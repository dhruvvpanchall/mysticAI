"use client";

import * as React from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  X,
  Sparkles,
  Quote,
  CheckCircle2,
  MessageSquareText,
  BookHeart,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  nextLesson,
  previousLesson,
  currentDay,
  totalLessons,
} from "@/lib/practice/lessons";
import { getJourney, markLessonComplete } from "@/lib/practice/journey";
import { getStreak, recordPractice } from "@/lib/practice/streak";
import {
  deriveRank,
  type Lesson,
  type StreakState,
} from "@/lib/practice/types";
import { HindiVoicePlayer } from "./HindiVoicePlayer";

interface Props {
  open: boolean;
  uid: string;
  onClose: () => void;
  /** Send a message into the chat composer. */
  onAskMystic?: (seedPrompt: string) => void;
  /** Bubble streak updates up to the sidebar chip. */
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

type LangTab = "english" | "hindi";

/**
 * Premium "Today's Wisdom" modal — opens from the sidebar entry.
 * Centered glassmorphism card with full verse content, a Hindi voice
 * narration strip, chat bridge CTAs, and an explicit "Mark Complete".
 *
 * Close-without-complete flow:
 *   user dismisses → confirmation overlay → "Completed" | "Coming back".
 *
 * Streak only increments on explicit completion — never on opening the
 * modal or interacting with sub-elements.
 */
export function DailyWisdomModal({
  open,
  uid,
  onClose,
  onAskMystic,
  onStreakChange,
}: Props) {
  const [mounted, setMounted] = React.useState(false);
  const [loading, setLoading] = React.useState(true);
  const [lesson, setLesson] = React.useState<Lesson | null>(null);
  const [completedRefs, setCompletedRefs] = React.useState<string[]>([]);
  const [completedToday, setCompletedToday] = React.useState(false);
  const [streak, setStreak] = React.useState<StreakState>({
    current: 0,
    longest: 0,
    lastActiveDate: null,
    totalDays: 0,
  });
  const [lang, setLang] = React.useState<LangTab>("english");
  const [confirmClose, setConfirmClose] = React.useState(false);
  const [marking, setMarking] = React.useState(false);

  React.useEffect(() => setMounted(true), []);

  // Load journey + streak each time the modal opens, so it always
  // reflects the freshest server state.
  React.useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setLoading(true);
    (async () => {
      try {
        const [journey, s] = await Promise.all([
          getJourney(uid),
          getStreak(uid),
        ]);
        if (cancelled) return;
        const locked = isSameLocalDay(journey.lastCompletedAt);
        const lessonToShow = locked
          ? previousLesson(journey.completedRefs)
          : nextLesson(journey.completedRefs);
        setLesson(lessonToShow);
        setCompletedRefs(journey.completedRefs);
        setCompletedToday(locked);
        setStreak(s);
      } catch (err) {
        console.error("[DailyWisdomModal] load failed:", err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, uid]);

  // Escape key — same rules as clicking X.
  React.useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") attemptClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, completedToday]);

  // Lock background scroll while modal is open.
  React.useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  const attemptClose = React.useCallback(() => {
    // Already completed today? Just close — no need to confirm anything.
    if (completedToday) {
      onClose();
      return;
    }
    // First-time dismiss → show the "mark today as completed?" confirm.
    setConfirmClose(true);
  }, [completedToday, onClose]);

  const handleConfirmCompleted = async () => {
    if (!lesson) return;
    setMarking(true);
    try {
      await markLessonComplete(uid, lesson.ref);
      const newStreak = await recordPractice(uid);
      setCompletedRefs((prev) =>
        prev.includes(lesson.ref) ? prev : [...prev, lesson.ref]
      );
      setStreak(newStreak);
      setCompletedToday(true);
      onStreakChange?.(newStreak);
      setConfirmClose(false);
      onClose();
    } catch (err) {
      console.error("[DailyWisdomModal] mark complete failed:", err);
    } finally {
      setMarking(false);
    }
  };

  const handleConfirmLater = () => {
    setConfirmClose(false);
    onClose();
  };

  const handleMarkComplete = async () => {
    if (!lesson || completedToday || marking) return;
    setMarking(true);
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
      console.error("[DailyWisdomModal] mark complete failed:", err);
    } finally {
      setMarking(false);
    }
  };

  if (!mounted || !open) return null;

  const rank = deriveRank(streak.current);

  const askPrompts: Array<{ label: string; icon: React.ReactNode; seed: string }> = lesson
    ? [
        {
          label: "Explain Simply",
          icon: <BookHeart size={14} />,
          seed: `Explain Bhagavad Gita verse ${lesson.ref} to me simply. The verse: "${lesson.english}"`,
        },
        {
          label: "Ask MysticAI",
          icon: <MessageSquareText size={14} />,
          seed: `I'm reflecting on Bhagavad Gita verse ${lesson.ref}: "${lesson.english}" What should I ask you about it?`,
        },
      ]
    : [];

  const dayNumber = completedToday
    ? completedRefs.length
    : currentDay(completedRefs);

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
          onClick={attemptClose}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.97, y: 6 }}
            transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
            onClick={(e) => e.stopPropagation()}
            className="relative flex max-h-[92vh] w-full max-w-2xl flex-col overflow-hidden rounded-3xl border border-saffron/25 bg-gradient-to-br from-[#120a1d] via-[#0e0a18] to-[#180f1f] shadow-[0_30px_80px_-30px_rgba(244,165,42,0.5),0_0_0_1px_rgba(244,165,42,0.05)_inset]"
          >
            {/* Ambient halos — sit on the static shell, not the scroll area */}
            <div
              aria-hidden
              className="pointer-events-none absolute -top-32 left-1/2 h-72 w-72 -translate-x-1/2 rounded-full bg-saffron/25 blur-[80px]"
            />
            <div
              aria-hidden
              className="pointer-events-none absolute -bottom-40 -left-20 h-72 w-72 rounded-full bg-maroon/40 blur-[100px]"
            />

