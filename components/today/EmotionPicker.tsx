"use client";

import * as React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Loader2 } from "lucide-react";
import { EMOTIONS, type Emotion } from "@/lib/practice/types";
import { cn } from "@/lib/utils";

interface Props {
  verseRef: string;
}

/**
 * "What are you struggling with today?" — chips → fetch a personalized
 * reading of today's verse through the chosen emotion. Stream-renders
 * into a callout below the chips.
 */
export function EmotionPicker({ verseRef }: Props) {
  const [picked, setPicked] = React.useState<Emotion | null>(null);
  const [text, setText] = React.useState("");
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const abortRef = React.useRef<AbortController | null>(null);

  const pick = React.useCallback(
    async (emotion: Emotion) => {
      abortRef.current?.abort();
      const ctrl = new AbortController();
      abortRef.current = ctrl;
      setPicked(emotion);
      setText("");
      setError(null);
      setLoading(true);
      try {
        const res = await fetch("/api/journey/reinterpret", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ verseRef, emotion }),
          signal: ctrl.signal,
        });
        if (!res.ok || !res.body) {
          throw new Error(`Request failed (${res.status})`);
        }
        const reader = res.body.getReader();
        const dec = new TextDecoder();
        let acc = "";
        while (true) {
          const { value, done } = await reader.read();
          if (done) break;
          acc += dec.decode(value, { stream: true });
          setText(acc);
        }
      } catch (e) {
        if ((e as { name?: string }).name !== "AbortError") {
          setError("That reading could not load. Try another emotion.");
        }
      } finally {
        setLoading(false);
      }
    },
    [verseRef]
  );

  React.useEffect(() => {
    return () => abortRef.current?.abort();
  }, []);

  return (
    <div className="mt-6">
      <h3 className="text-[13px] font-semibold uppercase tracking-[0.16em] text-saffron/90">
        What are you struggling with today?
      </h3>
      <div className="mt-3 flex flex-wrap gap-1.5">
        {EMOTIONS.map((e) => {
          const active = picked === e.key;
          return (
            <button
              key={e.key}
              onClick={() => pick(e.key)}
              disabled={loading && active}
              className={cn(
                "rounded-full border px-3 py-1.5 text-xs transition-all",
                active
                  ? "border-saffron/70 bg-saffron/15 text-saffron shadow-[0_0_18px_-6px_rgba(244,165,42,0.6)]"
                  : "border-white/10 bg-white/[0.04] text-white/70 hover:border-saffron/40 hover:bg-saffron/10 hover:text-saffron"
              )}
            >
              {e.label}
            </button>
          );
        })}
      </div>

      <AnimatePresence mode="wait">
        {picked && (
          <motion.div
            key={picked}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.35 }}
            className="mt-4 rounded-xl border border-saffron/20 bg-white/[0.03] p-4 backdrop-blur-sm"
          >
            {loading && !text && (
              <div className="flex items-center gap-2 text-xs text-white/60">
                <Loader2 size={13} className="animate-spin" />
                <span>Krishna is speaking to your {picked}…</span>
              </div>
            )}
            {error && <p className="text-xs text-rose-300/90">{error}</p>}
            {text && (
              <div className="whitespace-pre-wrap text-[14px] leading-relaxed text-white/90">
                {text}
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
