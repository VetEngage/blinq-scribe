// The one place times become text: 12-hour with AM/PM ("9:00 AM", "1:30 PM") on every screen.
// Built by hand rather than with Intl, whose output follows the browser's locale (24-hour in many)
// and puts a narrow no-break space before AM in newer versions. The space before AM is a plain no-break
// space, so a time never breaks across lines ("10:00" above "AM") wherever it lands in a sentence.

type TimeInput = string | Date | null | undefined;

/** "13:30" or "9:00" (the server's clock values) stay as written; anything else is a moment, shown in local time. */
function parts(value: TimeInput): { h: number; m: number } | null {
  if (!value) return null;
  if (typeof value === "string") {
    const hm = /^(\d{1,2}):(\d{2})(?::\d{2})?$/.exec(value.trim());
    if (hm) return { h: Number(hm[1]), m: Number(hm[2]) };
  }
  const d = value instanceof Date ? value : new Date(value);
  return Number.isNaN(d.getTime()) ? null : { h: d.getHours(), m: d.getMinutes() };
}

/** No-break space: "10:00" and "AM" stay on one line. */
const NBSP = "\u00a0";

/** The hour of a clock value or a moment, 0 to 23 (afternoon, a greeting); NaN when unreadable. */
export function hourOf(value: TimeInput): number {
  return parts(value)?.h ?? Number.NaN;
}

/** "1:30 PM", with a no-break space. Empty for a missing or unreadable value. */
export function formatTime(value: TimeInput): string {
  const p = parts(value);
  if (!p) return "";
  return `${p.h % 12 || 12}:${String(p.m).padStart(2, "0")}${NBSP}${p.h < 12 ? "AM" : "PM"}`;
}

/** "Sat, Oct 31, 1:30 PM": a moment with its day. Empty for a missing or unreadable value. */
export function formatDateTime(value: TimeInput): string {
  if (!value) return "";
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  return `${d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })}, ${formatTime(d)}`;
}
