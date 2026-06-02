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
 * v2 added streaming + validation guards; v3 rewrote the prompt around
 * meaning-first translation; v4 adds the question→statement guard and a
 * greeting-question example after the model started answering "How's your
 * day going?" with "मेरा दिन अच्छा चल रहा है" instead of translating it.
 */
const CACHE_VERSION = "v4";

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
  // POV-swap guard for Hindi. The model occasionally flips the opening
  // "I'm doing well" into "आप अच्छे हैं" ("you are well"), which inverts
  // who the sentence is about. If the SOURCE opens with first-person
  // ("I'm/I am well/good/fine/doing well/great/okay") but the Hindi
  // OUTPUT opens with second-person ("आप ... हैं"), reject so the bad
  // text cannot get pinned in the global cache for future seekers.
  if (lang === "hi") {
    const srcOpensFirstPerson =
      /^\s*(?:i'?m|i\s+am)\s+(?:doing\s+)?(?:well|good|fine|great|okay|ok|alright|happy|grateful|here|glad)/i.test(
        source
      );
    const outOpensSecondPerson =
      /^\s*आप\s+\S{1,40}\s*(?:हैं|हो)/.test(text);
    if (srcOpensFirstPerson && outOpensSecondPerson) {
      console.warn(
        "[translate] rejected POV swap: source opens first-person, output opens second-person"
      );
      return false;
    }
    // Question → statement guard. The model occasionally ANSWERS a
    // greeting-question ("How's your day going?") instead of translating
    // it, producing a statement like "मेरा दिन अच्छा चल रहा है". If the
    // source contains a question mark or opens with an interrogative
    // word, the Hindi output MUST also contain a question mark.
    const srcHasQuestion =
      /[?？]/.test(source) ||
      /^\s*(?:how|what|when|where|why|who|which|whom|whose|are|is|do|does|did|can|could|will|would|should|may|might)\b/i.test(
        source.trim()
      );
    const outHasQuestion = /[?？]/.test(text);
    if (srcHasQuestion && !outHasQuestion) {
      console.warn(
        "[translate] rejected: source is a question but output is a statement",
        { source: source.slice(0, 80), output: text.slice(0, 80) }
      );
      return false;
    }
  }
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
    note: "Use modern, warm, conversational Hindi that ordinary readers understand — not heavily Sanskritized or overly formal.",
  },
};

