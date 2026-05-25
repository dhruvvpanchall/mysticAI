import { NextRequest } from "next/server";
import { createHash } from "node:crypto";
import OpenAI from "openai";
import { doc, getDoc, setDoc, serverTimestamp } from "firebase/firestore";
import { getFirebaseDb, isFirebaseConfigured } from "@/lib/firebase";
import {
  TRANSLATE_LIMIT,
  clientKey,
  takeToken,
  tooManyRequests,
} from "@/lib/rate-limit";

export const runtime = "nodejs";
export const maxDuration = 30;

/**
 * Bump this whenever the translation system prompt or sanitization logic
 * changes. The version is folded into the cache key, so old (possibly bad)
 * entries are atomically ignored without needing to wipe Firestore. A prior
 * LLM glitch had poisoned the `who are you?` Hindi translation across users;
 * v2 is the first version that ships the streaming + validation guards.
 */
const CACHE_VERSION = "v2";

/**
 * Content-addressed cache key. Same (version, lang, text) from any seeker
 * hits the same Firestore doc — translation is deterministic enough that
 * sharing across users is correct and saves repeated LLM calls.
 */
function cacheKey(lang: string, text: string): string {
  return createHash("sha256")
    .update(`${CACHE_VERSION}\n${lang}\n${text}`)
    .digest("hex");
}

/**
 * Reject obvious non-translations before writing them to the shared cache.
 * The LLM occasionally answers the message instead of translating it (the
 * exact failure mode that the `who are you?` Hindi card showed). These
 * checks aren't bulletproof — they're floor guards so a single bad run
 * cannot get pinned in the global cache for every future seeker.
 */
function isValidTranslation(
  text: string,
  lang: string,
  source: string
): boolean {
  if (!text || text.trim().length === 0) return false;
  // Hindi must actually be Devanagari.
  if (lang === "hi" && !/[ऀ-ॿ]/.test(text)) return false;
  // Length-ratio sanity check. A genuine translation usually lands within
  // 0.5x–3x the source length. The actual `who are you?` failure was the
  // LLM emitting a 2-sentence meta-response (~120 chars) for a 285-char
  // source — ratio ~0.4, caught here. Short inputs get a 30-char floor so
  // greetings ("Hi") with a slightly longer Hindi welcome aren't rejected.
  const srcLen = Math.max(source.length, 30);
  if (text.length < srcLen * 0.5) return false;
  if (text.length > srcLen * 3 + 200) return false;
  return true;
}

async function readCache(key: string): Promise<string | null> {
  if (!isFirebaseConfigured()) return null;
  try {
    const snap = await getDoc(doc(getFirebaseDb(), "translations", key));
    if (!snap.exists()) return null;
    const data = snap.data();
    return typeof data?.translation === "string" ? data.translation : null;
  } catch (err) {
    console.error("[translate] cache read failed:", err);
    return null;
  }
}

async function writeCache(
  key: string,
  lang: string,
  translation: string
): Promise<void> {
  if (!isFirebaseConfigured()) return;
  try {
    await setDoc(doc(getFirebaseDb(), "translations", key), {
      lang,
      translation,
      createdAt: serverTimestamp(),
    });
  } catch (err) {
    console.error("[translate] cache write failed:", err);
  }
}

/**
 * Translates an assistant reply into a target language (currently Hindi).
 * Uses the same provider as /api/chat (see GEMINI_API_KEY / LLM_BASE_URL /
 * LLM_MODEL). Streams the translation so the UI can show it progressively.
 *
 * The prompt is strict about preserving markdown structure and the verse
 * reference / Sanskrit transliteration so the chat renderer (verse cards,
 * bold/italic) keeps working on the translated text.
 */

const BASE_URL =
  process.env.LLM_BASE_URL ??
  "https://generativelanguage.googleapis.com/v1beta/openai/";
const MODEL = process.env.LLM_MODEL ?? "gemini-2.5-flash";

interface LangSpec {
  name: string;
  script: string;
  note: string;
}

const LANGS: Record<string, LangSpec> = {
  hi: {
    name: "Hindi",
    script: "Devanagari",
    note: "Use warm, simple, conversational Hindi that ordinary readers understand — not heavily Sanskritized or overly formal.",
  },
};

