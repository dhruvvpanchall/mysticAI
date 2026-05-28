"use client";

import * as React from "react";
import { Flame } from "lucide-react";
import { deriveRank } from "@/lib/practice/types";
import { cn } from "@/lib/utils";

interface Props {
  streak: number;
  className?: string;
}

/**
 * Small streak chip — flame glyph + count + rank label. Sits in the
 * chat header. Glows subtly when streak > 0.
 */
export function StreakBadge({ streak, className }: Props) {
  const rank = deriveRank(streak);
  const active = streak > 0;
  return (
    <div
      title={`${streak}-day practice · ${rank.label}`}
      className={cn(
        "relative inline-flex h-9 items-center gap-1.5 rounded-full border px-2.5 transition-colors",
        active
          ? "border-saffron/50 bg-saffron-50 text-maroon"
          : "border-parchment-muted bg-parchment text-ink-soft",
        className
      )}
    >
      {active && (
        <span
          aria-hidden
          className="absolute inset-0 -z-10 animate-pulse-glow rounded-full bg-saffron/35 blur-md"
        />
      )}
      <Flame
        size={15}
        className={cn(active ? "text-saffron" : "text-ink-muted")}
      />
      <span className="text-xs font-semibold tabular-nums">{streak}</span>
      <span className="hidden text-[10px] uppercase tracking-[0.14em] text-ink-muted sm:inline">
        {rank.label}
      </span>
    </div>
  );
}
