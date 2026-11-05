import type { TFunction } from "i18next";

// Text the AI flagged for the vet, like "[confirm: ear cleaner name]", is marked so it stands out.
export const CONFIRM = /\[confirm:?\s*([^\]]*)\]/gi;
export const confirmsIn = (text: string | undefined): number => (String(text || "").match(/\[confirm/gi) || []).length;

/** A mark alone on its own line belongs to the line above it, so it shows on that line. */
export const foldMarks = (text: string): string =>
  text.replace(/\n[ \t]*(?:[-•*][ \t]*)?(\[confirm[^\]]*\])[ \t.]*(?=\n|$)/gi, " $1");

/**
 * A line Blinq couldn't place on one pet in a visit with several: its mark asks which pet
 * ("[confirm pet: Hazel or Mochi]"). The pets it could be about, or null for any other mark.
 */
export function petChoices(what: string): string[] | null {
  const m = /^pet:?\s*(.+)$/i.exec(what.trim());
  if (!m?.[1]) return null;
  const pets = m[1]
    .split(/\s*(?:,|\bor\b|\/)\s*/i)
    .map((x) => x.trim())
    .filter(Boolean);
  return pets.length ? pets : null;
}

/** A mark in words: "Confirm: ear drop product", or for a line Blinq couldn't place, "Which pet? Hazel / Mochi". */
export function markWords(what: string, t: TFunction): string {
  const pets = petChoices(what);
  return pets ? t("review.whichPet", { pets: pets.join(" / ") }) : t("review.confirmMark", { text: what });
}

/**
 * Take the line with the nth mark out of a section, for moving it to another pet's note: the section
 * without that line, and the line itself without its mark (a bullet keeps its dash).
 */
export function takeMarkedLine(text: string, n: number): { rest: string; line: string } | null {
  const lines = text.split("\n");
  let seen = -1;
  for (let i = 0; i < lines.length; i++) {
    const count = (lines[i]?.match(new RegExp(CONFIRM.source, "gi")) ?? []).length;
    if (seen + count < n) {
      seen += count;
      continue;
    }
    const line = (lines[i] ?? "")
      .replace(new RegExp(CONFIRM.source, "gi"), "")
      .replace(/[ \t]+([.!?,;])/g, "$1")
      .replace(/[ \t]+$/, "");
    const rest = [...lines.slice(0, i), ...lines.slice(i + 1)].join("\n");
    return { rest, line };
  }
  return null;
}

/** A line added at the end of a section: on its own line, as a bullet when the section is bullets. */
export function appendLine(text: string, line: string): string {
  const body = line.replace(/^\s*[-•*]\s+/, "").trim();
  if (!body) return text;
  const bullets = /^\s*[-•*]\s+/m.test(text);
  const add = bullets ? `- ${body}` : body;
  return text.trim() ? `${text.replace(/\s+$/, "")}\n${add}` : add;
}

/** A value to check ("74 lb", "102.5") rather than something missing ("drug and dosing"). */
export const isValue = (what: string): boolean => /\d/.test(what);

/**
 * Confirm one mark, the nth in the text: a value keeps its words ("[confirm: 74 lb]" is "74 lb"), a note
 * about something missing goes, and a line left empty by it goes too.
 */
export function confirmMark(text: string, n: number): string {
  let i = -1;
  let where = -1;
  const out = text.replace(new RegExp(CONFIRM.source, "gi"), (whole, what: string, at: number) => {
    i++;
    if (i !== n) return whole;
    where = at;
    return isValue(what) ? what.trim() : "\uE000";
  });
  if (where < 0) return text;
  return out
    .split("\n")
    .flatMap((line) => {
      if (!line.includes("\uE000")) return [line];
      const left = line.replace(/[ \t]*\uE000/g, "").replace(/[ \t]+$/, "");
      return /^\s*(?:[-•*]\s*)?$/.test(left) ? [] : [left];
    })
    .join("\n");
}

