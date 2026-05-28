"use client";

import * as React from "react";
import { motion } from "framer-motion";
import {
  Sparkles,
  MessageSquareText,
  Volume2,
  Quote,
  CheckCircle2,
  BookHeart,
} from "lucide-react";
import type { Lesson, StreakState } from "@/lib/practice/types";
import { EmotionPicker } from "./EmotionPicker";
import { ReflectionInput } from "./ReflectionInput";
import { cn } from "@/lib/utils";

interface Props {
  uid: string;
  lesson: Lesson;
  /** One-based "Day N of your journey". */
  dayNumber: number;
  streak: StreakState;
  /** Open chat with the verse as preloaded context. */
  onAskMystic: (seedPrompt: string) => void;
  /** Mark this verse complete + advance to the next. */
  onComplete: () => Promise<void> | void;
  /** True once the seeker has completed this verse (or any prior session). */
  completed: boolean;
}

type LangTab = "english" | "hindi";

/**
 * The hero "Today's Wisdom" card. Dark luxury surface sitting on the
 * parchment background. Contains the full verse, both languages, AI
 * explanation, modern-life meaning, emotion picker, reflection input,
 * and the chat-bridge CTAs.
 */
export function TodaysWisdom({
  uid,
  lesson,
  dayNumber,
  streak: _streak,
  onAskMystic,
  onComplete,
  completed,
}: Props) {
  const [lang, setLang] = React.useState<LangTab>("english");
  const [marking, setMarking] = React.useState(false);

  const handleComplete = async () => {
    if (completed || marking) return;
    setMarking(true);
    try {
      await onComplete();
    } finally {
      setMarking(false);
    }
  };

  const askPrompts: Array<{ label: string; icon: React.ReactNode; seed: string }> = [
    {
      label: "Explain Simply",
      icon: <BookHeart size={14} />,
      seed: `Explain Bhagavad Gita verse ${lesson.ref} to me simply, as if I'm new to the Gita. The verse: "${lesson.english}"`,
    },
    {
      label: "Ask MysticAI",
      icon: <MessageSquareText size={14} />,
      seed: `I'm reflecting on Bhagavad Gita verse ${lesson.ref}: "${lesson.english}" What should I ask you about it?`,
    },
    {
      label: "Reflect",
      icon: <Sparkles size={14} />,
      seed: `Help me reflect on Bhagavad Gita verse ${lesson.ref}. The verse says: "${lesson.english}" What is one question I should sit with today?`,
    },
  ];

  return (
    <motion.section
      initial={{ opacity: 0, y: 18 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
      className="relative overflow-hidden rounded-3xl border border-saffron/25 bg-gradient-to-br from-[#120a1d] via-[#0e0a18] to-[#180f1f] shadow-[0_30px_80px_-40px_rgba(244,165,42,0.45),0_0_0_1px_rgba(244,165,42,0.05)_inset]"
    >
      {/* Ambient halo */}
      <div
        aria-hidden
        className="pointer-events-none absolute -top-32 left-1/2 h-72 w-72 -translate-x-1/2 rounded-full bg-saffron/25 blur-[80px]"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -bottom-40 -left-20 h-72 w-72 rounded-full bg-maroon/40 blur-[100px]"
      />

      {/* Header strip */}
      <div className="relative flex items-center justify-between border-b border-white/5 px-5 py-3.5 sm:px-7">
        <div className="flex items-center gap-2.5">
          <span className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-saffron/40 bg-saffron/10">
            <Sparkles size={13} className="text-saffron" />
          </span>
          <div className="leading-tight">
            <div className="text-[10px] font-semibold uppercase tracking-[0.2em] text-saffron/80">
              Today's Wisdom
            </div>
            <div className="text-[11px] text-white/55">
              Day {dayNumber} · Adhyaya {lesson.chapter} · Verse {lesson.verse}
            </div>
          </div>
        </div>
        <div className="hidden text-[10px] uppercase tracking-[0.2em] text-white/40 sm:block">
          Bhagavad Gita
        </div>
      </div>

      <div className="relative px-5 pb-6 pt-6 sm:px-7 sm:pt-8">
        {/* Sanskrit — the heart of the card */}
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

        {/* Language tabs */}
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

        {/* AI explanation */}
        <div className="mt-6 rounded-xl border border-saffron/15 bg-white/[0.025] p-4 sm:p-5">
          <div className="text-[10px] font-semibold uppercase tracking-[0.2em] text-saffron/80">
            What Krishna is teaching here
          </div>
          <p className="mt-2 text-[14px] leading-relaxed text-white/85">
            {lesson.aiExplanation}
          </p>
        </div>

        {/* Modern life meaning */}
        <div className="mt-3 rounded-xl border border-maroon/30 bg-maroon/10 p-4 sm:p-5">
          <div className="text-[10px] font-semibold uppercase tracking-[0.2em] text-saffron/80">
            How this applies in modern life
          </div>
          <p className="mt-2 text-[14px] leading-relaxed text-white/85">
            {lesson.modernLife}
          </p>
        </div>

        {/* Chat-bridge actions */}
        <div className="mt-5 flex flex-wrap gap-2">
          {askPrompts.map((p) => (
            <button
              key={p.label}
              onClick={() => onAskMystic(p.seed)}
              className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2 text-xs text-white/80 transition-all hover:border-saffron/40 hover:bg-saffron/10 hover:text-saffron"
            >
              {p.icon}
              {p.label}
            </button>
          ))}
          <button
            disabled
            title="Voice recitation coming soon"
            className="inline-flex items-center gap-1.5 rounded-lg border border-white/5 bg-white/[0.02] px-3 py-2 text-xs text-white/35"
          >
            <Volume2 size={14} />
            Listen
          </button>
        </div>

        {/* Emotion picker */}
        <EmotionPicker verseRef={lesson.ref} />

        {/* Reflection journal */}
        <ReflectionInput
          uid={uid}
          verseRef={lesson.ref}
          prompt={lesson.reflection}
        />

        {/* Mark complete bar */}
        <div className="mt-7 flex flex-col items-stretch gap-3 border-t border-white/5 pt-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="text-[12px] text-white/55">
            {completed
              ? "Verse complete. Tomorrow you continue your journey."
              : "When you're ready, mark this verse complete to advance."}
          </div>
          <button
            onClick={handleComplete}
            disabled={completed || marking}
            className={cn(
              "inline-flex items-center justify-center gap-2 rounded-xl px-5 py-2.5 text-sm font-semibold transition-all",
              completed
                ? "border border-saffron/40 bg-saffron/20 text-saffron"
                : "bg-saffron text-[#120a1d] hover:bg-[#ffb44a] hover:shadow-[0_0_28px_-4px_rgba(244,165,42,0.7)]"
            )}
          >
            <CheckCircle2 size={16} />
            {completed ? "Completed today" : marking ? "Saving…" : "Mark complete"}
          </button>
        </div>
      </div>
    </motion.section>
  );
}
