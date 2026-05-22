"use client";

import * as React from "react";
import { motion, type HTMLMotionProps } from "framer-motion";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const button = cva(
  "group relative inline-flex select-none items-center justify-center gap-2 overflow-hidden rounded-xl font-medium tracking-wide transition-all duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-saffron/60 focus-visible:ring-offset-2 focus-visible:ring-offset-parchment disabled:cursor-not-allowed disabled:opacity-50",
  {
    variants: {
      variant: {
        // Primary CTA on light bg — deep maroon, parchment text
        primary:
          "bg-maroon text-parchment shadow-[0_10px_24px_-8px_rgba(122,31,31,0.55)] hover:bg-maroon-deep hover:shadow-[0_14px_32px_-6px_rgba(122,31,31,0.6)]",
        // Saffron gold for occasional hero/feature buttons on light bg
        divine:
          "bg-divine-gradient text-ink shadow-divine hover:shadow-[0_0_60px_-8px_rgba(245,166,35,0.55)]",
        // Quiet button on light surfaces
        ghost:
          "border border-parchment-muted bg-parchment/70 text-ink-soft hover:border-maroon/40 hover:text-maroon",
        // Outlined CTA on light bg
        outline:
          "border border-maroon/30 bg-transparent text-maroon hover:bg-maroon/5",
        // Legacy cosmic variant — kept for any dark surfaces that still use it
        cosmic:
          "bg-gradient-to-br from-cosmic-violet via-indigo-glow to-cosmic-purple text-white shadow-cosmic",
      },
      size: {
        sm: "h-9 px-4 text-sm",
        md: "h-11 px-6 text-[15px]",
        lg: "h-12 px-7 text-base",
      },
    },
    defaultVariants: {
      variant: "primary",
      size: "md",
    },
  }
);

type MotionButtonProps = HTMLMotionProps<"button">;

export interface GlowingButtonProps
  extends Omit<MotionButtonProps, "children">,
    VariantProps<typeof button> {
  children: React.ReactNode;
  loading?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
}

export const GlowingButton = React.forwardRef<
  HTMLButtonElement,
  GlowingButtonProps
>(
  (
    { className, variant, size, children, loading, leftIcon, rightIcon, disabled, ...props },
    ref
  ) => {
    return (
      <motion.button
        ref={ref}
        whileHover={{ scale: 1.015 }}
        whileTap={{ scale: 0.985 }}
        transition={{ type: "spring", stiffness: 320, damping: 22 }}
        className={cn(button({ variant, size }), className)}
        disabled={disabled || loading}
        {...props}
      >
        {/* Animated shine sweep */}
        <span
          aria-hidden
          className="pointer-events-none absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/30 to-transparent transition-transform duration-700 group-hover:translate-x-full"
        />
        {/* Soft outer aura on hover */}
        <span
          aria-hidden
          className="pointer-events-none absolute -inset-1 rounded-2xl opacity-0 blur-2xl transition-opacity duration-500 group-hover:opacity-60"
          style={{
            background:
              variant === "cosmic"
                ? "radial-gradient(circle, rgba(124,58,237,0.55), transparent 70%)"
                : variant === "primary"
                  ? "radial-gradient(circle, rgba(122,31,31,0.5), transparent 70%)"
                  : "radial-gradient(circle, rgba(245,166,35,0.55), transparent 70%)",
          }}
        />
        <span className="relative z-10 inline-flex items-center gap-2">
          {loading ? (
            <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
          ) : (
            leftIcon
          )}
          {children}
          {!loading && rightIcon}
        </span>
      </motion.button>
    );
  }
);
GlowingButton.displayName = "GlowingButton";
