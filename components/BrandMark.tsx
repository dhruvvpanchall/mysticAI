"use client";

import * as React from "react";
import Image from "next/image";
import logoMark from "@/assets/Logo/mysticAI_logo.png";
import { cn } from "@/lib/utils";

type Surface = "light" | "dark";
type Size = "sm" | "md" | "lg" | "xl";

const sizeMap: Record<Size, { box: string; img: number }> = {
  sm: { box: "h-7 w-7", img: 24 },
  md: { box: "h-9 w-9", img: 32 },
  lg: { box: "h-11 w-11", img: 40 },
  xl: { box: "h-14 w-14", img: 52 },
};

export interface BrandMarkProps {
  /** Size of the mark badge. */
  size?: Size;
  /** Light surfaces (parchment / landing / auth) vs dark (chat). */
  surface?: Surface;
  /** Render as a flat image with no chip background. */
  bare?: boolean;
  className?: string;
}

/**
 * The MysticAI brand mark in a small badge. Defaults are tuned for the
 * navbar / sidebar density. On dark surfaces we put a parchment-tinted
 * chip behind the mark so the maroon detail stays legible.
 */
export function BrandMark({
  size = "md",
  surface = "light",
  bare = false,
  className,
}: BrandMarkProps) {
  const { box, img } = sizeMap[size];
  return (
    <span
      className={cn(
        "relative flex shrink-0 items-center justify-center overflow-hidden",
        !bare && "rounded-xl border",
        !bare && surface === "light" && "border-saffron/40 bg-saffron-50",
        !bare && surface === "dark" && "border-saffron/40 bg-saffron-50",
        bare && "bg-transparent",
        box,
        className
      )}
      aria-hidden
    >
      <Image
        src={logoMark}
        alt=""
        width={img}
        height={img}
        priority
        className="h-[82%] w-[82%] object-contain"
      />
    </span>
  );
}

/**
 * Full wordmark — the mark + "MysticAI" text. Used in places where the
 * brand needs to read at a glance (navbar, footer, sidebar header).
 */
export function BrandLockup({
  size = "md",
  surface = "light",
  className,
}: {
  size?: Size;
  surface?: Surface;
  className?: string;
}) {
  return (
    <span className={cn("flex items-center gap-2.5", className)}>
      <BrandMark size={size} surface={surface} />
      <span
        className={cn(
          "font-display tracking-wide",
          size === "sm" ? "text-base" : "text-lg",
          surface === "dark" ? "text-white/90" : "text-ink"
        )}
      >
        Mystic
        <span className={surface === "dark" ? "text-saffron" : "text-maroon"}>
          AI
        </span>
      </span>
    </span>
  );
}
