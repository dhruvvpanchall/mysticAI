"use client";

import * as React from "react";
import { SacredGeometry } from "@/assets/SacredGeometry";
import { cn } from "@/lib/utils";

type Particle = {
  id: number;
  left: number;
  top: number;
  size: number;
  delay: number;
  duration: number;
  hue: "gold" | "violet" | "cyan";
};

function makeParticles(count: number, seed = 1): Particle[] {
  // Deterministic pseudo-random — avoids SSR/CSR hydration mismatch.
  let s = seed;
  const rand = () => {
    s = (s * 9301 + 49297) % 233280;
    return s / 233280;
  };
  const hues: Particle["hue"][] = ["gold", "violet", "cyan"];
  return Array.from({ length: count }, (_, i) => ({
    id: i,
    left: rand() * 100,
    top: rand() * 100,
    size: 1 + rand() * 2.4,
    delay: rand() * 6,
    duration: 4 + rand() * 5,
    hue: hues[Math.floor(rand() * hues.length)],
  }));
}

const hueColor: Record<Particle["hue"], string> = {
  gold: "rgba(245, 215, 110, 0.9)",
  violet: "rgba(167, 139, 250, 0.85)",
  cyan: "rgba(126, 232, 250, 0.8)",
};

export interface AnimatedBackgroundProps {
  className?: string;
  /** Number of floating particles. */
  particleCount?: number;
  /** Show the rotating mandala. */
  showMandala?: boolean;
  /** Intensity of the radial aurora glows (0–1). */
  intensity?: number;
}

/**
 * Full-screen cosmic background. Uses pure CSS animations (not per-element
 * Framer Motion) so it stays cheap to composite while the page scrolls.
 */
export function AnimatedBackground({
  className,
  particleCount = 36,
  showMandala = true,
  intensity = 1,
}: AnimatedBackgroundProps) {
  const particles = React.useMemo(
    () => makeParticles(particleCount, 7),
    [particleCount]
  );

  return (
    <div
      aria-hidden
      className={cn(
        "pointer-events-none fixed inset-0 -z-10 overflow-hidden bg-void",
        className
      )}
    >
      {/* Deep-space base gradient */}
      <div className="absolute inset-0 bg-cosmic-radial" />

      {/* Aurora blobs — CSS float, GPU-composited, lighter blur */}
      <div
        className="gpu absolute -top-40 -left-40 h-[34rem] w-[34rem] rounded-full bg-cosmic-violet/30 blur-[110px] animate-float-slow"
        style={{ opacity: 0.5 * intensity }}
      />
      <div
        className="gpu absolute top-1/3 -right-40 h-[32rem] w-[32rem] rounded-full bg-saffron/25 blur-[110px] animate-float-slow"
        style={{ opacity: 0.4 * intensity, animationDelay: "-3s" }}
      />
      <div
        className="gpu absolute -bottom-32 left-1/3 h-[28rem] w-[28rem] rounded-full bg-cyan-deep/20 blur-[110px] animate-float-slow"
        style={{ opacity: 0.35 * intensity, animationDelay: "-6s" }}
      />

      {/* Rotating sacred geometry — single layer, transform-only */}
      {showMandala && (
        <div className="gpu absolute left-1/2 top-1/2 h-[120vmin] w-[120vmin] -translate-x-1/2 -translate-y-1/2 mask-radial-fade text-saffron/25 animate-spin-slow">
          <SacredGeometry className="h-full w-full" stroke="currentColor" />
        </div>
      )}

      {/* Star field grid (very faint, static) */}
      <div
        className="absolute inset-0 opacity-[0.1] mix-blend-screen"
        style={{
          backgroundImage:
            "radial-gradient(circle at 1px 1px, rgba(255,255,255,0.6) 1px, transparent 0)",
          backgroundSize: "44px 44px",
        }}
      />

      {/* Floating particles — pure CSS keyframe, no JS per frame */}
      {particles.map((p) => (
        <span
          key={p.id}
          className="absolute rounded-full animate-twinkle"
          style={{
            left: `${p.left}%`,
            top: `${p.top}%`,
            width: p.size,
            height: p.size,
            background: hueColor[p.hue],
            boxShadow: `0 0 ${4 + p.size * 3}px ${hueColor[p.hue]}`,
            animationDelay: `${p.delay}s`,
            animationDuration: `${p.duration}s`,
          }}
        />
      ))}

      {/* Vignette */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_55%,rgba(0,0,0,0.65)_100%)]" />
    </div>
  );
}
