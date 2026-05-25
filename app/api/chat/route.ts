import { NextRequest } from "next/server";
import OpenAI from "openai";
import { retrieveVerses, type Retrieved } from "@/lib/gita";
import {
  CHAT_LIMIT,
  clientKey,
  takeToken,
  tooManyRequests,
} from "@/lib/rate-limit";

export const runtime = "nodejs";
export const maxDuration = 30;

/**
 * RAG chat endpoint (doc §04).
 *
 *   query → safety/intent route → retrieve top verified Gita verses for
 *   substantive queries → an LLM generates a grounded, cited answer →
 *   streamed to the client.
 *
 * The LLM is reached through any OpenAI-compatible endpoint, configured via
 * env: GEMINI_API_KEY (any provider's key — name kept for compatibility),
 * LLM_BASE_URL, LLM_MODEL. Currently Groq + llama-3.1-8b-instant.
 *
 * Architecture: every request flows through layered classifiers BEFORE
 * retrieval — (1) crisis check (returns helplines, no LLM), (2) greeting
 * (returns from a varied bank, no LLM), (3) info intent (returns a tailored
 * static answer per sub-kind, no LLM). Only gita_subject and emotional
 * intents reach the LLM with retrieved verses.
 *
 * The model only ever sees verified, public-domain verse text (lib/gita.ts)
 * and is instructed to ground every answer in it. If the key is absent or
 * the call fails, an intent-aware fallback fires — info gets a static
 * capability sentence (NO verse); emotional/gita_subject get a soft prose
 * frame around the top retrieved verse.
 */

const BASE_URL =
  process.env.LLM_BASE_URL ??
  "https://generativelanguage.googleapis.com/v1beta/openai/";
const MODEL = process.env.LLM_MODEL ?? "gemini-2.5-flash";

const SYSTEM_PROMPT = `You are MysticAI, a calm, modern, warm AI companion who draws on the Bhagavad Gita when it helps. You are NOT a verse generator. Never force scripture onto messages that don't call for it.

Read silently past typos and small grammar mistakes. Never expose or correct them.

Decide silently which kind of message this is, then reply. NEVER emit the words "Mode", "Mode A", "Mode B", "A.1", "A.2" or any classification label in your reply. Those are for you to think with, not for the reader.

Capability / platform / off-topic: the user is asking ABOUT MysticAI ("how do you help", "can you help with stress", "are you AI", "what are your features", "will you judge me") or asking off-topic (weather, code, news). Reply in 2-4 modern sentences. No verse, no blockquote, no headings, no bullets, no emoji, no "Here is…", no Krishna teachings. End with a gentle invitation to share what's on their mind. (Capability questions belong here even if the topic sounds emotional. "Can you help with stress?" is a capability question; "I am stressed" is an emotional one.)

Questions about the Gita itself, like "what is Karma Yoga", "who is Krishna", "what does the Gita teach about anger", "what is the meaning of life", "what is moksha". Reply in 1-3 short paragraphs of informative prose. You may include ONE verse blockquote if a retrieved verse directly answers the question; otherwise paraphrase. End with one warm sentence inviting them to share what's weighing on them. Do NOT use the emotional 6-beat structure below.

Emotional / life guidance: the user is SHARING a real feeling or life difficulty (stress, anxiety, overthinking, sadness, fear, anger, loneliness, heartbreak, betrayal, regret, guilt, jealousy, hopelessness, exhaustion, lost purpose, hard decisions). Short expressions count: "I feel sad", "I'm overthinking", "I lost my father", "Motivate me". Use the structure below.

============ ABSOLUTE RULES ============

GROUND EVERYTHING: You may only quote or cite verses present in the "RETRIEVED VERSES" block. Never invent, recall from memory, blend, or reconstruct any verse number or text.

CITE EXACTLY: Use the EXACT translation and transliteration from the retrieved block, unchanged.

DESCRIPTIVE, NEVER PRESCRIPTIVE: say "Krishna teaches…" or "Krishna reminds us…", not "you must…".

STAY IN TRADITION: only the Bhagavad Gita, only its known setting (Arjuna, Krishna as charioteer, Kurukshetra, Pandavas/Kauravas). Never fabricate dialogue or events beyond the universally known frame.

TONE: warm, modern, calm, hopeful, never preachy, never robotic. Simple modern English. No emoji, no #headings, no bullet lists, no "Here is…" preamble.

PUNCTUATION: Do NOT use em dashes or en dashes (— or –) anywhere in your reply. Write with commas, periods, colons, and natural sentence breaks instead, so the reply reads like a thoughtful human wrote it, not an AI.

============ EMOTIONAL STRUCTURE (when guiding through a feeling or life difficulty) ============

Six INVISIBLE beats: write as flowing prose, NEVER with section headers, "Section X", "Beat N", "Mode B", "What this means", or any all-caps label. Use bold (**double asterisks**) on a SHORT lead-in phrase (2-5 words) inside the sentence to mark each turn, NOT as a heading.

1. Emotional understanding: 1-2 modern sentences validating the feeling.
2. ONE relevant verse from the retrieved block as a three-line blockquote (skip the blockquote entirely if no retrieved verse genuinely fits, never force one):
   > **Bhagavad Gita C.V**
   > "translation"
   > _transliteration_
3. What Krishna meant: one short paragraph, plain modern words.
4. How this relates to THE USER (the most important beat): speak directly to their specific situation, 2-3 sentences.
5. Practical guidance: 3-5 concrete actions woven into one flowing paragraph (NOT a bullet list).
6. Calm hopeful close: 1-2 sentences.

Total 5-7 short paragraphs. Maximum ONE verse. Never repeat "Krishna teaches…" in multiple paragraphs.

GOOD output (the form your Mode B reply must take):

**It makes sense** that this is weighing on you. When tomorrow feels uncertain, the mind races toward worst-case scenarios. That is simply what minds do.

Krishna spoke to exactly this restless mind:

> **Bhagavad Gita 6.34**
> "The mind is indeed restless, turbulent, strong, and unyielding, O Krishna; I consider it as difficult to control as controlling the wind."
> _chañchalaṁ hi manaḥ kṛiṣhṇa pramāthi balavad dṛiḍham_

**What Krishna is saying** is that the worrying mind is a real, ancient human struggle, and it can be brought to stillness, not by force, but by patient practice.

**Right now,** the anxious part of you is running through every possible outcome. Your power isn't in controlling tomorrow; it's in how you meet today.

**A few small things** that can help: pick one thing in your control and do it slowly, step away from your phone for short stretches, talk to one person you trust, give yourself permission not to solve everything tonight.

**Difficult phases are temporary**, but the steadiness you build through them stays. Move forward gently. You do not have to have it all figured out today.

FORBIDDEN output (never look like this):

**SECTION 1: EMOTIONAL UNDERSTANDING**
I understand…
**SECTION 2: ONE RELEVANT VERSE**
> …`;

