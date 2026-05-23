"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  Sparkles,
  ArrowRight,
  Quote,
  ShieldCheck,
  Languages,
  Check,
  Star,
  Heart,
  Brain,
  Waves,
  Briefcase,
  Flame,
  Compass,
  Users,
  ChevronDown,
  CircleHelp,
  Search,
  BookOpenText,
  MessageCircleHeart,
} from "lucide-react";
import { GlowingButton } from "@/components/GlowingButton";
import { Navbar } from "@/components/landing/Navbar";
import { Reveal } from "@/components/landing/Reveal";
import { BrandLockup, BrandMark } from "@/components/BrandMark";
import { cn } from "@/lib/utils";

/* ------------------------------------------------------------------ */
/*  Hero                                                               */
/* ------------------------------------------------------------------ */

function Hero() {
  return (
    <section className="relative mx-auto flex max-w-6xl flex-col items-center px-5 pb-16 pt-32 text-center sm:px-6 sm:pb-24 sm:pt-44">
      {/* Soft saffron halo behind the hero text */}
      <div
        aria-hidden
        className="pointer-events-none absolute left-1/2 top-24 -z-10 h-[520px] w-[520px] -translate-x-1/2 rounded-full bg-saffron/25 blur-3xl"
      />

      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.7 }}
        className="inline-flex items-center gap-2 rounded-full border border-saffron/40 bg-saffron-50 px-4 py-1.5 text-[11px] font-medium uppercase tracking-[0.28em] text-maroon"
      >
        <Sparkles size={13} /> Real verses · Always cited
      </motion.div>

      <motion.h1
        initial={{ opacity: 0, y: 24, filter: "blur(8px)" }}
        animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
        transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1], delay: 0.1 }}
        className="mt-6 max-w-4xl text-balance font-display text-[40px] leading-[1.05] tracking-tight text-ink sm:mt-7 sm:text-6xl md:text-[76px]"
      >
        When life feels heavy,{" "}
        <span className="relative inline-block text-maroon">
          ask MysticAI.
          <span
            aria-hidden
            className="absolute -bottom-1 left-0 right-0 h-2 -skew-y-1 rounded-full bg-saffron/35"
          />
        </span>
      </motion.h1>

      <motion.p
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8, delay: 0.25 }}
        className="mt-7 max-w-2xl text-balance text-base text-ink-soft sm:text-lg"
      >
        MysticAI answers real situations like overthinking, heartbreak, and
        fear of the future, with verses you can verify, in words that sound
        like someone who has actually read the text.
      </motion.p>

      <motion.div
        initial={{ opacity: 0, y: 18 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8, delay: 0.4 }}
        className="mt-9 flex w-full flex-col items-stretch gap-3 sm:w-auto sm:flex-row sm:items-center"
      >
        <Link href="/signup" className="w-full sm:w-auto">
          <GlowingButton
            size="lg"
            variant="primary"
            rightIcon={<ArrowRight size={18} />}
            className="w-full sm:w-auto"
          >
            Start asking for free
          </GlowingButton>
        </Link>
        <Link href="#wisdom" className="w-full sm:w-auto">
          <GlowingButton
            size="lg"
            variant="outline"
            className="w-full sm:w-auto"
          >
            See real answers
          </GlowingButton>
        </Link>
      </motion.div>

      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.8, delay: 0.55 }}
        className="mt-8 flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-xs text-ink-muted"
      >
        <span className="inline-flex items-center gap-1.5">
          <ShieldCheck size={13} className="text-maroon" /> No invented shlokas
        </span>
        <span className="inline-flex items-center gap-1.5">
          <Quote size={13} className="text-maroon" /> Every reply cited
        </span>
        <span className="inline-flex items-center gap-1.5">
          <Languages size={13} className="text-maroon" /> English & हिन्दी
        </span>
      </motion.div>

      {/* Holy-books marquee — what MysticAI covers today and what's
          on the way. The seeker reads the scrolling pills and gets an
          honest snapshot of the corpus (one LIVE source, several queued). */}
      <HolyBooksMarquee />
    </section>
  );
}

/* ------------------------------------------------------------------ */
/*  Holy books marquee — corpus today + future grant roadmap            */
/* ------------------------------------------------------------------ */

type BookStatus = "live" | "soon";

interface HolyBook {
  name: string;
  status: BookStatus;
}

