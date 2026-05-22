"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowUp,
  Sparkles,
  Quote,
  ShieldCheck,
  Languages,
  Menu,
} from "lucide-react";
import { Sidebar, type SidebarConversation } from "@/components/chat/Sidebar";
import { BrandLockup, BrandMark } from "@/components/BrandMark";
import { useAuth } from "@/lib/auth";
import {
  appendMessage as fsAppendMessage,
  createConversation as fsCreateConversation,
  deleteConversation as fsDeleteConversation,
  listConversations as fsListConversations,
  setMessageTranslation as fsSetMessageTranslation,
  updateConversation as fsUpdateConversation,
} from "@/lib/conversations";
import { cn } from "@/lib/utils";

/**
 * Avatar that sits next to each assistant message. Always renders the
 * brand mark; while the reply is streaming, a single thin ring softly
 * expands and fades out from the chip edge — a quiet "still answering"
 * signal, no glow, no rotation.
 */
function AssistantAvatar({ answering }: { answering: boolean }) {
  return (
    <span className="relative mt-0.5 shrink-0">
      {answering && (
        <motion.span
          aria-hidden
          initial={{ scale: 1, opacity: 0.55 }}
          animate={{ scale: 1.25, opacity: 0 }}
          transition={{
            duration: 1.6,
            repeat: Infinity,
            ease: "easeOut",
          }}
          className="pointer-events-none absolute inset-0 rounded-xl border border-maroon/50"
        />
      )}
      <BrandMark size="md" />
    </span>
  );
}

type Lang = "en" | "hi";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  translations?: Partial<Record<Lang, string>>;
  displayLang?: Lang;
  translating?: Lang | null;
}

interface Conversation {
  id: string;
  title: string;
  messages: Message[];
  createdAt: number;
  updatedAt: number;
}

const LANG_LABEL: Record<Exclude<Lang, "en">, string> = {
  hi: "हिंदी",
};

const STARTERS = [
  "I'm overwhelmed and stressed about work.",
  "How do I deal with anger I can't control?",
  "I lost someone I love. How do I carry this grief?",
  "My mind never stops racing. How do I find stillness?",
];

// Only the "which conversation is active" is local — that's pure UI state
// and there's no reason to send it to Firestore. Everything else (messages,
// titles, translations) lives in Firestore so it follows the seeker across
// browsers and devices.
const ACTIVE_KEY = (uid: string) => `mystic:active:${uid}`;

function titleFromMessage(text: string): string {
  const cleaned = text.replace(/\s+/g, " ").trim();
  if (!cleaned) return "New conversation";
  return cleaned.length > 42 ? `${cleaned.slice(0, 42)}…` : cleaned;
}

/* ------------------------------------------------------------------ */
/*  Assistant message rendering — verse card + grounded prose, in the  */
/*  parchment/maroon theme used across landing + auth.                 */
/* ------------------------------------------------------------------ */

function Inline({ text }: { text: string }) {
  // Render **bold**, _italic_, and [label](url) markdown links. Links use
  // tel: for phone helplines (taps on mobile dial directly) and https: for
  // web URLs (open in new tab).
  const parts = text
    .split(/(\*\*[^*]+\*\*|_[^_]+_|\[[^\]]+\]\([^)]+\))/g)
    .filter(Boolean);
  return (
    <>
      {parts.map((p, i) => {
        if (p.startsWith("**") && p.endsWith("**"))
          return (
            <strong key={i} className="font-semibold text-ink">
              {p.slice(2, -2)}
            </strong>
          );
        if (p.startsWith("_") && p.endsWith("_"))
          return (
            <em key={i} className="italic text-ink-muted">
              {p.slice(1, -1)}
            </em>
          );
        const link = p.match(/^\[([^\]]+)\]\(([^)]+)\)$/);
        if (link) {
          const [, label, url] = link;
          const isExternal = url.startsWith("http");
          return (
            <a
              key={i}
              href={url}
              target={isExternal ? "_blank" : undefined}
              rel={isExternal ? "noopener noreferrer" : undefined}
              className="text-maroon underline decoration-maroon/40 underline-offset-2 hover:text-maroon-deep"
            >
              {label}
            </a>
          );
        }
        return <React.Fragment key={i}>{p}</React.Fragment>;
      })}
    </>
  );
}

