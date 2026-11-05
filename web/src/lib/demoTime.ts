// The busy demo day reads at its own clock (1:15 PM), whatever the real time. Everything that happens
// on it while the demo runs (started, signed, texted, saved) happened today in real time, so on that
// day each such time is shown on the demo's clock instead: the demo clock when the day was first
// opened in this session, plus the real time since. Times already on the busy day (its seeded visits,
// its bookings) are shown as they are. Every other day keeps the real clock.
import type { Appointment } from "../api/types";
import { ymd } from "./format";

const ANCHOR = "blinq_demo_anchor";
let day = "";
let shift = 0;

/** Read the visit on screen at the busy demo day's clock (its `demo_clock`), or the real clock (null). */
export function readAtClockOf(appt: Pick<Appointment, "start" | "demo_clock"> | null): void {
  const busy = appt?.demo_clock ? String(appt.start).slice(0, 10) : "";
  if (!busy || !appt?.demo_clock) {
    day = "";
    shift = 0;
    return;
  }
  if (day === busy) return;
  let anchor = Date.now();
  try {
    const kept = Number(sessionStorage.getItem(`${ANCHOR}|${busy}`));
    if (kept) anchor = kept;
    else sessionStorage.setItem(`${ANCHOR}|${busy}`, String(anchor));
  } catch {
    /* blocked storage: anchored at this load */
  }
  day = busy;
  shift = new Date(`${busy}T${appt.demo_clock}:00`).getTime() - anchor;
}

/** A time as the day on screen tells it: on the busy demo day, at its clock; else as it is. */
export function shownAt<T extends string | null | undefined>(x: T): T {
  if (!x || !day) return x;
  const d = new Date(x);
  if (Number.isNaN(d.getTime()) || ymd(d) === day) return x;
  return new Date(d.getTime() + shift).toISOString() as T;
}

/** Now, as the day on screen tells it. */
export const nowShown = (): number => Date.now() + (day ? shift : 0);
