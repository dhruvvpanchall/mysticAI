"use client";

import * as React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Volume2, Play, Pause, Square } from "lucide-react";
import type { Lesson } from "@/lib/practice/types";

interface Props {
  lesson: Lesson;
}

type Status = "idle" | "loading" | "playing" | "paused";

/**
 * Browser-native Hindi voice playback for the day's verse. Uses
 * the Web Speech API — no API key, no streaming endpoint, no cost.
 * Voice availability and pronunciation depend on the user's OS.
 *
 * Script is assembled from the lesson's Hindi-language fields with
 * short Devanagari connectors so the narration flows like a teacher
 * recounting the verse — not a flat list of fields.
 */
export function HindiVoicePlayer({ lesson }: Props) {
  const [status, setStatus] = React.useState<Status>("idle");
  const [hindiVoice, setHindiVoice] = React.useState<SpeechSynthesisVoice | null>(null);
  const [voiceReady, setVoiceReady] = React.useState(false);
  const utteranceRef = React.useRef<SpeechSynthesisUtterance | null>(null);

  // Resolve the best Hindi voice on the device. Voices load async on
  // some browsers, so we subscribe to onvoiceschanged too.
  React.useEffect(() => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) {
      setVoiceReady(true);
      return;
    }
    function pick() {
      const voices = window.speechSynthesis.getVoices();
      const hi =
        voices.find((v) => v.lang === "hi-IN") ??
        voices.find((v) => v.lang.toLowerCase().startsWith("hi")) ??
        null;
      setHindiVoice(hi);
      setVoiceReady(true);
    }
    pick();
    window.speechSynthesis.addEventListener("voiceschanged", pick);
    return () => {
      window.speechSynthesis.removeEventListener("voiceschanged", pick);
    };
  }, []);

  // Stop any speech when the lesson changes or the component unmounts —
  // otherwise switching verses leaves the prior verse still narrating.
  React.useEffect(() => {
    return () => {
      if (typeof window !== "undefined" && "speechSynthesis" in window) {
        window.speechSynthesis.cancel();
      }
    };
  }, [lesson.ref]);

  function buildScript(): string {
    // Hindi narration weaves through Sanskrit + Hindi translation with
    // small connector phrases. Pure Hindi content only — English
    // explanations are skipped here so the Hindi voice doesn't mangle
    // English vocabulary.
    return [
      `आज की दैनिक शिक्षा। भगवद गीता, अध्याय ${lesson.chapter}, श्लोक ${lesson.verse}।`,
      `पहले श्लोक सुनिए।`,
      lesson.sanskrit,
      `अब इस श्लोक का हिंदी अर्थ।`,
      lesson.hindi,
      `यही आज का चिंतन है। शांति से इस पर मनन कीजिए।`,
    ].join(" ");
  }

  function handlePlay() {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
    if (status === "paused") {
      window.speechSynthesis.resume();
      setStatus("playing");
      return;
    }
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(buildScript());
    u.lang = "hi-IN";
    if (hindiVoice) u.voice = hindiVoice;
    u.rate = 0.92;
    u.pitch = 1.0;
    u.onend = () => setStatus("idle");
    u.onerror = () => setStatus("idle");
    utteranceRef.current = u;
    setStatus("loading");
    // Tiny defer so the loading state paints before the engine kicks in.
    setTimeout(() => {
      window.speechSynthesis.speak(u);
      setStatus("playing");
    }, 60);
  }

  function handlePause() {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
    window.speechSynthesis.pause();
    setStatus("paused");
  }

  function handleStop() {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
    window.speechSynthesis.cancel();
    setStatus("idle");
  }

  const supported =
    typeof window !== "undefined" && "speechSynthesis" in window;

  if (!voiceReady) {
    return null;
  }

  if (!supported) {
    return (
      <div className="mt-5 rounded-xl border border-white/10 bg-white/[0.02] px-4 py-3 text-[12px] text-white/55">
        Your browser does not support voice playback yet.
      </div>
    );
  }

  const noHindiVoice = !hindiVoice;

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
          <div className="text-[10px] font-semibold uppercase tracking-[0.2em] text-saffron/85">
            Listen in Hindi
          </div>
          <div className="mt-0.5 text-[12.5px] text-white/70">
            {status === "playing"
              ? "सुन रहे हैं… शांति से सुनिए।"
              : status === "paused"
                ? "रुका हुआ है। जारी रखने के लिए दबाइए।"
                : status === "loading"
                  ? "तैयारी हो रही है…"
                  : noHindiVoice
                    ? "हिंदी आवाज़ इंस्टॉल नहीं है, सिस्टम की आवाज़ चलेगी।"
                    : "श्लोक और उसका अर्थ हिंदी में सुनें।"}
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          {status === "playing" ? (
            <button
              onClick={handlePause}
              aria-label="Pause"
              className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-saffron/40 bg-saffron/15 text-saffron transition-colors hover:bg-saffron/25"
            >
              <Pause size={16} />
            </button>
          ) : (
            <button
              onClick={handlePlay}
              disabled={status === "loading"}
              aria-label={status === "paused" ? "Resume" : "Play"}
              className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-saffron text-[#120a1d] shadow-[0_4px_16px_-4px_rgba(244,165,42,0.7)] transition-all hover:bg-[#ffb44a] disabled:opacity-60"
            >
              <Play size={16} className="translate-x-[1px]" />
            </button>
          )}
          {(status === "playing" || status === "paused") && (
            <button
              onClick={handleStop}
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
