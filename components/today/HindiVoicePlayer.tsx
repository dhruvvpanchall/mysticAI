"use client";

import * as React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Volume2, Play, Pause, Square } from "lucide-react";
import type { Lesson } from "@/lib/practice/types";
import { useHindiVoice } from "@/lib/voice/useHindiVoice";
import { buildLessonNarration } from "@/lib/voice";

interface Props {
  lesson: Lesson;
}

/**
 * Hindi voice player for the Daily Wisdom modal. Consumes the shared
 * voice provider via [[useHindiVoice]] — no TTS engine code lives here,
 * just the lesson-card UI shell (avatar bars, status copy, play
 * controls). Narration script is built by [[buildLessonNarration]].
 */
export function HindiVoicePlayer({ lesson }: Props) {
  const { status, voiceInfo, ready, supported, play, pause, resume, stop } =
    useHindiVoice();

  // Switching verses must not leave the previous narration playing.
  React.useEffect(() => {
    return () => {
      stop();
    };
  }, [lesson.ref, stop]);

  if (!ready) return null;

  if (!supported) {
    return (
      <div className="mt-5 rounded-xl border border-white/10 bg-white/[0.02] px-4 py-3 text-[12px] text-white/55">
        Your browser does not support voice playback yet.
      </div>
    );
  }

  const handlePrimary = () => {
    if (status === "playing") return pause();
    if (status === "paused") return resume();
    play(buildLessonNarration(lesson));
  };

  const voiceIsMale = voiceInfo?.isMale ?? false;

  return (
    <div className="mt-5 overflow-hidden rounded-2xl border border-saffron/25 bg-gradient-to-r from-saffron/[0.08] via-white/[0.02] to-maroon/[0.08] p-4 sm:p-5">
      <div className="flex items-center gap-3">
        <div className="relative inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-saffron/40 bg-gradient-to-br from-saffron/30 to-maroon/25">
          <AnimatePresence mode="wait">
            {status === "playing" ? (
              <motion.span
                key="bars"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="flex items-end gap-[3px]"
              >
                {[0, 1, 2, 3].map((i) => (
                  <motion.span
                    key={i}
                    animate={{ scaleY: [0.4, 1.1, 0.4] }}
                    transition={{
                      duration: 0.85,
                      repeat: Infinity,
                      ease: "easeInOut",
                      delay: i * 0.12,
                    }}
                    className="block h-3.5 w-[3px] origin-bottom rounded-full bg-saffron"
                  />
                ))}
              </motion.span>
            ) : (
              <motion.span
                key="icon"
                initial={{ opacity: 0, scale: 0.85 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.85 }}
              >
                <Volume2 size={18} className="text-saffron" />
              </motion.span>
            )}
          </AnimatePresence>
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.2em] text-saffron/85">
            <span>Listen in Hindi</span>
            {voiceInfo && (
              <span
                className={
                  "rounded-full border px-1.5 py-px text-[9px] font-medium normal-case tracking-normal " +
                  (voiceIsMale
                    ? "border-saffron/40 bg-saffron/10 text-saffron/90"
                    : "border-white/15 bg-white/[0.04] text-white/55")
                }
                title={
                  voiceIsMale
                    ? "Male Hindi voice active"
                    : "Install a male Hindi voice for the intended narration"
                }
              >
                {voiceIsMale ? "♂ male" : "default"}
              </span>
            )}
          </div>
          <div className="mt-0.5 text-[12.5px] text-white/70">
            {status === "playing"
              ? "सुन रहे हैं… शांति से सुनिए।"
              : status === "paused"
                ? "रुका हुआ है। जारी रखने के लिए दबाइए।"
                : status === "loading"
                  ? "तैयारी हो रही है…"
                  : "श्लोक, अर्थ और मनन हिंदी में सुनें।"}
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          {status === "playing" ? (
            <button
              onClick={handlePrimary}
              aria-label="Pause"
              className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-saffron/40 bg-saffron/15 text-saffron transition-colors hover:bg-saffron/25"
            >
              <Pause size={16} />
            </button>
          ) : (
            <button
              onClick={handlePrimary}
              disabled={status === "loading"}
              aria-label={status === "paused" ? "Resume" : "Play"}
              className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-saffron text-[#120a1d] shadow-[0_4px_16px_-4px_rgba(244,165,42,0.7)] transition-all hover:bg-[#ffb44a] disabled:opacity-60"
            >
              <Play size={16} className="translate-x-[1px]" />
            </button>
          )}
          {(status === "playing" || status === "paused") && (
            <button
              onClick={stop}
              aria-label="Stop"
              className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-white/15 bg-white/[0.04] text-white/70 transition-colors hover:bg-white/[0.08] hover:text-white"
            >
              <Square size={14} />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
