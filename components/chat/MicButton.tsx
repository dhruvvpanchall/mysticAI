"use client";

import * as React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Mic, Square, X } from "lucide-react";
import { useDictation } from "@/lib/stt/useDictation";
import { cn } from "@/lib/utils";

interface Props {
  /** Disabled when the chat is already streaming a reply — avoids the
   *  composer racing a transcription against a still-arriving response. */
  disabled?: boolean;
  /** Called with the final transcript. The chat page wires this to its
   *  send() function so a confirmed transcription auto-submits as a new
   *  user turn — the seeker speaks, the message goes. */
  onSubmit: (text: string) => void;
}

/**
 * Composer mic button. Tap to start recording, tap again to stop;
 * captured audio is transcribed via /api/transcribe (Whisper) and the
 * resulting text is fed straight into the parent's submit handler.
 *
 * States rendered:
 *   idle / error            → mic icon button
 *   requesting-permission   → mic icon, disabled (prevents double-tap)
 *   recording               → wide pill with elapsed time + cancel + stop
 *   transcribing            → spinner where the mic icon was
 *
 * Errors (permission denied, empty capture, network) surface as a small
 * fading tooltip below the button — no toast library dependency.
 */
export function MicButton({ disabled, onSubmit }: Props) {
  const [error, setError] = React.useState<string | null>(null);
  const [elapsed, setElapsed] = React.useState(0);

  const showError = React.useCallback((msg: string) => {
    setError(msg);
    setTimeout(() => setError((cur) => (cur === msg ? null : cur)), 3500);
  }, []);

  const { status, supported, start, stop, cancel } = useDictation({
    onTranscript: (result) => {
      const text = result.text.trim();
      if (text.length < 2) {
        showError("Didn't catch that — try again.");
        return;
      }
      onSubmit(text);
    },
    onError: (err) => {
      const m = err.message.toLowerCase();
      const friendly =
        m.includes("permission") ||
        m.includes("denied") ||
        m.includes("notallowed")
          ? "Mic permission needed. Enable it in your browser."
          : m.includes("no audio") || m.includes("empty")
            ? "Didn't catch that — try again."
            : m.includes("too large")
              ? "Recording was too long."
              : "Voice input failed. Try typing instead.";
      showError(friendly);
    },
  });

  // Track elapsed seconds while recording so the seeker has a visible
  // sense of how long they've been speaking. Resets on any state change
  // away from "recording" so a quick stop doesn't leave a stale time.
  React.useEffect(() => {
    if (status !== "recording") {
      setElapsed(0);
      return;
    }
    const start = Date.now();
    setElapsed(0);
    const id = window.setInterval(() => {
      setElapsed(Math.floor((Date.now() - start) / 1000));
    }, 250);
    return () => window.clearInterval(id);
  }, [status]);

  if (!supported) return null;

  const recording = status === "recording";
  const transcribing = status === "transcribing";
  const requesting = status === "requesting-permission";
  const busy = transcribing || requesting;

  return (
    <div className="relative inline-flex items-center">
      <AnimatePresence mode="wait" initial={false}>
        {recording ? (
          <motion.div
            key="rec"
            initial={{ opacity: 0, scale: 0.92 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.92 }}
            transition={{ duration: 0.15 }}
            className="flex items-center gap-1.5"
          >
            <button
              type="button"
              onClick={cancel}
              aria-label="Cancel recording"
              title="Cancel"
              className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-parchment-muted bg-parchment text-ink-soft transition-colors hover:border-maroon/40 hover:text-maroon"
            >
              <X size={16} />
            </button>
            <button
              type="button"
              onClick={stop}
              aria-label="Stop recording and send"
              title="Stop and send"
              className="inline-flex h-10 items-center gap-2 rounded-xl border border-maroon/50 bg-maroon/10 px-3 text-maroon transition-colors hover:bg-maroon/15"
            >
              <span className="relative inline-flex h-2.5 w-2.5">
                <span className="absolute inset-0 animate-ping rounded-full bg-maroon/70" />
                <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-maroon" />
              </span>
              <span className="text-[12px] font-medium tabular-nums">
                {formatSeconds(elapsed)}
              </span>
              <Square size={12} className="opacity-80" />
            </button>
          </motion.div>
        ) : (
          <motion.button
            key="idle"
            type="button"
            initial={{ opacity: 0, scale: 0.92 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.92 }}
            transition={{ duration: 0.15 }}
            onClick={() => {
              setError(null);
              start();
            }}
            disabled={disabled || busy}
            aria-label={transcribing ? "Transcribing" : "Start voice input"}
            title={
              transcribing
                ? "Transcribing…"
                : requesting
                  ? "Allow mic access…"
                  : "Voice input (Hindi or English)"
            }
            className={cn(
              "inline-flex h-10 w-10 items-center justify-center rounded-xl border transition-colors disabled:cursor-not-allowed disabled:opacity-50",
              "border-parchment-muted bg-parchment text-ink-soft hover:border-maroon/40 hover:text-maroon"
            )}
          >
            {busy ? (
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
            ) : (
              <Mic size={17} />
            )}
          </motion.button>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {error && (
          <motion.span
            key={error}
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            className="pointer-events-none absolute -top-9 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-md bg-ink/90 px-2 py-1 text-[11px] text-parchment shadow-lg"
          >
            {error}
          </motion.span>
        )}
      </AnimatePresence>
    </div>
  );
}

function formatSeconds(s: number): string {
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${r.toString().padStart(2, "0")}`;
}
