"use client";

import * as React from "react";
import { motion } from "framer-motion";
import { Sparkles, Check } from "lucide-react";
import { getJourney } from "@/lib/practice/journey";
import {
  nextLesson,
  previousLesson,
  currentDay,
} from "@/lib/practice/lessons";
import type { Lesson } from "@/lib/practice/types";
import { cn } from "@/lib/utils";
import { DailyWisdomModal } from "./DailyWisdomModal";

interface Props {
  uid: string;
  onAskMystic?: (seed: string) => void;
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
 * Compact "Today's Wisdom" entry point for the mobile chat header,
 * where the sidebar is a drawer and the daily ritual would otherwise
 * be invisible. Pulses gently when not completed today; quiets to a
 * gold check pill once the seeker has marked the verse complete.
 *
 * Owns its own modal — the sidebar entry stays the source of truth
 * on desktop, this is the source of truth on mobile. The data refreshes
 * each time the modal closes so the chip mirrors any completion that
 * happened during the visit.
 */
export function MobileWisdomChip({ uid, onAskMystic }: Props) {
  const [open, setOpen] = React.useState(false);
  const [lesson, setLesson] = React.useState<Lesson | null>(null);
  const [completedToday, setCompletedToday] = React.useState(false);
  const [dayNumber, setDayNumber] = React.useState(1);

  const refresh = React.useCallback(async () => {
    try {
      const journey = await getJourney(uid);
      const locked = isSameLocalDay(journey.lastCompletedAt);
      const lessonToShow = locked
        ? previousLesson(journey.completedRefs)
        : nextLesson(journey.completedRefs);
      setLesson(lessonToShow);
      setCompletedToday(locked);
      setDayNumber(
        locked ? journey.completedRefs.length : currentDay(journey.completedRefs)
      );
    } catch (err) {
      console.error("[MobileWisdomChip] refresh failed:", err);
    }
  }, [uid]);

  React.useEffect(() => {
    refresh();
  }, [refresh]);

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        aria-label={
          completedToday
            ? "Today's wisdom completed"
            : `Open today's wisdom, day ${dayNumber}`
        }
        className={cn(
          "group relative inline-flex h-10 items-center gap-1.5 overflow-hidden rounded-xl border px-2.5 text-[12px] font-semibold transition-all active:scale-[0.97]",
          completedToday
            ? "border-gold/40 bg-gold/10 text-gold-deep"
            : "border-saffron/50 bg-gradient-to-br from-saffron-50 via-parchment to-saffron-50/60 text-maroon shadow-[0_4px_12px_-6px_rgba(122,31,31,0.45)]"
        )}
      >
        {!completedToday && (
          <motion.span
            aria-hidden
            animate={{ opacity: [0.35, 0.85, 0.35] }}
            transition={{ duration: 2.6, repeat: Infinity, ease: "easeInOut" }}
            className="pointer-events-none absolute -right-3 -top-3 h-10 w-10 rounded-full bg-saffron/55 blur-xl"
          />
        )}
        <span
          className={cn(
            "relative inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-md text-parchment",
            completedToday
              ? "bg-gold/70"
              : "bg-gradient-to-br from-saffron to-[#e08a1f] shadow-[0_2px_6px_-2px_rgba(244,165,42,0.7)]"
          )}
        >
          {completedToday ? <Check size={11} /> : <Sparkles size={11} />}
        </span>
        <span className="relative whitespace-nowrap">
          {lesson ? `Day ${dayNumber}` : "Today"}
        </span>
        {!completedToday && (
          <span className="relative ml-0.5 inline-flex h-1.5 w-1.5 animate-pulse rounded-full bg-maroon" />
        )}
      </button>

      <DailyWisdomModal
        open={open}
        uid={uid}
        onClose={async () => {
          setOpen(false);
          await refresh();
        }}
        onAskMystic={onAskMystic}
      />
    </>
  );
}