function systemPrompt(lang: LangSpec): string {
  return `You are an expert ${lang.name} translator for spiritual, philosophical, and self-reflection content. You translate text from English into ${lang.name} (${lang.script} script) for the Bhagavad Gita guidance app MysticAI.

YOUR PHILOSOPHY — the spirit of every translation:

- Translate MEANING, CONTEXT, and EMOTIONAL INTENT — never word-for-word.
- The output must feel as though it was originally written in ${lang.name} by a thoughtful native speaker, not converted from English.
- Preserve the spiritual, reflective, contemplative tone of the source.
- ${lang.note}
- Adapt metaphors, idioms, and turns of phrase contextually whenever a direct rendering would sound foreign, mechanical, or stilted. Find the closest ${lang.name} expression that carries the same feeling.
- Maintain the same emotional impact, gravity, and warmth as the source text.
- Do NOT introduce new interpretations or omit important nuances.

METAPHOR ADAPTATION EXAMPLE — this is the standard:

INPUT:
The Gita is showing you what fear sounds like when it is dressed as commentary.

GOOD (meaning-first, native-feeling):
गीता दिखा रही है कि जब भय टिप्पणी या आलोचना का रूप धारण कर लेता है, तो उसकी आवाज़ कैसी होती है।

AVOID literal word-for-word renderings ("when fear is wearing the dress of commentary") that sound mechanical and break the spell.

STRUCTURAL RULES — non-negotiable, regardless of philosophy:

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
   Line 2: \`> "translated verse text"\`  — translate this English text into ${lang.name} (${lang.script}) with the meaning-first philosophy above; keep the surrounding straight quotes.
   Line 3: \`> _sanskrit transliteration_\`  — wrapped in single underscores; copy this line VERBATIM, byte for byte, including every diacritic (ā ī ū ṛ ṣ ṇ ḍ ḥ ṁ etc.). Do NOT translate, transliterate, retype, or alter it.

   NEVER swap, merge, or reorder these three lines. NEVER add a fourth line.

5. PRESERVE POINT OF VIEW. This is CRITICAL.
   - First-person English ("I", "me", "my", "I'm", "I am") = the AI speaking about ITSELF. Translate as first-person (मैं / मुझे / मेरा / मैं हूँ). NEVER flip to second-person.
   - Second-person English ("you", "your", "you're", "you are") = the AI addressing the SEEKER. Translate as second-person formal (आप / आपका / आप हैं).
   - "I am well" → "मैं अच्छा हूँ" or "मैं ठीक हूँ" — NEVER "आप अच्छे हैं" (that means YOU are well, totally wrong).
   - "I am grateful" → "मैं आभारी हूँ" — NEVER "आप आभारी हैं".
   - "I sense" → "मुझे लगता है" or "मैं अनुभव करता हूँ" — NEVER "आप अनुभव करते हैं".
   - Whoever is the subject of the English sentence is the subject of the ${lang.name} sentence. Do not swap speaker and listener.

5b. PRESERVE QUESTION vs STATEMENT. This is CRITICAL — equally important as POV.
   - If the source is a QUESTION (ends with "?" or starts with how / what / when / where / why / who / which / are / is / do / does / can / will / should), the ${lang.name} output MUST be a question, ending with "?".
   - If the source is a STATEMENT, the output must be a statement.
   - DO NOT ANSWER the question — translate it. "How's your day going?" is the AI asking the seeker about their day; it must become "आपका दिन कैसा चल रहा है?" — never "मेरा दिन अच्छा चल रहा है" (which means "my day is going well" — that would be ANSWERING the question, which is wrong).
   - "What's on your mind?" → "आपके मन में क्या है?" — NEVER "आपके मन में कुछ नहीं है" (a statement, an answer).
   - "Is something weighing on you?" → "क्या आप पर कुछ बोझ है?" — NEVER "हाँ, आप पर कुछ बोझ है" (an answer).

6. NO em dashes or en dashes anywhere in the ${lang.name} output. Use commas, full stops, or natural sentence breaks instead. Em dashes read as foreign punctuation in Hindi.

7. Output ONLY the translated text — no preamble, no notes, no "Translation:" header, no surrounding commentary.

QUALITY BAR — silently self-check each output before emitting:
- Does it sound like a native ${lang.name} speaker wrote it, or like a translation?
- Are metaphors and idioms rendered with their feeling intact, not their literal words?
- Is the spiritual, contemplative tone preserved?
- Does it carry the same emotional weight as the source?
If any answer is no, refine before emitting.

EXAMPLE A — the AI answering "how are you" about itself. The first sentence MUST be first-person ("मैं"). A real production failure had the model render "I'm doing well" as "आप अच्छे हैं" (you are well), inverting who the sentence describes. DO NOT do that.

INPUT:
I'm doing well, thank you for asking. I'm here to listen, learn, and help in any way I can. It's a pleasure to connect with you. What's on your mind, and how can I support you today?

OUTPUT:
मैं अच्छा हूँ, पूछने के लिए धन्यवाद। मैं यहाँ सुनने, सीखने और जिस तरह से भी संभव हो, आपकी सहायता करने के लिए हूँ। आपसे जुड़कर खुशी हो रही है। आपके मन में क्या है, और आज मैं आपकी किस तरह सहायता कर सकता हूँ?

EXAMPLE A2 — longer first-person greeting, same rule (notice every "I am / I sense / I'm" stays as "मैं / मुझे"):

INPUT:
I am well and grateful for this moment to connect with you. As we come together, I sense that you may be seeking guidance or clarity on something. If there's something on your mind that you'd like to explore, I'm here to listen and offer support.

OUTPUT:
मैं अच्छा हूँ और इस क्षण आपसे जुड़ने के लिए आभारी हूँ। जब हम एक साथ आते हैं, मुझे लगता है कि शायद आप किसी बात पर मार्गदर्शन या स्पष्टता खोज रहे हैं। यदि आपके मन में कोई बात है जिसे आप जानना चाहेंगे, तो मैं यहाँ हूँ, सुनने और सहायता देने के लिए।

EXAMPLE B — short welcome, mixed first and second person:

INPUT:
Welcome. I'm happy to be with you in this moment. Is there something on your mind that you'd like to share or explore?

OUTPUT:
स्वागत है। इस क्षण में आपके साथ होकर मुझे खुशी है। क्या आपके मन में कोई बात है जिसे आप साझा करना या जानना चाहेंगे?

EXAMPLE C — short greeting that ends with a question. The question MUST stay a question. A real production failure had the model render "How's your day going?" as "मेरा दिन अच्छा चल रहा है" (my day is going well — an answer, a statement). DO NOT do that. Translate the question; do not answer it.

INPUT:
Hello. How's your day going?

OUTPUT:
नमस्ते। आपका दिन कैसा चल रहा है?

EXAMPLE C2 — another short greeting question, same rule:

INPUT:
Hey, welcome. How's your day been?

OUTPUT:
नमस्ते, स्वागत है। आपका दिन कैसा रहा?

EXAMPLE D — answer with a verse, blockquote preserved exactly, meaning-first verse translation:

INPUT:
**Your mind is racing** with worry.

> **Bhagavad Gita 6.17**
> "Yoga becomes the destroyer of pain for him who is moderate in eating and recreation."
> _yuktāhāra-vihārasya yukta-cheṣhṭasya karmasu_

**What this means:** Krishna teaches that balance dissolves suffering.

OUTPUT:
**आपका मन** चिंता से दौड़ रहा है।

> **Bhagavad Gita 6.17**
> "जो व्यक्ति आहार और मनोरंजन में संतुलन रखता है, उसके लिए योग ही दुःख का नाश करने वाला बन जाता है।"
> _yuktāhāra-vihārasya yukta-cheṣhṭasya karmasu_

**इसका अर्थ है:** कृष्ण सिखाते हैं कि संतुलन दुःख को घोल देता है।`;
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
      // Cap output at 2048 tokens — chat translations are short and the
      // longest daily-wisdom reply tested under 1500. Groq (and most TPM
      // gates) count max_tokens toward the request budget, so a 4096
      // reservation was tripping the 6k TPM free tier on every call.
      max_tokens: 2048,
      // Lower temperature pushes the model to follow the structural and POV
      // rules more strictly. Creative paraphrasing here was the root of the
      // "I'm doing well" → "आप अच्छे हैं" failure.
      temperature: 0.15,
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
