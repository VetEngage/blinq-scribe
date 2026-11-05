// A day's visits as Home and the rail read them: which are seen, which need the provider, what's next.
import type { Appointment, Brief, OpenItem, VisitPet } from "../api/types";

/** A visit seen: drafted or signed. */
export const isSeen = (a: Appointment): boolean => a.visit_status === "draft_ready" || a.visit_status === "signed";

/** A household appointment: several of the owner's pets booked as one visit. */
export const isHousehold = (a: Appointment): boolean => (a.pets?.length ?? 0) > 1;

/** The pets a household visit is for, the appointment's pet first; one pet otherwise. */
export const petsOf = (a: Appointment): VisitPet[] =>
  isHousehold(a)
    ? (a.pets ?? [])
    : [{ patient: a.patient, reason: a.reason, visit_status: a.visit_status, encounter_id: a.encounter_id }];

/** Pets on a day: a household visit counts each of its pets. */
export const petCount = (appts: Appointment[]): number => appts.reduce((n, a) => n + petsOf(a).length, 0);

/**
 * The day the provider's day is read at: today, or the demo's busy day while it is the one on screen, so
 * End of day, the brief and the rail's counts are that day's.
 */
export const clinicDayOf = (today: string, viewDate: string, busyDay: string | undefined): string =>
  busyDay && viewDate === busyDay ? viewDate : today;

/**
 * Whether a visit needs the provider now: a note to sign, an owner text on it that didn't send (`left`,
 * the day's open items), or something that came in about the pet since yesterday (results, an owner's
 * text) before it is seen, or an open item on the visit itself.
 */
export function needsMe(a: Appointment, brief: Brief | null, left: OpenItem[] = []): boolean {
  if (a.visit_status === "draft_ready") return true;
  if (left.some((i) => i.appointment_id === a.id && i.kind === "failed_text")) return true;
  if (a.visit_status === "signed") return false;
  if ((brief?.new_since_yesterday ?? []).some((u) => u.patient_id === a.patient.id && u.kind !== "booked")) return true;
  return (brief?.from_yesterday ?? []).some((i) => i.appointment_id === a.id);
}

/** Where a pinned clock for today is kept: "HH:MM" (local), for demo recordings and the end to end tests. */
export const PINNED_CLOCK = "blinq_clock";

let demoClock = "";

/** The demo clinic's default time of day for today ("08:50"), or "" off the demo. */
export function setDemoClock(hhmm: string): void {
  demoClock = /^\d{2}:\d{2}$/.test(hhmm) ? hhmm : "";
}

/** What `blinq_clock` holds: a time ("09:45"), "live", or "" when nothing is pinned. */
function storedPin(): string {
  try {
    const v = localStorage.getItem(PINNED_CLOCK) ?? "";
    return v === "live" || /^\d{2}:\d{2}$/.test(v) ? v : "";
  } catch {
    return ""; // blocked storage: as if nothing is pinned
  }
}

/**
 * Today's clock pinned to a time of day ("09:45"), or "" for the real clock. A pin in `blinq_clock` wins;
 * "live" there means the real clock even in the demo clinic; otherwise the demo clinic's default.
 */
export function pinnedTime(): string {
  const v = storedPin();
  if (v === "live") return "";
  return v || demoClock;
}

/**
 * Whether the day on screen reads at a demo clock that stands still: the busy demo day's own clock, or the
 * demo clinic's default morning on today with nothing pinned. The rail draws no Now line then, since it
 * would never move. A clock pinned on purpose, or the real one, keeps the line.
 */
export function demoClockOn(appts: Appointment[], viewDate: string, today: string): boolean {
  if (appts.some((a) => a.demo_clock)) return true;
  return viewDate === today && !!demoClock && !storedPin();
}

/**
 * The clock a day is read at: now on today (or the pinned time of day, when one is set), the demo clinic's
 * own clock on its busy day (it reads as it stands mid-afternoon at any hour), else null: a day gone by or
 * to come has no "now".
 */
