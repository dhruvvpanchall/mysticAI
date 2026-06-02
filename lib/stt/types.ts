/**
 * Provider-agnostic speech-to-text contract. Mirrors lib/voice for
 * symmetry: components and hooks consume the resolved provider through
 * this interface, so swapping engines (Web Speech, Whisper-local,
 * Whisper-cloud) is a one-file change at the facade layer.
 */

export type DictationStatus =
  | "idle"
  | "requesting-permission"
  | "recording"
  | "transcribing"
  | "error";

/** Coarse language code returned by the engine, when known. Not
 *  authoritative — the chat route runs its own client-side language
 *  classifier (lib/i18n.detectQueryLang) on the transcript text. */
export type DetectedLang = "en" | "hi" | "unknown";

export interface TranscriptionResult {
  /** Final transcript text. May contain Devanagari, Latin, or a mix
   *  (Hinglish). Empty if the engine heard nothing usable. */
  text: string;
  /** Language code the engine reports, when supported. Used as a hint
   *  only — downstream lang detection re-checks on text content. */
  lang: DetectedLang;
}

export interface RecordingCallbacks {
  /** Fired once recording has actually begun (mic permission granted,
   *  capture started). Use to flip UI from "requesting" to "recording". */
  onStart?: () => void;
  /** Fired when the engine has produced a final transcript. */
  onResult?: (result: TranscriptionResult) => void;
  /** Fired on any error along the way (permission denied, network,
   *  upload failure, empty result, etc.). */
  onError?: (err: Error) => void;
}

export interface RecordingHandle {
  /** Stop recording, finalize, and emit the transcript via onResult. */
  stop(): void;
  /** Abort recording without emitting a transcript. Used by the cancel
   *  button so a misfired tap doesn't auto-send anything. */
  cancel(): void;
}

export interface TranscriptionProvider {
  /** True if this provider can capture and transcribe on the current
   *  device. False on browsers without MediaRecorder + getUserMedia, or
   *  if required env is missing on the server. */
  isSupported(): boolean;
  /** Begin capturing audio. Returns a handle to stop / cancel. The
   *  result lands via callbacks.onResult once transcription completes. */
  start(callbacks: RecordingCallbacks): Promise<RecordingHandle>;
}
