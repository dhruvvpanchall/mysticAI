"use client";

import * as React from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import { LogOut, Plus, MessageCircle, Trash2, X } from "lucide-react";
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
  onLogout: () => void;
  /** Mobile drawer open state. Ignored on lg+. */
  open: boolean;
  /** Close handler for the mobile drawer. */
  onClose: () => void;
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
              {conversations.map((c) => {
                const active = c.id === activeId;
                return (
                  <li key={c.id}>
                    <div
                      className={cn(
                        "group relative flex items-center rounded-lg transition-colors",
                        active
                          ? "border border-saffron/40 bg-saffron-50"
                          : "border border-transparent hover:bg-parchment"
                      )}
                    >
                      <button
                        onClick={() => onSelect(c.id)}
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
                        <span className="truncate">{c.title}</span>
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onDelete(c.id);
                        }}
                        aria-label={`Delete ${c.title}`}
                        className="mr-1.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-ink-muted opacity-0 transition-opacity hover:bg-rose-100 hover:text-rose-600 group-hover:opacity-100 group-focus-within:opacity-100"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </li>
                );
              })}
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
