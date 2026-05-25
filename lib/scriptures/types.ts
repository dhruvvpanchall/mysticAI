/**
 * Shared scripture abstraction. Every spiritual text MysticAI grounds itself
 * in (Bhagavad Gita today, Valmiki Ramayana next, Mahabharata / Upanishads /
 * etc. later) implements ScriptureModule. The chat route picks the module by
 * id and stays scripture-agnostic beyond that.
 */

export type ScriptureId = "gita" | "ramayana";

export interface ScriptureMeta {
  id: ScriptureId;
  /** Long, formal name used in system prompts and citations. */
  fullName: string;
  /** Short display label for UI chips and small surfaces. */
  shortName: string;
  /** Honorific used in greetings — "Krishna's teaching", "the Ramayana's wisdom", etc. */
  voice: string;
  /** One-line subtitle for the model switcher. */
  tagline: string;
}

/** What retrieval returns. Mirrors the existing Bhagavad Gita Verse shape so
 *  the chat route's verse-block rendering doesn't need to branch. */
export interface RetrievedVerse {
  id: number;
  ref: string;
  translation: string;
  transliteration: string;
  themes: string[];
  score: number;
}

export interface ScriptureModule {
  meta: ScriptureMeta;

  /** BM25-style retrieval over this scripture's verified corpus. */
  retrieve(query: string, k?: number): RetrievedVerse[];

  /** System prompt for the substantive (emotional + subject) path. The
   *  scripture controls everything model-specific in here: which characters
   *  to reference, citation format, what to ground in. */
  systemPrompt(): string;

  /** System prompt for the greeting path. Same voice as systemPrompt but
   *  shorter and warmer. */
  greetingSystemPrompt(): string;

  /** Heuristic: is this user message a question ABOUT the scripture (its
   *  characters, philosophy, story) rather than an emotional disclosure or
   *  an info question about MysticAI itself? */
  isSubjectQuery(message: string): boolean;

  /** LLM-down fallback for emotional intent — prose frame around a verse. */
  emotionalFallback(top: RetrievedVerse | undefined): string;

  /** LLM-down fallback for subject intent — verse + invitation. */
  subjectFallback(top: RetrievedVerse | undefined): string;

  /** Greeting bank — same kinds as the universal greeting classifier expects. */
  greetingBank: Record<GreetingKind, string[]>;

  /** Info-question bank — same kinds the universal info classifier emits.
   *  The scripture owns the exact wording so we never accidentally template
   *  away a phrase the seeker is used to seeing. */
  infoBank: Record<InfoKind, string[]>;
}

/** Greeting kinds — shared across scriptures because they're universal. */
export type GreetingKind =
  | "good_morning"
  | "good_afternoon"
  | "good_evening"
  | "how_are_you"
  | "thanks"
  | "farewell"
  | "hello";

/** Info-question sub-kinds — shared. The route classifies the question;
 *  each scripture provides its own answer bank so the response is grounded
 *  in the active tradition without templating drift. */
export type InfoKind =
  | "capability"
  | "what_is"
  | "is_real"
  | "is_human"
  | "is_ai"
  | "is_therapist"
  | "creator"
  | "different"
  | "privacy"
  | "casual";
