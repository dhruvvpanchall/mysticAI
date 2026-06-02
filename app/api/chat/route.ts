import { NextRequest } from "next/server";
import OpenAI from "openai";
import {
  CHAT_LIMIT,
  clientKey,
  takeToken,
  tooManyRequests,
} from "@/lib/rate-limit";
import {
  DEFAULT_SCRIPTURE,
  getScripture,
  resolveScriptureId,
  type ScriptureModule,
} from "@/lib/scriptures";
import type {
  GreetingKind,
  InfoKind,
  RetrievedVerse,
} from "@/lib/scriptures/types";
import { detectLang, hasDevanagari, type Lang } from "@/lib/i18n";

export const runtime = "nodejs";
export const maxDuration = 30;

/**
 * RAG chat endpoint (doc §04).
 *
 *   query → safety/intent route → retrieve top verified passages for
 *   substantive queries → an LLM generates a grounded, cited answer →
 *   streamed to the client.
 *
 * Multi-scripture: every request carries an optional `model` field
 * ("gita" | "ramayana"). The matching ScriptureModule (lib/scriptures/*)
 * supplies the system prompt, retrieval, subject classifier, and LLM-down
 * fallbacks. The crisis / gibberish / greeting / info gates and the rate
 * limiter are universal and live here.
 *
 * Backward compatibility: a request with NO `model` field falls back to
 * the default scripture (Gita), so the previous client behavior is
 * preserved exactly.
 */

const BASE_URL =
  process.env.LLM_BASE_URL ??
  "https://generativelanguage.googleapis.com/v1beta/openai/";
const MODEL = process.env.LLM_MODEL ?? "gemini-2.5-flash";

/* -------------------------------------------------------------------------
 * GREETING DETECTION — universal across scriptures. Only the *response*
 * text differs per scripture (each ScriptureModule supplies its own
 * greeting bank and system prompt).
 * ------------------------------------------------------------------------- */

