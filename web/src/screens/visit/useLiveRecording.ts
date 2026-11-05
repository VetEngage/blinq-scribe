import { useEffect, useState } from "react";
import type { Encounter } from "../../api/types";
import { useRecorder } from "../../recorder/store";
import { duration } from "../../lib/format";

const LIVE_MS = 30_000;

/** The time now, ticking every second while `on`. */
function useNow(on: boolean): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!on) return;
    setNow(Date.now());
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [on]);
  return now;
}

/** mm:ss since a moment, ticking every second. */
function useElapsed(since: number): string {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!since) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [since]);
  if (!since) return "";
  return duration((now - since) / 1000, { padMinutes: true });
}

export interface LiveRecording {
  /** Recording now: on this computer, from the glasses, or not at all. */
  where: "here" | "glasses" | null;
  /** mm:ss since it started. */
  elapsed: string;
}

/**
 * Whether this visit is recording right now, where, and for how long. The glasses count while their
 * audio arrives: a part in the last 30 seconds.
 */
export function useLiveRecording(e: Encounter | null): LiveRecording {
  const here = useRecorder((s) => !!e && s.encounterId === e.id);
  const startedAt = useRecorder((s) => s.startedAt);
  const now = useNow(!here && e?.source === "glasses" && e.status === "recording");
  const lastPart = e?.last_part_at ? new Date(e.last_part_at).getTime() : NaN;
  const glasses = !here && e?.source === "glasses" && e.status === "recording" && now - lastPart < LIVE_MS;
  const firstPart = glasses && e.first_part_at ? new Date(e.first_part_at).getTime() : 0;
  const elapsed = useElapsed(here ? startedAt : Number.isNaN(firstPart) ? 0 : firstPart);
  return {
    where: here ? "here" : glasses ? "glasses" : null,
    elapsed,
  };
}
