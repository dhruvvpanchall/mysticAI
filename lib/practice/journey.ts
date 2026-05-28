/**
 * Journey state — per-user position through the Gita corpus.
 *
 * Stored at users/{uid}/practice/journey. We store `completedRefs` as an
 * array so the "current" lesson is always derivable as `nextLesson(refs)`
 * — single source of truth, no risk of currentIndex and completedRefs
 * disagreeing.
 *
 * Skipping a day never skips a verse. The seeker returns and sees the
 * same next-unread verse waiting.
 */

import {
  doc,
  getDoc,
  serverTimestamp,
  setDoc,
  updateDoc,
  arrayUnion,
  Timestamp,
} from "firebase/firestore";
import { getFirebaseDb } from "@/lib/firebase";
import type { JourneyState } from "./types";

function journeyDoc(uid: string) {
  return doc(getFirebaseDb(), "users", uid, "practice", "journey");
}

function todayLocalDateKey(): string {
  // YYYY-MM-DD in the user's local timezone — used for streak boundary.
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function tsToNumber(v: unknown): number | null {
  if (v instanceof Timestamp) return v.toMillis();
  if (typeof v === "number") return v;
  return null;
}

/** Read the seeker's journey state. Initializes the doc if it does not exist. */
export async function getJourney(uid: string): Promise<JourneyState> {
  const snap = await getDoc(journeyDoc(uid));
  if (!snap.exists()) {
    const seed: JourneyState = {
      startDate: todayLocalDateKey(),
      completedRefs: [],
      lastCompletedAt: null,
    };
    await setDoc(journeyDoc(uid), {
      startDate: seed.startDate,
      completedRefs: [],
      lastCompletedAt: null,
      createdAt: serverTimestamp(),
    });
    return seed;
  }
  const d = snap.data();
  return {
    startDate: String(d.startDate ?? todayLocalDateKey()),
    completedRefs: Array.isArray(d.completedRefs)
      ? (d.completedRefs as string[])
      : [],
    lastCompletedAt: tsToNumber(d.lastCompletedAt),
  };
}

/**
 * Append a verse ref to the completed list. Idempotent — calling twice
 * with the same ref is safe (arrayUnion dedupes).
 */
export async function markLessonComplete(
  uid: string,
  verseRef: string
): Promise<void> {
  // Make sure the doc exists first so updateDoc doesn't 404.
  await getJourney(uid);
  await updateDoc(journeyDoc(uid), {
    completedRefs: arrayUnion(verseRef),
    lastCompletedAt: serverTimestamp(),
  });
}
