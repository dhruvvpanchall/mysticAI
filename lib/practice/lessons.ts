/**
 * Lesson lookup — pure functions over the bundled JSON corpus.
 *
 * The corpus is checked in (not fetched at runtime) so the daily lesson
 * pipeline has zero external dependencies and works in SSR + edge.
 */

import gitaCorpus from "@/lib/data/lessons/gita.json";
import type { Lesson, LessonCorpus, ScriptureKey } from "./types";

const corpora: Record<ScriptureKey, LessonCorpus> = {
  gita: gitaCorpus as LessonCorpus,
  // Ramayana lesson corpus to be added later; falls back to gita for now.
  ramayana: gitaCorpus as LessonCorpus,
};

export function getCorpus(scripture: ScriptureKey = "gita"): LessonCorpus {
  return corpora[scripture];
}

/** Total lessons available for a scripture. */
export function totalLessons(scripture: ScriptureKey = "gita"): number {
  return corpora[scripture].verses.length;
}

/** Look up a lesson by canonical ref ("1.1", "2.47"). Returns null if missing. */
export function lessonByRef(
  ref: string,
  scripture: ScriptureKey = "gita"
): Lesson | null {
  return corpora[scripture].verses.find((v) => v.ref === ref) ?? null;
}

/** Look up a lesson by zero-based position in the sequence. */
export function lessonByIndex(
  index: number,
  scripture: ScriptureKey = "gita"
): Lesson | null {
  const v = corpora[scripture].verses;
  if (index < 0 || index >= v.length) return null;
  return v[index];
}

/** Given a completed list, return the next lesson the seeker should see. */
export function nextLesson(
  completedRefs: string[],
  scripture: ScriptureKey = "gita"
): Lesson | null {
  const v = corpora[scripture].verses;
  const completed = new Set(completedRefs);
  for (const lesson of v) {
    if (!completed.has(lesson.ref)) return lesson;
  }
  return null;
}

/**
 * The seeker's current "day" in their journey — one-based count of verses
 * they've completed + 1. Used for the UI label "Day N of your journey".
 */
export function currentDay(completedRefs: string[]): number {
  return completedRefs.length + 1;
}

/** The most recently completed lesson, or null if none. */
export function previousLesson(
  completedRefs: string[],
  scripture: ScriptureKey = "gita"
): Lesson | null {
  if (completedRefs.length === 0) return null;
  return lessonByRef(completedRefs[completedRefs.length - 1], scripture);
}
