"use client";

import * as React from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { BrandMark } from "@/components/BrandMark";
import { cn } from "@/lib/utils";
import { fadeUp, scaleIn, stagger } from "@/animations/variants";

export interface AuthCardProps {
  eyebrow?: string;
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  children: React.ReactNode;
  footer?: React.ReactNode;
  className?: string;
}

/**
 * Light-theme auth card. Sits centered in the auth column. Warm cream
 * surface, deep maroon accents, restrained shadow.
 */
export function AuthCard({
  eyebrow,
  title,
  subtitle,
  children,
  footer,
  className,
}: AuthCardProps) {
  return (
    <motion.div
      variants={scaleIn}
      initial="hidden"
      animate="show"
      className={cn("relative w-full max-w-[460px]", className)}
    >
      {/* Soft saffron halo behind the card */}
      <div
        aria-hidden
        className="absolute -inset-4 -z-10 rounded-[2rem] bg-saffron/20 opacity-70 blur-3xl"
      />

      <div className="relative overflow-hidden rounded-3xl border border-parchment-muted bg-parchment shadow-[0_30px_80px_-30px_rgba(122,31,31,0.3)]">
        {/* Saffron accent strip at the very top */}
        <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-saffron via-maroon to-saffron" />

        <motion.div
          variants={stagger(0.2, 0.08)}
          initial="hidden"
          animate="show"
          className="relative p-6 sm:p-10"
        >
          {/* Brand mark — sits inside a saffron halo */}
          <motion.div
            variants={fadeUp}
            className="mb-6 flex items-center justify-center"
          >
            <div className="relative">
              <div className="absolute inset-0 animate-pulse-glow rounded-full bg-saffron/40 blur-2xl" />
              <div className="relative flex h-16 w-16 items-center justify-center rounded-full border border-saffron/50 bg-saffron-50">
                <BrandMark size="lg" bare />
              </div>
            </div>
          </motion.div>

          {eyebrow && (
            <motion.p
              variants={fadeUp}
              className="mb-2 text-center text-[11px] font-medium uppercase tracking-[0.35em] text-maroon"
            >
              {eyebrow}
            </motion.p>
          )}

          <motion.h1
            variants={fadeUp}
            className="text-balance text-center font-display text-[28px] leading-tight tracking-tight text-ink sm:text-[34px]"
          >
            {title}
          </motion.h1>

          {subtitle && (
            <motion.p
              variants={fadeUp}
              className="mt-3 text-balance text-center text-sm text-ink-soft"
            >
              {subtitle}
            </motion.p>
          )}

          <motion.div variants={fadeUp} className="mt-8">
            {children}
          </motion.div>

          {footer && (
            <motion.div
              variants={fadeUp}
              className="mt-6 text-center text-sm text-ink-muted"
            >
              {footer}
            </motion.div>
          )}
        </motion.div>
      </div>
    </motion.div>
  );
}

export function AuthDivider({
  children = "or continue with",
}: {
  children?: React.ReactNode;
}) {
  return (
    <div className="my-6 flex items-center gap-4">
      <span className="h-px flex-1 bg-gradient-to-r from-transparent via-parchment-muted to-transparent" />
      <span className="text-[11px] uppercase tracking-[0.25em] text-ink-muted">
        {children}
      </span>
      <span className="h-px flex-1 bg-gradient-to-r from-transparent via-parchment-muted to-transparent" />
    </div>
  );
}

export function AuthFooterLink({
  href,
  children,
  prompt,
}: {
  href: string;
  children: React.ReactNode;
  prompt: string;
}) {
  return (
    <span>
      {prompt}{" "}
      <Link
        href={href}
        className="font-medium text-maroon transition-colors hover:text-maroon-deep"
      >
        {children}
      </Link>
    </span>
  );
}
