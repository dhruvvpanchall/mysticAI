"use client";

import * as React from "react";
import { motion } from "framer-motion";
import { Quote, ShieldCheck, BookOpenText, Languages } from "lucide-react";
import { SacredGeometry } from "@/assets/SacredGeometry";
import { BrandMark } from "@/components/BrandMark";
import { spiritualQuotes } from "@/lib/utils";
import { fadeUp, stagger } from "@/animations/variants";

/**
 * Tall side panel shown on desktop next to the auth card. Light/warm
 * treatment to match the new landing — saffron wash, rotating mandala,
 * cycling Gita quote, trust strip at the foot.
 */
export function QuotePanel() {
  const [index, setIndex] = React.useState(0);

  React.useEffect(() => {
    const t = setInterval(
      () => setIndex((i) => (i + 1) % spiritualQuotes.length),
      7000
    );
    return () => clearInterval(t);
  }, []);

  const quote = spiritualQuotes[index];

  return (
    <motion.aside
      variants={stagger(0.1, 0.1)}
      initial="hidden"
      animate="show"
      className="relative hidden flex-col justify-between overflow-hidden bg-gradient-to-br from-parchment-deep via-parchment to-saffron-50 p-12 lg:flex"
    >
      {/* Background mandala — warm saffron tone */}
      <motion.div
        aria-hidden
        animate={{ rotate: 360 }}
        transition={{ duration: 280, repeat: Infinity, ease: "linear" }}
        className="pointer-events-none absolute -right-32 top-1/2 h-[120%] w-[120%] -translate-y-1/2 mask-radial-fade text-maroon/20"
      >
        <SacredGeometry className="h-full w-full" stroke="currentColor" />
      </motion.div>

      {/* Soft saffron halo */}
      <div
        aria-hidden
        className="pointer-events-none absolute -left-32 -top-32 h-[28rem] w-[28rem] rounded-full bg-saffron/30 blur-3xl"
      />

      <motion.div variants={fadeUp} className="relative">
        <div className="flex items-center gap-3">
          <BrandMark size="lg" surface="light" />
          <div>
            <div className="font-display text-xl tracking-wide text-ink">
              Mystic<span className="text-maroon">AI</span>
            </div>
            <div className="text-[11px] uppercase tracking-[0.3em] text-ink-muted">
              Wisdom · Guidance · Growth · Unity
            </div>
          </div>
        </div>
      </motion.div>

      <motion.div variants={fadeUp} className="relative max-w-md">
        <Quote className="mb-6 h-7 w-7 text-maroon/70" />
        <motion.blockquote
          key={quote.source}
          initial={{ opacity: 0, y: 20, filter: "blur(6px)" }}
          animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
          transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1] }}
          className="font-display text-[26px] leading-snug text-ink"
        >
          &ldquo;{quote.text}&rdquo;
        </motion.blockquote>
        <motion.cite
          key={`s-${quote.source}`}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.9, delay: 0.15 }}
          className="mt-5 inline-flex items-center gap-2 not-italic text-[12px] uppercase tracking-[0.3em] text-maroon"
        >
          <span className="h-px w-8 bg-maroon/50" />
          {quote.source}
        </motion.cite>

        {/* Dot indicators */}
        <div className="mt-7 flex gap-1.5">
          {spiritualQuotes.map((_, i) => (
            <button
              key={i}
              onClick={() => setIndex(i)}
              aria-label={`Quote ${i + 1}`}
              className={`h-1 rounded-full transition-all duration-500 ${
                i === index
                  ? "w-8 bg-maroon"
                  : "w-3 bg-ink-muted/20 hover:bg-ink-muted/40"
              }`}
            />
          ))}
        </div>
      </motion.div>

      {/* Trust strip — what makes MysticAI different, in 3 quick bullets */}
      <motion.div
        variants={fadeUp}
        className="relative grid grid-cols-1 gap-3 text-sm text-ink-soft"
      >
        <Trust
          icon={<ShieldCheck size={15} />}
          label="No invented shlokas. Every verse is real and cited."
        />
        <Trust
          icon={<BookOpenText size={15} />}
          label="700+ verified Bhagavad Gita verses, searchable in plain English."
        />
        <Trust
          icon={<Languages size={15} />}
          label="Replies in English with one-tap हिन्दी translation."
        />
      </motion.div>
    </motion.aside>
  );
}

function Trust({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <div className="flex items-start gap-2.5">
      <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-md border border-saffron/40 bg-saffron-50 text-maroon">
        {icon}
      </span>
      <span className="leading-snug">{label}</span>
    </div>
  );
}
