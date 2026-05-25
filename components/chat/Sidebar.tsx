"use client";

import * as React from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import {
  LogOut,
  Plus,
  MessageCircle,
  Trash2,
  X,
  Pencil,
  Check,
  Settings,
} from "lucide-react";
import { BrandLockup } from "@/components/BrandMark";
import { cn } from "@/lib/utils";

export interface SidebarConversation {
  id: string;
  title: string;
  updatedAt: number;
}

export interface SidebarUser {
  id: string;
  name: string;
  email: string;
}

interface SidebarProps {
  conversations: SidebarConversation[];
  activeId: string | null;
  user: SidebarUser;
  onSelect: (id: string) => void;
  onNew: () => void;
  onDelete: (id: string) => void;
  onRename: (id: string, title: string) => void;
  onLogout: () => void;
  /** Mobile drawer open state. Ignored on lg+. */
  open: boolean;
  /** Close handler for the mobile drawer. */
  onClose: () => void;
}

type RowMode = "normal" | "rename" | "confirm-delete";

/**
 * Single conversation row. Owns its own mode state (normal / rename /
 * confirm-delete) so the parent stays a thin list. The active row gets
 * a saffron highlight and the maroon icon; hover reveals rename + delete.
 */
function ConversationRow({
  conversation,
  active,
  onSelect,
  onRename,
  onDelete,
}: {
  conversation: SidebarConversation;
  active: boolean;
  onSelect: () => void;
  onRename: (title: string) => void;
  onDelete: () => void;
}) {
  const [mode, setMode] = React.useState<RowMode>("normal");
  const [draft, setDraft] = React.useState(conversation.title);
  const inputRef = React.useRef<HTMLInputElement>(null);

  // Snap the draft back to the current title whenever we leave rename mode,
  // so the next pencil click starts from the latest server-side title.
  React.useEffect(() => {
    if (mode !== "rename") setDraft(conversation.title);
  }, [mode, conversation.title]);

  React.useEffect(() => {
    if (mode === "rename") {
      inputRef.current?.focus();
      inputRef.current?.select();
    }
  }, [mode]);

  function commitRename() {
    const next = draft.trim();
    if (next && next !== conversation.title) onRename(next);
    setMode("normal");
  }

  if (mode === "rename") {
    return (
      <div className="flex items-center gap-1 rounded-lg border border-saffron/40 bg-parchment px-2 py-1.5">
        <Pencil size={13} className="shrink-0 text-maroon" />
        <input
          ref={inputRef}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              commitRename();
            } else if (e.key === "Escape") {
              e.preventDefault();
              setMode("normal");
            }
          }}
          onBlur={commitRename}
          className="min-w-0 flex-1 bg-transparent text-sm text-ink outline-none placeholder:text-ink-muted/60"
          maxLength={80}
          aria-label="Conversation title"
        />
        <button
          onMouseDown={(e) => e.preventDefault()}
          onClick={commitRename}
          aria-label="Save title"
          className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-ink-muted transition-colors hover:bg-saffron-50 hover:text-maroon"
        >
          <Check size={13} />
        </button>
      </div>
    );
  }

  if (mode === "confirm-delete") {
    return (
      <div className="flex items-center gap-1 rounded-lg border border-rose-300 bg-rose-50 px-2 py-1.5">
        <span className="min-w-0 flex-1 truncate text-[11px] text-rose-700">
          Delete this conversation?
        </span>
        <button
          onClick={() => setMode("normal")}
          className="rounded-md px-2 py-1 text-[11px] text-ink-soft transition-colors hover:bg-parchment hover:text-ink"
        >
          Cancel
        </button>
        <button
          onClick={() => {
            setMode("normal");
            onDelete();
          }}
          className="rounded-md bg-rose-600 px-2 py-1 text-[11px] font-medium text-parchment transition-colors hover:bg-rose-700"
        >
          Delete
        </button>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "group relative flex items-center rounded-lg transition-colors",
        active
          ? "border border-saffron/40 bg-saffron-50"
          : "border border-transparent hover:bg-parchment"
      )}
    >
      <button
        onClick={onSelect}
        className={cn(
          "flex min-w-0 flex-1 items-center gap-2 px-3 py-2 text-left text-sm transition-colors",
          active ? "text-ink" : "text-ink-soft hover:text-ink"
        )}
      >
        <MessageCircle
          size={14}
          className={cn(
            "shrink-0",
            active ? "text-maroon" : "text-ink-muted"
          )}
        />
        <span className="truncate">{conversation.title}</span>
      </button>
      <div className="mr-1 flex shrink-0 items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100">
        <button
          onClick={(e) => {
            e.stopPropagation();
            setMode("rename");
          }}
          aria-label={`Rename ${conversation.title}`}
          className="flex h-7 w-7 items-center justify-center rounded-md text-ink-muted transition-colors hover:bg-saffron-50 hover:text-maroon"
        >
          <Pencil size={13} />
        </button>
        <button
          onClick={(e) => {
            e.stopPropagation();
            setMode("confirm-delete");
          }}
          aria-label={`Delete ${conversation.title}`}
          className="flex h-7 w-7 items-center justify-center rounded-md text-ink-muted transition-colors hover:bg-rose-100 hover:text-rose-600"
        >
          <Trash2 size={13} />
        </button>
      </div>
    </div>
  );
}

