import type { SoapNote } from "../api/types";
import { useApp } from "./app";

// Autosave for the visit page (review principle 16): a reload, a crash or signing back in comes back to
// the same visit, tab, pet (a household's pet tab too), scroll, open section and unsaved edits.
// Kept per person in this browser:
// another person signing in here never gets them, and each entry ends after a day.

const PLACE = "blinq_visit_place";
const DRAFT = "blinq_visit_draft";
const RETURN = "blinq_return_to";
const DAY_MS = 24 * 60 * 60 * 1000;

/** Where the provider was on one visit page. */
export interface VisitPlace {
  tab: "visit" | "record";
  pet: string;
  section: string;
  scroll: number;
  /** The note section open in the editor, or "". */
  editing: string;
  /** A household visit: the pet tab on screen (its encounter), so the visit opens on it again. */
  encounter?: string;
  /** A household visit: the pets' notes the provider has opened (their encounters). */
  reviewed?: string[];
}

/** A note's edits not yet saved to the server, and the server's note they were made on. */
export interface DraftBackup {
  note?: SoapNote;
  /** JSON of the server's note when the edits began: they only come back over that same note. */
  base?: string;
  /** The Plan the owner's summary was written from, for "Out of sync with Plan". */
  summaryPlan?: string;
}

type Stamped<T> = T & { at: number; who: string };

const who = (): string => {
  const me = useApp.getState().me;
  return me?.user?.username || me?.via || "";
};

function readAll<T>(key: string): Record<string, Stamped<T>> {
  try {
    const all = JSON.parse(localStorage.getItem(key) || "{}") as Record<string, Stamped<T>>;
    const now = Date.now();
    return Object.fromEntries(Object.entries(all).filter(([, v]) => !!v && now - v.at <= DAY_MS));
  } catch {
    return {};
  }
}

function writeAll<T>(key: string, all: Record<string, Stamped<T>>): void {
  try {
    localStorage.setItem(key, JSON.stringify(all));
  } catch {
    // Storage full or blocked: the page still works, it just won't come back after a reload.
  }
}

function read<T>(key: string, id: string): T | null {
  const hit = readAll<T>(key)[id];
  return hit && hit.who === who() ? hit : null;
}

function write<T extends object>(key: string, id: string, value: T | null): void {
  const rest = Object.fromEntries(Object.entries(readAll<T>(key)).filter(([k]) => k !== id));
  writeAll(key, value ? { ...rest, [id]: { ...value, at: Date.now(), who: who() } } : rest);
}

export const readPlace = (appointmentId: string): VisitPlace | null => read<VisitPlace>(PLACE, appointmentId);

/** Merge into what's kept for this visit page. */
export function keepPlace(appointmentId: string, patch: Partial<VisitPlace>): void {
  const was = readPlace(appointmentId) ?? { tab: "visit", pet: "", section: "overview", scroll: 0, editing: "" };
  write<VisitPlace>(PLACE, appointmentId, { ...was, ...patch });
}

export const readDraft = (encounterId: string): DraftBackup | null => read<DraftBackup>(DRAFT, encounterId);
export const keepDraft = (encounterId: string, backup: DraftBackup | null): void =>
  write<DraftBackup>(DRAFT, encounterId, backup);

/**
 * The session ended on its own (a timeout): remember where the provider was, so signing back in
 * returns there. Sign, send to the PIMS and text all need the session, so they wait for it.
 */
export function keepReturnPath(path: string): void {
  try {
    sessionStorage.setItem(RETURN, JSON.stringify({ path, who: who(), at: Date.now() }));
  } catch {
    /* blocked storage: sign in lands on Home */
  }
}

/** Where to go after signing in: the page the session ended on, only for the same person. */
export function takeReturnPath(user: string): string {
  try {
    const raw = sessionStorage.getItem(RETURN);
    sessionStorage.removeItem(RETURN);
    const got = raw ? (JSON.parse(raw) as { path: string; who: string; at: number }) : null;
    if (!got || Date.now() - got.at > DAY_MS || !got.path.startsWith("/")) return "";
    return !got.who || !user || got.who === user ? got.path : "";
  } catch {
    return "";
  }
}