export function dayClock(appts: Appointment[], viewDate: string, today: string, now = new Date()): Date | null {
  const demo = appts.find((a) => a.demo_clock)?.demo_clock;
  if (demo) return new Date(`${viewDate}T${demo}:00`);
  if (viewDate !== today) return null;
  const pin = pinnedTime();
  return pin ? new Date(`${today}T${pin}:00`) : now;
}

const at = (s: string | null | undefined): number => (s ? new Date(s).getTime() : NaN);
const ends = (a: Appointment): number => at(a.start) + (a.duration_min || 0) * 60_000;

/** What's up next: the visit in the room, else the next one still to come, else the first not seen. */
export function pickNext(
  appts: Appointment[],
  skipped: string[] = [],
  now: Date = new Date(),
): Appointment | undefined {
  const pending = appts
    .filter((a) => !isSeen(a) && !skipped.includes(a.id))
    .sort((a, b) => String(a.start).localeCompare(String(b.start)));
  return (
    pending.find((a) => a.visit_status === "recording") ??
    pending.find((a) => at(a.start) >= now.getTime()) ??
    pending[0]
  );
}

/**
 * How late the day runs, in minutes rounded to 5: how far after its time the latest visit that started
 * really started (from the record, never a guess). Null when nothing has started, or when that start is
 * too far off its time to say anything about the day's pace.
 */
export function paceMinutes(appts: Appointment[], now: Date): number | null {
  // Visits due by now that started by now: one started early, or the demo's busy day opened at another
  // hour, says nothing about the pace so far.
  const started = appts
    .filter((a) => a.started_at && at(a.start) <= now.getTime() && at(a.started_at) <= now.getTime())
    .sort((a, b) => String(a.start).localeCompare(String(b.start)));
  const last = started[started.length - 1];
  if (!last) return null;
  const late = (at(last.started_at) - at(last.start)) / 60_000;
  if (!Number.isFinite(late) || late < -30 || late > 90) return null;
  return Math.max(0, Math.round(late / 5) * 5);
}

/**
 * Between visits: nobody in the room, the clinic open (between the day's first visit and the end of its
 * last) and a visit still to come. That next visit, else null.
 */
export function betweenVisits(appts: Appointment[], now: Date | null): Appointment | null {
  if (!now || !appts.length || appts.some((a) => a.visit_status === "recording")) return null;
  const t = now.getTime();
  const open = Math.min(...appts.map((a) => at(a.start)));
  const close = Math.max(...appts.map(ends));
  if (t < open || t > close) return null;
  const next = pickNext(appts, [], now);
  return next && at(next.start) > t ? next : null;
}

/** Minutes from now to a visit's time, never below zero. */
export const minutesUntil = (a: Appointment, now: Date): number =>
  Math.max(0, Math.floor((at(a.start) - now.getTime()) / 60_000));

export type HeadsUpKind = "household" | "caution" | "last";

/**
 * Up to three things to know about the rest of a heavy day, after the visit up next: the next household
 * visit (several pets), the next visit with a clinical caution, and the last visit of the day. Each visit
 * once, in the order of the day.
 */
export function headsUp(appts: Appointment[], now: Date, skip: string[] = []): { a: Appointment; kind: HeadsUpKind }[] {
  const rest = appts
    .filter((a) => !isSeen(a) && a.visit_status !== "recording" && at(a.start) > now.getTime() && !skip.includes(a.id))
    .sort((a, b) => String(a.start).localeCompare(String(b.start)));
  const out: { a: Appointment; kind: HeadsUpKind }[] = [];
  const add = (a: Appointment | undefined, kind: HeadsUpKind) => {
    if (a && !out.some((x) => x.a.id === a.id)) out.push({ a, kind });
  };
  add(
    rest.find((a) => isHousehold(a)),
    "household",
  );
  add(
    rest.find((a) => petsOf(a).some((p) => p.patient.alerts.length)),
    "caution",
  );
  add(rest[rest.length - 1], "last");
  return out.slice(0, 3).sort((x, y) => String(x.a.start).localeCompare(String(y.a.start)));
}
