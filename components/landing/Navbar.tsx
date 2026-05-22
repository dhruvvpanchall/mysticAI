"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { Menu, X } from "lucide-react";
import { BrandLockup } from "@/components/BrandMark";
import { cn } from "@/lib/utils";

const links = [
  { label: "How it works", href: "#how" },
  { label: "Topics", href: "#topics" },
  { label: "Wisdom", href: "#wisdom" },
  { label: "Pricing", href: "#pricing" },
  { label: "FAQ", href: "#faq" },
];

export function Navbar() {
  const router = useRouter();
  const [scrolled, setScrolled] = React.useState(false);
  const [mobileOpen, setMobileOpen] = React.useState(false);

  React.useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 16);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // Warm-compile auth routes in dev so the first click is instant.
  React.useEffect(() => {
    router.prefetch("/login");
    router.prefetch("/signup");
  }, [router]);

  const warmLogin = React.useCallback(() => router.prefetch("/login"), [router]);
  const warmSignup = React.useCallback(
    () => router.prefetch("/signup"),
    [router]
  );

  return (
    <motion.header
      initial={{ y: -24, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
      className="fixed inset-x-0 top-0 z-50 flex justify-center px-3 pt-3 sm:px-4 sm:pt-4"
    >
      <nav
        className={cn(
          "flex w-full max-w-6xl items-center justify-between rounded-2xl border px-3 py-2.5 transition-all duration-500 sm:px-5",
          scrolled
            ? "border-parchment-muted/70 bg-parchment/90 shadow-[0_8px_30px_-12px_rgba(122,31,31,0.18)] backdrop-blur-md"
            : "border-transparent bg-transparent"
        )}
      >
        <Link
          href="/"
          onClick={() => setMobileOpen(false)}
          className="flex items-center"
        >
          <BrandLockup size="md" surface="light" />
        </Link>

        <div className="hidden items-center gap-8 md:flex">
          {links.map((l) => (
            <a
              key={l.href}
              href={l.href}
              className="text-sm text-ink-soft transition-colors hover:text-maroon"
            >
              {l.label}
            </a>
          ))}
        </div>

        <div className="flex items-center gap-2 sm:gap-3">
          <Link
            href="/login"
            onMouseEnter={warmLogin}
            onTouchStart={warmLogin}
            className="hidden rounded-lg px-3 py-2 text-sm text-ink-soft transition-colors hover:text-maroon sm:block"
          >
            Sign in
          </Link>
          <Link
            href="/signup"
            onMouseEnter={warmSignup}
            onTouchStart={warmSignup}
            className="hidden rounded-xl bg-maroon px-4 py-2 text-sm font-medium text-parchment shadow-[0_8px_20px_-8px_rgba(122,31,31,0.5)] transition-all hover:bg-maroon-deep hover:shadow-[0_8px_28px_-6px_rgba(122,31,31,0.6)] sm:block"
          >
            Get started
          </Link>
          <button
            onClick={() => setMobileOpen((o) => !o)}
            aria-label="Toggle menu"
            className="flex h-10 w-10 items-center justify-center rounded-lg border border-parchment-muted bg-parchment text-ink-soft transition-colors hover:border-maroon/40 hover:text-maroon md:hidden"
          >
            {mobileOpen ? <X size={18} /> : <Menu size={18} />}
          </button>
        </div>
      </nav>

      {/* Mobile menu sheet */}
      <AnimatePresence>
        {mobileOpen && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.2 }}
            className="absolute inset-x-3 top-[68px] z-40 rounded-2xl border border-parchment-muted bg-parchment p-2 shadow-[0_24px_60px_-24px_rgba(122,31,31,0.3)] md:hidden"
          >
            <div className="flex flex-col">
              {links.map((l) => (
                <a
                  key={l.href}
                  href={l.href}
                  onClick={() => setMobileOpen(false)}
                  className="rounded-lg px-4 py-3 text-sm text-ink-soft transition-colors hover:bg-parchment-deep hover:text-maroon"
                >
                  {l.label}
                </a>
              ))}
              <div className="my-1 h-px bg-parchment-muted/60" />
              <Link
                href="/login"
                onClick={() => setMobileOpen(false)}
                className="rounded-lg px-4 py-3 text-sm text-ink-soft transition-colors hover:bg-parchment-deep hover:text-maroon"
              >
                Sign in
              </Link>
              <Link
                href="/signup"
                onClick={() => setMobileOpen(false)}
                className="m-1 rounded-lg bg-maroon px-4 py-3 text-center text-sm font-medium text-parchment hover:bg-maroon-deep"
              >
                Get started
              </Link>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.header>
  );
}
