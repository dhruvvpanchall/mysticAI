"use client";

import * as React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { BookOpenText, Check, ChevronDown } from "lucide-react";
import { SCRIPTURE_LIST, type ScriptureId } from "@/lib/scriptures";
import { cn } from "@/lib/utils";

interface ModelDropdownProps {
  value: ScriptureId;
  onChange: (id: ScriptureId) => void;
  className?: string;
  /** Disable while a reply is streaming so the seeker can't swap models
   *  mid-answer (would leave the partial response orphaned in the other
   *  scripture's thread). */
  disabled?: boolean;
}

/**
 * Composer-anchored scripture picker. Trigger shows the current scripture
 * with a chevron; click opens a menu UPWARD (composer sits at the bottom
 * of the viewport, so popping downward would overflow). Mirrors the
 * ChatGPT / Claude model picker pattern — compact when collapsed,
 * descriptive when open.
 */
export function ModelDropdown({
  value,
  onChange,
  className,
  disabled,
}: ModelDropdownProps) {
  const [open, setOpen] = React.useState(false);
  const rootRef = React.useRef<HTMLDivElement>(null);

  const active =
    SCRIPTURE_LIST.find((s) => s.id === value) ?? SCRIPTURE_LIST[0];

  React.useEffect(() => {
    if (!open) return;
    function handlePointer(e: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", handlePointer);
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("mousedown", handlePointer);
      document.removeEventListener("keydown", handleKey);
    };
  }, [open]);

  return (
    <div ref={rootRef} className={cn("relative inline-block", className)}>
      <button
        type="button"
        onClick={() => !disabled && setOpen((v) => !v)}
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        className={cn(
          "inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[12px] font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50",
          open
            ? "bg-saffron-50 text-maroon"
            : "text-ink-soft hover:bg-saffron-50 hover:text-maroon"
        )}
      >
        <BookOpenText size={13} className="text-maroon" />
        <span>{active.shortName}</span>
        <ChevronDown
          size={12}
          className={cn("transition-transform duration-200", open && "rotate-180")}
        />
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 6, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 6, scale: 0.97 }}
            transition={{ duration: 0.15, ease: "easeOut" }}
            // Menu opens UPWARD: composer is fixed at the bottom of the
            // viewport, so a downward-opening menu would clip below the
            // safe area on mobile. bottom-full + mb-2 lifts it above.
            className="absolute bottom-full left-0 z-40 mb-2 w-72 max-w-[calc(100vw-2rem)] rounded-2xl border border-parchment-muted bg-parchment p-1.5 shadow-[0_24px_60px_-20px_rgba(122,31,31,0.4)]"
            role="listbox"
          >
            <p className="px-2.5 pb-1 pt-1 text-[10px] uppercase tracking-[0.2em] text-ink-muted">
              Scripture
            </p>
            {SCRIPTURE_LIST.map((s) => {
              const isActive = s.id === value;
              return (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => {
                    if (!isActive) onChange(s.id);
                    setOpen(false);
                  }}
                  role="option"
                  aria-selected={isActive}
                  className={cn(
                    "flex w-full items-start gap-2.5 rounded-xl px-2.5 py-2 text-left transition-colors",
                    isActive
                      ? "bg-saffron-50"
                      : "hover:bg-parchment-deep/60"
                  )}
                >
                  <span
                    className={cn(
                      "mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full",
                      isActive
                        ? "bg-maroon text-parchment"
                        : "border border-parchment-muted bg-parchment text-transparent"
                    )}
                  >
                    {isActive && <Check size={10} strokeWidth={3} />}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span
                      className={cn(
                        "block text-[13px] font-medium",
                        isActive ? "text-maroon" : "text-ink"
                      )}
                    >
                      {s.fullName}
                    </span>
                    <span className="mt-0.5 block text-[11px] leading-snug text-ink-muted">
                      {s.tagline}
                    </span>
                  </span>
                </button>
              );
            })}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