function systemPrompt(lang: LangSpec): string {
  return `You translate text from English into ${lang.name} (${lang.script} script) for a Bhagavad Gita spiritual guidance app.

ABSOLUTE RULES — follow every one:

1. TRANSLATE ONLY WHAT IS GIVEN. Do NOT add any content that is not in the input.
   - Do NOT invent, fabricate, or add a Bhagavad Gita verse, citation, blockquote, or Sanskrit line if the input has none. If the input is a plain greeting or simple conversation, the output is also a plain greeting or simple conversation in ${lang.name} — nothing more.
   - Do NOT add "Bhagavad Gita X.Y" references that don't appear in the input.
   - Do NOT add a \`>\` blockquote line that doesn't appear in the input.
   - Do NOT add a Sanskrit transliteration line if the input has none.
   - The number of paragraphs, blockquotes, and lines in the OUTPUT must match the INPUT exactly. If the input has zero blockquotes, the output has zero blockquotes.

2. Preserve ALL markdown structure exactly: blockquote lines (starting with \`>\`), \`**bold**\` markers, \`_italic_\` markers, blank lines, paragraph breaks. Same count as input.

3. Do NOT translate verse references. \`**Bhagavad Gita 3.35**\` stays as \`**Bhagavad Gita 3.35**\` — keep the English words "Bhagavad Gita" and the chapter:verse numbers EXACTLY.

3b. PRESERVE THE BRAND NAME. The product is called "MysticAI". Whenever this word appears in the input, copy it byte-for-byte in Roman letters — never transliterate it to Devanagari (NOT मिस्टिकएआई, NOT मिस्टिक एआई). Treat it like a proper noun written in English script that must survive the translation untouched.

4. When (and ONLY when) the input contains a verse blockquote with exactly THREE lines, keep them in this EXACT order and format:
   Line 1: \`> **Bhagavad Gita C.V**\`  — the reference, untouched.
   Line 2: \`> "translated verse text"\`  — translate this English text into ${lang.name} (${lang.script}), keep the surrounding straight quotes.
   Line 3: \`> _sanskrit transliteration_\`  — wrapped in single underscores; copy this line VERBATIM, byte for byte, including every diacritic (ā ī ū ṛ ṣ ṇ ḍ ḥ ṁ etc.). Do NOT translate, transliterate, retype, or alter it.

   NEVER swap, merge, or reorder these three lines. NEVER add a fourth line.

5. PRESERVE POINT OF VIEW. This is CRITICAL.
   - First-person English ("I", "me", "my", "I'm", "I am") = the AI speaking about ITSELF. Translate as first-person (मैं / मुझे / मेरा / मैं हूँ). NEVER flip to second-person.
   - Second-person English ("you", "your", "you're", "you are") = the AI addressing the SEEKER. Translate as second-person formal (आप / आपका / आप हैं).
   - "I am well" → "मैं अच्छा हूँ" or "मैं ठीक हूँ" — NEVER "आप अच्छे हैं" (that means YOU are well, totally wrong).
   - "I am grateful" → "मैं आभारी हूँ" — NEVER "आप आभारी हैं".
   - "I sense" → "मुझे लगता है" or "मैं अनुभव करता हूँ" — NEVER "आप अनुभव करते हैं".
   - Whoever is the subject of the English sentence is the subject of the ${lang.name} sentence. Do not swap speaker and listener.

6. ${lang.note}

7. Keep the warm, grounded tone of the original.

8. Output ONLY the translated text — no preamble, no notes, no "Translation:" header, no surrounding commentary.

EXAMPLE A — plain greeting, AI speaking about itself in first person (notice "I am" → "मैं हूँ", NOT "आप हैं"):

INPUT:
I am well and grateful for this moment to connect with you. As we come together, I sense that you may be seeking guidance or clarity on something. If there's something on your mind that you'd like to explore, I'm here to listen and offer support.

OUTPUT:
मैं अच्छा हूँ और इस क्षण आपसे जुड़ने के लिए आभारी हूँ। जब हम एक साथ आते हैं, मुझे लगता है कि शायद आप किसी बात पर मार्गदर्शन या स्पष्टता खोज रहे हैं। यदि आपके मन में कोई बात है जिसे आप जानना चाहेंगे, तो मैं यहाँ हूँ, सुनने और सहायता देने के लिए।

EXAMPLE B — short welcome, mixed first and second person:

INPUT:
Welcome. I'm happy to be with you in this moment. Is there something on your mind that you'd like to share or explore?

OUTPUT:
स्वागत है। इस क्षण में आपके साथ होकर मुझे खुशी है। क्या आपके मन में कोई बात है जिसे आप साझा करना या जानना चाहेंगे?

EXAMPLE C — answer with a verse, blockquote preserved exactly:

INPUT:
**Your mind is racing** with worry.

> **Bhagavad Gita 6.17**
> "Yoga becomes the destroyer of pain for him who is moderate in eating and recreation."
> _yuktāhāra-vihārasya yukta-cheṣhṭasya karmasu_

**What this means:** Krishna teaches that balance dissolves suffering.

OUTPUT:
**आपका मन दौड़ रहा है** चिंता से।

> **Bhagavad Gita 6.17**
> "योग उस व्यक्ति के लिए दुःख का नाश करने वाला बनता है जो खाने-पीने और मनोरंजन में संयम रखता है।"
> _yuktāhāra-vihārasya yukta-cheṣhṭasya karmasu_

**इसका अर्थ है:** कृष्ण सिखाते हैं कि संतुलन दुःख को मिटा देता है।`;
}

