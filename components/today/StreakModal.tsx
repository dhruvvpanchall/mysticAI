"use client";

import * as React from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import { X, Flame, Trophy, Award } from "lucide-react";
import { getStreak } from "@/lib/practice/streak";
import { getJourney } from "@/lib/practice/journey";
import { totalLessons } from "@/lib/practice/lessons";
import { deriveRank, RANKS, type StreakState } from "@/lib/practice/types";

interface Props {
  open: boolean;
  uid: string;
  onClose: () => void;
}

/**
 * Streak details modal. Read-only view of the seeker's progress —
 * current streak, rank, longest streak, total days, completed verses,
 * and the next rank threshold.
 */
export function StreakModal({ open, uid, onClose }: Props) {
  const [mounted, setMounted] = React.useState(false);
  const [loading, setLoading] = React.useState(true);
  const [streak, setStreak] = React.useState<StreakState>({
    current: 0,
    longest: 0,
    lastActiveDate: null,
    totalDays: 0,
  });
  const [completedCount, setCompletedCount] = React.useState(0);

  React.useEffect(() => setMounted(true), []);

  React.useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setLoading(true);
    (async () => {
      try {
        const [s, j] = await Promise.all([getStreak(uid), getJourney(uid)]);
        if (cancelled) return;
        setStreak(s);
        setCompletedCount(j.completedRefs.length);
      } catch (err) {
        console.error("[StreakModal] load failed:", err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, uid]);

  React.useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  React.useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  if (!mounted || !open) return null;

  const rank = deriveRank(streak.current);
  const nextRank = RANKS.find((r) => r.threshold > streak.current);
  const progressToNext = nextRank
    ? Math.min(1, streak.current / nextRank.threshold)
    : 1;

  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div
          key="overlay"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.25 }}
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/65 p-3 backdrop-blur-md sm:p-6"
          onClick={onClose}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.97, y: 6 }}
            transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
            onClick={(e) => e.stopPropagation()}
            className="relative w-full max-w-md overflow-hidden rounded-3xl border border-saffron/25 bg-gradient-to-br from-[#120a1d] via-[#0e0a18] to-[#180f1f] shadow-[0_30px_80px_-30px_rgba(244,165,42,0.5)]"
          >
            <div
              aria-hidden
              className="pointer-events-none absolute -top-32 left-1/2 h-64 w-64 -translate-x-1/2 rounded-full bg-saffron/25 blur-[80px]"
            />

            {/* Header */}
            <div className="relative flex items-center justify-between border-b border-white/5 px-5 py-3.5">
              <div className="flex items-center gap-2.5">
                <span className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-saffron/40 bg-saffron/10">
                  <Flame size={13} className="text-saffron" />
                </span>
                <div className="text-[10px] font-semibold uppercase tracking-[0.2em] text-saffron/80">
                  Your Streak
                </div>
              </div>
              <button
                onClick={onClose}
                aria-label="Close"
                className="flex h-8 w-8 items-center justify-center rounded-full text-white/55 transition-colors hover:bg-white/10 hover:text-white"
              >
                <X size={16} />
              </button>
            </div>

            {/* Body */}
            <div className="relative px-6 pb-7 pt-7">
              {loading ? (
                <div className="flex h-40 items-center justify-center text-saffron/60">
                  Loading…
                </div>
              ) : (
                <>
                  {/* Hero — flame + count */}
                  <div className="flex flex-col items-center">
                    <div className="relative">
                      <div className="absolute inset-0 animate-pulse-glow rounded-full bg-saffron/40 blur-2xl" />
                      <div className="relative flex h-20 w-20 items-center justify-center rounded-full border border-saffron/50 bg-gradient-to-br from-saffron/30 to-maroon/30">
                        <Flame size={36} className="text-saffron drop-shadow" />
                      </div>
                    </div>
                    <div className="mt-4 font-display text-4xl text-saffron">
                      🔥 {streak.current}
                    </div>
                    <div className="mt-1 text-[12.5px] text-white/65">
                      {streak.current === 1 ? "Day Streak" : "Days Streak"}
                    </div>
                    <div className="mt-3 inline-flex items-center gap-1.5 rounded-full border border-saffron/40 bg-saffron/15 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-saffron">
                      <Award size={11} />
                      {rank.label}
                    </div>
                  </div>

                  {/* Progress to next rank */}
                  {nextRank ? (
                    <div className="mt-7">
                      <div className="flex items-center justify-between text-[11px] text-white/55">
                        <span>Progress to {nextRank.label}</span>
                        <span>
                          {streak.current}/{nextRank.threshold}
                        </span>
                      </div>
                      <div className="mt-2 h-2 overflow-hidden rounded-full bg-white/[0.05]">
                        <motion.div
                          initial={{ width: 0 }}
                          animate={{ width: `${progressToNext * 100}%` }}
                          transition={{ duration: 0.8, ease: "easeOut" }}
                          className="h-full bg-gradient-to-r from-saffron via-[#ffc36e] to-saffron shadow-[0_0_12px_rgba(244,165,42,0.6)]"
                        />
                      </div>
                    </div>
                  ) : (
                    <div className="mt-7 rounded-xl border border-saffron/30 bg-saffron/10 px-4 py-3 text-center text-[12.5px] text-saffron">
                      Highest rank reached. The journey is its own reward.
                    </div>
                  )}

                  {/* Stats */}
                  <div className="mt-6 grid grid-cols-3 gap-2">
                    <Stat label="Longest" value={streak.longest} icon={<Trophy size={12} />} />
                    <Stat label="Total Days" value={streak.totalDays} />
                    <Stat
                      label="Verses"
                      value={`${completedCount}/${totalLessons()}`}
                    />
                  </div>

                  {/* Ranks ladder */}
                  <div className="mt-6">
                    <div className="text-[10px] font-semibold uppercase tracking-[0.2em] text-saffron/80">
                      Path of practice
                    </div>
                    <div className="mt-3 space-y-1.5">
                      {RANKS.slice(1).map((r) => {
                        const reached = streak.current >= r.threshold;
                        const isCurrent = r.key === rank.key;
                        return (
                          <div
                            key={r.key}
                            className={`flex items-center justify-between rounded-lg border px-3 py-2 text-[12.5px] transition-colors ${
                              isCurrent
                                ? "border-saffron/50 bg-saffron/15 text-saffron"
                                : reached
                                  ? "border-saffron/20 bg-white/[0.03] text-white/75"
                                  : "border-white/5 bg-white/[0.02] text-white/35"
                            }`}
                          >
                            <span className="font-medium">{r.label}</span>
                            <span className="text-[11px]">
                              {r.threshold} days
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body
  );
}

function Stat({
  label,
  value,
  icon,
}: {
  label: string;
  value: number | string;
  icon?: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3 text-center">
      <div className="flex items-center justify-center gap-1 text-[10px] uppercase tracking-[0.14em] text-white/45">
        {icon}
        {label}
      </div>
      <div className="mt-1 text-base font-semibold text-saffron tabular-nums">
        {value}
      </div>
    </div>
  );
}