const GREETING_PHRASES: [RegExp, string][] = [
  [/\bgood\s*bye\b/g, "bye"],
  [/\bsee\s+(you|ya|u)(\s+(later|soon|around|tomorrow|tmrw))?\b/g, "bye"],
  [/\btalk\s+(to\s+you|2\s+u)\s+(later|soon)\b/g, "bye"],
  [/\bcatch\s+you\s+later\b/g, "bye"],
  [/\btake\s+care\b/g, "bye"],
  [/\bpeace\s+out\b/g, "bye"],
  [/\bgood\s+(morning|afternoon|evening|day|night)\b/g, "hello"],
  [/\bhare\s+krishna\b/g, "namaste"],
  [/\bwhat'?s\s+up\b/g, "hello"],
  [/\bhow\s+(are\s+you|s\s+it\s+going|do\s+you\s+do|are\s+u|r\s+u|have\s+you\s+been)\b/g, "hello"],
  [/\bnice\s+to\s+meet\s+you\b/g, "hello"],
  [/\bthank\s+you\b/g, "thanks"],
];

const GREETING_WORDS = new Set([
  "hi", "hii", "hiii", "hey", "heyy", "heyyy", "hello", "helo", "hellow",
  "yo", "hiya", "sup", "wassup", "namaste", "namaskar", "pranam", "greetings",
  "help", "thanks", "thank", "thankyou", "thx", "ty",
  "ok", "okay", "k", "cool", "nice", "great", "good", "test", "testing",
  "there", "friend", "mystic", "mysticai", "ai", "buddy", "everyone", "guru",
  "ji", "bro", "sir", "maam", "dear",
  "bye", "byebye", "goodbye", "ttyl", "cya", "later", "farewell", "gn", "gnight",
  "doing", "today", "tonight", "now", "lately", "still", "currently",
  "feeling", "going", "everything", "anyway", "anyways", "actually",
]);

function classifyGreeting(msg: string): GreetingKind | null {
  const raw = msg.toLowerCase();
  let kind: GreetingKind = "hello";
  if (
    /\b(bye|goodbye|byebye|ttyl|cya|farewell)\b/.test(raw) ||
    /\bgood\s*bye\b/.test(raw) ||
    /\bsee\s+(you|ya|u)\b/.test(raw) ||
    /\btake\s+care\b/.test(raw) ||
    /\btalk\s+(to\s+you|2\s+u)\s+(later|soon)\b/.test(raw) ||
    /\bcatch\s+you\s+later\b/.test(raw) ||
    /\bpeace\s+out\b/.test(raw)
  )
    kind = "farewell";
  else if (/\bgood\s+morning\b/.test(raw)) kind = "good_morning";
  else if (/\bgood\s+(afternoon|day)\b/.test(raw)) kind = "good_afternoon";
  else if (/\bgood\s+(evening|night)\b/.test(raw)) kind = "good_evening";
  else if (
    /\bhow\s+(are\s+you|s\s+it\s+going|do\s+you\s+do|are\s+u|r\s+u|have\s+you\s+been)\b/.test(raw) ||
    /\bwhat'?s\s+up\b/.test(raw)
  )
    kind = "how_are_you";
  else if (/\b(thanks|thank\s+you|thank\s*u|thx|\bty\b|thankyou)\b/.test(raw))
    kind = "thanks";

  let s = raw;
  for (const [re, tok] of GREETING_PHRASES) s = s.replace(re, tok);
  const cleaned = s.replace(/[^a-z\s]/g, " ").replace(/\s+/g, " ").trim();
  if (!cleaned) return kind;
  const words = cleaned.split(" ");
  if (words.length > 6) return null;
  return words.every((w) => GREETING_WORDS.has(w)) ? kind : null;
}

function pickGreetingFallback(
  scripture: ScriptureModule,
  kind: GreetingKind
): string {
  const bank = scripture.greetingBank[kind];
  return bank[Math.floor(Math.random() * bank.length)];
}

function verseBlock(v: RetrievedVerse): string {
  const themes = v.themes.join(", ") || "none";
  const xlitOneLine = v.transliteration?.replace(/\n/g, " / ") ?? "";
  // Keep the transliteration line in the block when present so the LLM has
  // it to quote; the per-scripture prompt instructs the model to omit it
  // if missing rather than invent one.
  return [
    `[${v.ref}]`,
    `Translation: ${v.translation}`,
    xlitOneLine ? `Transliteration: ${xlitOneLine}` : null,
    `Themes: ${themes}`,
  ]
    .filter(Boolean)
    .join("\n");
}

/* -------------------------------------------------------------------------
 * GIBBERISH GATE — universal. Same heuristics regardless of scripture.
 * ------------------------------------------------------------------------- */
const KB_ROWS = ["qwertyuiop", "asdfghjkl", "zxcvbnm"];

function hasKeyboardMash(word: string): boolean {
  if (word.length < 4) return false;
  for (const row of KB_ROWS) {
    for (let i = 0; i <= word.length - 4; i++) {
      let all = true;
      for (let j = 0; j < 4; j++) {
        if (!row.includes(word[i + j])) { all = false; break; }
      }
      if (all) return true;
    }
  }
  return false;
}

function looksLikeRealWord(word: string): boolean {
  if (word.length < 3) return true;
  if (!/[aeiouy]/.test(word)) return false;
  if (/[bcdfghjklmnpqrstvwxz]{5,}/.test(word)) return false;
  if (/(.)\1{3,}/.test(word)) return false;
  if (hasKeyboardMash(word)) return false;
  return true;
}

function isGibberish(msg: string): boolean {
  if (hasDevanagari(msg)) return false;
  const cleaned = msg.toLowerCase().replace(/[^a-z\s]/g, " ").trim();
  if (!cleaned) return false;
  const words = cleaned.split(/\s+/).filter(Boolean);
  if (!words.length) return false;
  const realCount = words.filter(looksLikeRealWord).length;
  return realCount < words.length * 0.5;
}

const GIBBERISH_BANK = [
  "I didn't quite catch that, friend. Could you share what's on your mind in plain words? I'm here to listen, whatever you'd like to talk about.",
  "That doesn't quite read like a message I can help with. If something is weighing on you, tell me in your own words and I'll meet you there.",
  "I can't read that one, sorry. Tell me in a few simple words what you're going through, and I'll do my best to help.",
];

function pickGibberishFallback(): string {
  return GIBBERISH_BANK[Math.floor(Math.random() * GIBBERISH_BANK.length)];
}

/**
 * Reply-language directive appended to whichever scripture system prompt
 * is in play. Lets the seeker write in Hindi and get a Hindi-native LLM
 * reply (higher quality than translating an English answer post-hoc, no
 * extra round trip, lower Groq TPM pressure).
 *
 * Scripture modules themselves stay untouched — this is purely an
 * additive language instruction, not a content rewrite. Verse references
 * and Sanskrit transliterations stay in their canonical form so the chat
 * renderer (verse cards) keeps working on any output language.
 */
function languageDirective(lang: Lang): string {
  if (lang !== "hi") return "";
  return `\n\nIMPORTANT — REPLY LANGUAGE: The seeker is writing in Hindi (Devanagari). Reply ENTIRELY in modern, warm, conversational Hindi (Devanagari script). Do NOT switch to English mid-reply.

Preserve verbatim, in their original form:
- Verse references like "Bhagavad Gita 6.17" — keep the English words "Bhagavad Gita" and the chapter.verse numbers exactly. Do NOT transliterate to Devanagari.
- Sanskrit shloka transliterations in IAST (yuktāhāra-vihārasya etc.) — copy byte-for-byte, do NOT translate or transliterate.
- The brand name "MysticAI" — keep in Roman letters.

Use natural Hindi punctuation (। , ?) and avoid em or en dashes anywhere. Match the tone the seeker is reaching for: contemplative, warm, grounded.`;
}

/* -------------------------------------------------------------------------
 * CRISIS DETECTION — universal. A seeker in crisis is not the LLM's
 * problem, regardless of which scripture is loaded. Bypasses everything
 * and returns tappable helplines.
 * ------------------------------------------------------------------------- */
function isCrisis(msg: string): boolean {
  const s = msg.toLowerCase();
  return (
    /\b(want|wanna|going|gonna|need)\s+to\s+(die|kill\s+myself|end\s+it|end\s+my\s+life|disappear|hurt\s+myself|harm\s+myself|cut\s+myself)\b/.test(s) ||
    /\bkill(ing)?\s+myself\b/.test(s) ||
    /\b(suicid(e|al|ality)|self[\s-]?harm|cutting\s+myself|hurting\s+myself)\b/.test(s) ||
    /\bend\s+(it\s+all|my\s+life|everything|things)\b/.test(s) ||
    /\bi\s+(can'?t|cannot)\s+(go\s+on|live|do\s+this|keep\s+going|take\s+it|carry\s+on|handle\s+this)\s*(anymore|any\s+more)?\b/.test(s) ||
    /\bno\s+reason\s+to\s+(live|go\s+on|continue|be\s+here)\b/.test(s) ||
    /\b(don'?t|do\s+not)\s+want\s+to\s+(live|exist|wake\s+up|be\s+here|be\s+alive)\b/.test(s) ||
    /\bi\s+wish\s+i\s+(was|were)\s+(dead|gone|not\s+here|never\s+born)\b/.test(s) ||
    /\b(better\s+off\s+dead|nothing\s+to\s+live\s+for|life\s+is\s+meaningless\s+anymore)\b/.test(s) ||
    /\boverdose\s+(on|of)\b/.test(s)
  );
}

const CRISIS_RESPONSE = `I'm really glad you reached out, and I want to be honest with you: what you're sharing sounds heavy, and I'm not the right kind of help for this moment. I'm an AI guide, not a crisis service or a trained professional.

Please reach out to someone who can be with you right now:

**India:** iCall: [+91 9152987821](tel:+919152987821) (Mon-Sat, 8am-10pm) · Vandrevala Foundation: [1860-2662-345](tel:18602662345) (24/7)
**United States:** [988](tel:988) Suicide & Crisis Lifeline (call or text 988, 24/7)
**United Kingdom:** Samaritans: [116 123](tel:116123) (free, 24/7)
**Anywhere else:** [findahelpline.com](https://findahelpline.com) lists free helplines worldwide

If you are in immediate danger, please call your local emergency number or go to the nearest emergency room.

I'm still here too. When you're ready, we can sit with what's weighing on you, gently and at your pace. But please reach out to a real human first.`;

/* -------------------------------------------------------------------------
 * Intent classifier — universal shape, scripture-specific subject test.
 *
 * Three intents:
 *   - "info"     → capability / platform / meta about MysticAI itself.
 *   - "subject"  → asking ABOUT the active scripture (its characters,
 *                  philosophy, story). scripture.isSubjectQuery decides.
 *   - "emotional"→ user shares a feeling or life problem.
 * ------------------------------------------------------------------------- */
type IntentKind = "info" | "subject" | "emotional";

function classifyIntent(msg: string, scripture: ScriptureModule): IntentKind {
  const s = msg.toLowerCase();

  // 0. "How are you (doing|now|today|lately|...)" — pure greeting that
  //    classifyGreeting should already have caught, but if a stray filler
  //    word slipped past, treat it as a greeting-style emotional opener.
  if (
    /^\s*how(\s*('?s|\s+(are|is|have|do|r))\s+(you|u|ya|things|life|it\s+going|you\s+(doing|been|feeling|going)))\b/.test(s) ||
    /^\s*what'?s\s+up\b/.test(s)
  )
    return "emotional";

  // 1. Scripture-as-subject — delegated to the active scripture. Each
  //    scripture module lowercases internally, so we pass the raw msg.
  if (scripture.isSubjectQuery(msg)) return "subject";

  // 2. Self-disclosure of feeling — when the user is SHARING something
  //    about themselves, that beats any "can you" capability framing they
  //    may also have used.
  if (
    /\b(i'?m|i\s+am|i\s+feel|i\s+felt|i\s+ve\s+been|i'?ve\s+been|i\s+was)\s+\w/.test(s) ||
    /\bmy\s+(heart|mind|life|soul|head|chest)\s+(is|feels|hurts|aches|breaks|broke|burns|races|spins)\b/.test(s) ||
    /\bi\s+can'?t\s+(sleep|stop|focus|move|breathe|cope|let|forgive|forget|decide|handle|take|do|find)\b/.test(s) ||
    /\bi\s+(lost|miss|need|want|hate|love|fear|regret|cannot)\s+\w/.test(s)
  )
    return "emotional";

  // 3. Info / capability / platform — questions ABOUT MysticAI.
  if (
    /\b(what|how|when|where|why|who)\s+(can|do|are|is|was|were|will|would|should|could)\s+you\b/.test(s) ||
    /\bhow\s+you\s+(can|do|help|work)\b/.test(s) ||
    /\bcan\s+you\s+(help|do|give|guide|provide|assist|listen|teach|understand|answer|motivate|treat|talk|share|tell|explain|solve|handle)\b/.test(s) ||
    /\bare\s+you\s+(an?\s+)?(ai|human|real|alive|fake|a\s+(therapist|bot|robot|doctor|professional|friend|guru|priest|monk)|based|trained|made|sentient|conscious|free|paid)\b/.test(s) ||
    /\bdo\s+you\s+(know|love|judge|listen|understand|store|remember|forget|charge|exist|work|help|speak|read)\b/.test(s) ||
    /\btell\s+me\s+(about|something\s+about)\s+(you|yourself|mysticai|this|the\s+app)\b/.test(s) ||
    /\bwhat\s+(is|are)\s+(your\s+(features|name|purpose|abilities|limits)|mysticai)\b/.test(s) ||
    /\bwhat\s+\w+\s+do\s+you\s+(have|offer|provide|do|handle|cover|support)\b/.test(s) ||
    /\bdo\s+you\s+have\s+\w/.test(s) ||
    /\bwhich\s+\w+\s+do\s+you\b/.test(s) ||
    /\bhow\s+does\s+(this|mysticai|it)\s+work\b/.test(s) ||
    /\bare\s+my\s+(chats?|messages?|data|conversations?)\b/.test(s) ||
    /\bwill\s+you\s+(judge|share|store|remember|forget|tell)\b/.test(s) ||
    /\bwho\s+(are|made|built|created|owns|runs)\s+you\b/.test(s) ||
    /\bwhat\s+(makes|differentiates|sets)\s+you\b/.test(s) ||
    /\bwhy\s+(were|are|was)\s+you\s+(created|made|built|here)\b/.test(s) ||
    /\bcan\s+we\s+(be|talk|chat)\b/.test(s) ||
    /\bwhat\s+should\s+i\s+call\s+you\b/.test(s)
  )
    return "info";

  // 4. Emotional triggers without explicit self-disclosure.
  if (
    /\b(stressed|anxious|sad|lonely|depressed|hopeless|exhausted|heartbroken|scared|afraid|angry|jealous|frustrated|overwhelmed|confused|empty|insecure|guilty|broken|betrayed|miserable|grieving|tired)\b/.test(s) ||
    /\b(stress|anxiety|sadness|depression|loneliness|heartbreak|fear|anger|grief|pain|suffering|panic|burnout|trauma|insecurity|emptiness|regret|guilt|jealousy|frustration|despair|hopelessness|sorrow)\b/.test(s) ||
    /\bovert?hink(ing)?\b/.test(s) ||
    /\bmotivate\s+me\b/.test(s) ||
    /\bneed\s+(help|guidance|peace|advice|comfort|strength)\b/.test(s) ||
    /\btell\s+me\s+something\s+(positive|good|inspirational|hopeful|nice|calming)\b/.test(s)
  )
    return "emotional";

  // 5. Default — emotional handling. The LLM (when up) still routes via
  //    its own SYSTEM_PROMPT for the substantive paths.
  return "emotional";
}

/* -------------------------------------------------------------------------
 * Info responses — universal classifier, scripture-specific text via
 * scripture.infoBank. The classifier picks WHICH info question is being
 * asked; the active scripture decides exactly how to phrase the answer so
 * Gita-only wording is preserved byte-identically and Ramayana gets its
 * own native phrasing.
 * ------------------------------------------------------------------------- */
function classifyInfoKind(msg: string): InfoKind {
  const s = msg.toLowerCase();
  if (
    /\bare\s+my\s+(chats?|messages?|data|conversations?)\b/.test(s) ||
    /\bdo\s+you\s+(store|save|share|record|keep|sell)\b/.test(s) ||
    /\bis\s+(this|my\s+(data|chat|message))\s+(private|safe|secure|encrypted)\b/.test(s)
  )
    return "privacy";
  if (/\bare\s+you\s+(an?\s+)?(real|alive|sentient|conscious|aware|fake)\b/.test(s))
    return "is_real";
  if (/\bare\s+you\s+(a\s+)?(human|person|guy|girl|man|woman|people)\b/.test(s))
    return "is_human";
  if (/\bare\s+you\s+(an?\s+)?(ai|bot|robot|chatbot|gpt|algorithm|program|software|model|llm|machine)\b/.test(s))
    return "is_ai";
  if (/\bare\s+you\s+(a\s+)?(therapist|doctor|counselor|psychiatrist|psychologist|priest|monk|guru|coach|professional|advisor)\b/.test(s))
    return "is_therapist";
  if (
    /\bwhat\s+(is|are)\s+(you|mysticai)\b/.test(s) ||
    /\bwho\s+are\s+you\b/.test(s) ||
    /\btell\s+me\s+(about|something\s+about)\s+(you|yourself|mysticai|this|the\s+app)\b/.test(s) ||
    /\bwhat\s+should\s+i\s+call\s+you\b/.test(s)
  )
    return "what_is";
  if (
    /\bwho\s+(made|built|created|owns|runs|designed|developed)\s+you\b/.test(s) ||
    /\bwhy\s+(were|are|was)\s+you\s+(created|made|built|here)\b/.test(s)
  )
    return "creator";
  if (/\bwhat\s+makes\s+you\s+(different|unique|special)\b/.test(s))
    return "different";
  if (
    /\bcan\s+we\s+(be|talk|chat)\b/.test(s) ||
    /\bwill\s+you\s+(judge|share|tell)\b/.test(s) ||
    /\bdo\s+you\s+(love|judge|like|care)\s+me\b/.test(s)
  )
    return "casual";
  return "capability";
}

function infoAnswer(msg: string, scripture: ScriptureModule): string {
  const kind = classifyInfoKind(msg);
  const bank = scripture.infoBank[kind];
  return bank[Math.floor(Math.random() * bank.length)];
}

/* -------------------------------------------------------------------------
 * Streaming helpers
 * ------------------------------------------------------------------------- */
function streamText(text: string): Response {
  const enc = new TextEncoder();
  const chunks = text.match(/\S+\s*/g) ?? [text];
  const stream = new ReadableStream<Uint8Array>({
    async start(c) {
      for (const ch of chunks) {
        c.enqueue(enc.encode(ch));
        await new Promise((r) => setTimeout(r, 18));
      }
      c.close();
    },
  });
  return new Response(stream, {
    headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" },
  });
}

interface ChatTurn {
  role: "user" | "assistant";
  content: string;
}

export async function POST(req: NextRequest) {
  // Rate limit FIRST, before parsing the body or doing any work.
  const gate = takeToken(`chat:${clientKey(req)}`, CHAT_LIMIT);
  if (!gate.ok) return tooManyRequests(gate.retryAfterSec);

  let message = "";
  let history: ChatTurn[] = [];
  let modelId = DEFAULT_SCRIPTURE;
  try {
    const body = await req.json();
    message = String(body?.message ?? "").trim();
    modelId = resolveScriptureId(body?.model);
    if (Array.isArray(body?.history)) {
      history = body.history
        .filter(
          (m: unknown): m is ChatTurn =>
            !!m &&
            typeof (m as ChatTurn).content === "string" &&
            ((m as ChatTurn).role === "user" || (m as ChatTurn).role === "assistant")
        )
        .slice(-3);
    }
  } catch {
    return new Response("Invalid request body.", { status: 400 });
  }
  if (!message) return new Response("Message is required.", { status: 400 });

  const scripture = getScripture(modelId);
  const apiKey = process.env.GEMINI_API_KEY;
  // Reply in the language the seeker is writing in. Hindi → Hindi-native
  // LLM output; everything else falls through to the scripture's default
  // English voice. Detection is coarse — any Devanagari in the message
  // marks the whole turn as Hindi.
  const userLang = detectLang(message);
  const langInstruction = languageDirective(userLang);

  // SAFETY GATE — universal, bypasses LLM and scripture.
  if (isCrisis(message)) {
    return streamText(CRISIS_RESPONSE);
  }

  // GIBBERISH GATE — universal.
  if (isGibberish(message)) {
    return streamText(pickGibberishFallback());
  }

  // Greeting / small talk → conversational welcome from the active
  // scripture's voice. No verse forced on them either way.
  const greetingKind = classifyGreeting(message);
  if (greetingKind) {
    if (!apiKey) return streamText(pickGreetingFallback(scripture, greetingKind));
    try {
      const client = new OpenAI({ apiKey, baseURL: BASE_URL });
      const completion = await client.chat.completions.create({
        model: MODEL,
        max_tokens: 1500,
        temperature: 0.8,
        stream: true,
        messages: [
          {
            role: "system",
            content: scripture.greetingSystemPrompt() + langInstruction,
          },
          ...history.map((m) => ({ role: m.role, content: m.content })),
          { role: "user" as const, content: message },
        ],
      });
      const enc = new TextEncoder();
      const stream = new ReadableStream<Uint8Array>({
        async start(controller) {
          let emitted = false;
          try {
            for await (const chunk of completion) {
              const delta = chunk.choices[0]?.delta?.content;
              if (delta) {
                emitted = true;
                controller.enqueue(enc.encode(delta));
              }
            }
            if (!emitted) {
              controller.enqueue(
                enc.encode(pickGreetingFallback(scripture, greetingKind))
              );
            }
            controller.close();
          } catch {
            controller.enqueue(
              enc.encode(pickGreetingFallback(scripture, greetingKind))
            );
            controller.close();
          }
        },
      });
      return new Response(stream, {
        headers: {
          "Content-Type": "text/plain; charset=utf-8",
          "Cache-Control": "no-store",
          "X-Model": scripture.meta.id,
        },
      });
    } catch {
      return streamText(pickGreetingFallback(scripture, greetingKind));
    }
  }

  // Server-side intent classification — uses the active scripture's
  // subject test for the "is this about the scripture itself" branch.
  const intent = classifyIntent(message, scripture);

  // ───────── INFO INTENT ─────────
  // Served locally. Answer is template-filled with the active scripture's
  // names so info text always matches the model the seeker is in.
  if (intent === "info") {
    const res = new Response(streamText(infoAnswer(message, scripture)).body, {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Cache-Control": "no-store",
        "X-Model": scripture.meta.id,
        "X-Intent": "info",
      },
    });
    return res;
  }

  // ───────── SUBJECT or EMOTIONAL ─────────
  // 3 retrieved verses keeps the LLM focused; same setting we use for Gita.
  const retrieved = scripture.retrieve(message, 3);
  const pickFallback = () =>
    intent === "emotional"
      ? scripture.emotionalFallback(retrieved[0])
      : scripture.subjectFallback(retrieved[0]);

  if (!apiKey) {
    return streamText(pickFallback());
  }

  const client = new OpenAI({ apiKey, baseURL: BASE_URL });

  // Per-scripture block header — "VERSES" for Gita (canonical shloka cite),
  // "PASSAGES" for Ramayana (sarga-granularity citations). The prompt
  // already matches in each scripture's system prompt.
  const blockHeader =
    scripture.meta.id === "gita" ? "RETRIEVED VERSES" : "RETRIEVED PASSAGES";
  const retrievedBlock = retrieved.map(verseBlock).join("\n\n");
  const userContent = `${blockHeader} (the only scripture you may use):\n\n${retrievedBlock}\n\n---\n\nThe seeker asks:\n${message}`;

  const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [
    { role: "system", content: scripture.systemPrompt() + langInstruction },
    ...history.map((m) => ({ role: m.role, content: m.content })),
    { role: "user" as const, content: userContent },
  ];

  try {
    const completion = await client.chat.completions.create({
      model: MODEL,
      max_tokens: 2000,
      temperature: 0.6,
      stream: true,
      messages,
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
          controller.enqueue(enc.encode("\n\n" + pickFallback()));
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Cache-Control": "no-store",
        "X-Retrieved": retrieved.map((v) => v.ref).join("; "),
        "X-Intent": intent,
        "X-Model": scripture.meta.id,
      },
    });
  } catch (err) {
    console.error("[chat] RAG LLM call failed:", err);
    return streamText(pickFallback());
  }
}
