"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { Mail, Lock, ArrowRight } from "lucide-react";
import { AuthCard, AuthDivider, AuthFooterLink } from "@/components/AuthCard";
import { FormInput } from "@/components/FormInput";
import { GlowingButton } from "@/components/GlowingButton";
import { Checkbox } from "@/components/Checkbox";
import { SocialButtons } from "@/components/SocialButtons";
import { useAuth } from "@/lib/auth";

export default function LoginPage() {
  const router = useRouter();
  const { user, loading: authLoading, login, googleLogin } = useAuth();
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [remember, setRemember] = React.useState(true);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  // Already signed in? Skip straight to the sanctum.
  React.useEffect(() => {
    if (!authLoading && user) router.replace("/chat");
  }, [authLoading, user, router]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!email || !password) {
      setError("Please complete both fields to enter.");
      return;
    }
    setLoading(true);
    try {
      await login(email, password);
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
      eyebrow="Welcome back"
      title={
        <>
          Pick up where you{" "}
          <span className="text-maroon">left off</span>
        </>
      }
      subtitle="Sign in to keep asking life's questions and receiving cited wisdom from the Gita."
      footer={
        <AuthFooterLink href="/signup" prompt="New to MysticAI?">
          Begin your journey →
        </AuthFooterLink>
      }
    >
      <form
        onSubmit={onSubmit}
        className="space-y-4"
        noValidate
        autoComplete="off"
      >
        {/* Decoy fields: browsers autofill the first credential pair they
            find — feeding them these hidden inputs keeps the real ones
            blank. */}
        <input
          type="text"
          name="username"
          autoComplete="username"
          tabIndex={-1}
          aria-hidden
          className="hidden"
        />
        <input
          type="password"
          name="password"
          autoComplete="new-password"
          tabIndex={-1}
          aria-hidden
          className="hidden"
        />

        <FormInput
          label="Email"
          type="email"
          name="mystic-email"
          autoComplete="off"
          icon={<Mail size={17} />}
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <FormInput
          label="Password"
          type="password"
          name="mystic-password"
          autoComplete="new-password"
          icon={<Lock size={17} />}
          showPasswordToggle
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />

        {error && (
          <motion.p
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            className="rounded-lg border border-rose-400/40 bg-rose-50 px-3 py-2 text-xs text-rose-700"
          >
            {error}
          </motion.p>
        )}

        <div className="flex items-center justify-between pt-1">
          <Checkbox
            checked={remember}
            onChange={setRemember}
            label="Remember me"
          />
          <a
            href="#"
            className="text-sm text-ink-soft transition-colors hover:text-maroon"
          >
            Forgot password?
          </a>
        </div>

        <GlowingButton
          type="submit"
          size="lg"
          variant="primary"
          className="mt-6 w-full"
          loading={loading}
          rightIcon={<ArrowRight size={18} />}
        >
          Sign in
        </GlowingButton>
      </form>

      <AuthDivider />

      <SocialButtons onGoogle={handleGoogle} />
    </AuthCard>
  );
}
