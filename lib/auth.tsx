"use client";

import * as React from "react";
import {
  createUserWithEmailAndPassword,
  deleteUser,
  EmailAuthProvider,
  GoogleAuthProvider,
  onAuthStateChanged,
  reauthenticateWithCredential,
  reauthenticateWithPopup,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  updateProfile,
  type User as FirebaseUser,
} from "firebase/auth";
import {
  getFirebaseAuth,
  googleProvider,
  isFirebaseConfigured,
} from "@/lib/firebase";
import { deleteAllUserData } from "@/lib/conversations";

/**
 * Real auth via Firebase. The exposed API surface (useAuth → user, loading,
 * login, signup, googleLogin, logout) intentionally matches what the
 * previous localStorage demo exposed, so callers in /chat /login /signup
 * don't need to know we swapped the backend.
 *
 * Friendly error messages are mapped from Firebase's auth/* error codes —
 * raw codes ("auth/email-already-in-use") read like API output and are not
 * what the seeker should see.
 */

export interface User {
  id: string;
  name: string;
  email: string;
}

interface AuthContextValue {
  user: User | null;
  /** True until the persisted session has been read on mount. */
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  signup: (name: string, email: string, password: string) => Promise<void>;
  googleLogin: () => Promise<void>;
  logout: () => Promise<void>;
  /** Update the seeker's display name in Firebase Auth. */
  updateName: (name: string) => Promise<void>;
  /**
   * Wipe Firestore data and the Firebase Auth user. For email/password
   * accounts, pass `password` so we can re-auth if Firebase requires it
   * (recent-login policy). For Google accounts, leave it empty — we'll
   * re-auth via a Google popup automatically.
   */
  deleteAccount: (opts?: { password?: string }) => Promise<void>;
}

const AuthContext = React.createContext<AuthContextValue | null>(null);

function toUser(fb: FirebaseUser): User {
  return {
    id: fb.uid,
    name: fb.displayName ?? fb.email?.split("@")[0] ?? "Seeker",
    email: fb.email ?? "",
  };
}

/**
 * Translate Firebase's auth/* codes into sentences the seeker can read.
 * Anything we don't have a case for falls back to a generic message —
 * raw codes (`auth/network-request-failed`) leak implementation detail
 * and don't help.
 */
