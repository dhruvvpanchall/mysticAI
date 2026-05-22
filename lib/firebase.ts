/**
 * Firebase client init. Reads config from NEXT_PUBLIC_FIREBASE_* env vars
 * so it works in the browser. Exposes singleton Auth + Firestore handles.
 *
 * Designed to be safe when env vars are missing — `isFirebaseConfigured()`
 * lets callers check and fall back gracefully instead of crashing the dev
 * server while the seeker is still filling in their .env.local.
 */

import { initializeApp, getApps, getApp, type FirebaseApp } from "firebase/app";
import {
  getAuth,
  GoogleAuthProvider,
  type Auth,
} from "firebase/auth";
import { getFirestore, type Firestore } from "firebase/firestore";

const config = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

export function isFirebaseConfigured(): boolean {
  return Boolean(
    config.apiKey && config.authDomain && config.projectId && config.appId
  );
}

let cachedApp: FirebaseApp | null = null;
let cachedAuth: Auth | null = null;
let cachedDb: Firestore | null = null;

function ensureApp(): FirebaseApp {
  if (cachedApp) return cachedApp;
  if (!isFirebaseConfigured()) {
    throw new Error(
      "Firebase is not configured. Set NEXT_PUBLIC_FIREBASE_* env vars in .env.local."
    );
  }
  cachedApp = getApps().length
    ? getApp()
    : initializeApp({
        apiKey: config.apiKey!,
        authDomain: config.authDomain!,
        projectId: config.projectId!,
        storageBucket: config.storageBucket,
        messagingSenderId: config.messagingSenderId,
        appId: config.appId!,
      });
  return cachedApp;
}

export function getFirebaseAuth(): Auth {
  if (cachedAuth) return cachedAuth;
  cachedAuth = getAuth(ensureApp());
  return cachedAuth;
}

export function getFirebaseDb(): Firestore {
  if (cachedDb) return cachedDb;
  cachedDb = getFirestore(ensureApp());
  return cachedDb;
}

export const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: "select_account" });
