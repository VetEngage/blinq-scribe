// The record's tabs, and what its panels list: the past visits that count as past, the texts about a pet.
import type { Appointment, Household, PastVisit } from "../../api/types";

export const RECORD_TABS = ["overview", "visits", "documents", "invoices", "texts"] as const;
export type RecordTab = (typeof RECORD_TABS)[number];
export const isRecordTab = (v: string | null | undefined): v is RecordTab => RECORD_TABS.includes(v as RecordTab);

export type HouseholdPet = Household["pets"][number];

/** The visit a record is opened in: its pets say "This visit", and its own notes are never past. */
export interface RecordVisit {
  appt: Appointment;
  /** The pets in this visit. */
  petIds: string[];
  /** This visit's encounters. */
  encounterIds: string[];
}

export type ShownVisit = PastVisit & { same: string[] };

const at = (date: string): number => new Date(/^\d{4}-\d{2}-\d{2}$/.test(date) ? `${date}T00:00:00` : date).getTime();

/**
 * The past visits to list, newest first. Inside a visit, never that visit itself (its appointment, or
 * a note signed in it) nor anything after it started. A note saved again with the same text is one
 * row, the first time it was written, with the dates it repeats on in `same`.
 */
export function pastVisits(rows: PastVisit[], visit?: RecordVisit): ShownVisit[] {
  const mine = new Set((visit?.encounterIds ?? []).filter(Boolean).map((id) => `blinq-${id}`));
  const start = visit ? at(visit.appt.start) : Number.NaN;
  const earlier = rows.filter((v) => {
    if (!visit) return true;
    if (mine.has(v.id) || (v.appointment_id && v.appointment_id === visit.appt.id)) return false;
    const when = at(v.date);
    return Number.isNaN(start) || Number.isNaN(when) || when < start;
  });
  const oldestFirst = [...earlier].sort((a, b) => String(a.date).localeCompare(String(b.date)));
  const byText = new Map<string, ShownVisit>();
  const out: ShownVisit[] = [];
  for (const v of oldestFirst) {
    const text = (v.note || "").replace(/\s+/g, " ").trim().toLowerCase();
    const first = text ? byText.get(text) : undefined;
    if (first) {
      first.same.push(v.date);
      continue;
    }
    const row = { ...v, same: [] };
    if (text) byText.set(text, row);
    out.push(row);
  }
  return out.reverse();
}

/** Whether a text is about this pet: it names the pet. The PIMS keeps texts by owner, not by pet. */
export const aboutPet = (text: string, name: string): boolean =>
  !!name && new RegExp(`\\b${name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i").test(text);