function friendlyError(err: unknown): string {
  const code =
    typeof err === "object" && err && "code" in err
      ? String((err as { code: unknown }).code)
      : "";
  switch (code) {
    case "auth/invalid-credential":
    case "auth/wrong-password":
    case "auth/user-not-found":
      return "Those credentials don't match any seeker. Try again.";
    case "auth/invalid-email":
      return "That email doesn't look quite right.";
    case "auth/email-already-in-use":
      return "A seeker with this email already walks the path. Sign in instead.";
    case "auth/weak-password":
      return "Let your password hold at least 6 characters.";
    case "auth/too-many-requests":
      return "Too many attempts. Take a breath and try again in a moment.";
    case "auth/popup-closed-by-user":
    case "auth/cancelled-popup-request":
      return "Sign-in was cancelled.";
    case "auth/popup-blocked":
      return "Your browser blocked the sign-in window. Allow popups for this site and try again.";
    case "auth/account-exists-with-different-credential":
      return "This email is already linked to a different sign-in method. Try email + password.";
    case "auth/network-request-failed":
      return "Network trouble. Check your connection and try again.";
    default:
      if (err instanceof Error && err.message) return err.message;
      return "Something went wrong. Please try again.";
  }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = React.useState<User | null>(null);
  const [loading, setLoading] = React.useState(true);

  // Subscribe to Firebase auth state. Fires immediately with null when
  // there's no session, and again whenever sign-in / sign-out happens.
  React.useEffect(() => {
    if (!isFirebaseConfigured()) {
      // No Firebase config yet — stop loading so the UI can show the
      // login form instead of an infinite spinner.
      setLoading(false);
      return;
    }
    const auth = getFirebaseAuth();
    const unsub = onAuthStateChanged(auth, (fb) => {
      setUser(fb ? toUser(fb) : null);
      setLoading(false);
    });
    return unsub;
  }, []);

  const login = React.useCallback(
    async (email: string, password: string) => {
      const auth = getFirebaseAuth();
      try {
        const cred = await signInWithEmailAndPassword(
          auth,
          email.trim().toLowerCase(),
          password
        );
        setUser(toUser(cred.user));
      } catch (err) {
        throw new Error(friendlyError(err));
      }
    },
    []
  );

  const signup = React.useCallback(
    async (name: string, email: string, password: string) => {
      const auth = getFirebaseAuth();
      try {
        const cred = await createUserWithEmailAndPassword(
          auth,
          email.trim().toLowerCase(),
          password
        );
        const trimmed = name.trim();
        if (trimmed) {
          await updateProfile(cred.user, { displayName: trimmed });
        }
        // updateProfile mutates the FirebaseUser in place; rebuild our
        // app-facing User from it so name shows up on the next render.
        setUser({
          id: cred.user.uid,
          name: trimmed || cred.user.email?.split("@")[0] || "Seeker",
          email: cred.user.email ?? email.trim().toLowerCase(),
        });
      } catch (err) {
        throw new Error(friendlyError(err));
      }
    },
    []
  );

  const googleLogin = React.useCallback(async () => {
    const auth = getFirebaseAuth();
    try {
      const cred = await signInWithPopup(auth, googleProvider);
      // Defensive — credential is always present on success, but the
      // typings say so loosely. Extract the user.
      const fb = cred.user;
      GoogleAuthProvider.credentialFromResult(cred); // discard, used for token if needed later
      setUser(toUser(fb));
    } catch (err) {
      throw new Error(friendlyError(err));
    }
  }, []);

  const logout = React.useCallback(async () => {
    const auth = getFirebaseAuth();
    await signOut(auth);
    setUser(null);
  }, []);

  const updateName = React.useCallback(async (name: string) => {
    const auth = getFirebaseAuth();
    const fb = auth.currentUser;
    if (!fb) throw new Error("Not signed in.");
    const trimmed = name.trim();
    if (!trimmed) throw new Error("Name cannot be empty.");
    try {
      await updateProfile(fb, { displayName: trimmed });
      setUser({
        id: fb.uid,
        name: trimmed,
        email: fb.email ?? "",
      });
    } catch (err) {
      throw new Error(friendlyError(err));
    }
  }, []);

  const deleteAccount = React.useCallback(
    async (opts?: { password?: string }) => {
      const auth = getFirebaseAuth();
      const fb = auth.currentUser;
      if (!fb) throw new Error("Not signed in.");

      // Identify the sign-in method so we know how to reauth on the
      // requires-recent-login branch. providerData is empty for anonymous
      // users only — both google.com and password populate at least one.
      const providerId = fb.providerData[0]?.providerId ?? "password";

      // Inner: wipe data, then delete the auth user. Order matters: once
      // the auth identity is gone, security rules deny further writes, so
      // Firestore data must go first.
      const purge = async () => {
        await deleteAllUserData(fb.uid);
        await deleteUser(fb);
      };

      try {
        await purge();
      } catch (err) {
        const code =
          typeof err === "object" && err && "code" in err
            ? String((err as { code: unknown }).code)
            : "";
        if (code !== "auth/requires-recent-login") {
          throw new Error(friendlyError(err));
        }
        // Recent-login required — reauth then retry the purge.
        try {
          if (providerId === "google.com") {
            await reauthenticateWithPopup(fb, googleProvider);
          } else {
            if (!opts?.password) {
              throw new Error(
                "Please enter your password to confirm account deletion."
              );
            }
            if (!fb.email) {
              throw new Error("This account has no email on file.");
            }
            const cred = EmailAuthProvider.credential(fb.email, opts.password);
            await reauthenticateWithCredential(fb, cred);
          }
        } catch (reauthErr) {
          throw new Error(friendlyError(reauthErr));
        }
        await purge();
      }
      setUser(null);
    },
    []
  );

  const value = React.useMemo(
    () => ({
      user,
      loading,
      login,
      signup,
      googleLogin,
      logout,
      updateName,
      deleteAccount,
    }),
    [user, loading, login, signup, googleLogin, logout, updateName, deleteAccount]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = React.useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within an AuthProvider");
  return ctx;
}
