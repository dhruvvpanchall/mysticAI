/**
 * Provider-agnostic voice playback contract. Every TTS adapter (browser
 * Web Speech, Azure Speech, Piper) implements VoiceProvider. The rest of
 * the app — components, hooks, routes — only touches the resolved
 * provider through this interface, so swapping engines is a one-file
 * change at the facade layer.
 */

export type VoiceStatus = "idle" | "loading" | "playing" | "paused";

export interface VoiceInfo {
  /** Engine-reported voice name (e.g. "Microsoft Hemant"). */
  name: string;
  /** True if the chosen voice is a male narrator. The Web Speech API
   *  doesn't expose gender, so adapters infer this from voice name
   *  heuristics; Azure exposes it directly. */
  isMale: boolean;
}

export interface SpeakCallbacks {
  onStart?: () => void;
  onEnd?: () => void;
  onError?: (err: Error) => void;
}

export interface VoiceHandle {
  pause(): void;
  resume(): void;
  stop(): void;
}

export interface VoiceProvider {
  /** Resolves once voices are loaded and the provider is ready to speak. */
  ready(): Promise<void>;
  /** True if this provider can synthesize on the current device. */
  isSupported(): boolean;
  /** Metadata about the selected Hindi voice, once `ready()` has resolved.
   *  Null means no usable Hindi voice was found on this device. */
  getVoiceInfo(): VoiceInfo | null;
  /** Speak the given Hindi text. Calling speak() again before the previous
   *  handle ends cancels the previous utterance. */
  speak(text: string, callbacks?: SpeakCallbacks): VoiceHandle;
}
