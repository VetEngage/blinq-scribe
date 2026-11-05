import { create } from "zustand";
import { api } from "../api";
import type { Encounter } from "../api/types";
import { t } from "../i18n";
import { startMic, type MicRecorder } from "./mic";
import { UploadChain } from "./uploads";

// Recording belongs to one visit. Leaving it (another visit, end of day, team, signing out) stops the
// mic, and every chunk goes to the visit it was recorded in, never to whichever visit is open later.

interface RecorderState {
  /** The visit the mic is recording for, or "" when it is off. */
  encounterId: string;
  /** Parts recorded since the mic started. */
  parts: number;
  /** When the mic started (ms since epoch), for the visit's timer; 0 when off. */
  startedAt: number;
  /** The part being sent right now (1 based), or 0. */
  sending: number;
  pending: number;
  error: string;
  /** Parts that didn't reach the server: kept here to send again. */
  failed: number;
  start: (encounterId: string) => Promise<void>;
  stop: (keep?: boolean) => void;
}

let mic: MicRecorder | null = null;
let session = 0; // bumped at sign out: a part still on its way is dropped, never shown to the next person
let chunkIndex = 0; // unique for the page, so no saved chunk on the server is overwritten
let listener: (e: Encounter) => void = () => {};
const chain = new UploadChain((n) => useRecorder.setState({ pending: n }));
// Parts that failed to send, with the visit they were recorded in, for Retry.
let failedParts: { encounterId: string; wav: Blob; index: number }[] = [];

/** Send one part; a failure keeps it for Retry and says so. */
function send(encounterId: string, wav: Blob, index: number, mine: number): void {
  const set = useRecorder.setState;
  chain.enqueue(
    async () => {
      if (mine !== session) return;
      set({ sending: index + 1 });
      const updated = await api.uploadAudio(encounterId, wav, index);
      if (mine === session) listener(updated);
    },
    (err) => {
      if (mine !== session) return;
      failedParts.push({ encounterId, wav, index });
      set({
        failed: failedParts.length,
        error: t("visit.partFailed", {
          n: index + 1,
          message: err instanceof Error ? err.message : String(err),
        }),
      });
    },
  );
  void chain.idle().then(() => {
    if (!chain.size) set({ sending: 0 });
  });
}

/** Retry: send again every part that failed, in the order recorded. */
export function retryFailedParts(): void {
  const again = failedParts;
  failedParts = [];
  useRecorder.setState({ failed: 0, error: "" });
  for (const p of again) send(p.encounterId, p.wav, p.index, session);
}

/** The visit screen hears each updated transcript here. */
export const onTranscribed = (fn: (e: Encounter) => void): void => {
  listener = fn;
};
/** Resolves once every recorded part has reached the server (draft and sign wait for it). */
export const waitForUploads = (): Promise<void> => chain.idle();
export const micLevel = (): number => (mic ? mic.level() : 0);

export const useRecorder = create<RecorderState>((set, get) => ({
  encounterId: "",
  parts: 0,
  startedAt: 0,
  sending: 0,
  pending: 0,
  error: "",
  failed: 0,
  async start(encounterId) {
    if (mic) return;
    const mine = session;
    set({ parts: 0, error: "" });
    try {
      const started = await startMic((wav) => {
        const index = chunkIndex++;
        set({ parts: get().parts + 1 });
        send(encounterId, wav, index, mine);
      });
      if (mine !== session) {
        started.stop(false);
        return;
      }
      mic = started;
      set({ encounterId, startedAt: Date.now() });
    } catch (err) {
      set({ error: t("visit.micUnavailable", { message: err instanceof Error ? err.message : String(err) }) });
    }
  },
  stop(keep = true) {
    if (!mic) return;
    mic.stop(keep);
    mic = null;
    set({ encounterId: "", startedAt: 0 });
  },
}));

// The session timed out mid-visit: what was recorded is kept for the same person, to send once they
// sign back in. Anyone else signing in here gets none of it.
let parkedFor = "";

/**
 * Signing out: stop the mic, drop what it had, and ignore any part still on its way. A timeout
 * (`keepFor`, who was signed in) keeps the recording: the mic stops with its last part, and any part
 * that couldn't send waits for Retry.
 */
export function endRecordingSession(keepFor = ""): void {
  if (keepFor) {
    parkedFor = keepFor;
    useRecorder.getState().stop(true);
    return;
  }
  parkedFor = "";
  session++;
  useRecorder.getState().stop(false);
  failedParts = [];
  useRecorder.setState({ parts: 0, sending: 0, error: "", failed: 0 });
}

/** Signed back in: the recording kept from a timeout stays only for the same person. */
export function resumeRecordingSession(user: string): void {
  if (parkedFor && parkedFor !== user) endRecordingSession();
  parkedFor = "";
}
