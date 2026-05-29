/**
 * Practice — the daily ritual layer of MysticAI.
 *
 * Daily Gita Journey: every user moves through Bhagavad Gita verses
 * sequentially (1.1 → 1.2 → 1.3 → ...). Position is per-user (not
 * date-based), so skipping days never skips verses — the seeker simply
 * picks up where they left off.
 *
 * Streak is a separate, daily-engagement signal layered on top.
 */

export type ScriptureKey = "gita" | "ramayana";

/** One day's lesson — the editorial unit. */
export interface Lesson {
  /** Verse reference, e.g. "1.1", "2.47". */
  ref: string;
  chapter: number;
  verse: number;
  /** Devanagari shloka. May contain embedded newlines for pada breaks. */
  sanskrit: string;
  /** IAST or simplified Roman transliteration. */
  transliteration: string;
  /** Hindi meaning in Devanagari. */
  hindi: string;
  /** Plain modern English translation. */
  english: string;
  /** 2-3 sentences naming what this verse teaches, calmly and humanly. */
  aiExplanation: string;
  /** Hindi (Devanagari) version of aiExplanation, used by the voice player. */
  hindiExplanation: string;
  /** 2-3 sentences applying the verse to daily modern life. */
  modernLife: string;
  /** Hindi (Devanagari) version of modernLife, used by the voice player. */
  hindiModernLife: string;
  /** One thoughtful question for the seeker to sit with today. */
  reflection: string;
}

export interface LessonCorpus {
  meta: {
    scripture: ScriptureKey;
    totalVerses: number;
    lessonsAvailable: number;
    lastUpdated: string;
    note: string;
  };
  verses: Lesson[];
}

/** Per-user journey state, persisted in Firestore. */
export interface JourneyState {
  /** Days from epoch when the seeker first opened a verse. */
  startDate: string;
  /** Refs the seeker has marked complete, in order. */
  completedRefs: string[];
  /** Ms-epoch of the most recent completion (for UX, not auth). */
  lastCompletedAt: number | null;
}

/** Streak rank tiers — derived from streak.current. */
export type Rank = "novice" | "seeker" | "sadhak" | "yogi" | "gyani";

export interface RankInfo {
  key: Rank;
  /** Display label shown in UI. */
  label: string;
  /** Streak threshold to reach this rank. */
  threshold: number;
}

export const RANKS: RankInfo[] = [
  { key: "novice", label: "Beginning", threshold: 0 },
  { key: "seeker", label: "Seeker", threshold: 7 },
  { key: "sadhak", label: "Sadhak", threshold: 21 },
  { key: "yogi", label: "Yogi", threshold: 90 },
  { key: "gyani", label: "Gyani", threshold: 365 },
];

export function deriveRank(streakCurrent: number): RankInfo {
  let result = RANKS[0];
  for (const r of RANKS) {
    if (streakCurrent >= r.threshold) result = r;
  }
  return result;
}

/** Streak doc shape, persisted in Firestore. */
export interface StreakState {
  current: number;
  longest: number;
  /** YYYY-MM-DD in the user's local timezone. */
  lastActiveDate: string | null;
  totalDays: number;
}

