"use client";

import * as React from "react";
import { resolveVoiceProvider } from "./index";
import type { VoiceHandle, VoiceInfo, VoiceStatus } from "./types";

/**
 * React wrapper around the resolved voice provider. Each consuming
 * component gets its own status state, but all instances share the
 * underlying provider singleton — so starting playback in one place
 * naturally stops any prior utterance (speechSynthesis is a global).
 *
 * Tears down any active utterance on unmount so navigating away never
 * leaves a verse still narrating in the background.
 */
export function useHindiVoice() {
  const [status, setStatus] = React.useState<VoiceStatus>("idle");
  const [voiceInfo, setVoiceInfo] = React.useState<VoiceInfo | null>(null);
  const [ready, setReady] = React.useState(false);
  const [supported, setSupported] = React.useState(true);
  const handleRef = React.useRef<VoiceHandle | null>(null);
  const providerRef = React.useRef(resolveVoiceProvider());

  React.useEffect(() => {
    const provider = providerRef.current;
    if (!provider.isSupported()) {
      setSupported(false);
      setReady(true);
      return;
    }
    let cancelled = false;
    provider.ready().then(() => {
      if (cancelled) return;
      setVoiceInfo(provider.getVoiceInfo());
      setReady(true);
    });
    return () => {
      cancelled = true;
      handleRef.current?.stop();
    };
  }, []);

  const play = React.useCallback((text: string) => {
    const provider = providerRef.current;
    if (!provider.isSupported()) return;
    handleRef.current?.stop();
    setStatus("loading");
    handleRef.current = provider.speak(text, {
      onStart: () => setStatus("playing"),
      onEnd: () => setStatus("idle"),
      onError: (err) => {
        console.error("[voice] playback error:", err);
        setStatus("idle");
      },
    });
  }, []);

  const pause = React.useCallback(() => {
    handleRef.current?.pause();
    setStatus("paused");
  }, []);

  const resume = React.useCallback(() => {
    handleRef.current?.resume();
    setStatus("playing");
  }, []);

  const stop = React.useCallback(() => {
    handleRef.current?.stop();
    setStatus("idle");
  }, []);

  return { status, voiceInfo, ready, supported, play, pause, resume, stop };
}