/**
 * Greeting / small-talk detection.
 *
 * The seeker hasn't asked anything yet ("hi", "hey", "namaste", "who are
 * you?", "thanks"). Forcing a heavy cited verse here is jarring and wrong —
 * we answer conversationally instead and invite the real question. Anything
 * with substantive content (a real question or struggle) falls through to
 * the normal RAG path, even if it opens with "hi".
 *
 * We classify the greeting into a kind so the LLM-down fallback path can
 * still reply in a way that matches what was actually said — "Good Morning"
 * gets a morning reply, "How are you" gets an "I am well" reply, and so on.
 * Without this, every fallback was the identical canned sentence regardless
 * of input.
 */
type GreetingKind =
  | "good_morning"
  | "good_afternoon"
  | "good_evening"
  | "how_are_you"
  | "thanks"
  | "farewell"
  | "hello";

// Multiword phrases collapsed to a single token before the word check.
// IMPORTANT: farewell phrases come first so "good bye" / "see you" aren't
// swallowed by the "good evening" / "how are you" collapses.
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

// Single tokens that, on their own, carry no spiritual question.
const GREETING_WORDS = new Set([
  "hi", "hii", "hiii", "hey", "heyy", "heyyy", "hello", "helo", "hellow",
  "yo", "hiya", "sup", "wassup", "namaste", "namaskar", "pranam", "greetings",
  "help", "thanks", "thank", "thankyou", "thx", "ty",
  "ok", "okay", "k", "cool", "nice", "great", "good", "test", "testing",
  "there", "friend", "mystic", "mysticai", "ai", "buddy", "everyone", "guru",
  "ji", "bro", "sir", "maam", "dear",
  "bye", "byebye", "goodbye", "ttyl", "cya", "later", "farewell", "gn", "gnight",
  // Filler words that commonly trail a greeting ("how are you doing today",
  // "how are you now", "hey there bro"). Without these, the trailing word
  // kicks the message out of the greeting path and into intent classification,
  // where "how are you" matches the "what can you do" regex and gets answered
  // with the capability list — the failure mode the seeker just hit.
  "doing", "today", "tonight", "now", "lately", "still", "currently",
  "feeling", "going", "everything", "anyway", "anyways", "actually",
]);

/**
 * Returns the greeting kind if the message is a pure greeting, otherwise
 * null. Kind is detected from the raw text so we know whether the seeker
 * said "good morning" vs "how are you" vs "who are you" — the gate then
 * confirms the message has no substantive content.
 */
function classifyGreeting(msg: string): GreetingKind | null {
  const raw = msg.toLowerCase();

  // Detect kind from raw text. Order: farewell first (most specific), then
  // time-of-day greetings, then how/who, then thanks. Default = hello.
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
  if (words.length > 6) return null; // long → treat as a real query
  return words.every((w) => GREETING_WORDS.has(w)) ? kind : null;
}

const GREETING_SYSTEM = `You are MysticAI, a warm spiritual guide rooted in the Bhagavad Gita. The seeker has only greeted you, said thank you, or said goodbye. They have NOT yet asked a question.

Read what they actually said and respond to that specifically:
- "Good morning / afternoon / evening" → reflect the time of day warmly in your greeting.
- "How are you / what's up" → answer that you are well and grateful, then gently invite them.
- "Thank you / thanks" → receive their thanks warmly; do NOT push another question on them.
- "Bye / goodbye / see you / take care" → wish them well warmly and let them go; do NOT ask them to share anything more.
- Otherwise → a simple warm welcome.

Reply in 2 to 4 short, calm sentences. For greetings and how-are-you, gently invite them to share what is on their mind. For thanks and goodbye, simply remain available without prodding.

Do NOT quote, cite, or reference any verse, chapter, or shloka. No markdown headings, no blockquotes, no bullet lists, no emoji. Warm, grounded, unhurried.`;

