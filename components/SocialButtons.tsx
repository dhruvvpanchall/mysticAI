"use client";

import * as React from "react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

function GoogleIcon(props: React.SVGProps<SVGSVGElement>) {
  // Multi-color official Google "G" mark.
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" {...props}>
      <path
        fill="#4285F4"
        d="M23.49 12.27c0-.79-.07-1.54-.19-2.27H12v4.51h6.47c-.29 1.48-1.14 2.73-2.41 3.58v2.97h3.88c2.28-2.1 3.55-5.19 3.55-8.79z"
      />
      <path
        fill="#34A853"
        d="M12 24c3.24 0 5.96-1.07 7.94-2.91l-3.88-2.97c-1.08.72-2.45 1.16-4.06 1.16-3.13 0-5.78-2.11-6.73-4.96H1.27v3.11C3.25 21.31 7.31 24 12 24z"
      />
      <path
        fill="#FBBC05"
        d="M5.27 14.32c-.24-.72-.38-1.49-.38-2.27s.14-1.55.38-2.27V6.67H1.27C.46 8.28 0 10.09 0 12s.46 3.72 1.27 5.33l4-3.01z"
      />
      <path
        fill="#EA4335"
        d="M12 4.77c1.77 0 3.36.61 4.61 1.81l3.45-3.45C17.95 1.19 15.24 0 12 0 7.31 0 3.25 2.69 1.27 6.67l4 3.01C6.22 6.88 8.87 4.77 12 4.77z"
      />
    </svg>
  );
}

interface SocialButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  icon: React.ReactNode;
  label: string;
  loading?: boolean;
}

function SocialButton({
  icon,
  label,
  className,
  loading,
  disabled,
  ...props
}: SocialButtonProps) {
  return (
    <motion.button
      type="button"
      whileHover={loading || disabled ? undefined : { y: -2 }}
      whileTap={loading || disabled ? undefined : { scale: 0.97 }}
      transition={{ type: "spring", stiffness: 320, damping: 22 }}
      className={cn(
        "group relative flex h-11 flex-1 items-center justify-center gap-2 overflow-hidden rounded-xl border border-parchment-muted bg-parchment text-sm text-ink-soft transition-all hover:border-maroon/40 hover:bg-parchment-deep hover:text-ink disabled:cursor-not-allowed disabled:opacity-60",
        className
      )}
      aria-label={label}
      disabled={loading || disabled}
      {...(props as React.ComponentProps<typeof motion.button>)}
    >
      <span
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-500 group-hover:opacity-100"
        style={{
          background:
            "radial-gradient(120px 60px at 50% 110%, rgba(245,166,35,0.18), transparent 70%)",
        }}
      />
      <span className="relative flex items-center gap-2.5">
        {loading ? (
          <span className="h-4 w-4 animate-spin rounded-full border-2 border-ink-muted border-t-transparent" />
        ) : (
          icon
        )}
        <span>{label}</span>
      </span>
    </motion.button>
  );
}

export interface SocialButtonsProps {
  /** Handler for the Google button. Throw to surface an error in the caller. */
  onGoogle?: () => Promise<void>;
}

export function SocialButtons({ onGoogle }: SocialButtonsProps) {
  const [loading, setLoading] = React.useState(false);

  async function handleGoogle() {
    if (!onGoogle || loading) return;
    setLoading(true);
    try {
      await onGoogle();
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex">
      <SocialButton
        icon={<GoogleIcon />}
        label={loading ? "Signing in…" : "Continue with Google"}
        loading={loading}
        onClick={handleGoogle}
      />
    </div>
  );
}
