import { useEffect, useRef } from "react";
import { useSpeech } from "../../lib/speak";
import { SPEECH_KEY, spoke, useVoice } from "../../state/voice";

/** Moves voice on when Blinq goes quiet: the end of its answer, Stop elsewhere, or leaving the page. */
export function useVoiceWatch(): void {
  const phase = useVoice((s) => s.phase);
  const s = useSpeech(SPEECH_KEY);
  const active = s.speaking || s.loading;
  const started = useRef(false);
  useEffect(() => {
    if (phase !== "speaking") {
      started.current = false;
      return;
    }
    if (active) started.current = true;
    else if (started.current) spoke();
  }, [phase, active]);
  // No voice at all on this browser: don't wait for speech that never starts.
  useEffect(() => {
    if (phase !== "speaking") return;
    const id = setTimeout(() => {
      if (!started.current) spoke();
    }, 5000);
    return () => clearTimeout(id);
  }, [phase]);
}
