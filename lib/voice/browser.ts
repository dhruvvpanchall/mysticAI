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
      const pick = () => {
        const voices = window.speechSynthesis.getVoices();
        if (voices.length === 0) return;
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
        window.speechSynthesis.removeEventListener("voiceschanged", pick);
        resolve();
      };
      pick();
      if (window.speechSynthesis.getVoices().length === 0) {
        window.speechSynthesis.addEventListener("voiceschanged", pick);
        // Some browsers never fire voiceschanged if voices were never going
        // to load. Resolve after a generous timeout so the UI doesn't hang.
        setTimeout(() => {
          window.speechSynthesis.removeEventListener("voiceschanged", pick);
          resolve();
        }, 2500);
      }
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

    const u = new SpeechSynthesisUtterance(text);
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