            {/* Floating close — pinned to the modal corner so it stays
                reachable no matter how far the seeker has scrolled. */}
            <button
              onClick={attemptClose}
              aria-label="Close"
              className="absolute right-3 top-3 z-20 flex h-9 w-9 items-center justify-center rounded-full border border-white/10 bg-black/40 text-white/80 backdrop-blur-md transition-colors hover:border-saffron/40 hover:bg-black/60 hover:text-saffron"
            >
              <X size={16} />
            </button>

            {/* Scroll container — owns the overflow + themed scrollbar */}
            <div className="modal-scroll relative flex-1 overflow-y-auto">
              {/* Header strip */}
              <div className="relative flex items-center justify-between border-b border-white/5 px-5 py-3.5 pr-16 sm:px-7 sm:pr-20">
                <div className="flex items-center gap-2.5">
                  <span className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-saffron/40 bg-saffron/10">
                    <Sparkles size={13} className="text-saffron" />
                  </span>
                  <div className="leading-tight">
                    <div className="text-[10px] font-semibold uppercase tracking-[0.2em] text-saffron/80">
                      Today's Wisdom
                    </div>
                    <div className="text-[11px] text-white/55">
                      {lesson
                        ? `Day ${dayNumber} · Adhyaya ${lesson.chapter} · Verse ${lesson.verse}`
                        : "Loading…"}
                    </div>
                  </div>
                </div>
              </div>

              {/* Body */}
              <div className="relative px-5 pb-6 pt-6 sm:px-7 sm:pt-8">
              {loading && (
                <div className="flex items-center justify-center py-16 text-saffron/70">
                  <motion.div
                    animate={{ rotate: 360 }}
                    transition={{ duration: 1.4, repeat: Infinity, ease: "linear" }}
                  >
                    <Sparkles size={20} />
                  </motion.div>
                </div>
              )}