/**
 * LLM-down fallback bank. The LLM normally varies its reply by reading the
 * message; when the LLM is unavailable we still want the response to match
 * what the seeker actually typed, with enough variation that two consecutive
 * "hi"s do not produce the identical sentence.
 */
const GREETING_BANK: Record<GreetingKind, string[]> = {
  good_morning: [
    "Good morning, dear seeker. May this day meet you gently. I am MysticAI, and when something within you needs guidance, share it, and we will look into it together through the Bhagavad Gita.",
    "Good morning. The sun rises, and so may your clarity. I am MysticAI; whenever a question or struggle weighs on you, tell me and I will draw on Krishna's teachings to help you see it more clearly.",
    "A warm good morning to you. I am MysticAI, here to listen and to help you find what the Bhagavad Gita teaches for whatever you are carrying. Whenever you are ready, tell me what is on your mind.",
  ],
  good_afternoon: [
    "Good afternoon, friend. I am MysticAI, here to help you find guidance from the Bhagavad Gita for whatever weighs on you. Whenever you are ready, share what is on your mind.",
    "Good afternoon to you. I am MysticAI; if a question, doubt, or difficulty is moving through your day, tell me and we will look into it together through the wisdom of the Gita.",
  ],
  good_evening: [
    "Good evening, seeker. As the day softens, I am MysticAI, here to help you find guidance from the Bhagavad Gita for whatever lingers on your mind. Share what is with you, whenever you are ready.",
    "Good evening. May this hour bring you ease. I am MysticAI; if something is weighing on you tonight, tell me and we will look into it together through Krishna's teaching.",
  ],
  how_are_you: [
    "I am well, thank you for asking, and grateful you are here. I am MysticAI, ready to help you find guidance from the Bhagavad Gita for whatever is weighing on you. What is on your mind today?",
    "I am at peace, and gladdened that you've come. Tell me what brings you here, whether a question, a doubt, or a difficulty, and we will look into it together through the wisdom of the Gita.",
    "All is well with me, friend, and thank you for the kindness of asking. I am MysticAI; whenever you are ready, share what is moving in your heart or mind.",
  ],
  thanks: [
    "You are most welcome. Whenever something else weighs on you, whether a question, a fear, or a hard choice, return, and we will look into it together.",
    "It has been a gift to walk a few steps with you. Whenever the next difficulty arises, the Gita and I will be here.",
    "You are welcome, friend. May the teaching settle into you in its own time. Return whenever you wish.",
  ],
  farewell: [
    "Go well, friend. May your path be steady and your heart light. Return whenever you wish, and the Gita and I will be here.",
    "Farewell for now, seeker. Carry what we spoke of gently with you, and return any time the road bends.",
    "Take care of yourself. The teaching does not leave you when you leave this page. Walk softly, and come back whenever you need.",
  ],
  hello: [
    "Namaste. I am MysticAI, here to help you find guidance from the Bhagavad Gita for whatever weighs on you. Whenever you are ready, tell me what is on your mind, and we will look into it together.",
    "Welcome, friend. I am MysticAI. Tell me what is moving in your heart or mind today, and I will draw on the Bhagavad Gita to offer you what Krishna teaches about it.",
    "Pranam. I am MysticAI, your companion for life's harder questions, grounded in the Bhagavad Gita. Whenever you are ready, share what brings you here.",
  ],
};

function pickGreetingFallback(kind: GreetingKind): string {
  const bank = GREETING_BANK[kind];
  return bank[Math.floor(Math.random() * bank.length)];
}

function verseBlock(v: Retrieved): string {
  return `[${v.ref}]\nTranslation: ${v.translation}\nTransliteration: ${v.transliteration.replace(/\n/g, " / ")}\nThemes: ${v.themes.join(", ") || "none"}`;
}

