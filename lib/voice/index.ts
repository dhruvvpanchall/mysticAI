"use client";

import { BrowserVoiceProvider } from "./browser";
import type { VoiceProvider } from "./types";

let instance: VoiceProvider | null = null;

/**
 * Resolves the active voice provider. Today this returns the browser
 * Web Speech adapter — zero setup, runs entirely client-side, free.
 *
 * When Azure Speech credentials are configured server-side, this is the
 * single function that flips to the Azure adapter (which calls a small
 * `/api/voice/synthesize` route that returns MP3 bytes). Callers don't
 * change; only this file does.
 */
export function resolveVoiceProvider(): VoiceProvider {
  if (instance) return instance;
  instance = new BrowserVoiceProvider();
  return instance;
}

export type {
  VoiceProvider,
  VoiceStatus,
  VoiceInfo,
  VoiceHandle,
  SpeakCallbacks,
} from "./types";
export { buildChatNarration, buildLessonNarration } from "./script";