function VerseCard({ lines }: { lines: string[] }) {
  const strip = (s: string, open: string, close = open) =>
    s.startsWith(open) && s.endsWith(close) && s.length > open.length + close.length
      ? s.slice(open.length, -close.length)
      : s;
  const cleaned = lines.map((l) => l.trim()).filter(Boolean);
  const normRef = (s: string) => strip(strip(s, "[", "]"), "**");
  const ref = cleaned[0] ? normRef(cleaned[0]) : "";
  let translation = "";
  let sanskrit = "";
  if (cleaned.length >= 3) {
    translation = strip(cleaned.slice(1, -1).join(" "), '"');
    sanskrit = strip(cleaned[cleaned.length - 1], "_");
  } else if (cleaned.length === 2) {
    translation = strip(cleaned[1], '"');
  }
  return (
    <div className="my-3 rounded-2xl border border-saffron/40 bg-saffron-50 p-4">
      {ref && (
        <div className="mb-2 inline-flex items-center gap-1.5 rounded-md bg-maroon/10 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wider text-maroon">
          <Quote size={11} /> {ref}
        </div>
      )}
      {translation && (
        <p className="font-display text-lg leading-snug text-ink">
          &ldquo;{translation}&rdquo;
        </p>
      )}
      {sanskrit && (
        <p className="mt-2 text-xs italic text-ink-muted">{sanskrit}</p>
      )}
    </div>
  );
}

function AssistantContent({ text }: { text: string }) {
  const lines = text.split("\n");
  const out: React.ReactNode[] = [];
  let quote: string[] = [];

  const flushQuote = (key: string) => {
    if (quote.length) {
      out.push(<VerseCard key={key} lines={quote} />);
      quote = [];
    }
  };

  lines.forEach((line, i) => {
    if (line.startsWith(">")) {
      const body = line.replace(/^>\s?/, "");
      if (body.trim()) quote.push(body);
      return;
    }
    flushQuote(`q-${i}`);
    if (line.trim()) {
      out.push(
        <p key={`p-${i}`} className="text-sm leading-relaxed text-ink-soft">
          <Inline text={line} />
        </p>
      );
    }
  });
  flushQuote("q-end");

  return <div className="space-y-3">{out}</div>;
}

/* ------------------------------------------------------------------ */
/*  Page                                                               */
/* ------------------------------------------------------------------ */