              {!loading && !lesson && (
                <p className="py-12 text-center text-sm text-white/70">
                  You've completed every lesson available right now (
                  {totalLessons()} verses). More verses are on the way.
                </p>
              )}

              {!loading && lesson && (
                <>
                  {/* Sanskrit */}
                  <div className="relative">
                    <Quote
                      aria-hidden
                      size={28}
                      className="absolute -left-1 -top-3 text-saffron/15"
                    />
                    <pre className="whitespace-pre-wrap break-words text-center font-display text-[19px] leading-[1.7] text-saffron sm:text-[22px]">
                      {lesson.sanskrit}
                    </pre>
                  </div>

                  {/* Transliteration */}
                  <p className="mt-3 whitespace-pre-wrap break-words text-center text-[12.5px] italic text-white/55 sm:text-sm">
                    {lesson.transliteration}
                  </p>

                  {/* Lang tabs */}
                  <div className="mt-5 flex justify-center gap-1.5">
                    {(["english", "hindi"] as LangTab[]).map((l) => (
                      <button
                        key={l}
                        onClick={() => setLang(l)}
                        className={cn(
                          "rounded-full px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] transition-colors",
                          lang === l
                            ? "bg-saffron text-[#120a1d]"
                            : "text-white/40 hover:text-white/70"
                        )}
                      >
                        {l === "english" ? "English" : "हिन्दी"}
                      </button>
                    ))}
                  </div>

                  {/* Translation */}
                  <p className="mx-auto mt-3 max-w-2xl text-center text-[15px] leading-relaxed text-white/85 sm:text-base">
                    {lang === "english" ? lesson.english : lesson.hindi}
                  </p>

                  {/* Hindi voice playback */}
                  <HindiVoicePlayer lesson={lesson} />

                  {/* AI explanation */}
                  <div className="mt-6 rounded-xl border border-saffron/15 bg-white/[0.025] p-4 sm:p-5">
                    <div className="text-[10px] font-semibold uppercase tracking-[0.2em] text-saffron/80">
                      What Krishna is teaching here
                    </div>
                    <p className="mt-2 text-[14px] leading-relaxed text-white/85">
                      {lesson.aiExplanation}
                    </p>
                  </div>

                  {/* Modern life */}
                  <div className="mt-3 rounded-xl border border-maroon/30 bg-maroon/10 p-4 sm:p-5">
                    <div className="text-[10px] font-semibold uppercase tracking-[0.2em] text-saffron/80">
                      How this applies in modern life
                    </div>
                    <p className="mt-2 text-[14px] leading-relaxed text-white/85">
                      {lesson.modernLife}
                    </p>
                  </div>

                  {/* Streak strip */}
                  <div className="mt-4 flex items-center justify-between rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3">
                    <div>
                      <div className="text-[10px] font-semibold uppercase tracking-[0.2em] text-saffron/80">
                        Your practice
                      </div>
                      <div className="mt-0.5 text-[13px] text-white/80">
                        🔥 {streak.current}{" "}
                        {streak.current === 1 ? "day" : "days"} streak · {rank.label}
                      </div>
                    </div>
                    <div className="text-right text-[11px] text-white/45">
                      {completedRefs.length}/{totalLessons()} verses
                    </div>
                  </div>

                  {/* Ask MysticAI bridge */}
                  {onAskMystic && (
                    <div className="mt-5 flex flex-wrap gap-2">
                      {askPrompts.map((p) => (
                        <button
                          key={p.label}
                          onClick={() => {
                            onAskMystic(p.seed);
                            onClose();
                          }}
                          className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2 text-xs text-white/80 transition-all hover:border-saffron/40 hover:bg-saffron/10 hover:text-saffron"
                        >
                          {p.icon}
                          {p.label}
                        </button>
                      ))}
                    </div>
                  )}

                  {/* Mark complete */}
                  <div className="mt-7 flex flex-col items-stretch gap-3 border-t border-white/5 pt-5 sm:flex-row sm:items-center sm:justify-between">
                    <div className="text-[12px] text-white/55">
                      {completedToday
                        ? "Verse complete. Tomorrow you continue your journey."
                        : "Ready? Mark today as completed to advance and earn your streak."}
                    </div>
                    <button
                      onClick={handleMarkComplete}
                      disabled={completedToday || marking}
                      className={cn(
                        "inline-flex items-center justify-center gap-2 rounded-xl px-5 py-2.5 text-sm font-semibold transition-all",
                        completedToday
                          ? "border border-saffron/40 bg-saffron/20 text-saffron"
                          : "bg-saffron text-[#120a1d] hover:bg-[#ffb44a] hover:shadow-[0_0_28px_-4px_rgba(244,165,42,0.7)]"
                      )}
                    >
                      <CheckCircle2 size={16} />
                      {completedToday
                        ? "Completed today"
                        : marking
                          ? "Saving…"
                          : "Mark Complete"}
                    </button>
                  </div>
                </>
              )}
              </div>
            </div>
          </motion.div>

          {/* Close-confirm overlay */}
          <AnimatePresence>
            {confirmClose && (
              <motion.div
                key="confirm"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="absolute inset-0 z-[110] flex items-center justify-center bg-black/55 backdrop-blur-md"
                onClick={(e) => e.stopPropagation()}
              >
                <motion.div
                  initial={{ scale: 0.94, y: 6, opacity: 0 }}
                  animate={{ scale: 1, y: 0, opacity: 1 }}
                  exit={{ scale: 0.96, opacity: 0 }}
                  transition={{ duration: 0.25 }}
                  className="mx-4 w-full max-w-sm rounded-2xl border border-saffron/30 bg-gradient-to-br from-[#160d22] via-[#100a1a] to-[#1a1024] p-5 shadow-[0_20px_60px_-20px_rgba(244,165,42,0.45)]"
                >
                  <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-saffron/80">
                    Daily practice
                  </div>
                  <h3 className="mt-1 text-[17px] font-display text-white">
                    Mark today as completed?
                  </h3>
                  <p className="mt-1.5 text-[12.5px] text-white/55">
                    Your streak only counts once you mark the verse complete. You
                    can also come back later today.
                  </p>
                  <div className="mt-5 flex flex-col gap-2">
                    <button
                      onClick={handleConfirmCompleted}
                      disabled={marking}
                      className="inline-flex items-center justify-center gap-2 rounded-xl bg-saffron px-4 py-2.5 text-sm font-semibold text-[#120a1d] transition-all hover:bg-[#ffb44a] hover:shadow-[0_0_24px_-4px_rgba(244,165,42,0.7)] disabled:opacity-60"
                    >
                      <CheckCircle2 size={15} />
                      {marking ? "Saving…" : "Completed"}
                    </button>
                    <button
                      onClick={handleConfirmLater}
                      disabled={marking}
                      className="rounded-xl border border-white/15 bg-white/[0.03] px-4 py-2.5 text-sm text-white/80 transition-colors hover:bg-white/[0.06]"
                    >
                      Coming back in a while
                    </button>
                  </div>
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body
  );
}