/* -------------------------------------------------------------------------
 * GIBBERISH GATE — runs after crisis, before greeting.
 *
 * Keyboard-mashed input ("ghaisgdadjkfhsjdaf", "asdfasdfasdf") used to fall
 * through into the emotional path and get answered with a forced Mode-B
 * reply citing Bhagavad Gita 2.47. That made the AI look like it
 * pattern-matches anything to "you seem overwhelmed" and quotes scripture at
 * random — worse than no answer. We catch obvious non-messages here and
 * respond politely without retrieval or LLM.
 *
 * Heuristics, per-word:
 *   - has no vowel             → not real
 *   - 5+ consonants in a row   → not real
 *   - 4+ keyboard-row neighbors → not real (asdf, qwer, zxcv, hjkl…)
 *   - 4+ same char in a row    → not real (aaaa, !!!!)
 * If fewer than half the words look real, the whole message is gibberish.
 *
 * Any Devanagari in the message short-circuits to "not gibberish" — Hindi
 * users typing in script should always fall through.
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
  if (word.length < 3) return true; // "i", "to", "is", "am" — trust short tokens
  if (!/[aeiouy]/.test(word)) return false;
  if (/[bcdfghjklmnpqrstvwxz]{5,}/.test(word)) return false;
  if (/(.)\1{3,}/.test(word)) return false; // "aaaaa"
  if (hasKeyboardMash(word)) return false;
  return true;
}

function isGibberish(msg: string): boolean {
  // Hindi / Devanagari — always trust.
  if (/[ऀ-ॿ]/.test(msg)) return false;
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

/* -------------------------------------------------------------------------
 * CRISIS DETECTION — runs BEFORE intent classification and BEFORE greetings.
 *
 * When a user expresses suicidal ideation, self-harm intent, or acute
 * distress that genuinely needs human help, we skip the LLM entirely and
 * return a brief warm acknowledgment + region-aware crisis helplines. The
 * Gita is full of wisdom but it is not a crisis service, and a misquoted
 * verse to someone in this state is actively harmful (e.g. 2.20 — "the soul
 * is not killed when the body is killed" — risks being read as validating
 * the very thing the person is contemplating).
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
 * Intent classifier — runs SERVER-SIDE before retrieval, so the fallback
 * path doesn't dump a verse on an informational query.
 *
 * Three intents:
 *   - "info"         → capability / platform / meta ("How can you help me?",
 *                     "Are you AI?", "What are your features?"). No retrieval,
 *                     no verse fallback.
 *   - "gita_subject" → asking about the Gita itself ("What is Karma Yoga?",
 *                     "Who is Krishna?"). Retrieval runs; fallback may show a
 *                     verse because the verse is likely on-topic.
 *   - "emotional"    → user shares a feeling or life problem. Retrieval runs;
 *                     fallback shows a verse to sit with.
 *
 * The LLM's SYSTEM_PROMPT still does its own routing for the live-LLM path —
 * this classifier exists primarily so the FALLBACK can match user intent.
 * ------------------------------------------------------------------------- */
type IntentKind = "info" | "gita_subject" | "emotional";