// ---------- the editor: marks as chips, never as brackets ----------

/** One mark in the editor's text: where its words are, and what it asks for. */
export interface MarkRange {
  start: number;
  end: number;
  what: string;
}

/** The note's text as the editor shows it: each "[confirm: x]" as its words ("Confirm: x"), and where. */
export function toDisplay(value: string, label: (what: string) => string): { text: string; marks: MarkRange[] } {
  const marks: MarkRange[] = [];
  let text = "";
  let last = 0;
  for (const m of value.matchAll(new RegExp(CONFIRM.source, "gi"))) {
    const at = m.index ?? 0;
    text += value.slice(last, at);
    const what = (m[1] ?? "").trim();
    const words = label(what);
    marks.push({ start: text.length, end: text.length + words.length, what });
    text += words;
    last = at + m[0].length;
  }
  return { text: text + value.slice(last), marks };
}

/** The editor's text back as the note stores it: each mark's words as "[confirm: x]" again. */
export function toValue(text: string, marks: MarkRange[]): string {
  let out = "";
  let last = 0;
  for (const m of [...marks].sort((a, b) => a.start - b.start)) {
    out += text.slice(last, m.start) + `[confirm: ${m.what}]`;
    last = m.end;
  }
  return out + text.slice(last);
}

/**
 * The editor's text after the provider typed: marks before the change stay, marks after it move, and a
 * mark the change touched is gone, all of its words with it (typing over a mark replaces it whole).
 */
export function applyEdit(
  oldText: string,
  newText: string,
  marks: MarkRange[],
  /** The selection before the change, when known: typing replaced exactly that. */
  selection?: [number, number],
): { text: string; marks: MarkRange[]; caret: number } {
  let p: number;
  let oldEnd: number;
  const [a, b] = selection ?? [-1, -1];
  const tail = oldText.length - b;
  if (
    a >= 0 &&
    b >= a &&
    newText.length >= a + tail &&
    newText.startsWith(oldText.slice(0, a)) &&
    newText.endsWith(oldText.slice(b))
  ) {
    p = a;
    oldEnd = b;
  } else {
    // No selection to go by (Backspace, Delete, a cut): the one place the texts differ.
    const most = Math.min(oldText.length, newText.length);
    p = 0;
    while (p < most && oldText[p] === newText[p]) p++;
    let s = 0;
    while (s < most - p && oldText[oldText.length - 1 - s] === newText[newText.length - 1 - s]) s++;
    oldEnd = oldText.length - s;
  }
  const newEnd = newText.length - (oldText.length - oldEnd);
  const delta = newText.length - oldText.length;
  const kept: MarkRange[] = [];
  // Leftover words of a touched mark, in the new text: [from, to).
  const cut: [number, number][] = [];
  for (const m of marks) {
    if (m.end <= p) kept.push(m);
    else if (m.start >= oldEnd) kept.push({ ...m, start: m.start + delta, end: m.end + delta });
    else {
      if (m.start < p) cut.push([m.start, p]);
      if (m.end > oldEnd) cut.push([newEnd, newEnd + (m.end - oldEnd)]);
    }
  }
  let text = newText;
  let caret = newEnd;
  for (const [from, to] of cut.sort((a, b) => b[0] - a[0])) {
    text = text.slice(0, from) + text.slice(to);
    const len = to - from;
    if (from < caret) caret -= Math.min(len, caret - from);
    for (const k of kept) {
      if (k.start >= to) {
        k.start -= len;
        k.end -= len;
      }
    }
  }
  return { text, marks: kept, caret };
}

/** A selection that starts or ends inside a mark grows to the whole mark, so typing replaces all of it. */
export function wholeMarks(start: number, end: number, marks: MarkRange[]): [number, number] {
  let a = start;
  let b = end;
  for (const m of marks) {
    if (a > m.start && a < m.end) a = m.start;
    if (b > m.start && b < m.end) b = m.end;
  }
  return [a, b];
}
