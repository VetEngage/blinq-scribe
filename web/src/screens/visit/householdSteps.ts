// A household visit's notes, one per pet, and the one next step the green action names (decision D1):
// confirm this pet's note, else review the next pet's, else sign every note left. Never a greyed out Sign.

/** Where one pet's note stands, as its tab and the rail say it. */
export function petNoteStatus(e: { status: string; note: unknown }): "signed" | "draft" | "notStarted" {
  return e.status === "signed" ? "signed" : e.note ? "draft" : "notStarted";
}

/** One pet's note in a household visit, as the stepping action needs it. */
export interface PetNote {
  id: string;
  pet: string;
  signed: boolean;
  /** Things left to confirm in it, a pet question included. */
  confirms: number;
  /** Lines of the last plan asked to cover today that the visit didn't, still open. Reminders, never a block. */
  reminders?: number;
  /** The provider saw all of it: the end of the note in view, every section seen, or the primary pressed there. */
  reviewed: boolean;
}

export type PetStep =
  | { kind: "confirm"; pet: string }
  | { kind: "plan"; pet: string; count: number }
  /** Review a pet's note: another pet's opens its tab; `here` is the note on screen, not seen in full yet. */
  | { kind: "review"; pet: string; id: string; here?: boolean }
  | { kind: "sign"; count: number; ids: string[] };

/**
 * The steps left, in order, from the note on screen: its own things to confirm, its lines from the last
 * plan to check, reviewing it to the end, then each other note not signed that isn't reviewed or still has
 * something to confirm or check (in the visit's pet order), then signing every note not signed. The first
 * is what the green action does; the rest are its "Then:".
 */
export function petSteps(notes: PetNote[], currentId: string): PetStep[] {
  const left = notes.filter((n) => !n.signed);
  if (!left.length) return [];
  const steps: PetStep[] = [];
  const here = left.find((n) => n.id === currentId);
  if (here) {
    if (here.confirms > 0) steps.push({ kind: "confirm", pet: here.pet });
    if ((here.reminders ?? 0) > 0) steps.push({ kind: "plan", pet: here.pet, count: here.reminders ?? 0 });
    if (!here.reviewed) steps.push({ kind: "review", pet: here.pet, id: here.id, here: true });
  }
  for (const n of left) {
    if (n.id !== currentId && (!n.reviewed || n.confirms > 0 || (n.reminders ?? 0) > 0))
      steps.push({ kind: "review", pet: n.pet, id: n.id });
  }
  steps.push({ kind: "sign", count: left.length, ids: left.map((n) => n.id) });
  return steps;
}

/** A note's things to confirm: every "[confirm" mark in it, in any section, vital or medicine. */
export const confirmsInNote = (note: unknown): number => (JSON.stringify(note ?? "").match(/\[confirm/gi) ?? []).length;