export default function ChatPage() {
  const router = useRouter();
  const { user, loading: authLoading, logout } = useAuth();

  const [conversations, setConversations] = React.useState<Conversation[]>([]);
  const [activeId, setActiveId] = React.useState<string | null>(null);
  const [input, setInput] = React.useState("");
  const [streaming, setStreaming] = React.useState(false);
  const [sidebarOpen, setSidebarOpen] = React.useState(false);
  const [hydrated, setHydrated] = React.useState(false);

  const scrollRef = React.useRef<HTMLDivElement>(null);
  const taRef = React.useRef<HTMLTextAreaElement>(null);
  // In-flight Firestore conversation creates, keyed by their optimistic
  // `local-` id. send() awaits the SAME promise instead of starting a
  // second create — a duplicate create races the temp-id→real-id swap and
  // leaves streaming writes pointing at an id no longer in state.
  const pendingCreates = React.useRef<Map<string, Promise<string>>>(new Map());

  React.useEffect(() => {
    if (!authLoading && !user) router.replace("/login");
  }, [authLoading, user, router]);

  // Load every conversation from Firestore once per sign-in. Optimistic
  // writes during the session keep React state in sync; the next sign-in
  // re-reads from Firestore to pick up any device-to-device changes.
  React.useEffect(() => {
    let cancelled = false;
    if (!user) return;
    (async () => {
      try {
        const fromDb = await fsListConversations(user.id);
        if (cancelled) return;
        const convs: Conversation[] = fromDb.map((c) => ({
          id: c.id,
          title: c.title,
          createdAt: c.createdAt,
          updatedAt: c.updatedAt,
          messages: c.messages.map((m) => ({
            id: m.id,
            role: m.role,
            content: m.content,
            translations: m.translations,
          })),
        }));
        setConversations(convs);
        const savedActive = localStorage.getItem(ACTIVE_KEY(user.id));
        const stillExists = convs.find((c) => c.id === savedActive);
        setActiveId(stillExists ? savedActive : convs[0]?.id ?? null);
      } catch (err) {
        console.error("[chat] failed to load conversations:", err);
      } finally {
        if (!cancelled) setHydrated(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user]);

  // Active conversation id is pure UI state — kept in localStorage so a
  // page refresh lands on the same thread the seeker was reading.
  React.useEffect(() => {
    if (!user || !hydrated) return;
    if (activeId) localStorage.setItem(ACTIVE_KEY(user.id), activeId);
    else localStorage.removeItem(ACTIVE_KEY(user.id));
  }, [user, hydrated, activeId]);

  const activeConv = React.useMemo(
    () => conversations.find((c) => c.id === activeId) ?? null,
    [conversations, activeId]
  );
  const messages = React.useMemo(
    () => activeConv?.messages ?? [],
    [activeConv]
  );

  // Auto-scroll only when new content arrives — a new message appended,
  // OR the last message's content grows during streaming. Don't scroll on
  // translation updates, which mutate older messages (translations, pills)
  // without adding visible new text at the bottom.
  const messageCount = messages.length;
  const lastContentLength =
    messages[messages.length - 1]?.content.length ?? 0;
  React.useEffect(() => {
    scrollRef.current?.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [messageCount, lastContentLength, streaming]);

  React.useEffect(() => {
    setSidebarOpen(false);
  }, [activeId]);

  const autosize = React.useCallback(() => {
    const ta = taRef.current;
    if (!ta) return;
    ta.style.height = "auto";
    const next = Math.min(ta.scrollHeight, 160);
    ta.style.height = `${next}px`;
    ta.style.overflowY = ta.scrollHeight > 160 ? "auto" : "hidden";
  }, []);

  React.useEffect(() => {
    autosize();
  }, [input, autosize]);

  function setMessages(
    conversationId: string,
    updater: (prev: Message[]) => Message[]
  ) {
    setConversations((cs) =>
      cs.map((c) =>
        c.id === conversationId
          ? { ...c, messages: updater(c.messages), updatedAt: Date.now() }
          : c
      )
    );
  }

  /** Create a blank conversation locally + in Firestore. The temp local
   *  id is replaced with the Firestore-generated id once the write resolves.
   *  We do NOT block on the network — UI updates immediately and Firestore
   *  catches up. */
  function startNewConversation(): Conversation {
    if (activeConv && activeConv.messages.length === 0) {
      setSidebarOpen(false);
      return activeConv;
    }
    const tempId = `local-${crypto.randomUUID()}`;
    const conv: Conversation = {
      id: tempId,
      title: "New conversation",
      messages: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    setConversations((cs) => [conv, ...cs]);
    setActiveId(tempId);
    if (user) {
      const create = fsCreateConversation(user.id, conv.title).then(
        (realId) => {
          // Swap the temp id for the Firestore id everywhere in state.
          setConversations((cs) =>
            cs.map((c) => (c.id === tempId ? { ...c, id: realId } : c))
          );
          setActiveId((prev) => (prev === tempId ? realId : prev));
          return realId;
        }
      );
      pendingCreates.current.set(tempId, create);
      create.catch((err) =>
        console.error("[chat] createConversation failed:", err)
      );
    }
    return conv;
  }

  function deleteConversation(id: string) {
    setConversations((cs) => {
      const next = cs.filter((c) => c.id !== id);
      if (id === activeId) setActiveId(next[0]?.id ?? null);
      return next;
    });
    if (user && !id.startsWith("local-")) {
      fsDeleteConversation(user.id, id).catch((err) =>
        console.error("[chat] deleteConversation failed:", err)
      );
    }
  }

  async function send(text: string) {
    const content = text.trim();
    if (!content || streaming || !user) return;

    let conv = activeConv;
    if (!conv) {
      conv = startNewConversation();
    }
    let conversationId = conv.id;
    const isFirstMessage = conv.messages.length === 0;

    const userMsg: Message = {
      id: crypto.randomUUID(),
      role: "user",
      content,
    };
    const history = conv.messages
      .filter((m) => m.content)
      .map((m) => ({ role: m.role, content: m.content }));
    const assistantId = crypto.randomUUID();
    const title = isFirstMessage ? titleFromMessage(content) : conv.title;

    setConversations((cs) =>
      cs.map((c) =>
        c.id === conversationId
          ? {
              ...c,
              title,
              messages: [
                ...c.messages,
                userMsg,
                { id: assistantId, role: "assistant", content: "" },
              ],
              updatedAt: Date.now(),
            }
          : c
      )
    );
    setInput("");
    setStreaming(true);

    // If the active conversation is still being created in Firestore (it
    // still carries the optimistic `local-` id), wait for that SAME create
    // to finish rather than starting a second one. A duplicate create races
    // the id-swap and streaming writes end up targeting a stale id.
    if (conversationId.startsWith("local-")) {
      const tempId = conversationId;
      try {
        const pending = pendingCreates.current.get(tempId);
        conversationId = pending
          ? await pending
          : await fsCreateConversation(user.id, title);
        pendingCreates.current.delete(tempId);
        // The shared promise's .then already ran this swap; repeat it
        // idempotently so the no-pending fallback above is also covered.
        setConversations((cs) =>
          cs.map((c) => (c.id === tempId ? { ...c, id: conversationId } : c))
        );
        setActiveId((prev) => (prev === tempId ? conversationId : prev));
      } catch (err) {
        console.error("[chat] createConversation (deferred) failed:", err);
      }
    }

    // First message: ensure the Firestore conversation title reflects it.
    // startNewConversation creates the doc titled "New conversation", so the
    // message-derived title must be pushed once the real id is known.
    if (isFirstMessage && !conversationId.startsWith("local-")) {
      fsUpdateConversation(user.id, conversationId, { title }).catch((err) =>
        console.error("[chat] updateConversation title failed:", err)
      );
    }

    // Persist the user's message immediately — important even if streaming
    // fails so the question isn't lost.
    fsAppendMessage(user.id, conversationId, {
      id: userMsg.id,
      role: "user",
      content,
      createdAt: Date.now(),
    }).catch((err) =>
      console.error("[chat] appendMessage(user) failed:", err)
    );

    let finalContent = "";
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: content, history }),
      });
      if (!res.ok || !res.body) throw new Error("The oracle is silent.");

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let acc = "";
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        acc += decoder.decode(value, { stream: true });
        setMessages(conversationId, (msgs) =>
          msgs.map((msg) =>
            msg.id === assistantId ? { ...msg, content: acc } : msg
          )
        );
      }
      finalContent = acc;
    } catch {
      finalContent = "The connection wavered. Take a breath and ask again.";
      setMessages(conversationId, (msgs) =>
        msgs.map((msg) =>
          msg.id === assistantId ? { ...msg, content: finalContent } : msg
        )
      );
    } finally {
      setStreaming(false);
      // Persist the assistant message ONCE, after streaming completes —
      // writing every chunk would explode Firestore writes for no UX gain.
      if (finalContent) {
        fsAppendMessage(user.id, conversationId, {
          id: assistantId,
          role: "assistant",
          content: finalContent,
          createdAt: Date.now(),
        }).catch((err) =>
          console.error("[chat] appendMessage(assistant) failed:", err)
        );
      }
    }
  }

  async function translate(
    conversationId: string,
    messageId: string,
    lang: Exclude<Lang, "en">
  ) {
    if (!user) return;
    const conv = conversations.find((c) => c.id === conversationId);
    const msg = conv?.messages.find((m) => m.id === messageId);
    if (!msg || msg.role !== "assistant" || !msg.content) return;
    if (msg.translations?.[lang]) {
      setMessages(conversationId, (msgs) =>
        msgs.map((m) =>
          m.id === messageId ? { ...m, displayLang: lang } : m
        )
      );
      return;
    }
    setMessages(conversationId, (msgs) =>
      msgs.map((m) =>
        m.id === messageId ? { ...m, translating: lang } : m
      )
    );
    let finalTranslation = "";
    try {
      const res = await fetch("/api/translate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: msg.content, lang }),
      });
      if (!res.ok || !res.body) throw new Error("translate failed");
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let acc = "";
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        acc += decoder.decode(value, { stream: true });
        setMessages(conversationId, (msgs) =>
          msgs.map((m) =>
            m.id === messageId
              ? {
                  ...m,
                  translations: { ...(m.translations ?? {}), [lang]: acc },
                  displayLang: lang,
                }
              : m
          )
        );
      }
      finalTranslation = acc;
    } catch {
      finalTranslation = "Translation could not be loaded. Please try again.";
      setMessages(conversationId, (msgs) =>
        msgs.map((m) =>
          m.id === messageId
            ? {
                ...m,
                translations: {
                  ...(m.translations ?? {}),
                  [lang]: finalTranslation,
                },
                displayLang: lang,
              }
            : m
        )
      );
    } finally {
      setMessages(conversationId, (msgs) =>
        msgs.map((m) =>
          m.id === messageId ? { ...m, translating: null } : m
        )
      );
      // Persist the cached translation on the message so reloads / other
      // devices skip the LLM call. Skip the persisted-error case so we
      // retry next time the seeker taps the pill.
      if (
        finalTranslation &&
        finalTranslation !==
          "Translation could not be loaded. Please try again." &&
        !conversationId.startsWith("local-")
      ) {
        fsSetMessageTranslation(
          user.id,
          conversationId,
          messageId,
          lang,
          finalTranslation
        ).catch((err) =>
          console.error("[chat] setMessageTranslation failed:", err)
        );
      }
    }
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send(input);
    }
  }

  if (authLoading || !user) {
    return (
      <div className="relative flex min-h-[100dvh] items-center justify-center bg-parchment">
        <div
          aria-hidden
          className="pointer-events-none fixed inset-0 -z-10 bg-parchment-radial"
        />
        <div className="flex items-center gap-3 text-ink-soft">
          <span className="h-5 w-5 animate-spin rounded-full border-2 border-maroon border-t-transparent" />
          Entering the sanctum…
        </div>
      </div>
    );
  }

  const hasChat = messages.length > 0;
  const lastAssistantEmpty =
    streaming &&
    messages[messages.length - 1]?.role === "assistant" &&
    messages[messages.length - 1]?.content === "";

  const sidebarItems: SidebarConversation[] = [...conversations]
    .sort((a, b) => b.updatedAt - a.updatedAt)
    .map((c) => ({ id: c.id, title: c.title, updatedAt: c.updatedAt }));

  return (
    <div className="relative flex h-[100dvh] w-full overflow-hidden bg-parchment text-ink">
      {/* Soft parchment wash — matches landing + auth so navigation is
          visually continuous. */}
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 -z-10 bg-parchment-radial"
      />

      <Sidebar
        conversations={sidebarItems}
        activeId={activeId}
        user={user}
        onSelect={setActiveId}
        onNew={() => {
          startNewConversation();
        }}
        onDelete={deleteConversation}
        onLogout={async () => {
          await logout();
          router.replace("/login");
        }}
        open={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
      />

      {/* Main column */}
      <div className="relative z-10 flex min-w-0 flex-1 flex-col">
        {/* Mobile-only top bar — desktop sidebar carries the brand. */}
        <header
          className="flex items-center justify-between border-b border-parchment-muted bg-parchment/80 px-3 py-2.5 backdrop-blur-sm sm:px-5 lg:hidden"
          style={{ paddingTop: "max(0.6rem, env(safe-area-inset-top))" }}
        >
          <div className="flex items-center gap-2">
            <button
              onClick={() => setSidebarOpen(true)}
              aria-label="Open menu"
              className="flex h-10 w-10 items-center justify-center rounded-lg border border-parchment-muted bg-parchment text-ink-soft transition-colors hover:border-maroon/40 hover:text-maroon"
            >
              <Menu size={18} />
            </button>
            <BrandLockup size="sm" surface="light" />
          </div>

          <button
            onClick={() => startNewConversation()}
            aria-label="New conversation"
            className="hidden h-10 items-center gap-1.5 rounded-lg border border-parchment-muted bg-parchment px-3 text-sm text-ink-soft transition-colors hover:border-maroon/40 hover:text-maroon sm:inline-flex"
          >
            New
          </button>
        </header>

        {/* Conversation */}
        <div
          ref={scrollRef}
          className="relative flex-1 overflow-y-auto overscroll-contain"
        >
          <div className="mx-auto w-full max-w-3xl px-4 py-5 sm:px-6 sm:py-8">
            {!hasChat ? (
              <motion.div
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.7 }}
                className="flex flex-col items-center pt-10 text-center sm:pt-20"
              >
                <div className="relative mb-6">
                  <div className="absolute inset-0 animate-pulse-glow rounded-full bg-saffron/40 blur-2xl" />
                  <div className="relative flex h-16 w-16 items-center justify-center rounded-full border border-saffron/50 bg-saffron-50">
                    <Sparkles className="h-7 w-7 text-maroon" />
                  </div>
                </div>
                <h1 className="text-balance font-display text-[26px] leading-tight text-ink sm:text-4xl">
                  Ask life&rsquo;s hardest questions,{" "}
                  <span className="text-maroon">
                    {user.name?.split(" ")[0] || "seeker"}
                  </span>
                </h1>
                <p className="mt-3 max-w-md text-balance text-[13px] text-ink-soft sm:text-sm">
                  Describe your situation in plain words. Every answer cites a
                  real verse from the Bhagavad Gita. Nothing is invented.
                </p>

                <div className="mt-7 grid w-full gap-2.5 sm:mt-9 sm:grid-cols-2">
                  {STARTERS.map((s) => (
                    <button
                      key={s}
                      onClick={() => send(s)}
                      className="group rounded-xl border border-parchment-muted bg-parchment p-3.5 text-left text-sm text-ink-soft transition-all hover:-translate-y-0.5 hover:border-maroon/40 hover:bg-saffron-50 hover:text-ink sm:p-4"
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </motion.div>
            ) : (
              <div className="space-y-6">
                <AnimatePresence initial={false}>
                  {messages.map((m, idx) =>
                    m.role === "user" ? (
                      <motion.div
                        key={m.id}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="flex justify-end"
                      >
                        <div className="max-w-[85%] whitespace-pre-wrap break-words rounded-2xl rounded-br-md border border-maroon/20 bg-maroon px-3.5 py-2.5 text-[15px] text-parchment sm:max-w-[80%] sm:px-4 sm:py-3 sm:text-sm">
                          {m.content}
                        </div>
                      </motion.div>
                    ) : (
                      <motion.div
                        key={m.id}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="flex gap-3"
                      >
                        <AssistantAvatar
                          answering={streaming && idx === messages.length - 1}
                        />
                        <div className="min-w-0 flex-1">
                          {(() => {
                            const lang: Lang = m.displayLang ?? "en";
                            const displayContent =
                              lang === "en"
                                ? m.content
                                : m.translations?.[lang] ?? m.content;
                            const isComplete = !!m.content && !streaming;
                            const showPills =
                              isComplete &&
                              (Object.keys(LANG_LABEL) as Array<
                                Exclude<Lang, "en">
                              >).length > 0;
                            return (
                              <>
                                {displayContent ? (
                                  <AssistantContent text={displayContent} />
                                ) : (
                                  <div className="flex items-center gap-1.5 py-2">
                                    {[0, 1, 2].map((i) => (
                                      <span
                                        key={i}
                                        className="h-2 w-2 animate-twinkle rounded-full bg-maroon/70"
                                        style={{
                                          animationDelay: `${i * 0.18}s`,
                                        }}
                                      />
                                    ))}
                                  </div>
                                )}
                                {isComplete &&
                                  /^>\s/m.test(displayContent) && (
                                    <div className="mt-3 flex flex-wrap gap-2">
                                      <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-400/40 bg-emerald-50 px-3 py-1 text-[11px] text-emerald-700">
                                        <ShieldCheck size={12} />
                                        Verified verse
                                      </span>
                                    </div>
                                  )}
                                {showPills && activeId && (
                                  <div className="mt-3 flex flex-wrap items-center gap-1.5">
                                    <Languages
                                      size={12}
                                      className="mr-0.5 text-ink-muted"
                                    />
                                    <button
                                      onClick={() =>
                                        setMessages(activeId, (msgs) =>
                                          msgs.map((x) =>
                                            x.id === m.id
                                              ? { ...x, displayLang: "en" }
                                              : x
                                          )
                                        )
                                      }
                                      className={cn(
                                        "rounded-full border px-2.5 py-0.5 text-[11px] transition-colors",
                                        lang === "en"
                                          ? "border-maroon/40 bg-saffron-50 text-maroon"
                                          : "border-parchment-muted bg-parchment text-ink-soft hover:border-maroon/30 hover:text-ink"
                                      )}
                                    >
                                      English
                                    </button>
                                    {(
                                      Object.keys(LANG_LABEL) as Array<
                                        Exclude<Lang, "en">
                                      >
                                    ).map((code) => {
                                      const active = lang === code;
                                      const busy = m.translating === code;
                                      return (
                                        <button
                                          key={code}
                                          onClick={() =>
                                            translate(activeId, m.id, code)
                                          }
                                          disabled={busy}
                                          className={cn(
                                            "inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[11px] transition-colors disabled:opacity-60",
                                            active
                                              ? "border-maroon/40 bg-saffron-50 text-maroon"
                                              : "border-parchment-muted bg-parchment text-ink-soft hover:border-maroon/30 hover:text-ink"
                                          )}
                                        >
                                          {busy && (
                                            <span className="h-2.5 w-2.5 animate-spin rounded-full border border-current border-t-transparent" />
                                          )}
                                          {LANG_LABEL[code]}
                                        </button>
                                      );
                                    })}
                                  </div>
                                )}
                              </>
                            );
                          })()}
                        </div>
                      </motion.div>
                    )
                  )}
                </AnimatePresence>
                {lastAssistantEmpty && <div className="h-2" />}
              </div>
            )}
          </div>
        </div>

        {/* Composer — sticks to bottom; pads for iPhone home indicator via
            safe-area-inset-bottom. Textarea uses 16px font so iOS Safari
            doesn't auto-zoom on focus (sub-16px is the documented trigger). */}
        <div
          className="border-t border-parchment-muted bg-parchment/80 px-3 pt-3 backdrop-blur-sm sm:px-6 sm:pt-4"
          style={{
            paddingBottom: "max(0.75rem, env(safe-area-inset-bottom))",
          }}
        >
          <div className="mx-auto w-full max-w-3xl">
            <div className="relative flex items-end gap-2 rounded-2xl border border-parchment-muted bg-parchment p-2 shadow-[0_10px_30px_-18px_rgba(122,31,31,0.25)] focus-within:border-maroon/50 focus-within:shadow-[0_12px_36px_-14px_rgba(122,31,31,0.35)]">
              <textarea
                ref={taRef}
                rows={1}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={onKeyDown}
                placeholder="Describe what you're going through…"
                autoComplete="off"
                autoCorrect="on"
                spellCheck
                enterKeyHint="send"
                className="max-h-40 flex-1 resize-none overflow-y-hidden bg-transparent px-3 py-2.5 text-base text-ink outline-none placeholder:text-ink-muted/60 [scrollbar-width:thin]"
              />
              <button
                onClick={() => send(input)}
                disabled={!input.trim() || streaming}
                aria-label="Send"
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-maroon text-parchment shadow-[0_10px_24px_-8px_rgba(122,31,31,0.55)] transition-all hover:bg-maroon-deep hover:shadow-[0_14px_32px_-6px_rgba(122,31,31,0.6)] disabled:cursor-not-allowed disabled:opacity-40"
              >
                {streaming ? (
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-parchment border-t-transparent" />
                ) : (
                  <ArrowUp size={18} />
                )}
              </button>
            </div>
            <p className="mt-2 text-center text-[11px] text-ink-muted">
              MysticAI retrieves real verses. It never invents scripture.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
