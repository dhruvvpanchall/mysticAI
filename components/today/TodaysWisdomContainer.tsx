"use client";

import * as React from "react";
import { Loader2 } from "lucide-react";
import { getJourney, markLessonComplete } from "@/lib/practice/journey";
import { getStreak, recordPractice } from "@/lib/practice/streak";
import {
  nextLesson,
  previousLesson,
  currentDay,
  totalLessons,
} from "@/lib/practice/lessons";
import type { Lesson, StreakState } from "@/lib/practice/types";
import { TodaysWisdom } from "./TodaysWisdom";

function isSameLocalDay(ms: number | null): boolean {
  if (!ms) return false;
  const a = new Date(ms);
  const b = new Date();
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

interface Props {
  uid: string;
  /** Open chat with a preloaded prompt. */
  onAskMystic: (seedPrompt: string) => void;
  /** Bubble streak changes up so the header chip can refresh. */
  onStreakChange?: (streak: StreakState) => void;
}

/**
 * Loads the seeker's journey + streak from Firestore, picks today's
 * lesson, and renders the Today's Wisdom card. Handles the mark-complete
 * flow: appends ref to journey + bumps streak + advances to next lesson.
 */
export function TodaysWisdomContainer({
  uid,
  onAskMystic,
  onStreakChange,
}: Props) {
  const [loading, setLoading] = React.useState(true);
  const [lesson, setLesson] = React.useState<Lesson | null>(null);
  const [completedRefs, setCompletedRefs] = React.useState<string[]>([]);
  const [streak, setStreak] = React.useState<StreakState>({
    current: 0,
    longest: 0,
    lastActiveDate: null,
    totalDays: 0,
  });
  const [completedToday, setCompletedToday] = React.useState(false);

  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [journey, s] = await Promise.all([
          getJourney(uid),
          getStreak(uid),
        ]);
        if (cancelled) return;
        // If today's verse is already done, lock the card to that verse
        // in completed state. Otherwise, surface the next unread verse.
        const locked = isSameLocalDay(journey.lastCompletedAt);
        const lessonToShow = locked
          ? previousLesson(journey.completedRefs)
          : nextLesson(journey.completedRefs);
        setLesson(lessonToShow);
        setCompletedRefs(journey.completedRefs);
        setCompletedToday(locked);
        setStreak(s);
        onStreakChange?.(s);
      } catch (err) {
        console.error("[TodaysWisdomContainer] load failed:", err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [uid, onStreakChange]);

  const handleComplete = React.useCallback(async () => {
    if (!lesson) return;
    try {
      await markLessonComplete(uid, lesson.ref);
      const newStreak = await recordPractice(uid);
      setCompletedRefs((prev) =>
        prev.includes(lesson.ref) ? prev : [...prev, lesson.ref]
      );
      setStreak(newStreak);
      setCompletedToday(true);
      onStreakChange?.(newStreak);
    } catch (err) {
      console.error("[TodaysWisdomContainer] mark complete failed:", err);
    }
  }, [uid, lesson, onStreakChange]);

  if (loading) {
    return (
      <div className="flex items-center justify-center rounded-3xl border border-saffron/15 bg-gradient-to-br from-[#120a1d] via-[#0e0a18] to-[#180f1f] py-16 text-saffron/70">
        <Loader2 size={18} className="animate-spin" />
      </div>
    );
  }

  if (!lesson) {
    return (
      <div className="rounded-3xl border border-saffron/25 bg-gradient-to-br from-[#120a1d] via-[#0e0a18] to-[#180f1f] p-8 text-center">
        <p className="text-sm text-white/70">
          You've completed every lesson we have right now ({totalLessons()}{" "}
          verses). More verses are on the way. In the meantime, ask MysticAI
          anything below.
        </p>
      </div>
    );
  }

  // When the seeker has already completed today's verse, dayNumber is
  // the verse they just finished. Otherwise it's the one they're about to
  // start.
  const dayNumber = completedToday
    ? completedRefs.length
    : currentDay(completedRefs);

  return (
    <TodaysWisdom
      uid={uid}
      lesson={lesson}
      dayNumber={dayNumber}
      streak={streak}
      onAskMystic={onAskMystic}
      onComplete={handleComplete}
      completed={completedToday || completedRefs.includes(lesson.ref)}
    />
  );
}
