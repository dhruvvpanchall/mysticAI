"use client";

import * as React from "react";
import { Volume2, Play, Pause, Square } from "lucide-react";
import { useHindiVoice } from "@/lib/voice/useHindiVoice";
import { buildChatNarration } from "@/lib/voice";
import { hasDevanagari } from "@/lib/i18n";
import { cn } from "@/lib/utils";

interface Props {
  /** Hindi translation of the message, if it has been generated. May
   *  populate incrementally during streaming — `isTranslating` says
   *  whether more tokens are still arriving. */
  hindiText: string | undefined;
  /** True while the translate stream is still in flight. We never start
   *  playback against a partial translation; the play queues until this
   *  flips back to false. */
  isTranslating: boolean;
  /** Parent-owned trigger to start translation. Voice player calls this
   *  the first time a user taps Listen on an English-only message. */
  onRequestTranslation: () => void;
}

/**
 * Per-message "Listen in Hindi" control. Slots in alongside the
 * translate pills on assistant messages. Knows nothing about the TTS
 * engine — it talks to the resolved provider via [[useHindiVoice]] and
 * to the parent via the three props above. Swapping Web Speech for
 * Azure changes neither this component nor the chat page.
 */
export function MessageVoicePlayer({
  hindiText,
  isTranslating,
  onRequestTranslation,
}: Props) {
  const { status, voiceInfo, ready, supported, play, pause, resume, stop } =
    useHindiVoice();
  const [pendingPlay, setPendingPlay] = React.useState(false);

  // When a play request was queued behind translation, kick off playback
  // the moment the full Hindi text lands. Watches parent-owned props so
  // this component stays a thin controller and the chat page remains the
  // single source of truth for message state.
  //
  // hasDevanagari guard: a failed translation lands an English error
  // string ("Translation could not be loaded...") into hindiText. Don't
  // try to speak that with a Hindi voice — just drop the pending play.
  React.useEffect(() => {
    if (pendingPlay && hindiText && !isTranslating) {
      if (hasDevanagari(hindiText)) {
        play(buildChatNarration(hindiText));
      }
      setPendingPlay(false);
    }
  }, [pendingPlay, hindiText, isTranslating, play]);

  if (!supported) return null;

  const noVoice = ready && !voiceInfo;
  const playing = status === "playing";
  const paused = status === "paused";
  const busy = status === "loading" || (pendingPlay && isTranslating);

  const handlePrimary = () => {
    if (playing) return pause();
    if (paused) return resume();
    if (hindiText && !isTranslating && hasDevanagari(hindiText)) {
      play(buildChatNarration(hindiText));
      return;
    }
    if (!hindiText && !isTranslating) onRequestTranslation();
    setPendingPlay(true);
  };

  const label = playing
    ? "Pause"
    : paused
      ? "Resume"
      : busy
        ? "Loading"
        : "Listen";

  const tooltip = noVoice
    ? "No Hindi voice installed on this device"
    : voiceInfo
      ? `${label} in Hindi (${voiceInfo.isMale ? "male" : "default"} voice)`
      : label;

  return (
    <span className="inline-flex items-center gap-1">
      <button
        onClick={handlePrimary}
        disabled={busy || noVoice}
        aria-label={tooltip}
        title={tooltip}
        className={cn(
          "inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[11px] transition-colors disabled:cursor-not-allowed disabled:opacity-50",
          playing || paused
            ? "border-maroon/40 bg-saffron-50 text-maroon"
            : "border-parchment-muted bg-parchment text-ink-soft hover:border-maroon/30 hover:text-ink"
        )}
      >
        {busy ? (
          <span className="h-2.5 w-2.5 animate-spin rounded-full border border-current border-t-transparent" />
        ) : playing ? (
          <Pause size={11} />
        ) : paused ? (
          <Play size={11} className="translate-x-[0.5px]" />
        ) : (
          <Volume2 size={11} />
        )}
        {label}
      </button>
      {(playing || paused) && (
        <button
          onClick={stop}
          aria-label="Stop"
          title="Stop"
          className="inline-flex h-[22px] w-[22px] items-center justify-center rounded-full border border-parchment-muted bg-parchment text-ink-muted transition-colors hover:border-maroon/30 hover:text-maroon"
        >
          <Square size={9} />
        </button>
      )}
    </span>
  );
}
