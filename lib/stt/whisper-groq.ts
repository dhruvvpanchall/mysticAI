"use client";

import type {
  RecordingCallbacks,
  RecordingHandle,
  TranscriptionProvider,
} from "./types";

/**
 * Cloud Whisper adapter. Records audio in the browser via MediaRecorder
 * + getUserMedia, then POSTs the captured Blob to /api/transcribe (which
 * forwards to Groq Whisper-large-v3-turbo). Returns final transcript
 * once the server responds.
 *
 * Codec selection is dynamic — Chrome / Firefox use webm+opus, Safari
 * uses mp4+aac. Groq Whisper accepts both. We pick whichever the
 * browser claims to support.
 */

const CODEC_CANDIDATES = [
  "audio/webm;codecs=opus",
  "audio/webm",
  "audio/mp4;codecs=mp4a.40.2",
  "audio/mp4",
  "audio/ogg;codecs=opus",
];

/** Hard cap on a single recording. Beyond this we stop the recorder
 *  automatically — protects against runaway uploads and Whisper's 25MB
 *  file size ceiling. 60s of opus@32kbps is ~240KB; safe headroom. */
const MAX_RECORDING_MS = 60_000;

function pickMimeType(): string {
  for (const t of CODEC_CANDIDATES) {
    try {
      if (MediaRecorder.isTypeSupported(t)) return t;
    } catch {
      // Some legacy implementations throw on unknown types — keep walking.
    }
  }
  return "";
}

export class GroqWhisperProvider implements TranscriptionProvider {
  isSupported(): boolean {
    if (typeof window === "undefined") return false;
    return (
      "MediaRecorder" in window &&
      typeof navigator !== "undefined" &&
      !!navigator.mediaDevices &&
      typeof navigator.mediaDevices.getUserMedia === "function"
    );
  }

  async start(callbacks: RecordingCallbacks): Promise<RecordingHandle> {
    if (!this.isSupported()) {
      const err = new Error("Audio capture is not supported in this browser");
      callbacks.onError?.(err);
      throw err;
    }

    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch (e) {
      const err =
        e instanceof Error ? e : new Error("Microphone permission denied");
      callbacks.onError?.(err);
      throw err;
    }

    const mimeType = pickMimeType();
    const recorder = mimeType
      ? new MediaRecorder(stream, { mimeType })
      : new MediaRecorder(stream);

    const chunks: BlobPart[] = [];
    let cancelled = false;
    let stopped = false;
    let timer: ReturnType<typeof setTimeout> | null = null;

    const releaseStream = () => {
      for (const track of stream.getTracks()) track.stop();
      if (timer) {
        clearTimeout(timer);
        timer = null;
      }
    };

    recorder.ondataavailable = (e) => {
      if (e.data && e.data.size > 0) chunks.push(e.data);
    };

    recorder.onerror = (e) => {
      releaseStream();
      // MediaRecorder's error event is a MediaRecorderErrorEvent in some
      // browsers, a plain Event in others. Both reach us via the same
      // handler — wrap defensively rather than reading e.error directly.
      const err = new Error(
        "Recording failed" +
          (typeof e === "object" && e !== null && "error" in e
            ? `: ${(e as { error: { message?: string } }).error?.message ?? "unknown"}`
            : "")
      );
      callbacks.onError?.(err);
    };

    recorder.onstop = async () => {
      releaseStream();
      if (cancelled) return;
      if (chunks.length === 0) {
        callbacks.onError?.(new Error("No audio captured"));
        return;
      }
      const blob = new Blob(chunks, {
        type: mimeType || "audio/webm",
      });
      try {
        const result = await uploadForTranscription(blob, mimeType || "audio/webm");
        callbacks.onResult?.(result);
      } catch (e) {
        callbacks.onError?.(
          e instanceof Error ? e : new Error("Transcription failed")
        );
      }
    };

    recorder.start();
    callbacks.onStart?.();

    timer = setTimeout(() => {
      if (recorder.state === "recording") recorder.stop();
    }, MAX_RECORDING_MS);

    return {
      stop: () => {
        if (stopped) return;
        stopped = true;
        if (recorder.state === "recording") recorder.stop();
      },
      cancel: () => {
        if (stopped) return;
        stopped = true;
        cancelled = true;
        if (recorder.state === "recording") recorder.stop();
        releaseStream();
      },
    };
  }
}

async function uploadForTranscription(
  blob: Blob,
  mime: string
): Promise<{ text: string; lang: "en" | "hi" | "unknown" }> {
  // Pick a filename extension that matches the codec; Whisper APIs sniff
  // the extension before the actual bytes, so an audio/mp4 blob named
  // "audio.webm" can get rejected on stricter providers.
  const ext = mime.includes("mp4")
    ? "m4a"
    : mime.includes("ogg")
      ? "ogg"
      : "webm";
  const file = new File([blob], `audio.${ext}`, { type: mime });
  const form = new FormData();
  form.append("audio", file);

  const res = await fetch("/api/transcribe", {
    method: "POST",
    body: form,
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`Transcribe failed: ${res.status} ${detail.slice(0, 200)}`);
  }
  const data = (await res.json()) as {
    text?: string;
    lang?: "en" | "hi" | "unknown";
  };
  if (!data?.text || typeof data.text !== "string") {
    throw new Error("Transcribe returned no text");
  }
  return { text: data.text.trim(), lang: data.lang ?? "unknown" };
}