// One LIVE source, the rest queued. Order is roughly by adjacency to the
// Bhagavad Gita: closest Sanatan-dharma corpora first, then Sikh +
// Buddhist neighbors. Swap freely — order = marquee order.
const HOLY_BOOKS: HolyBook[] = [
  { name: "Bhagavad Gita", status: "live" },
  { name: "Ramayana", status: "soon" },
  { name: "Upanishads", status: "soon" },
  { name: "Yoga Sutras", status: "soon" },
  { name: "Hanuman Chalisa", status: "soon" },
  { name: "Ashtavakra Gita", status: "soon" },
  { name: "Mahabharata", status: "soon" },
  { name: "Bhagavata Purana", status: "soon" },
  { name: "Guru Granth Sahib", status: "soon" },
  { name: "Dhammapada", status: "soon" },
];

function HolyBookChip({ book }: { book: HolyBook }) {
  const isLive = book.status === "live";
  return (
    <div className="mx-2 inline-flex shrink-0 items-center gap-2.5 rounded-full border border-parchment-muted bg-parchment px-4 py-2 text-sm text-ink-soft shadow-[0_8px_30px_-16px_rgba(122,31,31,0.18)]">
      <BookOpenText size={14} className="text-maroon/70" />
      <span className="font-medium text-ink">{book.name}</span>
      <span
        className={cn(
          "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium uppercase tracking-[0.12em]",
          isLive
            ? "bg-maroon text-parchment"
            : "border border-saffron/45 bg-saffron-50 text-maroon"
        )}
      >
        {isLive && (
          <span aria-hidden className="h-1.5 w-1.5 animate-pulse rounded-full bg-saffron" />
        )}
        {isLive ? "Live" : "Coming"}
      </span>
    </div>
  );
}

