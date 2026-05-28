"use client";

import * as React from "react";
import { motion } from "framer-motion";
import { Sparkles, Flame, ChevronRight } from "lucide-react";
import { getStreak } from "@/lib/practice/streak";
import { getJourney } from "@/lib/practice/journey";
import {
  nextLesson,
  previousLesson,
  currentDay,
} from "@/lib/practice/lessons";
import { deriveRank, type Lesson, type StreakState } from "@/lib/practice/types";
import { DailyWisdomModal } from "./DailyWisdomModal";
import { StreakModal } from "./StreakModal";

interface Props {
  uid: string;
  /** Send a prompt into the chat composer when a wisdom CTA is tapped. */
  onAskMystic?: (seedPrompt: string) => void;
  /** Called whenever the modal flow closes — parent can refresh its
   *  in-memory streak chip if it tracks one. */
  onStreakChange?: (s: StreakState) => void;
}

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

/**
 * Sidebar block — "Today's Wisdom" card + streak chip, each opening
 * its own modal. Sits above the conversations list in the sidebar.
 *
 * The wisdom card pulses softly with a saffron glow to draw the eye.
 * The streak chip is a quieter row below it.
 */
export function SidebarDailyPractice({
  uid,
  onAskMystic,
  onStreakChange,
}: Props) {
  const [wisdomOpen, setWisdomOpen] = React.useState(false);
  const [streakOpen, setStreakOpen] = React.useState(false);
  const [lesson, setLesson] = React.useState<Lesson | null>(null);
  const [completedToday, setCompletedToday] = React.useState(false);
  const [dayNumber, setDayNumber] = React.useState(1);
  const [streak, setStreak] = React.useState<StreakState>({
    current: 0,
    longest: 0,
    lastActiveDate: null,
    totalDays: 0,
  });

  const refresh = React.useCallback(async () => {
    try {
      const [journey, s] = await Promise.all([getJourney(uid), getStreak(uid)]);
      const locked = isSameLocalDay(journey.lastCompletedAt);
      const lessonToShow = locked
        ? previousLesson(journey.completedRefs)
        : nextLesson(journey.completedRefs);
      setLesson(lessonToShow);
      setCompletedToday(locked);
      setDayNumber(
        locked ? journey.completedRefs.length : currentDay(journey.completedRefs)
      );
      setStreak(s);
    } catch (err) {
      console.error("[SidebarDailyPractice] refresh failed:", err);
    }
  }, [uid]);

  React.useEffect(() => {
    refresh();
  }, [refresh]);

  const rank = deriveRank(streak.current);

  return (
    <div className="space-y-2 px-1">
      {/* Today's Wisdom — the prominent CTA */}
      <button
        onClick={() => setWisdomOpen(true)}
        className="group relative w-full overflow-hidden rounded-2xl border border-saffron/40 bg-gradient-to-br from-[#1a0f24] via-[#150d20] to-[#1a1024] p-3.5 text-left shadow-[0_8px_24px_-12px_rgba(244,165,42,0.5)] transition-all hover:border-saffron/60 hover:shadow-[0_10px_30px_-10px_rgba(244,165,42,0.65)]"
      >
        {/* Pulsing halo */}
        <motion.div
          aria-hidden
          animate={{ opacity: [0.55, 0.95, 0.55] }}
          transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
          className="pointer-events-none absolute -right-6 -top-6 h-20 w-20 rounded-full bg-saffron/35 blur-2xl"
        />
        <div className="relative flex items-center gap-3">
          <span className="relative inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-saffron/40 bg-saffron/15">
            <motion.span
              aria-hidden
              animate={{ scale: [1, 1.35, 1], opacity: [0.5, 0, 0.5] }}
              transition={{ duration: 2.2, repeat: Infinity, ease: "easeOut" }}
              className="absolute inset-0 rounded-xl border border-saffron/50"
            />
            <Sparkles size={15} className="text-saffron" />
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-saffron/90">
              Today's Wisdom
              {!completedToday && (
                <span className="inline-flex h-1.5 w-1.5 animate-pulse rounded-full bg-saffron" />
              )}
            </div>
            <div className="mt-0.5 truncate text-[12px] text-white/65">
              {lesson
                ? `Day ${dayNumber} · Verse ${lesson.ref}`
                : "Loading…"}
            </div>
          </div>
          <ChevronRight
            size={15}
            className="shrink-0 text-saffron/55 transition-transform group-hover:translate-x-0.5"
          />
        </div>
        {!completedToday && (
          <div className="relative mt-2 text-[10.5px] uppercase tracking-[0.16em] text-saffron/65">
            Tap to begin
          </div>
        )}
        {completedToday && (
          <div className="relative mt-2 text-[10.5px] uppercase tracking-[0.16em] text-saffron/50">
            Completed today
          </div>
        )}
      </button>

      {/* Streak chip — quieter secondary row */}
      <button
        onClick={() => setStreakOpen(true)}
        className="group flex w-full items-center gap-3 rounded-xl border border-white/10 bg-white/[0.025] p-3 text-left transition-colors hover:border-saffron/40 hover:bg-saffron/10"
      >
        <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-white/15 bg-white/[0.04] text-saffron">
          <Flame size={15} />
        </span>
        <div className="min-w-0 flex-1">
          <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-white/55">
            Your Streak
          </div>
          <div className="mt-0.5 text-[12px] text-white/80">
            🔥 {streak.current}{" "}
            {streak.current === 1 ? "day" : "days"} · {rank.label}
          </div>
        </div>
        <ChevronRight
          size={15}
          className="shrink-0 text-white/40 transition-transform group-hover:translate-x-0.5"
        />
      </button>

      {/* Modals — render once, controlled by local state */}
      <DailyWisdomModal
        open={wisdomOpen}
        uid={uid}
        onClose={async () => {
          setWisdomOpen(false);
          await refresh();
        }}
        onAskMystic={onAskMystic}
        onStreakChange={(s) => {
          setStreak(s);
          onStreakChange?.(s);
        }}
      />
      <StreakModal
        open={streakOpen}
        uid={uid}
        onClose={() => setStreakOpen(false)}
      />
    </div>
  );
}
