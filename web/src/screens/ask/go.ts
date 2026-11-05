// Ask Blinq's helpers: where its links go, its keyboard shortcuts (shown only in tooltips), what's
// being read aloud and which questions to offer next.
import type { AssistLink } from "../../api/types";
import { useApp } from "../../state/app";
import type { AskMessage } from "../../state/chat";
import { useOpen } from "../../state/open";
import { useVoice } from "../../state/voice";

const mac = typeof navigator !== "undefined" && /Mac|iPhone|iPad/.test(navigator.userAgent);
/** Keyboard shortcuts, shown only in tooltips. */
export const KEYS = { open: mac ? "⌘J" : "Ctrl+J", talk: mac ? "⌥ Space" : "Alt+Space", esc: "Esc" };

/** Go where a link chip or a source points: a visit, a pet's record or Documents, a household. */
export function useGo() {
  const open = useOpen();
  return (l: AssistLink) => {
    if (l.to === "record") return void open.patient({ id: l.patient_id, client_id: l.client_id });
    if (l.to === "household") return open.target({ to: "household", client_id: l.client_id });
    if (l.to === "documents")
      return open.target({
        to: "documents",
        patient_id: l.patient_id,
        client_id: l.client_id,
        document_id: l.document_id,
      });
    open.target({
      to: "visit",
      appointment_id: l.appointment_id,
      encounter_id: l.encounter_id || undefined,
      date: l.date || useApp.getState().today,
    });
  };
}

/** Whether `key` ("brief", "msg:3") is what Blinq is reading aloud. */
export const useReading = (key: string): boolean => useVoice((s) => s.phase === "speaking" && s.reading === key);

/**
 * The questions to offer: the last answer's follow ups, else the brief's suggestions. Never one
 * already asked.
 */
export function nextQuestions(history: AskMessage[], suggestions: string[]): string[] {
  const asked = new Set(history.filter((m) => m.role === "user").map((m) => m.content.trim().toLowerCase()));
  const last = history[history.length - 1];
  const pool = last?.role === "assistant" && last.followups?.length ? last.followups : suggestions;
  return pool.filter((q) => !asked.has(q.trim().toLowerCase()));
}
