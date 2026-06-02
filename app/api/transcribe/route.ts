import { NextRequest } from "next/server";
import OpenAI from "openai";
import {
  TRANSCRIBE_LIMIT,
  clientKey,
  takeToken,
  tooManyRequests,
} from "@/lib/rate-limit";
import { getSTTEnv } from "@/lib/stt/env";
import { hasDevanagari } from "@/lib/i18n";

export const runtime = "nodejs";
export const maxDuration = 30;

/**
 * Speech-to-text endpoint.
 *
 * Accepts a multipart/form-data POST with a single `audio` file field
 * (webm/opus, mp4/aac, or ogg/opus — whichever the browser produced).
 * Forwards to Groq Whisper-large-v3-turbo via the OpenAI-compatible
 * audio.transcriptions API, then returns:
 *
 *   { text: string, lang: "en" | "hi" | "unknown" }
 *
 * Language detection here is best-effort: Whisper's verbose_json
 * response carries a language hint, but the chat route runs its own
 * lib/i18n.detectQueryLang on the transcript text (which also
 * distinguishes Hinglish), so this is just a coarse signal for the
 * client.
 *
 * Audio uploads are size-capped at 10MB defensively — at opus@32kbps,
 * 60s of speech is ~240KB, so a 10MB blob is an order of magnitude
 * larger than any legitimate single-utterance recording.
 */

const MAX_AUDIO_BYTES = 10 * 1024 * 1024;

export async function POST(req: NextRequest) {
  const gate = takeToken(`transcribe:${clientKey(req)}`, TRANSCRIBE_LIMIT);
  if (!gate.ok) return tooManyRequests(gate.retryAfterSec);

  const env = getSTTEnv();
  if (!env.apiKey) {
    return new Response("Transcription is not enabled (no API key).", {
      status: 503,
    });
  }

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return new Response("Expected multipart/form-data with an audio field.", {
      status: 400,
    });
  }

  const file = form.get("audio");
  if (!(file instanceof File) || file.size === 0) {
    return new Response("Missing audio file.", { status: 400 });
  }
  if (file.size > MAX_AUDIO_BYTES) {
    return new Response("Audio file is too large.", { status: 413 });
  }

  const client = new OpenAI({ apiKey: env.apiKey, baseURL: env.baseURL });

  try {
    // verbose_json gives us the detected language code alongside the
    // transcript. The OpenAI SDK types are tight on response_format, but
    // every shipped provider (OpenAI, Groq, local whisper.cpp) accepts
    // "verbose_json" — cast through unknown to silence the union check.
    const response = (await client.audio.transcriptions.create({
      file,
      model: env.model,
      response_format: "verbose_json" as unknown as "json",
    })) as unknown as { text?: string; language?: string };

    const text = String(response.text ?? "").trim();
    if (!text) {
      return new Response(
        JSON.stringify({ text: "", lang: "unknown" }),
        {
          status: 200,
          headers: {
            "Content-Type": "application/json; charset=utf-8",
            "Cache-Control": "no-store",
          },
        }
      );
    }

    // Whisper's `language` is the iso-639 name ("english", "hindi") or a
    // 2-letter code depending on the provider. We collapse to en / hi /
    // unknown. Anything else (script-level mix-ups like a Hinglish input
    // labeled "english") gets re-classified downstream by the chat route.
    const langHint = (response.language ?? "").toLowerCase();
    const lang: "en" | "hi" | "unknown" = hasDevanagari(text)
      ? "hi"
      : langHint === "hindi" || langHint === "hi"
        ? "hi"
        : langHint === "english" || langHint === "en"
          ? "en"
          : "unknown";

    return new Response(JSON.stringify({ text, lang }), {
      status: 200,
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Cache-Control": "no-store",
      },
    });
  } catch (err) {
    console.error("[transcribe] Whisper call failed:", err);
    return new Response("Transcription failed.", { status: 502 });
  }
}
