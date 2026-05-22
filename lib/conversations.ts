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

export type Lang = "en" | "hi";

export interface StoredMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  translations?: Partial<Record<Lang, string>>;
  createdAt: number;
}

export interface StoredConversation {
  id: string;
  title: string;
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
      return {
        id: m.id,
        role: d.role as "user" | "assistant",
        content: String(d.content ?? ""),
        translations: (d.translations ?? undefined) as
          | Partial<Record<Lang, string>>
          | undefined,
        createdAt: tsToNumber(d.createdAt),
      };
    });
    out.push({
      id: c.id,
      title: String(cData.title ?? "New conversation"),
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
  title: string
): Promise<string> {
  const ref = await addDoc(convosCol(uid), {
    title,
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
