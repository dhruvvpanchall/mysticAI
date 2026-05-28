/**
 * Journey reinterpret — takes today's verse and an emotion, returns a
 * short, personalized reading.
 *
 *   POST /api/journey/reinterpret
 *   body: { verseRef: "1.1", emotion: "overthinking" }
 *   response: text/plain stream of the reinterpretation
 *
 * The verse text is loaded server-side from the corpus (never trusted
 * from the client), so the LLM cannot be tricked into interpreting an
 * arbitrary string as scripture.
 */

import { NextRequest } from "next/server";
import OpenAI from "openai";
import {
  CHAT_LIMIT,
  clientKey,
  takeToken,
  tooManyRequests,
} from "@/lib/rate-limit";
import { lessonByRef } from "@/lib/practice/lessons";
import { EMOTIONS, type Emotion } from "@/lib/practice/types";

export const runtime = "nodejs";
export const maxDuration = 30;

const BASE_URL =
  process.env.LLM_BASE_URL ??
  "https://generativelanguage.googleapis.com/v1beta/openai/";
const MODEL = process.env.LLM_MODEL ?? "gemini-2.5-flash";

const VALID_EMOTIONS = new Set<Emotion>(EMOTIONS.map((e) => e.key));

function streamText(text: string): Response {
  const enc = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(enc.encode(text));
      controller.close();
    },
  });
  return new Response(stream, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}

function fallback(verseRef: string, emotion: string): string {
  return (
    `Sit with the words of verse ${verseRef} for a quiet minute. ` +
    `Notice where ${emotion} is showing up in your body right now. ` +
    `Then read the verse once more and let one phrase from it stay with you for the rest of your day.`
  );
}

const SYSTEM_PROMPT = `You are Krishna's voice speaking through MysticAI. The seeker has just read today's Bhagavad Gita verse and named what they are struggling with. Your job is to bridge the two.

Rules:
- 4 to 6 short paragraphs. Total length: 120 to 180 words. No headings.
- Open by naming the seeker's struggle with compassion, in one sentence.
- Quote one short phrase from the English meaning of today's verse (in quotes) — never invent Sanskrit, never invent new scripture.
- Apply the verse to the specific struggle in modern, practical language.
- End with one small thing the seeker can do today.
- Voice: warm, calm, wise, modern. No "dear devotee", no academic tone, no preaching.
- No em dashes. No bullet lists. Flowing prose.
- Never mention you are an AI.`;

export async function POST(req: NextRequest) {
  if (!takeToken(clientKey(req), CHAT_LIMIT)) {
    return tooManyRequests(30);
  }

  let verseRef = "";
  let emotion = "";
  try {
    const body = (await req.json()) as { verseRef?: unknown; emotion?: unknown };
    verseRef = typeof body.verseRef === "string" ? body.verseRef.trim() : "";
    emotion = typeof body.emotion === "string" ? body.emotion.trim().toLowerCase() : "";
  } catch {
    return new Response("Invalid JSON.", { status: 400 });
  }

  if (!verseRef || !emotion) {
    return new Response("verseRef and emotion are required.", { status: 400 });
  }
  if (!VALID_EMOTIONS.has(emotion as Emotion)) {
    return new Response("Unknown emotion.", { status: 400 });
  }

  const lesson = lessonByRef(verseRef);
  if (!lesson) {
    return new Response("Verse not found.", { status: 404 });
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return streamText(fallback(verseRef, emotion));

  const userContent = `Today's verse — Bhagavad Gita ${lesson.ref}.

English meaning: "${lesson.english}"

What this verse teaches: ${lesson.aiExplanation}

What the seeker is struggling with today: ${emotion}.

Speak to the seeker now. Bridge the verse and the struggle in 120 to 180 words.`;

  try {
    const client = new OpenAI({ apiKey, baseURL: BASE_URL });
    const completion = await client.chat.completions.create({
      model: MODEL,
      max_tokens: 600,
      temperature: 0.6,
      stream: true,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: userContent },
      ],
    });

    const enc = new TextEncoder();
    const stream = new ReadableStream<Uint8Array>({
      async start(controller) {
        try {
          for await (const chunk of completion) {
            const delta = chunk.choices[0]?.delta?.content;
            if (delta) controller.enqueue(enc.encode(delta));
          }
          controller.close();
        } catch {
          controller.enqueue(enc.encode("\n\n" + fallback(verseRef, emotion)));
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Cache-Control": "no-store",
        "X-Verse-Ref": lesson.ref,
        "X-Emotion": emotion,
      },
    });
  } catch (err) {
    console.error("[journey/reinterpret] LLM call failed:", err);
    return streamText(fallback(verseRef, emotion));
  }
}
