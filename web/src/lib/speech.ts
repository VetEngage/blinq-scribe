// The browser's speech recognition, where it has one (Chrome, Edge, Safari). Used for Dictate in
// the note editor and for saying "capture" in the photo view. Elsewhere both quietly don't appear.
export type SpeechRecognitionLike = {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onresult:
    ((ev: { resultIndex: number; results: ArrayLike<{ isFinal: boolean; 0: { transcript: string } }> }) => void) | null;
  onend: (() => void) | null;
  onerror: (() => void) | null;
  start: () => void;
  stop: () => void;
};

export function speechRecognition(): (new () => SpeechRecognitionLike) | undefined {
  if (typeof window === "undefined") return undefined;
  const w = window as unknown as Record<string, unknown>;
  return (w.SpeechRecognition ?? w.webkitSpeechRecognition) as (new () => SpeechRecognitionLike) | undefined;
}

/** True when what was heard contains the word on its own ("capture", "Capture.", "ok capture"). */
export const heardWord = (heard: string, word: string): boolean =>
  new RegExp(`(^|[^a-z])${word}([^a-z]|$)`, "i").test(heard);
