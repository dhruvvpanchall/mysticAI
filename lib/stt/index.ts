"use client";

import { GroqWhisperProvider } from "./whisper-groq";
import type { TranscriptionProvider } from "./types";

let instance: TranscriptionProvider | null = null;

/**
 * Resolves the active speech-to-text provider. Today this returns the
 * Groq Whisper-large-v3-turbo adapter — true multilingual auto-detect
 * (English, Hindi, Hinglish) with quality the Web Speech API can't
 * match.
 *
 * If we ever need a no-key fallback (e.g. local dev without the Groq
 * env set), flip this to a BrowserSTTProvider that uses the Web Speech
 * SpeechRecognition API. The component contract above does not change.
 */
export function resolveSTTProvider(): TranscriptionProvider {
  if (instance) return instance;
  instance = new GroqWhisperProvider();
  return instance;
}

export type {
  TranscriptionProvider,
  TranscriptionResult,
  RecordingHandle,
  RecordingCallbacks,
  DictationStatus,
  DetectedLang,
} from "./types";