/**
 * Side rail with conversation list, new-chat button, and the seeker's
 * account block. Always-visible on lg+, off-canvas drawer below that.
 * Light parchment theme — matches landing + auth.
 */
export function Sidebar({
  conversations,
  activeId,
  user,
  onSelect,
  onNew,
  onDelete,
  onRename,
  onLogout,
  open,
  onClose,
}: SidebarProps) {
  return (
    <>
      {/* Mobile backdrop */}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={onClose}
            className="fixed inset-0 z-40 bg-ink/40 backdrop-blur-sm lg:hidden"
            aria-hidden
          />
        )}
      </AnimatePresence>

      {/* Drawer (mobile) / static rail (desktop). One element, two behaviors
          via responsive classes — keeps state in a single tree. */}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 flex w-72 flex-col border-r border-parchment-muted bg-parchment-deep transition-transform duration-300 ease-out lg:static lg:z-0 lg:translate-x-0",
          open ? "translate-x-0" : "-translate-x-full"
        )}
        style={{
          paddingTop: "max(0.75rem, env(safe-area-inset-top))",
          paddingBottom: "max(0.75rem, env(safe-area-inset-bottom))",
        }}
        aria-label="Conversations"
      >
        {/* Brand + close (mobile only) */}
        <div className="flex items-center justify-between px-4 pb-3 pt-1">
          <Link href="/">
            <BrandLockup size="md" surface="light" />
          </Link>
          <button
            onClick={onClose}
            aria-label="Close menu"
            className="flex h-9 w-9 items-center justify-center rounded-lg border border-parchment-muted bg-parchment text-ink-soft transition-colors hover:border-maroon/40 hover:text-maroon lg:hidden"
          >
            <X size={16} />
          </button>
        </div>

        {/* Conversation list — top of the rail so the most-used affordance
            (jumping between past chats) is closest to thumb reach. */}
        <div className="min-h-0 flex-1 overflow-y-auto px-2 py-2">
          {conversations.length === 0 ? (
            <p className="px-3 py-6 text-center text-xs text-ink-muted">
              Your conversations will appear here.
            </p>
          ) : (
            <ul className="space-y-1">
              {conversations.map((c) => (
                <li key={c.id}>
                  <ConversationRow
                    conversation={c}
                    active={c.id === activeId}
                    onSelect={() => onSelect(c.id)}
                    onRename={(title) => onRename(c.id, title)}
                    onDelete={() => onDelete(c.id)}
                  />
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* New chat — sits right above the account block so it's a clear
            footer-level action rather than competing with the history list. */}
        <div className="border-t border-parchment-muted px-3 pt-3">
          <button
            onClick={onNew}
            className="flex w-full items-center justify-center gap-1.5 rounded-xl bg-maroon px-3 py-2.5 text-sm font-medium text-parchment shadow-[0_8px_20px_-8px_rgba(122,31,31,0.5)] transition-colors hover:bg-maroon-deep"
          >
            <Plus size={15} /> New conversation
          </button>
        </div>

        {/* Account block */}
        <div className="px-3 pt-3">
          <div className="flex items-center gap-2.5 rounded-lg px-2 py-2">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-maroon font-display text-sm text-parchment">
              {(user.name || user.email || "?").trim().charAt(0).toUpperCase()}
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm text-ink">
                {user.name || user.email.split("@")[0]}
              </p>
              <p className="truncate text-[11px] text-ink-muted">
                {user.email}
              </p>
            </div>
            <Link
              href="/settings"
              aria-label="Settings"
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-parchment-muted bg-parchment text-ink-soft transition-colors hover:border-maroon/40 hover:text-maroon"
            >
              <Settings size={14} />
            </Link>
            <button
              onClick={onLogout}
              aria-label="Sign out"
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-parchment-muted bg-parchment text-ink-soft transition-colors hover:border-rose-300 hover:text-rose-600"
            >
              <LogOut size={14} />
            </button>
          </div>
        </div>
      </aside>
    </>
  );
}
