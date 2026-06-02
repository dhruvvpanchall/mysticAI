"use client";

import * as React from "react";
import { resolveSTTProvider } from "./index";
import type {
  DictationStatus,
  RecordingHandle,
  TranscriptionResult,
} from "./types";

interface UseDictationOptions {
  /** Fired with the final transcript once recording stops and Whisper
   *  responds. The chat composer uses this to populate the textarea and
   *  immediately auto-send. */
  onTranscript?: (result: TranscriptionResult) => void;
  /** Fired on any failure path — permission denied, upload error, empty
   *  result. The composer uses this to surface a toast / banner. */
  onError?: (err: Error) => void;
}

/**
 * React wrapper around the resolved STT provider. Tracks recording
 * lifecycle as discrete states so the mic button can render the right
 * affordance at each step (idle / requesting / recording / transcribing
 * / error). Cleans up the recorder on unmount so navigating mid-record
 * never leaves a hot mic.
 */
export function useDictation(opts: UseDictationOptions = {}) {
  const [status, setStatus] = React.useState<DictationStatus>("idle");
  const [supported, setSupported] = React.useState(true);
  const handleRef = React.useRef<RecordingHandle | null>(null);
  const providerRef = React.useRef(resolveSTTProvider());

  React.useEffect(() => {
    setSupported(providerRef.current.isSupported());
    return () => {
      handleRef.current?.cancel();
      handleRef.current = null;
    };
  }, []);

  const start = React.useCallback(async () => {
    const provider = providerRef.current;
    if (!provider.isSupported()) {
      const err = new Error("Audio capture is not supported in this browser");
      opts.onError?.(err);
      setStatus("error");
      return;
    }
    if (status === "recording" || status === "requesting-permission") return;

    setStatus("requesting-permission");
    try {
      handleRef.current = await provider.start({
        onStart: () => setStatus("recording"),
        onResult: (result) => {
          handleRef.current = null;
          setStatus("idle");
          opts.onTranscript?.(result);
        },
        onError: (err) => {
          handleRef.current = null;
          setStatus("error");
          opts.onError?.(err);
        },
      });
    } catch (e) {
      handleRef.current = null;
      setStatus("error");
      opts.onError?.(e instanceof Error ? e : new Error("Could not start"));
    }
  }, [status, opts]);

  /** Stop recording and submit the captured audio for transcription. */
  const stop = React.useCallback(() => {
    if (!handleRef.current) return;
    setStatus("transcribing");
    handleRef.current.stop();
  }, []);

  /** Abort the recording entirely — discard captured audio, do not
   *  transcribe. Used when the seeker hits the cancel button. */
  const cancel = React.useCallback(() => {
    if (!handleRef.current) return;
    handleRef.current.cancel();
    handleRef.current = null;
    setStatus("idle");
  }, []);

  /** Reset from an error state back to idle so the seeker can retry. */
  const reset = React.useCallback(() => {
    handleRef.current?.cancel();
    handleRef.current = null;
    setStatus("idle");
  }, []);

  return { status, supported, start, stop, cancel, reset };
}
