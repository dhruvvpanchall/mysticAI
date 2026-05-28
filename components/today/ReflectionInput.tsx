"use client";

import * as React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Check, NotebookPen, Loader2 } from "lucide-react";
import { saveReflection, getReflection } from "@/lib/practice/reflections";

interface Props {
  uid: string;
  verseRef: string;
  prompt: string;
  /** Notify parent when a reflection is saved (e.g. to bump streak). */
  onSaved?: () => void;
}

/**
 * "What did you learn today?" — textarea + save. Loads any prior
 * reflection for this verse on mount so the seeker can revise it.
 */
export function ReflectionInput({ uid, verseRef, prompt, onSaved }: Props) {
  const [value, setValue] = React.useState("");
  const [savedAt, setSavedAt] = React.useState<number | null>(null);
  const [saving, setSaving] = React.useState(false);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const prior = await getReflection(uid, verseRef);
        if (cancelled) return;
        if (prior) {
          setValue(prior.content);
          setSavedAt(prior.createdAt);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [uid, verseRef]);

  const save = async () => {
    const trimmed = value.trim();
    if (!trimmed) return;
    setSaving(true);
    try {
      await saveReflection(uid, verseRef, trimmed);
      setSavedAt(Date.now());
      onSaved?.();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="mt-6">
      <h3 className="flex items-center gap-2 text-[13px] font-semibold uppercase tracking-[0.16em] text-saffron/90">
        <NotebookPen size={13} />
        What did you learn today?
      </h3>
      <p className="mt-1.5 text-xs italic text-white/55">{prompt}</p>

      <div className="mt-3">
        <textarea
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder={loading ? "Loading…" : "Write a few lines for yourself…"}
          disabled={loading}
          rows={3}
          className="w-full resize-none rounded-xl border border-white/10 bg-white/[0.04] px-3.5 py-3 text-[14px] leading-relaxed text-white/90 placeholder:text-white/30 focus:border-saffron/40 focus:outline-none focus:ring-2 focus:ring-saffron/20"
        />
        <div className="mt-2 flex items-center justify-between">
          <AnimatePresence mode="wait">
            {savedAt ? (
              <motion.span
                key="saved"
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="inline-flex items-center gap-1.5 text-[11px] text-saffron/80"
              >
                <Check size={12} />
                Reflection saved
              </motion.span>
            ) : (
              <span key="empty" className="text-[11px] text-white/30">
                Private to you. Stored under your account.
              </span>
            )}
          </AnimatePresence>
          <button
            onClick={save}
            disabled={saving || loading || !value.trim()}
            className="inline-flex items-center gap-1.5 rounded-lg border border-saffron/40 bg-saffron/10 px-3 py-1.5 text-xs font-medium text-saffron transition-all hover:bg-saffron/20 hover:shadow-[0_0_18px_-6px_rgba(244,165,42,0.6)] disabled:opacity-40"
          >
            {saving ? (
              <Loader2 size={12} className="animate-spin" />
            ) : (
              <Check size={12} />
            )}
            {savedAt ? "Update" : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
}
