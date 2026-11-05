// Talking to Blinq: press to talk, never an always-on mic. Pressing a mic starts listening; pressing
// again (or Done) sends the clip to the server's speech model, asks the question, and reads the answer
// back in the vet's voice. The demo clinic has no speech model: there the browser's own recognition
// hears the words (and shows them live) when it has one, else the server's demo hears a plausible
// question. Pressing a mic while Blinq speaks cuts it off.
import { create } from "zustand";
import { api } from "../api";
import { ApiError } from "../api/http";
import { useSession } from "../api/session";
import { t } from "../i18n";
import { speak, stopSpeech } from "../lib/speak";
import { startMic, type MicRecorder } from "../recorder/mic";
import { plainAnswer } from "../lib/plainWords";
import { ask } from "./ask";
import { useChat } from "./chat";
import { useApp } from "./app";

export type VoicePhase = "idle" | "listening" | "thinking" | "speaking";

interface VoiceState {
  phase: VoicePhase;
  /** Listening: the words heard so far. */
  caption: string;
  /** Speaking: what is being read, already on screen: "brief", or "msg:<index in the thread>". */
  reading: string;
  /** Why the last try didn't work, shown under the field. */
  error: string;
  /** The mic's loudness, 0 to 1, for the level bar. */
  level: () => number;
}

const quiet = () => 0;

export const useVoice = create<VoiceState>(() => ({
  phase: "idle",
  caption: "",
  reading: "",
  error: "",
  level: quiet,
}));

/** The control whose speech this is (lib/speak keeps one voice at a time across the app). */
export const SPEECH_KEY = "ask";

// The browser's speech recognition, where it has one (Chrome, Edge, Safari).
interface Recognition {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult: ((ev: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null;
  onerror: (() => void) | null;
  start(): void;
  stop(): void;
  abort(): void;
}
type RecognitionCtor = new () => Recognition;
const Recognizer = (): RecognitionCtor | undefined => {
  if (typeof window === "undefined") return undefined;
  const w = window as unknown as { SpeechRecognition?: RecognitionCtor; webkitSpeechRecognition?: RecognitionCtor };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition;
};

let mic: MicRecorder | null = null;
let recognition: Recognition | null = null;
let clip: Blob | null = null;
let heard = "";
// Bumped by every start and stop, so a late clip, transcript or answer never lands in a newer turn.
let turn = 0;

const set = (patch: Partial<VoiceState>) => useVoice.setState(patch);

function release() {
  mic?.stop(false);
  mic = null;
  recognition?.abort();
  recognition = null;
}

/** Whether the browser listens instead of the server: only with no speech model on the server. */
const browserListens = () => useApp.getState().health?.stt === "mock" && !!Recognizer();

/** Start listening. Call it inside the click or key press, so the browser allows the mic. */
export function startTalking(): void {
  if (useVoice.getState().phase === "listening") return void finishTalking();
  stopSpeech(); // cuts Blinq off
  release();
  const mine = ++turn;
  clip = null;
  heard = "";
  set({ phase: "listening", caption: "", reading: "", error: "", level: quiet });
  startMic((wav) => {
    // One clip per question: the recorder hands one over every 15 seconds, so that is the longest.
    if (mine !== turn || clip) return;
    clip = wav;
    if (useVoice.getState().phase === "listening") void finishTalking();
  })
    .then((m) => {
      if (mine !== turn || useVoice.getState().phase !== "listening") return m.stop(false);
      mic = m;
      set({ level: m.level });
    })
    .catch(() => {
      if (mine !== turn) return;
      release();
      set({ phase: "idle", error: t("ask.voice.noMic"), level: quiet });
    });
  const Ctor = browserListens() ? Recognizer() : undefined;
  if (Ctor) {
    try {
      const r = new Ctor();
      r.lang = "en-US";
      r.continuous = true;
      r.interimResults = true;
      r.onresult = (ev) => {
        if (mine !== turn) return;
        heard = Array.from(ev.results, (res) => res[0]?.transcript ?? "").join("");
        set({ caption: heard });
      };
      r.onerror = () => undefined; // the clip still goes to the server
      r.start();
      recognition = r;
    } catch {
      recognition = null;
    }
  }
}

/** Done: stop listening, work out what was said, ask it, and read the answer back. */
export async function finishTalking(): Promise<void> {
  if (useVoice.getState().phase !== "listening") return;
  const mine = turn;
  set({ phase: "thinking", level: quiet });
  mic?.stop(true); // hands over what it heard since the last clip
  mic = null;
  recognition?.stop();
  recognition = null;
  let question = heard.trim();
  if (!question && clip) {
    try {
      question = (await api.listen(clip)).text.trim();
    } catch (err) {
      if (mine !== turn) return;
      const why = err instanceof ApiError && err.status === 503 ? t("ask.voice.notHeard") : t("ask.voice.failed");
      set({ phase: "idle", error: why });
      return;
    }
  }
  if (mine !== turn) return;
  if (!question) {
    set({ phase: "idle", caption: "", error: t("ask.voice.notHeard") });
    return;
  }
  set({ caption: "" });
  const answer = await ask(question);
  if (mine !== turn) return;
  if (!answer) return endVoice();
  // The answer is the newest message in the thread: read it there.
  say(plainAnswer(answer.content), `msg:${useChat.getState().history.length - 1}`);
}

/** Read `text` aloud as Blinq. `reading` names what's being read on screen, so it's marked there. */
export function say(text: string, reading: string): void {
  turn++;
  release();
  set({ phase: "speaking", caption: "", reading, error: "", level: quiet });
  void speak(text, SPEECH_KEY);
}

/** Blinq finished reading (the speech went quiet): back to the field. */
export function spoke(): void {
  if (useVoice.getState().phase === "speaking") set({ phase: "idle", reading: "" });
}

/** Stop: cut Blinq off, or stop listening without asking. */
export function stopTalking(): void {
  endVoice();
}

/** Back to the field: nothing listening or speaking. */
export function endVoice(): void {
  turn++;
  release();
  if (useVoice.getState().phase === "speaking") stopSpeech();
  set({ phase: "idle", caption: "", reading: "", error: "", level: quiet });
}

// Signing out drops whatever was being heard or said.
useSession.subscribe((s, prev) => {
  if (s.epoch !== prev.epoch) endVoice();
});

