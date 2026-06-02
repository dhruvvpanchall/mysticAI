/**
 * Firestore CRUD for chat conversations.
 *
 * Layout — one document per conversation, one subcollection of messages
 * underneath it, all nested under the user's UID so security rules can
 * enforce "you only touch your own data":
 *
 *   users/{uid}
 *     conversations/{conversationId}              <- title, timestamps
 *       messages/{messageId}                       <- role, content, translations
 *
 * Why nested rather than top-level: Firestore rules read `request.auth.uid`
 * naturally against the path; flat collections would need composite indexes
 * and an `ownerUid` field on every doc, more rules to get right.
 *
 * The chat page keeps its in-memory React state and writes through to
 * Firestore for persistence. Reads happen on sign-in. Writes are
 * fire-and-forget — if they fail (offline), the UI keeps going and a
 * sync banner can be added later.
 */

import {
  addDoc,
  collection,
  deleteDoc,
  deleteField,
  doc,
  getDocs,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  writeBatch,
  Timestamp,
} from "firebase/firestore";
import { getFirebaseDb } from "@/lib/firebase";
import {
  DEFAULT_SCRIPTURE,
  resolveScriptureId,
  type ScriptureId,
} from "@/lib/scriptures";

export type Lang = "en" | "hi";
export type { ScriptureId };

export interface StoredMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  translations?: Partial<Record<Lang, string>>;
  /** Language the `content` was authored in. Assistant replies adopt the
   *  language the seeker wrote in (see /api/chat languageDirective), so
   *  this is set once per assistant turn after streaming completes.
   *  Legacy docs without the field default to "en" at the call site. */
  contentLang?: Lang;
  createdAt: number;
}

export interface StoredConversation {
  id: string;
  title: string;
  /** Which scripture this conversation is grounded in. Legacy docs without
   *  the field default to the default scripture (Gita) so old conversations
   *  keep working unchanged. */
  model: ScriptureId;
  createdAt: number;
  updatedAt: number;
  messages: StoredMessage[];
}

const convosCol = (uid: string) =>
  collection(getFirebaseDb(), "users", uid, "conversations");

const messagesCol = (uid: string, convId: string) =>
  collection(getFirebaseDb(), "users", uid, "conversations", convId, "messages");

const convoDoc = (uid: string, convId: string) =>
  doc(getFirebaseDb(), "users", uid, "conversations", convId);

const messageDoc = (uid: string, convId: string, msgId: string) =>
  doc(
    getFirebaseDb(),
    "users",
    uid,
    "conversations",
    convId,
    "messages",
    msgId
  );

function tsToNumber(v: unknown): number {
  if (v instanceof Timestamp) return v.toMillis();
  if (typeof v === "number") return v;
  return Date.now();
}

/* ─────────────── Read ─────────────── */

/** Load every conversation for the user, newest first, with all messages. */
export async function listConversations(
  uid: string
): Promise<StoredConversation[]> {
  const convoSnap = await getDocs(
    query(convosCol(uid), orderBy("updatedAt", "desc"))
  );
  const out: StoredConversation[] = [];
  for (const c of convoSnap.docs) {
    const cData = c.data();
    const msgSnap = await getDocs(
      query(messagesCol(uid, c.id), orderBy("createdAt", "asc"))
    );
    const messages: StoredMessage[] = msgSnap.docs.map((m) => {
      const d = m.data();
      const rawLang = d.contentLang;
      const contentLang: Lang | undefined =
        rawLang === "en" || rawLang === "hi" ? rawLang : undefined;
      return {
        id: m.id,
        role: d.role as "user" | "assistant",
        content: String(d.content ?? ""),
        translations: (d.translations ?? undefined) as
          | Partial<Record<Lang, string>>
          | undefined,
        contentLang,
        createdAt: tsToNumber(d.createdAt),
      };
    });
    out.push({
      id: c.id,
      title: String(cData.title ?? "New conversation"),
      model: resolveScriptureId(cData.model),
      createdAt: tsToNumber(cData.createdAt),
      updatedAt: tsToNumber(cData.updatedAt),
      messages,
    });
  }
  return out;
}

/* ─────────────── Write ─────────────── */

/** Create a blank conversation. Returns the generated id. */
export async function createConversation(
  uid: string,
  title: string,
  model: ScriptureId = DEFAULT_SCRIPTURE
): Promise<string> {
  const ref = await addDoc(convosCol(uid), {
    title,
    model,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return ref.id;
}

/** Rename / re-stamp a conversation. */
export async function updateConversation(
  uid: string,
  convId: string,
  patch: { title?: string; updatedAt?: true }
): Promise<void> {
  const data: Record<string, unknown> = {};
  if (patch.title !== undefined) data.title = patch.title;
  if (patch.updatedAt) data.updatedAt = serverTimestamp();
  if (!Object.keys(data).length) return;
  await updateDoc(convoDoc(uid, convId), data);
}

/** Delete a conversation and all its messages (batched). */
export async function deleteConversation(
  uid: string,
  convId: string
): Promise<void> {
  const msgSnap = await getDocs(messagesCol(uid, convId));
  const batch = writeBatch(getFirebaseDb());
  for (const m of msgSnap.docs) batch.delete(m.ref);
  batch.delete(convoDoc(uid, convId));
  await batch.commit();
}

/**
 * Wipe every conversation + message for the user. Called from the
 * delete-account flow BEFORE deleting the Firebase Auth user — once the
 * auth identity is gone, the user no longer has permission to clean up
 * their own data and it would orphan in Firestore.
 *
 * Firestore batches cap at 500 ops; we chunk through the convo list and
 * issue a fresh batch per conversation. Each conversation contributes
 * (messages + 1) deletes, well under the cap for normal usage.
 */
export async function deleteAllUserData(uid: string): Promise<void> {
  const convoSnap = await getDocs(convosCol(uid));
  for (const c of convoSnap.docs) {
    const msgSnap = await getDocs(messagesCol(uid, c.id));
    const batch = writeBatch(getFirebaseDb());
    for (const m of msgSnap.docs) batch.delete(m.ref);
    batch.delete(c.ref);
    await batch.commit();
  }
}

/** Append a message. Caller supplies the id (so optimistic UI matches). */
export async function appendMessage(
  uid: string,
  convId: string,
  msg: StoredMessage
): Promise<void> {
  await setDoc(messageDoc(uid, convId, msg.id), {
    role: msg.role,
    content: msg.content,
    createdAt: serverTimestamp(),
    ...(msg.translations ? { translations: msg.translations } : {}),
    ...(msg.contentLang ? { contentLang: msg.contentLang } : {}),
  });
  await updateConversation(uid, convId, { updatedAt: true });
}

/** Replace a message's `content` (used during streaming). */
export async function setMessageContent(
  uid: string,
  convId: string,
  msgId: string,
  content: string
): Promise<void> {
  await updateDoc(messageDoc(uid, convId, msgId), { content });
}

/** Cache a translation onto a message. */
export async function setMessageTranslation(
  uid: string,
  convId: string,
  msgId: string,
  lang: Exclude<Lang, "en">,
  text: string
): Promise<void> {
  await updateDoc(messageDoc(uid, convId, msgId), {
    [`translations.${lang}`]: text,
  });
}

/** Remove a stored translation (used on load to evict invalid entries). */
export async function removeMessageTranslation(
  uid: string,
  convId: string,
  msgId: string,
  lang: Exclude<Lang, "en">
): Promise<void> {
  await updateDoc(messageDoc(uid, convId, msgId), {
    [`translations.${lang}`]: deleteField(),
  });
}
