// Read aloud: one voice at a time across the app, with Stop. The server's natural voice when it has
// one (a WAV clip fetched with the Authorization header and played from a blob URL); otherwise the
// browser's own voice, the most natural one it offers in US English.
import { useSyncExternalStore } from "react";
import { authHeader } from "../api/session";
import { plainWords } from "./plainWords";

export interface VoiceChoice {
  /** "server:<id>", "browser:<name>", or "" for the default. */
  voice: string;
  /** Playback rate, 1 is normal. */
  speed: number;
}

export interface SpeechState {
  /** What is being read: the key of the control that started it, "" when quiet. */
  key: string;
  /** The clip is being made (server voice). */
  loading: boolean;
}

let state: SpeechState = { key: "", loading: false };
const listeners = new Set<() => void>();
const set = (next: SpeechState) => {
  state = next;
  listeners.forEach((l) => l());
};

let audio: HTMLAudioElement | null = null;
let clipUrl = "";
let pending: AbortController | null = null;
// Bumped by every speak and stop, so a clip that arrives after Stop is never played.
let turn = 0;

function release() {
  if (audio) {
    audio.onended = audio.onerror = null;
    audio.pause();
    audio = null;
  }
  if (clipUrl) {
    URL.revokeObjectURL(clipUrl);
    clipUrl = "";
  }
}

/** Stop whatever is being read, and any clip still on its way. */
export function stopSpeech(): void {
  turn++;
  pending?.abort();
  pending = null;
  release();
  if (typeof window !== "undefined" && "speechSynthesis" in window) window.speechSynthesis.cancel();
  if (state.key || state.loading) set({ key: "", loading: false });
}

// --- the voice the vet picked (Account > Voice), kept in this browser per person ---

const prefKey = (userId: string) => `blinq.voice.${userId || "default"}`;

export function loadVoiceChoice(userId: string): VoiceChoice {
  try {
    const raw = localStorage.getItem(prefKey(userId));
    const v = raw ? (JSON.parse(raw) as Partial<VoiceChoice>) : {};
    return { voice: typeof v.voice === "string" ? v.voice : "", speed: typeof v.speed === "number" ? v.speed : 1 };
  } catch {
    return { voice: "", speed: 1 };
  }
}

export function saveVoiceChoice(userId: string, choice: VoiceChoice): void {
  try {
    localStorage.setItem(prefKey(userId), JSON.stringify(choice));
  } catch {
    /* private window or storage off: the choice lasts until reload */
  }
}

let current: VoiceChoice = { voice: "", speed: 1 };
/** The choice reads use from now on (set at sign in and from Account). */
export function setVoiceChoice(choice: VoiceChoice): void {
  current = choice;
}

// --- the browser's voice ---

const NATURAL = /natural|neural|enhanced|premium|google/i;

/** The most natural US English voice the browser has: one named Natural, Neural, Enhanced, Premium or Google first. */
export function pickBrowserVoice(voices: SpeechSynthesisVoice[], wanted = ""): SpeechSynthesisVoice | null {
  if (wanted) {
    const named = voices.find((v) => v.name === wanted);
    if (named) return named;
  }
  const us = voices.filter((v) => /^en[-_]US$/i.test(v.lang));
  const english = voices.filter((v) => /^en\b/i.test(v.lang));
  return (
    us.find((v) => NATURAL.test(v.name)) ?? us[0] ?? english.find((v) => NATURAL.test(v.name)) ?? english[0] ?? null
  );
}

export const browserVoices = (): SpeechSynthesisVoice[] =>
  typeof window !== "undefined" && "speechSynthesis" in window ? window.speechSynthesis.getVoices() : [];

function speakInBrowser(text: string, key: string, mine: number) {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) {
    set({ key: "", loading: false });
    return;
  }
  // Shorthand in plain words ("6yo" is "6 year old"), the way the server's voice says it.
  const u = new SpeechSynthesisUtterance(plainWords(text));
  const name = current.voice.startsWith("browser:") ? current.voice.slice(8) : "";
  const voice = pickBrowserVoice(browserVoices(), name);
  if (voice) u.voice = voice;
  u.lang = voice?.lang ?? "en-US";
  u.rate = current.speed;
  u.onstart = () => mine === turn && set({ key, loading: false });
  u.onend = u.onerror = () => mine === turn && set({ key: "", loading: false });
  window.speechSynthesis.cancel();
  window.speechSynthesis.speak(u);
  set({ key, loading: false });
}

// --- the server's voice ---

let serverVoice: boolean | null = null;
/** Whether the server reads aloud (from speech_options); null until known, then the browser is the fallback. */
export function setServerVoice(available: boolean): void {
  serverVoice = available;
}

async function speakFromServer(text: string, key: string, mine: number): Promise<boolean> {
  const ctl = new AbortController();
  pending = ctl;
  const voice = current.voice.startsWith("server:") ? current.voice.slice(7) : "";
  let res: Response;
  try {
    res = await fetch("/api/speech", {
      method: "POST",
      headers: { ...authHeader(), "Content-Type": "application/json" },
      body: JSON.stringify({ text, voice }),
      signal: ctl.signal,
    });
  } catch {
    return mine !== turn; // stopped on purpose, or the network: the browser reads it instead
  }
  if (mine !== turn) return true;
  if (!res.ok) {
    // 503: the natural voice isn't installed on this server. Don't ask again this session.
    if (res.status === 503) serverVoice = false;
    return false;
  }
  const blob = await res.blob();
  if (mine !== turn) return true;
  pending = null;
  release();
  clipUrl = URL.createObjectURL(blob);
  const a = new Audio(clipUrl);
  audio = a;
  a.playbackRate = current.speed;
  const done = () => {
    if (audio !== a) return;
    release();
    if (mine === turn) set({ key: "", loading: false });
  };
  a.onended = done;
  a.onerror = done;
  try {
    await a.play();
  } catch {
    done();
    return false;
  }
  if (mine === turn) set({ key, loading: false });
  return true;
}

/** Read `text` aloud for the control `key`, stopping anything else first. */
export async function speak(text: string, key = "default"): Promise<void> {
  if (!text) return;
  stopSpeech();
  const mine = turn;
  if (serverVoice !== false) {
    set({ key, loading: true });
    if (await speakFromServer(text, key, mine)) return;
    if (mine !== turn) return;
  }
  speakInBrowser(text, key, mine);
}

/** For a Read aloud control: whether it is reading or making its clip, and a toggle. */
export function useSpeech(key: string) {
  const s = useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => state,
  );
  const mine = s.key === key;
  return {
    speaking: mine && !s.loading,
    loading: mine && s.loading,
    speak: (text: string) => void speak(text, key),
    stop: stopSpeech,
    toggle: (text: string) => (mine ? stopSpeech() : void speak(text, key)),
  };
}

// A hidden tab goes quiet.
if (typeof document !== "undefined") {
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) stopSpeech();
  });
}
