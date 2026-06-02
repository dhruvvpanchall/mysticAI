"use client";

import type {
  SpeakCallbacks,
  VoiceHandle,
  VoiceInfo,
  VoiceProvider,
} from "./types";

/** Voice names that commonly ship as male Hindi voices on major
 *  platforms. The Web Speech API doesn't expose a gender field in any
 *  cross-browser way, so we lean on name heuristics. Microsoft Hemant
 *  ships on Windows; Madhur / Aarav on iOS / macOS; Google's hi-IN male
 *  appears on Chrome / Android. */
const MALE_HINDI_HINTS = ["hemant", "madhur", "ravi", "aditya", "rishi", "male"];

/**
 * Web Speech API adapter. Free, no setup, runs entirely client-side.
 * Quality varies by OS; on devices with no installed Hindi voice the
 * engine falls back to a default voice that mispronounces Devanagari.
 * `getVoiceInfo()` returns null in that case so the UI can disable
 * playback rather than emit nonsense.
 */
export class BrowserVoiceProvider implements VoiceProvider {
  private voice: SpeechSynthesisVoice | null = null;
  private isMale = false;
  private readyPromise: Promise<void> | null = null;

  isSupported(): boolean {
    return typeof window !== "undefined" && "speechSynthesis" in window;
  }

  ready(): Promise<void> {
    if (!this.isSupported()) return Promise.resolve();
    if (this.readyPromise) return this.readyPromise;

    this.readyPromise = new Promise<void>((resolve) => {
      const TOTAL_TIMEOUT_MS = 5000;
      const POLL_INTERVAL_MS = 200;
      const started = Date.now();

      const tryPick = (): boolean => {
        const voices = window.speechSynthesis.getVoices();
        if (voices.length === 0) return false;
        const hindi = voices.filter((v) =>
          v.lang.toLowerCase().startsWith("hi")
        );
        const male = hindi.find((v) => {
          const n = v.name.toLowerCase();
          return MALE_HINDI_HINTS.some((hint) => n.includes(hint));
        });
        const fallback =
          hindi.find((v) => v.lang === "hi-IN") ?? hindi[0] ?? null;
        this.voice = male ?? fallback;
        this.isMale = Boolean(male);
        return true;
      };

      if (tryPick()) {
        resolve();
        return;
      }

      // Poll. iOS Safari often does NOT fire voiceschanged at all, and
      // getVoices() returns empty until the system finishes loading the
      // voice manifest. Polling is the only reliable detector on iOS.
      const pollId = window.setInterval(() => {
        if (tryPick()) {
          window.clearInterval(pollId);
          resolve();
        } else if (Date.now() - started > TOTAL_TIMEOUT_MS) {
          window.clearInterval(pollId);
          // Give up gracefully — speak() will still try with lang=hi-IN
          // and the engine picks whatever default it has.
          resolve();
        }
      }, POLL_INTERVAL_MS);
    });
    return this.readyPromise;
  }

  getVoiceInfo(): VoiceInfo | null {
    if (!this.voice) return null;
    return { name: this.voice.name, isMale: this.isMale };
  }

  speak(text: string, callbacks?: SpeakCallbacks): VoiceHandle {
    if (!this.isSupported()) {
      callbacks?.onError?.(new Error("Web Speech API not supported"));
      return NOOP_HANDLE;
    }
    window.speechSynthesis.cancel();

    const u = new SpeechSynthesisUtterance(sanitizeForHindiSpeech(text));
    u.lang = "hi-IN";
    if (this.voice) u.voice = this.voice;
    u.rate = 0.9;
    // A true male voice reads at neutral pitch; nudge fallback voices
    // downward so a default female voice still lands in a warmer,
    // teacher-like register.
    u.pitch = this.isMale ? 0.98 : 0.8;

    u.onstart = () => callbacks?.onStart?.();
    u.onend = () => callbacks?.onEnd?.();
    u.onerror = (ev) => {
      // cancel()/pause()/new-speak interruptions surface as "canceled" /
      // "interrupted" errors. Treat those as a clean stop so the UI
      // doesn't flash an error state during normal control flow.
      if (ev.error === "canceled" || ev.error === "interrupted") {
        callbacks?.onEnd?.();
        return;
      }
      callbacks?.onError?.(new Error(ev.error ?? "speech synthesis failed"));
    };

    window.speechSynthesis.speak(u);

    return {
      pause: () => window.speechSynthesis.pause(),
      resume: () => window.speechSynthesis.resume(),
      stop: () => window.speechSynthesis.cancel(),
    };
  }
}

const NOOP_HANDLE: VoiceHandle = {
  pause: () => {},
  resume: () => {},
  stop: () => {},
};

/**
 * Strip punctuation iOS Safari's Hindi voices read literally instead of
 * interpreting as pauses. The bug surfaces as the narration saying
 * "comma 1 comma 5 comma comma dash" because Latin punctuation embedded
 * in Hindi text is vocalized verbatim by the engine. Convert problematic
 * punctuation to whitespace; leave the Devanagari danda (।) which the
 * engine handles correctly. Numbers stay as digits — the engine reads
 * them as numerals, not as "comma N comma".
 *
 * Applied at the speech-utterance boundary so the narration scripts
 * (lib/voice/script.ts) stay semantically clean and only the playback
 * adapter knows about engine quirks.
 */
function sanitizeForHindiSpeech(text: string): string {
  return text
    .replace(/[,;:]/g, " ")
    .replace(/[-–—]/g, " ")
    .replace(/(\d)\.(\d)/g, "$1 $2")
    .replace(/\s+/g, " ")
    .trim();
}