export async function POST(req: NextRequest) {
  const gate = takeToken(`translate:${clientKey(req)}`, TRANSLATE_LIMIT);
  if (!gate.ok) return tooManyRequests(gate.retryAfterSec);

  let text = "";
  let lang = "";
  try {
    const body = await req.json();
    text = String(body?.text ?? "").trim();
    lang = String(body?.lang ?? "").trim();
  } catch {
    return new Response("Invalid request body.", { status: 400 });
  }
  if (!text) return new Response("text is required.", { status: 400 });
  const spec = LANGS[lang];
  if (!spec)
    return new Response(`Unsupported language: ${lang}`, { status: 400 });

  // Check the Firestore cache before spending an LLM call. Cache key is
  // SHA-256(lang + "\n" + text) so same-input from any seeker hits the
  // same doc. Translations are deterministic enough to share globally.
  const key = cacheKey(lang, text);
  const cached = await readCache(key);
  if (cached) {
    return new Response(cached, {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Cache-Control": "no-store",
        "X-Cache": "HIT",
      },
    });
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey)
    return new Response("Translation is not enabled (no API key).", {
      status: 503,
    });

  const client = new OpenAI({ apiKey, baseURL: BASE_URL });

  // Pre-extract the ORIGINAL transliteration lines (the `> _..._` lines
  // inside each verse blockquote). Small LLMs cannot be trusted to copy
  // IAST diacritics byte-exact (ā ī ū ṛ ṣ ṇ ḍ ḥ ṁ get stripped or
  // turned into `?`). For a scripture app, the Sanskrit must be exact,
  // so after translation we splice the originals back in by position.
  const originalTranslits = extractTransliterations(text);
  const inputHadBlockquote = /^>\s/m.test(text);

  try {
    const completion = await client.chat.completions.create({
      model: MODEL,
      max_tokens: 4096,
      temperature: 0.3,
      stream: true,
      messages: [
        { role: "system", content: systemPrompt(spec) },
        { role: "user", content: text },
      ],
    });

    const enc = new TextEncoder();
    const stream = new ReadableStream<Uint8Array>({
      async start(controller) {
        let full = "";
        try {
          for await (const chunk of completion) {
            const delta = chunk.choices[0]?.delta?.content;
            if (delta) {
              full += delta;
              controller.enqueue(enc.encode(delta));
            }
          }
          controller.close();
        } catch (err) {
          console.error("[translate] stream error:", err);
          controller.error(err);
          return;
        }
        // Sanitize and cache AFTER the stream closes. The user already sees
        // the live tokens; this just controls what the next seeker gets.
        const sanitized = inputHadBlockquote ? full : stripBlockquotes(full);
        const cleaned = restoreTransliterations(sanitized, originalTranslits);
        if (isValidTranslation(cleaned, lang, text)) {
          void writeCache(key, lang, cleaned);
        } else {
          console.warn(
            "[translate] rejected invalid output; not caching",
            { lang, sourceLen: text.length, outLen: cleaned.length }
          );
        }
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Cache-Control": "no-store",
        "X-Cache": "MISS",
      },
    });
  } catch (err) {
    console.error("[translate] LLM call failed:", err);
    return new Response("Translation failed.", { status: 502 });
  }
}

/** Pull out every `> _..._` line, in order of appearance. */
function extractTransliterations(text: string): string[] {
  const out: string[] = [];
  for (const line of text.split("\n")) {
    const m = line.match(/^>\s*_(.+)_\s*$/);
    if (m) out.push(m[1]);
  }
  return out;
}

/** Drop every blockquote line (`> ...`). Used when the input had none —
 *  any blockquote in the output is a hallucination. Also collapses the
 *  blank line that often surrounded the fabricated quote. */
function stripBlockquotes(text: string): string {
  const out: string[] = [];
  let lastWasBlank = false;
  for (const line of text.split("\n")) {
    if (/^>\s?/.test(line)) continue;
    const isBlank = line.trim() === "";
    if (isBlank && lastWasBlank) continue;
    out.push(line);
    lastWasBlank = isBlank;
  }
  return out.join("\n").trim();
}

/** Replace each translated `> _..._` line with the originals, in order. */
function restoreTransliterations(text: string, originals: string[]): string {
  if (!originals.length) return text;
  let i = 0;
  return text
    .split("\n")
    .map((line) => {
      if (i >= originals.length) return line;
      if (/^>\s*_.+_\s*$/.test(line)) {
        const restored = `> _${originals[i]}_`;
        i++;
        return restored;
      }
      return line;
    })
    .join("\n");
}