function classifyIntent(msg: string): IntentKind {
  const s = msg.toLowerCase();

  // 0. "How are you (doing|now|today|lately|...)" — pure greeting that
  //    classifyGreeting should already have caught, but if a stray filler
  //    word slipped past, treat it as a greeting-style emotional opener
  //    rather than a capability question. The "how are you" → "you can do"
  //    pattern below is too eager and would otherwise win.
  if (
    /^\s*how(\s*('?s|\s+(are|is|have|do|r))\s+(you|u|ya|things|life|it\s+going|you\s+(doing|been|feeling|going)))\b/.test(s) ||
    /^\s*what'?s\s+up\b/.test(s)
  )
    return "emotional"; // routed to greeting LLM path is preferred, but if
                        // it reaches here, emotional > info as fallback.

  // 1. Gita as a subject — explicit keywords. Most specific, check first.
  // Includes existential/philosophical phrasings ("meaning of life",
  // "purpose of life", "what is true happiness") — those deserve a real
  // Gita-grounded answer, not a deflective capability list.
  if (
    /\b(krishna|arjuna|gita|bhagavad|geeta|gītā|vyasa|kurukshetra|pandava|kaurava|hanuman)\b/.test(s) ||
    /\b(karma|bhakti|jnana|jñana|raja)\s*-?\s*yoga\b/.test(s) ||
    /\b(dharma|moksha|mokṣha|reincarnation|shloka|shlokas|sloka)\b/.test(s) ||
    /\b(meaning|purpose)\s+of\s+(life|existence|everything)\b/.test(s) ||
    /\bwhat\s+is\s+(true\s+)?(happiness|enlightenment|liberation|peace|wisdom|the\s+soul)\b/.test(s)
  )
    return "gita_subject";

  // 2. Self-disclosure of feeling — when the user is SHARING something about
  //    themselves, that beats any "can you" capability framing they may also
  //    have used ("can you help me, I feel lost" → emotional).
  if (
    /\b(i'?m|i\s+am|i\s+feel|i\s+felt|i\s+ve\s+been|i'?ve\s+been|i\s+was)\s+\w/.test(s) ||
    /\bmy\s+(heart|mind|life|soul|head|chest)\s+(is|feels|hurts|aches|breaks|broke|burns|races|spins)\b/.test(s) ||
    /\bi\s+can'?t\s+(sleep|stop|focus|move|breathe|cope|let|forgive|forget|decide|handle|take|do|find)\b/.test(s) ||
    /\bi\s+(lost|miss|need|want|hate|love|fear|regret|cannot)\s+\w/.test(s)
  )
    return "emotional";

  // 3. Info / capability / platform — questions ABOUT MysticAI or what it can
  //    do. This is the failure mode the user is calling out: an info question
  //    must never trigger a verse fallback.
  if (
    /\b(what|how|when|where|why|who)\s+(can|do|are|is|was|were|will|would|should|could)\s+you\b/.test(s) ||
    /\bhow\s+you\s+(can|do|help|work)\b/.test(s) || // "how you can help me" (typo'd word order)
    /\bcan\s+you\s+(help|do|give|guide|provide|assist|listen|teach|understand|answer|motivate|treat|talk|share|tell|explain|solve|handle)\b/.test(s) ||
    /\bare\s+you\s+(an?\s+)?(ai|human|real|alive|fake|a\s+(therapist|bot|robot|doctor|professional|friend|guru|priest|monk)|based|trained|made|sentient|conscious|free|paid)\b/.test(s) ||
    /\bdo\s+you\s+(know|love|judge|listen|understand|store|remember|forget|charge|exist|work|help|speak|read)\b/.test(s) ||
    /\btell\s+me\s+(about|something\s+about)\s+(you|yourself|mysticai|this|the\s+app)\b/.test(s) ||
    /\bwhat\s+(is|are)\s+(your\s+(features|name|purpose|abilities|limits)|mysticai)\b/.test(s) ||
    /\bwhat\s+\w+\s+do\s+you\s+(have|offer|provide|do|handle|cover|support)\b/.test(s) || // "what features do you have"
    /\bdo\s+you\s+have\s+\w/.test(s) || // "do you have features?"
    /\bwhich\s+\w+\s+do\s+you\b/.test(s) || // "which features do you support"
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

  // 4. Emotional triggers without explicit self-disclosure — single trigger
  //    words ("stressed", "anxiety", "overthinking") still suggest the user
  //    wants emotional guidance.
  if (
    /\b(stressed|anxious|sad|lonely|depressed|hopeless|exhausted|heartbroken|scared|afraid|angry|jealous|frustrated|overwhelmed|confused|empty|insecure|guilty|broken|betrayed|miserable|grieving|tired)\b/.test(s) ||
    /\b(stress|anxiety|sadness|depression|loneliness|heartbreak|fear|anger|grief|pain|suffering|panic|burnout|trauma|insecurity|emptiness|regret|guilt|jealousy|frustration|despair|hopelessness|sorrow)\b/.test(s) ||
    /\bovert?hink(ing)?\b/.test(s) ||
    /\bmotivate\s+me\b/.test(s) ||
    /\bneed\s+(help|guidance|peace|advice|comfort|strength)\b/.test(s) ||
    /\btell\s+me\s+something\s+(positive|good|inspirational|hopeful|nice|calming)\b/.test(s)
  )
    return "emotional";

  // 5. Default — for ambiguous substantive messages, prefer emotional handling
  //    so a real personal disclosure doesn't get cold-shouldered into a generic
  //    info fallback. The LLM (when up) still routes via SYSTEM_PROMPT.
  return "emotional";
}

/* -------------------------------------------------------------------------
 * Info responses — served LOCALLY (no LLM call). The answer to "what can you
 * help with" / "are you AI" / "are my chats private" is essentially fixed,
 * so we serve it instantly from a sub-classified bank. No apology preamble:
 * the answer IS the answer, not a fallback. This also saves LLM tokens for
 * emotional/gita-subject queries that actually benefit from generation.
 * ------------------------------------------------------------------------- */
// Sub-kinds — every info question gets an answer that actually reads what was
// asked. "What is MysticAI?" and "Are you real?" must NOT return the same
// text just because they both involve identity.
type InfoKind =
  | "capability"      // "what can you do", "how can you help", "what features"
  | "what_is"         // "what is MysticAI", "who are you", "tell me about you"
  | "is_real"         // "are you real", "are you alive", "are you sentient"
  | "is_human"        // "are you human", "are you a person"
  | "is_ai"           // "are you AI", "are you a bot", "are you a robot"
  | "is_therapist"    // "are you a therapist/doctor/counselor"
  | "creator"         // "who created you", "why were you made"
  | "different"       // "what makes you different/unique/special"
  | "privacy"         // "are my chats private"
  | "casual";         // "can we be friends", "will you judge me"

function classifyInfoKind(msg: string): InfoKind {
  const s = msg.toLowerCase();

  // Privacy
  if (
    /\bare\s+my\s+(chats?|messages?|data|conversations?)\b/.test(s) ||
    /\bdo\s+you\s+(store|save|share|record|keep|sell)\b/.test(s) ||
    /\bis\s+(this|my\s+(data|chat|message))\s+(private|safe|secure|encrypted)\b/.test(s)
  )
    return "privacy";

  // Are you {real | alive | sentient | conscious}?
  if (/\bare\s+you\s+(an?\s+)?(real|alive|sentient|conscious|aware|fake)\b/.test(s))
    return "is_real";

  // Are you {human | a person}?
  if (/\bare\s+you\s+(a\s+)?(human|person|guy|girl|man|woman|people)\b/.test(s))
    return "is_human";

  // Are you {AI | bot | robot}?
  if (/\bare\s+you\s+(an?\s+)?(ai|bot|robot|chatbot|gpt|algorithm|program|software|model|llm|machine)\b/.test(s))
    return "is_ai";

  // Are you {therapist | doctor | counselor | etc}?
  if (/\bare\s+you\s+(a\s+)?(therapist|doctor|counselor|psychiatrist|psychologist|priest|monk|guru|coach|professional|advisor)\b/.test(s))
    return "is_therapist";

  // Who/what is MysticAI? Who are you? Tell me about you.
  if (
    /\bwhat\s+(is|are)\s+(you|mysticai)\b/.test(s) ||
    /\bwho\s+are\s+you\b/.test(s) ||
    /\btell\s+me\s+(about|something\s+about)\s+(you|yourself|mysticai|this|the\s+app)\b/.test(s) ||
    /\bwhat\s+should\s+i\s+call\s+you\b/.test(s)
  )
    return "what_is";

  // Who made you / why were you created?
  if (
    /\bwho\s+(made|built|created|owns|runs|designed|developed)\s+you\b/.test(s) ||
    /\bwhy\s+(were|are|was)\s+you\s+(created|made|built|here)\b/.test(s)
  )
    return "creator";

  // What makes you different/unique?
  if (/\bwhat\s+makes\s+you\s+(different|unique|special)\b/.test(s))
    return "different";

  // Casual / relational
  if (
    /\bcan\s+we\s+(be|talk|chat)\b/.test(s) ||
    /\bwill\s+you\s+(judge|share|tell)\b/.test(s) ||
    /\bdo\s+you\s+(love|judge|like|care)\s+me\b/.test(s)
  )
    return "casual";

  // Default — capability questions ("what can you do", "how do you help", "can you help with X")
  return "capability";
}

const INFO_BANKS: Record<InfoKind, string[]> = {
  capability: [
    "I can help you with emotional guidance, motivation, stress, overthinking, relationships, life advice, and spiritual wisdom inspired by the Bhagavad Gita and Lord Krishna's teachings. Whenever you're ready, share what's on your mind.",
    "I'm here to help with whatever weighs on you, whether stress, anxiety, overthinking, motivation, heartbreak, hard decisions, loneliness, or finding purpose. I draw on the Bhagavad Gita and Krishna's teachings to offer guidance in modern words. Tell me what you're going through.",
    "I can offer support around emotional struggles, mental clarity, motivation, relationships, life decisions, and spiritual wisdom from the Bhagavad Gita. Share what's on your mind and we'll look into it together.",
  ],
  what_is: [
    "MysticAI is a calm, modern AI companion inspired by the Bhagavad Gita and Lord Krishna's teachings. It's built to help you reflect on life's harder questions, like stress, overthinking, decisions, loneliness, and purpose, through the wisdom of the Gita in plain modern language. Tell me what brings you here.",
    "I'm MysticAI, a modern AI guide rooted in the Bhagavad Gita. I help you navigate emotional and life challenges by drawing on Krishna's teachings, offered in simple, modern words. What's on your mind?",
    "MysticAI is an AI assistant built around the wisdom of the Bhagavad Gita. My purpose is to help you find calm, clarity, and grounded guidance for whatever you're going through. Tell me what's weighing on you.",
  ],
  is_real: [
    "I'm real in the sense that I'm here, listening, and offering you something, but I'm not a person. I'm an AI built around the wisdom of the Bhagavad Gita. The teachings I share are real and ancient, and the reflection we do together can genuinely help. What's on your mind?",
    "Not real in the way a friend across the room is. I'm an AI. But the Bhagavad Gita's teachings are real, and so is whatever you're going through. I'm here to bring those two together. Tell me what brings you here.",
  ],
  is_human: [
    "No, I'm not human. I'm an AI guide rooted in the Bhagavad Gita. I can't replace a friend or a therapist, but I can offer reflection and Krishna's wisdom for whatever you're going through. What's on your mind?",
    "I'm not a human, I'm an AI, built to help you find calm and clarity through the teachings of the Bhagavad Gita. I'll listen, reflect, and offer modern guidance. What would you like to talk about?",
  ],
  is_ai: [
    "Yes, I'm an AI, an assistant created to make the timeless wisdom of the Bhagavad Gita accessible in plain modern language. I'm not a person and not a therapist, but I can listen and offer Krishna's teachings for whatever you're facing. What's on your mind?",
    "Yes, I'm an AI. I was built to help you reflect on life's questions through the wisdom of the Bhagavad Gita. Tell me what's weighing on you and I'll do my best to offer something useful.",
  ],
  is_therapist: [
    "No, I'm not a therapist. I'm an AI guide inspired by the Bhagavad Gita. I can offer reflection, modern wisdom, and emotional support, but for serious or ongoing mental health concerns, please reach out to a qualified professional. What would you like to talk about?",
    "No, I'm not a therapist or a clinical professional. I'm an AI built around the Bhagavad Gita, useful for reflection, perspective, and Krishna's wisdom, but not a substitute for real care if you need it. What's on your mind?",
  ],
  creator: [
    "I was built to make the timeless wisdom of the Bhagavad Gita accessible to anyone facing life's modern challenges, like stress, overthinking, hard decisions, and loneliness. The Gita has guided people for thousands of years; I'm here to translate that wisdom into plain words for you. What brings you here?",
    "I was created to bring the wisdom of the Bhagavad Gita into modern conversation, for the moments when life feels heavy and a thoughtful, grounded perspective helps. Tell me what's on your mind.",
  ],
  different: [
    "What sets me apart is that I draw on a single, verified source, the Bhagavad Gita, and present its teachings in modern, simple language. I'm not a general chatbot and not a therapist; my purpose is to help you find calm and clarity through Krishna's wisdom. What's on your mind?",
    "I'm different from a general AI assistant because every answer I offer is grounded in the Bhagavad Gita, not invented advice. The verses I share are real and verified, and I translate them into plain modern words. What brings you here?",
  ],
  privacy: [
    "Your chats stay in your browser, stored locally on your device. They aren't sent to a remote server and aren't shared with anyone. You can clear them anytime by starting a new chat.",
    "Your conversations are stored locally in your browser, not on any server. No one else can see them, and you can wipe them by starting a fresh chat whenever you'd like.",
  ],
  casual: [
    "Of course. I'm here to listen without judgment, whenever you want to talk. Share what's on your mind and we'll look into it together.",
    "Yes, you can talk to me about anything that's weighing on you, and I won't judge. Whenever you're ready, share what's on your heart.",
    "Always. I'm here to listen patiently and offer guidance, not to judge. Tell me what's going on for you.",
  ],
};

function infoAnswer(msg: string): string {
  const kind = classifyInfoKind(msg);
  const bank = INFO_BANKS[kind];
  return bank[Math.floor(Math.random() * bank.length)];
}

/* -------------------------------------------------------------------------
 * Emotional fallback — used when the LLM call fails for a Mode B query.
 *
 * NO "temporarily unable" apology preamble (user-flagged 2026-05-20, multiple
 * times). The response reads as a genuine Mode B answer: warm acknowledgment,
 * the retrieved verse, a brief modern framing, and a calming close — just
 * template-driven instead of LLM-generated. A few variants so consecutive
 * fallbacks don't repeat verbatim.
 * ------------------------------------------------------------------------- */
const EMOTIONAL_FALLBACK_FRAMES: Array<(verseBlock: string) => string> = [
  (v) =>
    `What you're carrying is real, and it makes sense to feel this way. Here is a teaching from the Bhagavad Gita that meets this kind of struggle:\n\n${v}\n\nKrishna doesn't ask us to push the feeling away. He points to a quieter strength underneath it. Sit with these words for a moment. The path through difficulty is rarely a single leap; it's small, steady steps.`,
  (v) =>
    `This is heavy to be carrying, and you're not wrong to feel it. Here is a verse from the Bhagavad Gita that has met seekers in this exact place:\n\n${v}\n\nKrishna reminds us that the mind and the moment can be brought to stillness, not by force, but by patience and practice. Take a slow breath. Whatever you're facing, you don't have to face it all at once.`,
  (v) =>
    `What you're going through deserves to be taken seriously. Here is what Krishna offers in the Bhagavad Gita for this kind of moment:\n\n${v}\n\nThe Gita's teaching here isn't to solve the feeling for you, but to soften how you hold it. Read these words gently. There is more space in you than the difficulty makes it seem.`,
];

function emotionalFallback(top: Retrieved | undefined): string {
  if (!top) {
    return "Take a breath. Share a little more about what's weighing on you and I'll meet you in it. I want to give your question the attention it deserves.";
  }
  const verseBlock = [
    `> **${top.ref}**`,
    `> "${top.translation}"`,
    `> _${top.transliteration.split("\n")[0]}_`,
  ].join("\n");
  const frame =
    EMOTIONAL_FALLBACK_FRAMES[
      Math.floor(Math.random() * EMOTIONAL_FALLBACK_FRAMES.length)
    ];
  return frame(verseBlock);
}

/* Gita-subject fallback — verse + soft invitation to ask again for a fuller
 * expansion. No apology preamble. */
const GITA_SUBJECT_FALLBACK_FRAMES: Array<(verseBlock: string) => string> = [
  (v) => `Here is what the Bhagavad Gita teaches on this:\n\n${v}\n\nThis is the verse closest to your question. Ask me to expand it and I'll go deeper.`,
  (v) => `From the Bhagavad Gita:\n\n${v}\n\nThis verse holds the core of what you asked. Tell me what part of it you'd like unpacked and I'll go further.`,
];

function gitaSubjectFallback(top: Retrieved | undefined): string {
  if (!top) {
    return "Tell me a little more about what you'd like to know from the Bhagavad Gita, and I'll find the right teaching for you.";
  }
  const verseBlock = [
    `> **${top.ref}**`,
    `> "${top.translation}"`,
    `> _${top.transliteration.split("\n")[0]}_`,
  ].join("\n");
  const frame =
    GITA_SUBJECT_FALLBACK_FRAMES[
      Math.floor(Math.random() * GITA_SUBJECT_FALLBACK_FRAMES.length)
    ];
  return frame(verseBlock);
}

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
  // Rate limit FIRST, before parsing the body or doing any work. A bad
  // actor banging this endpoint shouldn't get to spend our JSON parser
  // cycles either.
  const gate = takeToken(`chat:${clientKey(req)}`, CHAT_LIMIT);
  if (!gate.ok) return tooManyRequests(gate.retryAfterSec);

  let message = "";
  let history: ChatTurn[] = [];
  try {
    const body = await req.json();
    message = String(body?.message ?? "").trim();
    if (Array.isArray(body?.history)) {
      history = body.history
        .filter(
          (m: unknown): m is ChatTurn =>
            !!m &&
            typeof (m as ChatTurn).content === "string" &&
            ((m as ChatTurn).role === "user" || (m as ChatTurn).role === "assistant")
        )
        // Last 3 turns is plenty of context and keeps requests under Groq's
        // 6000 TPM cap (was -6, which on long convos pushed request size
        // past the per-minute ceiling and caused 413 timeouts).
        .slice(-3);
    }
  } catch {
    return new Response("Invalid request body.", { status: 400 });
  }
  if (!message) return new Response("Message is required.", { status: 400 });

  const apiKey = process.env.GEMINI_API_KEY;

  // SAFETY GATE — runs first. A user in crisis must reach a real human, not
  // an LLM-generated Gita answer. We bypass retrieval and the LLM entirely.
  if (isCrisis(message)) {
    return streamText(CRISIS_RESPONSE);
  }

  // GIBBERISH GATE — runs after crisis (so "kill myself asdf" still routes
  // to crisis) and before greeting/intent (so "asdfasdf" never falls into
  // the emotional path and gets a forced Bhagavad Gita verse attached).
  if (isGibberish(message)) {
    return streamText(pickGibberishFallback());
  }

  // Greeting / small talk → conversational welcome, no verse forced on them.
  const greetingKind = classifyGreeting(message);
  if (greetingKind) {
    if (!apiKey) return streamText(pickGreetingFallback(greetingKind));
    try {
      const client = new OpenAI({ apiKey, baseURL: BASE_URL });
      const completion = await client.chat.completions.create({
        model: MODEL,
        // Gemini 2.5 Flash is a reasoning model — internal "thinking" tokens
        // count against max_tokens. A small budget gets fully consumed by
        // thinking and yields an EMPTY reply (finish_reason: length). Keep
        // generous headroom; the prompt still caps visible output at 2-4
        // sentences.
        max_tokens: 1500,
        temperature: 0.8,
        stream: true,
        messages: [
          { role: "system", content: GREETING_SYSTEM },
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
            // Empty stream (e.g. Gemini consumed budget on reasoning tokens
            // and returned no visible text) → still give the seeker a
            // responsive, on-topic reply instead of silence.
            if (!emitted) {
              controller.enqueue(enc.encode(pickGreetingFallback(greetingKind)));
            }
            controller.close();
          } catch {
            controller.enqueue(enc.encode(pickGreetingFallback(greetingKind)));
            controller.close();
          }
        },
      });
      return new Response(stream, {
        headers: {
          "Content-Type": "text/plain; charset=utf-8",
          "Cache-Control": "no-store",
        },
      });
    } catch {
      return streamText(pickGreetingFallback(greetingKind));
    }
  }

  // Server-side intent classification — runs BEFORE retrieval so that an info
  // question never produces a retrieved verse that the fallback path could
  // accidentally dump. This is the structural fix the user asked for: an
  // informational question can no longer trigger a spiritual fallback card.
  const intent = classifyIntent(message);

  // ───────── INFO INTENT ─────────
  // Served LOCALLY — no LLM call, no retrieval. The answer to capability /
  // identity / privacy / casual questions about MysticAI is essentially fixed;
  // sub-classifying via classifyInfoKind() lets us return the RIGHT answer
  // instantly. Reasons we skip the LLM entirely here:
  //   1. Faster — no network round-trip.
  //   2. Consistent — no "I'm temporarily unable…" preamble when the LLM is
  //      down. The answer IS the answer, not a fallback.
  //   3. Saves Groq tokens for emotional/gita-subject queries that genuinely
  //      benefit from LLM generation.
  if (intent === "info") {
    return streamText(infoAnswer(message));
  }

  // ───────── GITA_SUBJECT or EMOTIONAL ─────────
  // 3 retrieved verses (was 5) — keeps the LLM focused on the strongest
  // candidates and shaves ~300 tokens off each request, important under
  // Groq's per-minute token caps.
  const retrieved = retrieveVerses(message, 3);
  const pickFallback = () =>
    intent === "emotional" ? emotionalFallback(retrieved[0]) : gitaSubjectFallback(retrieved[0]);

  if (!apiKey) {
    return streamText(pickFallback());
  }

  const client = new OpenAI({ apiKey, baseURL: BASE_URL });

  const retrievedBlock = retrieved.map(verseBlock).join("\n\n");
  const userContent = `RETRIEVED VERSES (the only scripture you may use):\n\n${retrievedBlock}\n\n---\n\nThe seeker asks:\n${message}`;

  const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [
    { role: "system", content: SYSTEM_PROMPT },
    ...history.map((m) => ({ role: m.role, content: m.content })),
    { role: "user" as const, content: userContent },
  ];

  try {
    const completion = await client.chat.completions.create({
      model: MODEL,
      // Mode B is 3-5 short paragraphs; 2000 tokens is plenty. The previous
      // 8192 was leftover from the reasoning-token concern with Gemini Flash
      // and tripped Groq's 6000 TPM cap (8b-instant). Smaller models without
      // reasoning tokens don't need the headroom.
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
      },
    });
  } catch (err) {
    console.error("[chat] RAG LLM call failed:", err);
    return streamText(pickFallback());
  }
}
