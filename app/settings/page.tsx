"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import {
  ArrowLeft,
  Check,
  LogOut,
  Mail,
  ShieldAlert,
  User as UserIcon,
} from "lucide-react";
import { useAuth } from "@/lib/auth";
import { BrandLockup } from "@/components/BrandMark";
import { GlowingButton } from "@/components/GlowingButton";

/**
 * Account settings page. Lives outside the chat shell so it has its own
 * scroll context and a clear "go back" header. Holds:
 *   - Display name (editable)
 *   - Email (read-only — Firebase Auth treats email as a re-auth-required
 *     change, not worth exposing here yet)
 *   - Sign out
 *   - Delete account (with confirmation + password re-auth for email users)
 */
export default function SettingsPage() {
  const router = useRouter();
  const { user, loading, logout, updateName, deleteAccount } = useAuth();

  const [name, setName] = React.useState("");
  const [savingName, setSavingName] = React.useState(false);
  const [nameMsg, setNameMsg] = React.useState<
    { kind: "success" | "error"; text: string } | null
  >(null);

  const [confirmOpen, setConfirmOpen] = React.useState(false);
  const [confirmText, setConfirmText] = React.useState("");
  const [confirmPassword, setConfirmPassword] = React.useState("");
  const [deleting, setDeleting] = React.useState(false);
  const [deleteError, setDeleteError] = React.useState<string | null>(null);

  // Mirror the auth name into the input once the user hydrates, so the
  // page renders with their current value pre-filled.
  React.useEffect(() => {
    if (user && !name) setName(user.name);
  }, [user, name]);

  React.useEffect(() => {
    if (!loading && !user) router.replace("/login");
  }, [loading, user, router]);

  if (loading || !user) {
    return (
      <div className="flex min-h-[100dvh] items-center justify-center bg-parchment text-ink-soft">
        <span className="h-5 w-5 animate-spin rounded-full border-2 border-maroon border-t-transparent" />
      </div>
    );
  }

  // We don't expose provider in the public User shape — `deleteAccount`
  // figures it out from FirebaseUser.providerData. For UX we always show the
  // password field when confirming deletion; Google users can leave it blank
  // (the reauth flow opens a popup instead).

  async function onSaveName() {
    setNameMsg(null);
    const trimmed = name.trim();
    if (!trimmed) {
      setNameMsg({ kind: "error", text: "Name cannot be empty." });
      return;
    }
    if (trimmed === user!.name) return;
    setSavingName(true);
    try {
      await updateName(trimmed);
      setNameMsg({ kind: "success", text: "Saved." });
    } catch (err) {
      setNameMsg({
        kind: "error",
        text: err instanceof Error ? err.message : "Could not save.",
      });
    } finally {
      setSavingName(false);
    }
  }

  async function onConfirmDelete() {
    setDeleteError(null);
    if (confirmText !== "DELETE") {
      setDeleteError('Type DELETE in capitals to confirm.');
      return;
    }
    setDeleting(true);
    try {
      await deleteAccount({ password: confirmPassword || undefined });
      router.replace("/");
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : "Could not delete.");
      setDeleting(false);
    }
  }

  return (
    <div className="relative min-h-[100dvh] bg-parchment text-ink">
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 -z-10 bg-parchment-radial"
      />

      <header className="border-b border-parchment-muted bg-parchment/80 backdrop-blur-sm">
        <div className="mx-auto flex w-full max-w-2xl items-center justify-between px-4 py-3 sm:px-6">
          <Link
            href="/chat"
            className="inline-flex items-center gap-1.5 text-sm text-ink-soft transition-colors hover:text-maroon"
          >
            <ArrowLeft size={15} />
            Back to chat
          </Link>
          <BrandLockup size="sm" surface="light" />
        </div>
      </header>

      <main className="mx-auto w-full max-w-2xl px-4 py-8 sm:px-6 sm:py-12">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
        >
          <p className="text-xs uppercase tracking-[0.18em] text-maroon">
            Your account
          </p>
          <h1 className="mt-2 font-display text-3xl text-ink sm:text-4xl">
            Settings
          </h1>
          <p className="mt-2 max-w-md text-sm text-ink-soft">
            Manage how you appear in MysticAI and what we keep about you.
          </p>
        </motion.div>

        {/* Profile section */}
        <section className="mt-8 rounded-2xl border border-parchment-muted bg-parchment-deep/60 p-5 sm:p-6">
          <h2 className="font-display text-lg text-ink">Profile</h2>
          <p className="mt-1 text-xs text-ink-muted">
            How you appear in your conversations.
          </p>

          <div className="mt-5 space-y-4">
            <div>
              <label className="mb-1.5 block text-xs uppercase tracking-wider text-ink-muted">
                Display name
              </label>
              <div className="flex items-center gap-2 rounded-xl border border-parchment-muted bg-parchment px-3 py-2 focus-within:border-maroon/50">
                <UserIcon size={15} className="shrink-0 text-ink-muted" />
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  maxLength={60}
                  className="min-w-0 flex-1 bg-transparent text-sm text-ink outline-none placeholder:text-ink-muted/60"
                  placeholder="Your name"
                />
                <button
                  onClick={onSaveName}
                  disabled={savingName || name.trim() === user.name}
                  className="inline-flex items-center gap-1 rounded-lg bg-maroon px-3 py-1.5 text-xs font-medium text-parchment transition-colors hover:bg-maroon-deep disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {savingName ? (
                    <span className="h-3 w-3 animate-spin rounded-full border border-parchment border-t-transparent" />
                  ) : (
                    <Check size={13} />
                  )}
                  Save
                </button>
              </div>
              {nameMsg && (
                <p
                  className={`mt-1.5 text-xs ${
                    nameMsg.kind === "success"
                      ? "text-emerald-700"
                      : "text-rose-700"
                  }`}
                >
                  {nameMsg.text}
                </p>
              )}
            </div>

            <div>
              <label className="mb-1.5 block text-xs uppercase tracking-wider text-ink-muted">
                Email
              </label>
              <div className="flex items-center gap-2 rounded-xl border border-parchment-muted bg-parchment/50 px-3 py-2">
                <Mail size={15} className="shrink-0 text-ink-muted" />
                <span className="min-w-0 flex-1 truncate text-sm text-ink-soft">
                  {user.email}
                </span>
              </div>
              <p className="mt-1 text-[11px] text-ink-muted">
                Email cannot be changed yet.
              </p>
            </div>
          </div>
        </section>

        {/* Session section */}
        <section className="mt-6 rounded-2xl border border-parchment-muted bg-parchment-deep/60 p-5 sm:p-6">
          <h2 className="font-display text-lg text-ink">Session</h2>
          <p className="mt-1 text-xs text-ink-muted">
            Sign out of this device. Your data stays.
          </p>
          <GlowingButton
            variant="outline"
            size="md"
            className="mt-4"
            leftIcon={<LogOut size={15} />}
            onClick={async () => {
              await logout();
              router.replace("/login");
            }}
          >
            Sign out
          </GlowingButton>
        </section>

        {/* Danger zone */}
        <section className="mt-6 rounded-2xl border border-rose-300 bg-rose-50/60 p-5 sm:p-6">
          <h2 className="flex items-center gap-2 font-display text-lg text-rose-700">
            <ShieldAlert size={18} /> Danger zone
          </h2>
          <p className="mt-1 text-xs text-rose-700/80">
            Delete your account and every conversation. This cannot be undone.
          </p>

          {!confirmOpen ? (
            <button
              onClick={() => setConfirmOpen(true)}
              className="mt-4 inline-flex items-center gap-2 rounded-xl border border-rose-300 bg-parchment px-4 py-2 text-sm text-rose-700 transition-colors hover:bg-rose-100"
            >
              Delete my account
            </button>
          ) : (
            <div className="mt-4 space-y-3 rounded-xl border border-rose-300 bg-parchment p-4">
              <p className="text-sm text-ink">
                This wipes every conversation and your account permanently.
                Type <span className="font-mono font-semibold">DELETE</span> to
                confirm.
              </p>
              <input
                value={confirmText}
                onChange={(e) => setConfirmText(e.target.value)}
                placeholder="DELETE"
                className="w-full rounded-lg border border-parchment-muted bg-parchment px-3 py-2 text-sm font-mono text-ink outline-none focus:border-rose-400"
                autoComplete="off"
              />
              <div>
                <label className="mb-1 block text-[11px] uppercase tracking-wider text-ink-muted">
                  Password (email accounts only — Google users skip)
                </label>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Leave blank if you signed in with Google"
                  className="w-full rounded-lg border border-parchment-muted bg-parchment px-3 py-2 text-sm text-ink outline-none focus:border-rose-400"
                  autoComplete="current-password"
                />
              </div>
              {deleteError && (
                <p className="rounded-lg border border-rose-300 bg-rose-50 px-3 py-2 text-xs text-rose-700">
                  {deleteError}
                </p>
              )}
              <div className="flex flex-wrap gap-2 pt-1">
                <button
                  onClick={() => {
                    setConfirmOpen(false);
                    setConfirmText("");
                    setConfirmPassword("");
                    setDeleteError(null);
                  }}
                  disabled={deleting}
                  className="rounded-lg border border-parchment-muted bg-parchment px-4 py-2 text-sm text-ink-soft transition-colors hover:text-ink disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  onClick={onConfirmDelete}
                  disabled={deleting || confirmText !== "DELETE"}
                  className="inline-flex items-center gap-2 rounded-lg bg-rose-600 px-4 py-2 text-sm font-medium text-parchment transition-colors hover:bg-rose-700 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {deleting && (
                    <span className="h-3 w-3 animate-spin rounded-full border border-parchment border-t-transparent" />
                  )}
                  Permanently delete
                </button>
              </div>
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