function HolyBooksMarquee() {
  // Render the list twice in a single track so the -50% translate at the
  // end of the keyframe lands on a visually identical position — the
  // viewer never sees the seam.
  const track = [...HOLY_BOOKS, ...HOLY_BOOKS];
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.8, delay: 0.7 }}
      className="group relative mt-10 w-full max-w-5xl overflow-hidden"
      role="region"
      aria-label="Holy books in MysticAI — live and coming soon"
    >
      {/* Soft parchment fades on the marquee edges so chips melt in/out
          instead of hard-clipping at the container boundary. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-y-0 left-0 z-10 w-20 bg-gradient-to-r from-parchment to-transparent"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-y-0 right-0 z-10 w-20 bg-gradient-to-l from-parchment to-transparent"
      />

      <div className="flex w-max animate-marquee py-1 group-hover:[animation-play-state:paused]">
        {track.map((b, i) => (
          <HolyBookChip key={`${b.name}-${i}`} book={b} />
        ))}
      </div>
    </motion.div>
  );
}

/* ------------------------------------------------------------------ */
/*  Topics — what seekers actually bring to MysticAI                   */
/* ------------------------------------------------------------------ */

const topics = [
  {
    icon: Brain,
    title: "Overthinking & anxiety",
    body: "When the mind won't slow down. Krishna calls it 'restless, turbulent, strong', and offers a way to steady it.",
  },
  {
    icon: Heart,
    title: "Heartbreak & loss",
    body: "Grief, betrayal, the ache of someone leaving. The Gita doesn't rush you past it. It sits beside it.",
  },
  {
    icon: Briefcase,
    title: "Work & career fear",
    body: "Effort that feels wasted, futures that won't arrive. 2.47 has been carried into boardrooms for a reason.",
  },
  {
    icon: Flame,
    title: "Anger you can't control",
    body: "The verses on anger are surprisingly modern: what it does to clarity, and how it loosens.",
  },
  {
    icon: Waves,
    title: "Sadness & low energy",
    body: "Heavy days, low mornings. Gentle perspective from a text that has met this for thousands of years.",
  },
  {
    icon: Compass,
    title: "Purpose & meaning",
    body: "What is mine to do? The Gita's central question, answered through your own situation.",
  },
  {
    icon: Users,
    title: "Family & relationships",
    body: "Difficult parents, distant partners, friendships that shifted. Wisdom for the people closest to us.",
  },
  {
    icon: MessageCircleHeart,
    title: "Hard decisions",
    body: "Two paths and no clarity. Krishna spoke directly to a man frozen on a battlefield. Same energy.",
  },
];

function Topics() {
  return (
    <section
      id="topics"
      className="cv-auto relative mx-auto max-w-6xl px-5 py-20 sm:px-6 sm:py-28"
    >
      <Reveal className="mx-auto max-w-2xl text-center">
        <SectionEyebrow>What seekers bring here</SectionEyebrow>
        <SectionTitle>
          The questions people <span className="text-maroon">actually</span>{" "}
          ask
        </SectionTitle>
        <SectionSubtitle>
          Not philosophical puzzles, just real life. Whatever you&rsquo;d bring
          to a trusted friend, the Gita has met it before.
        </SectionSubtitle>
      </Reveal>

      <div className="mt-14 grid gap-4 sm:gap-5 md:grid-cols-2 lg:grid-cols-4">
        {topics.map((t, i) => (
          <Reveal key={t.title} delay={(i % 4) * 0.07}>
            <div className="group relative h-full rounded-2xl border border-parchment-muted bg-parchment p-5 transition-all hover:-translate-y-1 hover:border-maroon/40 hover:shadow-[0_18px_40px_-20px_rgba(122,31,31,0.3)] sm:p-6">
              <span className="mb-4 flex h-11 w-11 items-center justify-center rounded-xl border border-saffron/40 bg-saffron-50 text-maroon transition-transform group-hover:scale-105">
                <t.icon size={20} />
              </span>
              <h3 className="font-display text-lg text-ink sm:text-xl">
                {t.title}
              </h3>
              <p className="mt-1.5 text-[13px] leading-relaxed text-ink-soft sm:text-sm">
                {t.body}
              </p>
            </div>
          </Reveal>
        ))}
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/*  Sample answer — the product "aha"                                  */
/* ------------------------------------------------------------------ */

function SampleAnswer() {
  return (
    <section className="cv-auto relative mx-auto max-w-4xl px-5 pb-20 sm:px-6 sm:pb-28">
      <Reveal className="mx-auto max-w-2xl text-center">
        <SectionEyebrow>A real answer, live</SectionEyebrow>
        <SectionTitle>
          See how MysticAI <span className="text-maroon">responds</span>
        </SectionTitle>
        <SectionSubtitle>
          One real situation, one grounded reply, one verse you can verify.
        </SectionSubtitle>
      </Reveal>

      <Reveal className="mt-12 sm:mt-14">
        <div className="relative overflow-hidden rounded-3xl border border-parchment-muted bg-parchment shadow-[0_30px_80px_-30px_rgba(122,31,31,0.25)]">
          {/* Browser chrome */}
          <div className="flex items-center justify-between border-b border-parchment-muted bg-parchment-deep px-4 py-3 sm:px-5">
            <div className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-full bg-rose-300" />
              <span className="h-2.5 w-2.5 rounded-full bg-amber-300" />
              <span className="h-2.5 w-2.5 rounded-full bg-emerald-400" />
            </div>
            <span className="hidden font-mono text-[10px] uppercase tracking-[0.25em] text-ink-muted sm:inline">
              mysticai · /chat
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-400/40 bg-emerald-50 px-2.5 py-0.5 text-[10px] font-medium uppercase tracking-wider text-emerald-700">
              <span className="relative flex h-1.5 w-1.5">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400/70" />
                <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-500" />
              </span>
              Live
            </span>
          </div>

          <div className="space-y-5 bg-parchment p-5 sm:p-9">
            <div className="flex justify-end">
              <div className="max-w-[88%] whitespace-pre-wrap break-words rounded-2xl rounded-br-md border border-parchment-muted bg-parchment-deep px-4 py-3 text-[15px] text-ink sm:max-w-[80%]">
                I&rsquo;m overwhelmed and stressed about work. I keep worrying
                about whether my effort will pay off.
              </div>
            </div>

            <div className="flex gap-3">
              <span className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-saffron/40 bg-saffron-50">
                <span className="font-display text-base text-maroon">ॐ</span>
              </span>
              <div className="min-w-0 flex-1 space-y-4">
                <p className="text-[15px] leading-relaxed text-ink-soft">
                  <strong className="font-semibold text-ink">
                    The Gita speaks directly to this.
                  </strong>{" "}
                  Krishna teaches that your power lies in the action itself,
                  not in its outcome:
                </p>

                <div className="relative">
                  <div
                    aria-hidden
                    className="absolute -inset-px rounded-2xl bg-gradient-to-br from-saffron/40 via-saffron/10 to-transparent opacity-70 blur-md"
                  />
                  <div className="relative rounded-2xl border border-saffron/40 bg-saffron-50 p-4 sm:p-5">
                    <div className="mb-2.5 inline-flex items-center gap-1.5 rounded-md bg-maroon/10 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wider text-maroon">
                      <Quote size={11} /> Bhagavad Gita 2.47
                    </div>
                    <p className="font-display text-lg leading-snug text-ink sm:text-xl">
                      &ldquo;You have the right to perform your duty, but never
                      to the results of your actions.&rdquo;
                    </p>
                    <p className="mt-2 text-xs italic text-ink-muted">
                      karmaṇy-evādhikāras te mā phaleṣhu kadāchana
                    </p>
                  </div>
                </div>

                <p className="text-[15px] leading-relaxed text-ink-soft">
                  <strong className="font-semibold text-ink">
                    Brought into your situation:
                  </strong>{" "}
                  pour yourself into the work that is yours to do, and release
                  the anxiety of results you cannot control. The worry softens
                  when effort and outcome stop being tangled together.
                </p>

                <div className="flex flex-wrap gap-2 pt-1">
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-400/40 bg-emerald-50 px-3 py-1 text-[11px] text-emerald-700">
                    <ShieldCheck size={12} />
                    Verified verse
                  </span>
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-parchment-muted bg-parchment px-3 py-1 text-[11px] text-ink-muted">
                    <BookOpenText size={12} className="text-maroon" />
                    Tap to read the full shloka
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Footer CTA inside card */}
          <div className="border-t border-parchment-muted bg-parchment-deep px-5 py-5 sm:px-9">
            <div className="flex flex-col items-stretch justify-between gap-3 sm:flex-row sm:items-center">
              <p className="text-[13px] leading-snug text-ink-soft sm:text-sm">
                Now bring your own question. Free to start, no setup.
              </p>
              <Link
                href="/signup"
                className="group inline-flex items-center justify-center gap-1.5 rounded-xl bg-maroon px-4 py-2.5 text-sm font-medium text-parchment shadow-[0_10px_24px_-8px_rgba(122,31,31,0.55)] transition-all hover:bg-maroon-deep"
              >
                Try MysticAI free
                <ArrowRight
                  size={15}
                  className="transition-transform group-hover:translate-x-0.5"
                />
              </Link>
            </div>
          </div>
        </div>
      </Reveal>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/*  Wisdom from the Gita — real verses, beautifully shown              */
/* ------------------------------------------------------------------ */

const verses = [
  {
    ref: "Bhagavad Gita 6.34",
    translation:
      "The mind is indeed restless and difficult to subdue, turbulent, strong, unyielding. As difficult to control as the wind.",
    transliteration: "chañchalaṁ hi manaḥ kṛiṣhṇa pramāthi balavad dṛiḍham",
    reflection:
      "Krishna names what you already feel. Naming it is the first softening.",
    topic: "On a racing mind",
  },
  {
    ref: "Bhagavad Gita 2.47",
    translation:
      "You have the right to perform your duty, but never to the results of your actions.",
    transliteration: "karmaṇy-evādhikāras te mā phaleṣhu kadāchana",
    reflection:
      "Effort is yours; outcome is not. The worry loosens the moment you separate them.",
    topic: "On work & worry",
  },
  {
    ref: "Bhagavad Gita 2.14",
    translation:
      "Contact of the senses with objects gives rise to feelings of heat and cold, pleasure and pain. They come and go and are impermanent. Endure them.",
    transliteration: "mātrā-sparśhās tu kaunteya śhītoṣhṇa-sukha-duḥkha-dāḥ",
    reflection:
      "Whatever you're carrying today is real, and not the whole of you. It passes.",
    topic: "On hard seasons",
  },
  {
    ref: "Bhagavad Gita 18.66",
    translation:
      "Abandon all varieties of duty and simply surrender unto Me alone. I shall liberate you from all sins. Do not fear.",
    transliteration:
      "sarva-dharmān parityajya mām ekaṁ śharaṇaṁ vraja",
    reflection:
      "The closing verse of the Gita. After every argument comes gentleness, and an invitation to stop carrying it alone.",
    topic: "On letting go",
  },
];

function WisdomShowcase() {
  return (
    <section
      id="wisdom"
      className="cv-auto relative bg-parchment-deep px-5 py-20 sm:px-6 sm:py-28"
    >
      <div className="mx-auto max-w-6xl">
        <Reveal className="mx-auto max-w-2xl text-center">
          <SectionEyebrow>Wisdom you&rsquo;ll meet</SectionEyebrow>
          <SectionTitle>
            Four verses, for <span className="text-maroon">four kinds of days</span>
          </SectionTitle>
          <SectionSubtitle>
            Real text, from the public-domain corpus MysticAI draws on. Not
            paraphrases, but the verses themselves, with a one-line invitation.
          </SectionSubtitle>
        </Reveal>

        <div className="mt-14 grid gap-5 md:grid-cols-2">
          {verses.map((v, i) => (
            <Reveal key={v.ref} delay={(i % 2) * 0.1}>
              <article className="group relative h-full overflow-hidden rounded-3xl border border-parchment-muted bg-parchment p-6 transition-all hover:border-maroon/40 hover:shadow-[0_18px_50px_-24px_rgba(122,31,31,0.35)] sm:p-8">
                <div
                  aria-hidden
                  className="pointer-events-none absolute -right-10 -top-10 h-32 w-32 rounded-full bg-saffron/10 blur-3xl"
                />
                <div className="flex items-center justify-between">
                  <span className="inline-flex items-center gap-1.5 rounded-md bg-maroon/10 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wider text-maroon">
                    <Quote size={11} /> {v.ref}
                  </span>
                  <span className="text-[10px] uppercase tracking-[0.22em] text-ink-muted">
                    {v.topic}
                  </span>
                </div>
                <blockquote className="mt-5 font-display text-xl leading-snug text-ink sm:text-2xl">
                  &ldquo;{v.translation}&rdquo;
                </blockquote>
                <p className="mt-3 text-xs italic text-ink-muted">
                  {v.transliteration}
                </p>
                <div className="mt-5 flex items-start gap-2 border-t border-parchment-muted pt-4 text-sm leading-relaxed text-ink-soft">
                  <Sparkles
                    size={14}
                    className="mt-1 shrink-0 text-saffron"
                  />
                  <p>{v.reflection}</p>
                </div>
              </article>
            </Reveal>
          ))}
        </div>

        <Reveal className="mt-12 text-center">
          <Link href="/signup">
            <GlowingButton
              size="lg"
              variant="primary"
              rightIcon={<ArrowRight size={18} />}
            >
              Ask your own question
            </GlowingButton>
          </Link>
        </Reveal>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/*  How it works                                                       */
/* ------------------------------------------------------------------ */

const steps = [
  {
    icon: MessageCircleHeart,
    title: "Tell it what's heavy",
    body: "Plain words. No scripture knowledge needed. Whatever you'd say to a friend who'd actually listen.",
  },
  {
    icon: Search,
    title: "It finds the verse",
    body: "From a verified Bhagavad Gita corpus of 700+ shlokas. The matching verse is retrieved, never invented.",
  },
  {
    icon: BookOpenText,
    title: "You receive an answer",
    body: "A grounded reply that quotes the verse, explains it gently, and brings it into your specific situation.",
  },
];

function HowItWorks() {
  return (
    <section
      id="how"
      className="cv-auto relative mx-auto max-w-6xl px-5 py-20 sm:px-6 sm:py-28"
    >
      <Reveal className="mx-auto max-w-2xl text-center">
        <SectionEyebrow>How it works</SectionEyebrow>
        <SectionTitle>
          Three steps from question to{" "}
          <span className="text-maroon">real wisdom</span>
        </SectionTitle>
        <SectionSubtitle>
          Retrieval-Augmented Generation in plain language: find the verse
          first, then explain it. The AI never makes a verse up.
        </SectionSubtitle>
      </Reveal>

      <div className="relative mt-16 grid gap-5 md:grid-cols-3">
        {/* Connecting line on desktop */}
        <div
          aria-hidden
          className="absolute left-12 right-12 top-12 hidden h-px bg-gradient-to-r from-transparent via-maroon/30 to-transparent md:block"
        />
        {steps.map((s, i) => (
          <Reveal key={s.title} delay={i * 0.12}>
            <div className="relative flex h-full flex-col items-center rounded-2xl border border-parchment-muted bg-parchment p-7 text-center transition-all hover:border-maroon/40">
              <div className="mb-5 flex h-14 w-14 items-center justify-center rounded-2xl border border-saffron/40 bg-saffron-50 text-maroon">
                <s.icon size={24} />
              </div>
              <div className="mb-1 font-display text-xs uppercase tracking-[0.25em] text-maroon">
                Step {i + 1}
              </div>
              <h3 className="font-display text-xl text-ink">{s.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-ink-soft">
                {s.body}
              </p>
            </div>
          </Reveal>
        ))}
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/*  Testimonials                                                       */
/* ------------------------------------------------------------------ */

const testimonials = [
  {
    name: "Ananya R.",
    role: "Designer, Bengaluru",
    initials: "AR",
    quote:
      "I asked at 3am when I couldn't sleep. The answer felt like a friend who'd actually read the text. It pointed me to 6.34, the verse about the restless mind. Sat with it for an hour and finally slept.",
  },
  {
    name: "Vikram S.",
    role: "Founder, Pune",
    initials: "VS",
    quote:
      "I was skeptical about AI for something this personal. But every reply cites a real verse. I checked three of them against a paper copy. It's the real thing, translated for now.",
  },
  {
    name: "Priya M.",
    role: "Doctor, Delhi",
    initials: "PM",
    quote:
      "Found a verse for the grief I'd been carrying for two years. I'd never have known to look for 2.14 on my own. Reading it felt like someone finally understood.",
  },
];

function Testimonials() {
  return (
    <section className="cv-auto relative mx-auto max-w-6xl px-5 py-20 sm:px-6 sm:py-28">
      <Reveal className="mx-auto max-w-2xl text-center">
        <SectionEyebrow>What seekers say</SectionEyebrow>
        <SectionTitle>
          Words from <span className="text-maroon">real users</span>
        </SectionTitle>
      </Reveal>

      <div className="mt-14 grid gap-5 md:grid-cols-3">
        {testimonials.map((t, i) => (
          <Reveal key={t.name} delay={i * 0.1}>
            <article className="relative flex h-full flex-col rounded-2xl border border-parchment-muted bg-parchment p-6 transition-all hover:border-maroon/30 sm:p-7">
              <Quote
                size={26}
                className="absolute right-5 top-5 text-saffron/60"
              />
              <div className="mb-3 inline-flex">
                {[0, 1, 2, 3, 4].map((i) => (
                  <Star
                    key={i}
                    size={13}
                    className="fill-saffron text-saffron"
                  />
                ))}
              </div>
              <p className="text-[15px] leading-relaxed text-ink-soft">
                &ldquo;{t.quote}&rdquo;
              </p>
              <div className="mt-6 flex items-center gap-3 border-t border-parchment-muted pt-4">
                <span className="flex h-10 w-10 items-center justify-center rounded-full bg-maroon font-display text-sm text-parchment">
                  {t.initials}
                </span>
                <div>
                  <p className="text-sm font-medium text-ink">{t.name}</p>
                  <p className="text-xs text-ink-muted">{t.role}</p>
                </div>
              </div>
            </article>
          </Reveal>
        ))}
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/*  FAQ                                                                */
/* ------------------------------------------------------------------ */

const faqs = [
  {
    q: "Are the verses real, or does the AI make them up?",
    a: "Every verse is pulled from a verified, public-domain Bhagavad Gita corpus before the AI writes its reply. The model is forbidden to invent shlokas. If no verse genuinely fits, it paraphrases Krishna's teaching instead. Every citation is real and verifiable.",
  },
  {
    q: "Is MysticAI a substitute for therapy?",
    a: "No. MysticAI offers reflection, perspective, and timeless wisdom, useful for many ordinary hard moments. For ongoing mental health concerns, please reach out to a qualified professional. MysticAI is not a clinical service.",
  },
  {
    q: "What if I'm in crisis right now?",
    a: "If you're thinking about suicide or self-harm, MysticAI will quietly step aside and give you real helplines (iCall, Vandrevala, 988, Samaritans) before anything else. Please reach out to a human first. We're built to help, not to replace human help in those moments.",
  },
  {
    q: "Does it speak Hindi?",
    a: "Yes. After any reply, tap हिंदी to translate. The Sanskrit transliteration is preserved byte-for-byte, and the Gita reference stays in its standard form. More Indic languages are on the roadmap.",
  },
  {
    q: "Will MysticAI judge me?",
    a: "No. There is no shame in what you bring. The Gita itself opens with Arjuna paralyzed by despair, and Krishna does not shame him. He listens, then teaches. MysticAI inherits that posture.",
  },
  {
    q: "How much does it cost?",
    a: "Free to start, with a generous daily quota. Premium (₹199/mo) removes limits and adds Hindi, audio, deeper commentary, and a private reflection journal. Scholar (₹999/mo) adds Sanskrit tools and API access.",
  },
];

function Faq() {
  const [open, setOpen] = React.useState<number | null>(0);
  return (
    <section
      id="faq"
      className="cv-auto relative mx-auto max-w-3xl px-5 py-20 sm:px-6 sm:py-28"
    >
      <Reveal className="mx-auto max-w-2xl text-center">
        <SectionEyebrow>Frequently asked</SectionEyebrow>
        <SectionTitle>
          Questions, <span className="text-maroon">answered honestly</span>
        </SectionTitle>
      </Reveal>

      <div className="mt-12 space-y-3">
        {faqs.map((f, i) => {
          const isOpen = open === i;
          return (
            <Reveal key={f.q} delay={(i % 6) * 0.05}>
              <div
                className={cn(
                  "overflow-hidden rounded-2xl border bg-parchment transition-colors",
                  isOpen
                    ? "border-maroon/40 shadow-[0_18px_40px_-22px_rgba(122,31,31,0.25)]"
                    : "border-parchment-muted hover:border-maroon/30"
                )}
              >
                <button
                  onClick={() => setOpen(isOpen ? null : i)}
                  className="flex w-full items-start gap-3 px-5 py-4 text-left sm:gap-4 sm:px-6 sm:py-5"
                  aria-expanded={isOpen}
                >
                  <CircleHelp
                    size={18}
                    className={cn(
                      "mt-0.5 shrink-0 transition-colors",
                      isOpen ? "text-maroon" : "text-saffron"
                    )}
                  />
                  <span className="flex-1 font-display text-base text-ink sm:text-lg">
                    {f.q}
                  </span>
                  <ChevronDown
                    size={18}
                    className={cn(
                      "mt-0.5 shrink-0 text-ink-muted transition-transform duration-300",
                      isOpen && "rotate-180 text-maroon"
                    )}
                  />
                </button>
                <AnimatePresence initial={false}>
                  {isOpen && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
                      className="overflow-hidden"
                    >
                      <p className="px-5 pb-5 pl-[52px] text-sm leading-relaxed text-ink-soft sm:px-6 sm:pb-6 sm:pl-[58px]">
                        {f.a}
                      </p>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </Reveal>
          );
        })}
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/*  Pricing                                                            */
/* ------------------------------------------------------------------ */

const tiers = [
  {
    name: "Free",
    price: "₹0",
    cadence: "forever",
    features: [
      "20 questions per day",
      "Bhagavad Gita corpus",
      "English language",
      "Cited verses & translations",
    ],
    cta: "Start free",
    highlight: false,
  },
  {
    name: "Premium",
    price: "₹199",
    cadence: "/ month",
    features: [
      "Unlimited questions",
      "English + हिन्दी",
      "Audio recitation of verses",
      "Deeper commentary lenses",
      "Private reflection journal",
      "Priority response speed",
    ],
    cta: "Go Premium",
    highlight: true,
  },
  {
    name: "Scholar",
    price: "₹999",
    cadence: "/ month",
    features: [
      "Everything in Premium",
      "Sanskrit analysis tools",
      "Commentary comparison",
      "API access",
      "Priority support",
    ],
    cta: "Get Scholar",
    highlight: false,
  },
];

function Pricing() {
  return (
    <section
      id="pricing"
      className="cv-auto relative bg-parchment-deep px-5 py-20 sm:px-6 sm:py-28"
    >
      <div className="mx-auto max-w-6xl">
        <Reveal className="mx-auto max-w-2xl text-center">
          <SectionEyebrow>Pricing</SectionEyebrow>
          <SectionTitle>
            Start free. <span className="text-maroon">Go deeper anytime.</span>
          </SectionTitle>
          <SectionSubtitle>
            A generous free tier forever. Upgrade for unlimited wisdom and
            scholarly depth.
          </SectionSubtitle>
        </Reveal>

        <div className="mt-14 grid items-stretch gap-5 lg:grid-cols-3">
          {tiers.map((t, i) => (
            <Reveal key={t.name} delay={i * 0.1}>
              <div
                className={cn(
                  "relative flex h-full flex-col rounded-3xl border p-8",
                  t.highlight
                    ? "border-maroon/40 bg-parchment shadow-[0_30px_80px_-30px_rgba(122,31,31,0.4)]"
                    : "border-parchment-muted bg-parchment"
                )}
              >
                {t.highlight && (
                  <span className="absolute -top-3 left-1/2 inline-flex -translate-x-1/2 items-center gap-1.5 rounded-full bg-maroon px-3 py-1 text-[11px] font-semibold uppercase tracking-wider text-parchment">
                    <Star size={11} className="fill-parchment" /> Most popular
                  </span>
                )}
                <h3 className="font-display text-2xl text-ink">{t.name}</h3>
                <div className="mt-3 flex items-end gap-1.5">
                  <span className="font-display text-4xl text-maroon">
                    {t.price}
                  </span>
                  <span className="pb-1 text-sm text-ink-muted">
                    {t.cadence}
                  </span>
                </div>

                <ul className="mt-6 flex-1 space-y-3">
                  {t.features.map((f) => (
                    <li
                      key={f}
                      className="flex items-start gap-2.5 text-sm text-ink-soft"
                    >
                      <Check
                        size={16}
                        className="mt-0.5 shrink-0 text-maroon"
                      />
                      {f}
                    </li>
                  ))}
                </ul>

                <Link href="/signup" className="mt-8">
                  <GlowingButton
                    className="w-full"
                    variant={t.highlight ? "primary" : "outline"}
                  >
                    {t.cta}
                  </GlowingButton>
                </Link>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/*  Final CTA + footer                                                 */
/* ------------------------------------------------------------------ */

function FinalCTA() {
  return (
    <section className="cv-auto relative mx-auto max-w-4xl px-5 py-24 text-center sm:px-6 sm:py-32">
      <Reveal>
        <div className="relative overflow-hidden rounded-[2rem] border border-parchment-muted bg-parchment px-8 py-16 shadow-[0_40px_100px_-40px_rgba(122,31,31,0.35)] sm:px-16">
          <div
            aria-hidden
            className="absolute inset-0 bg-parchment-radial opacity-80"
          />
          <div className="relative">
            <h2 className="text-balance font-display text-4xl leading-tight tracking-tight text-ink sm:text-5xl">
              Your next answer is{" "}
              <span className="text-maroon">one question away.</span>
            </h2>
            <p className="mx-auto mt-5 max-w-xl text-balance text-ink-soft">
              Join the seekers turning to timeless wisdom for modern life. Free
              to begin, no scripture knowledge required.
            </p>
            <div className="mt-9 flex justify-center">
              <Link href="/signup">
                <GlowingButton
                  size="lg"
                  variant="primary"
                  rightIcon={<ArrowRight size={18} />}
                >
                  Begin your journey
                </GlowingButton>
              </Link>
            </div>
            <figure className="mt-12">
              <blockquote className="font-display text-xl italic text-ink-soft">
                &ldquo;Yoga is the journey of the self, through the self, to
                the self.&rdquo;
              </blockquote>
              <figcaption className="mt-3 text-[11px] uppercase tracking-[0.3em] text-maroon">
                Bhagavad Gita 6.20
              </figcaption>
            </figure>
          </div>
        </div>
      </Reveal>
    </section>
  );
}

function Footer() {
  return (
    <footer className="relative border-t border-parchment-muted bg-parchment-deep px-6 py-10">
      <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 text-sm text-ink-muted sm:flex-row">
        <BrandLockup size="sm" surface="light" />
        <p>Ancient · Modern · Eternal</p>
        <p>© {new Date().getFullYear()} MysticAI</p>
      </div>
    </footer>
  );
}

/* ------------------------------------------------------------------ */
/*  Shared section bits                                                */
/* ------------------------------------------------------------------ */

function SectionEyebrow({ children }: { children: React.ReactNode }) {
  return (
    <p className="mb-4 text-[11px] font-medium uppercase tracking-[0.32em] text-maroon">
      {children}
    </p>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="text-balance font-display text-[32px] leading-tight tracking-tight text-ink sm:text-5xl">
      {children}
    </h2>
  );
}

function SectionSubtitle({ children }: { children: React.ReactNode }) {
  return (
    <p className="mt-4 text-balance text-[15px] text-ink-soft sm:text-base">
      {children}
    </p>
  );
}

/* ------------------------------------------------------------------ */
/*  Page                                                               */
/* ------------------------------------------------------------------ */

export default function HomePage() {
  const router = useRouter();
  React.useEffect(() => {
    router.prefetch("/login");
    router.prefetch("/signup");
  }, [router]);

  return (
    <div className="relative min-h-[100dvh] w-full overflow-hidden bg-parchment text-ink">
      {/* Soft parchment wash behind everything */}
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 -z-10 bg-parchment-radial"
      />
      <Navbar />
      <main className="relative">
        <Hero />
        <Topics />
        <SampleAnswer />
        <WisdomShowcase />
        <HowItWorks />
        <Testimonials />
        <Faq />
        <Pricing />
        <FinalCTA />
      </main>
      <Footer />
    </div>
  );
}
