/**
 * Streak — daily-engagement counter with named rank tiers.
 *
 * Persisted at users/{uid}/practice/streak. Day boundary uses the user's
 * local timezone (computed client-side) so 11:55pm and 12:05am don't
 * break a streak.
 *
 * recordPractice() is idempotent per day: calling it twice on the same
 * day from different surfaces (verse-complete, chat, reflection) only
 * counts once.
 */

import { doc, getDoc, serverTimestamp, setDoc } from "firebase/firestore";
import { getFirebaseDb } from "@/lib/firebase";
import { deriveRank, RANKS } from "./types";
import type { RankInfo, StreakState } from "./types";

function streakDoc(uid: string) {
  return doc(getFirebaseDb(), "users", uid, "practice", "streak");
}

function todayLocalDateKey(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function yesterdayLocalDateKey(): string {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** Read the seeker's streak, initializing the doc if it does not exist. */
export async function getStreak(uid: string): Promise<StreakState> {
  const snap = await getDoc(streakDoc(uid));
  if (!snap.exists()) {
    const seed: StreakState = {
      current: 0,
      longest: 0,
      lastActiveDate: null,
      totalDays: 0,
    };
    await setDoc(streakDoc(uid), {
      ...seed,
      createdAt: serverTimestamp(),
    });
    return seed;
  }
  const d = snap.data();
  return {
    current: Number(d.current ?? 0),
    longest: Number(d.longest ?? 0),
    lastActiveDate:
      typeof d.lastActiveDate === "string" ? d.lastActiveDate : null,
    totalDays: Number(d.totalDays ?? 0),
  };
}

/**
 * Mark today as a practice day. Returns the new streak state.
 * - If today is already counted: no-op.
 * - If yesterday was the last active day: streak += 1.
 * - Otherwise: streak resets to 1.
 */
export async function recordPractice(uid: string): Promise<StreakState> {
  const current = await getStreak(uid);
  const today = todayLocalDateKey();
  const yesterday = yesterdayLocalDateKey();

  if (current.lastActiveDate === today) {
    return current;
  }

  const next: StreakState = {
    current:
      current.lastActiveDate === yesterday ? current.current + 1 : 1,
    longest: 0,
    lastActiveDate: today,
    totalDays: current.totalDays + 1,
  };
  next.longest = Math.max(current.longest, next.current);

  await setDoc(streakDoc(uid), {
    ...next,
    updatedAt: serverTimestamp(),
  });
  return next;
}

export type { RankInfo, StreakState };
export { deriveRank, RANKS };
