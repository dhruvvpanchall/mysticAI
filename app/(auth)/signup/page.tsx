"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { Mail, Lock, User, Sparkles } from "lucide-react";
import { AuthCard, AuthDivider, AuthFooterLink } from "@/components/AuthCard";
import { FormInput } from "@/components/FormInput";
import { GlowingButton } from "@/components/GlowingButton";
import { Checkbox } from "@/components/Checkbox";
import { SocialButtons } from "@/components/SocialButtons";
import { useAuth } from "@/lib/auth";

function strengthOf(password: string) {
  let score = 0;
  if (password.length >= 8) score++;
  if (/[A-Z]/.test(password)) score++;
  if (/[0-9]/.test(password)) score++;
  if (/[^A-Za-z0-9]/.test(password)) score++;
  return score; // 0..4
}

const strengthLabels = ["", "Faint spark", "Glowing ember", "Steady flame", "Divine fire"];
const strengthColors = [
  "bg-parchment-muted",
  "bg-rose-400",
  "bg-amber-400",
  "bg-saffron",
  "bg-gradient-to-r from-saffron via-maroon to-saffron",
];

export default function SignupPage() {
  const router = useRouter();
  const { user, loading: authLoading, signup, googleLogin } = useAuth();
  const [name, setName] = React.useState("");
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [accept, setAccept] = React.useState(false);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const score = strengthOf(password);

  React.useEffect(() => {
    if (!authLoading && user) router.replace("/chat");
  }, [authLoading, user, router]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!name || !email || !password) {
      setError("Please complete the sacred trinity above.");
      return;
    }
    if (password.length < 8) {
      setError("Let your password hold at least 8 characters.");
      return;
    }
    if (!accept) {
      setError("Please accept the path of consent to continue.");
      return;
    }
    setLoading(true);
    try {
      await signup(name, email, password);
      router.replace("/chat");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
      setLoading(false);
    }
  }

  async function handleGoogle() {
    setError(null);
    try {
      await googleLogin();
      router.replace("/chat");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    }
  }

  return (
    <AuthCard
      eyebrow="Begin your journey"
      title={
        <>
          Ancient wisdom,{" "}
          <span className="text-maroon">in your pocket.</span>
        </>
      }
      subtitle="Free to start. No credit card. Bring whatever's weighing on you."
      footer={
        <AuthFooterLink href="/login" prompt="Already a seeker?">
          Sign in →
        </AuthFooterLink>
      }
    >
      <form onSubmit={onSubmit} className="space-y-3" noValidate>
        {/* Row 1: Name + Email side-by-side, occupies the same vertical
            space as login's email row. */}
        <div className="grid grid-cols-2 gap-3">
          <FormInput
            label="Full name"
            icon={<User size={17} />}
            autoComplete="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <FormInput
            label="Email"
            type="email"
            icon={<Mail size={17} />}
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>

        <FormInput
          label="Password"
          type="password"
          icon={<Lock size={17} />}
          autoComplete="new-password"
          showPasswordToggle
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />

        {/* Slim strength row — only mounts while typing, so the empty
            form keeps its compact height. */}
        {password.length > 0 && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            className="flex items-center gap-3 overflow-hidden px-1"
          >
            <div className="flex flex-1 gap-1.5">
              {[0, 1, 2, 3].map((i) => (
                <div
                  key={i}
                  className={`h-[3px] flex-1 rounded-full transition-all duration-500 ${
                    i < score ? strengthColors[score] : "bg-parchment-muted"
                  }`}
                />
              ))}
            </div>
            <span className="shrink-0 text-[10px] uppercase tracking-[0.16em] text-ink-muted">
              {strengthLabels[score]}
            </span>
          </motion.div>
        )}

        {error && (
          <motion.p
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            className="rounded-lg border border-rose-400/40 bg-rose-50 px-3 py-2 text-xs text-rose-700"
          >
            {error}
          </motion.p>
        )}

        {/* Row 3: Consent — mirrors login's remember/forgot row so the
            overall form height matches exactly. */}
        <div className="flex items-center justify-between pt-1">
          <Checkbox
            checked={accept}
            onChange={setAccept}
            label={
              <span className="text-sm text-ink-soft">
                I accept the{" "}
                <a href="#" className="text-maroon hover:text-maroon-deep">
                  terms
                </a>
              </span>
            }
          />
          <a
            href="#"
            className="text-sm text-ink-soft transition-colors hover:text-maroon"
          >
            Privacy
          </a>
        </div>

        <GlowingButton
          type="submit"
          size="lg"
          variant="primary"
          className="mt-4 w-full"
          loading={loading}
          leftIcon={<Sparkles size={17} />}
        >
          Create my account
        </GlowingButton>
      </form>

      <AuthDivider>or join with</AuthDivider>

      <SocialButtons onGoogle={handleGoogle} />
    </AuthCard>
  );
}
