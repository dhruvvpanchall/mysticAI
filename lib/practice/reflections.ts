/**
 * Reflections — the seeker's journal entries against verses they've sat
 * with. One entry per verse (overwrites), keyed by ref so the next
 * "growth timeline" view can iterate over completed verses and pull
 * each reflection in order.
 */

import {
  collection,
  doc,
  getDoc,
  getDocs,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  Timestamp,
} from "firebase/firestore";
import { getFirebaseDb } from "@/lib/firebase";
import type { Reflection } from "./types";

// Reflections live as a top-level subcollection under the user so the
// Firestore path stays at the legal odd-segment depth for collections
// (users/{uid}/reflections → 3 segments). Nesting under practice would
// have required a synthetic intermediate doc.
function reflectionsCol(uid: string) {
  return collection(getFirebaseDb(), "users", uid, "reflections");
}

function reflectionDoc(uid: string, verseRef: string) {
  // verseRef contains a dot (e.g. "1.1") which Firestore allows in doc IDs.
  return doc(reflectionsCol(uid), verseRef);
}

function tsToNumber(v: unknown): number {
  if (v instanceof Timestamp) return v.toMillis();
  if (typeof v === "number") return v;
  return Date.now();
}

/** Save (or overwrite) the seeker's reflection on a verse. */
export async function saveReflection(
  uid: string,
  verseRef: string,
  content: string
): Promise<void> {
  const trimmed = content.trim();
  if (!trimmed) return;
  await setDoc(reflectionDoc(uid, verseRef), {
    verseRef,
    content: trimmed,
    createdAt: serverTimestamp(),
  });
}

/** Read the seeker's reflection on a specific verse, if it exists. */
export async function getReflection(
  uid: string,
  verseRef: string
): Promise<Reflection | null> {
  const snap = await getDoc(reflectionDoc(uid, verseRef));
  if (!snap.exists()) return null;
  const d = snap.data();
  return {
    verseRef: String(d.verseRef ?? verseRef),
    content: String(d.content ?? ""),
    createdAt: tsToNumber(d.createdAt),
  };
}

/** List all reflections newest-first (for a future growth-timeline view). */
export async function listReflections(uid: string): Promise<Reflection[]> {
  const snap = await getDocs(
    query(reflectionsCol(uid), orderBy("createdAt", "desc"))
  );
  return snap.docs.map((s) => {
    const d = s.data();
    return {
      verseRef: String(d.verseRef ?? s.id),
      content: String(d.content ?? ""),
      createdAt: tsToNumber(d.createdAt),
    };
  });
}
