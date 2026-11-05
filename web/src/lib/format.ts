// Dates and money as the console shows them. Days are local YYYY-MM-DD strings. Times come from
// formatTime and formatDateTime in @blinq-scribe/ui, the one place they're formatted.
import { formatDateTime, formatTime, hourOf, phoneHref, speciesLabel } from "@blinq-scribe/ui";
import { t } from "../i18n";

export const ymd = (d: Date): string =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
export const parseDay = (s: string): Date => {
  const [y = 1970, m = 1, d = 1] = s.split("-").map(Number);
  return new Date(y, m - 1, d);
};
export const addDays = (s: string, n: number): string => {
  const d = parseDay(s);
  d.setDate(d.getDate() + n);
  return ymd(d);
};
const asDate = (s: string | null | undefined): Date | null =>
  !s ? null : /^\d{4}-\d{2}-\d{2}$/.test(s) ? parseDay(s) : new Date(s);
const valid = (d: Date | null): d is Date => !!d && !Number.isNaN(d.getTime());

export const fmtDate = (s: string | null | undefined): string => {
  const d = asDate(s);
  return valid(d) ? d.toLocaleDateString([], { month: "short", day: "numeric", year: "numeric" }) : "";
};
/** "Jun 2027": a due date the practice only needs to the month. */
export const fmtMonthYear = (s: string | null | undefined): string => {
  const d = asDate(s);
  return valid(d) ? d.toLocaleDateString("en-US", { month: "short", year: "numeric" }) : "";
};
/** "2021": when a client joined. Anything that isn't a date stays as the practice wrote it. */
export const fmtYear = (s: string | null | undefined): string => {
  const d = /^\d{4}-\d{2}-\d{2}$/.test(s || "") ? asDate(s) : null;
  return valid(d) ? String(d.getFullYear()) : s || "";
};
export const monthDay = (s: string | null | undefined): string => {
  const d = asDate(s);
  return valid(d) ? d.toLocaleDateString([], { month: "short", day: "numeric" }) : "";
};
export const wdMonthDay = (s: string): string => {
  const d = parseDay(s);
  return `${d.toLocaleDateString([], { weekday: "short" })} ${d.toLocaleDateString([], { month: "short" })} ${d.getDate()}`;
};
export const longDay = (s: string): string =>
  parseDay(s).toLocaleDateString([], { weekday: "long", month: "short", day: "numeric" });
export const money = (n: number | string | null | undefined): string =>
  n == null || n === ""
    ? ""
    : "$" + Number(n).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
/** Model text in a label: whitespace squeezed and cut at a word to `max` characters, with an ellipsis. */
export const clip = (text: string | null | undefined, max = 60): string => {
  const s = String(text || "")
    .replace(/\s+/g, " ")
    .trim();
  if (s.length <= max) return s;
  const cut = s.slice(0, max - 1);
  const space = cut.lastIndexOf(" ");
  return `${(space > max / 2 ? cut.slice(0, space) : cut).replace(/[\s.,;:!?~-]+$/, "")}…`;
};
/**
 * Seconds as minutes and seconds: 66 reads "1:06" (time into a visit). `padMinutes` gives the
 * timer's "01:06". Minutes keep counting past an hour ("75:00").
 */
export const duration = (seconds: number, { padMinutes = false }: { padMinutes?: boolean } = {}): string => {
  const s = Math.max(0, Math.floor(seconds));
  const m = String(Math.floor(s / 60));
  return `${padMinutes ? m.padStart(2, "0") : m}:${String(s % 60).padStart(2, "0")}`;
};
/** A follow up's heading: the server's short title, else its reason cut short. */
export const followupTitle = (f: { title?: string; reason: string }): string => f.title || clip(f.reason);
/** Links from server data: http(s) only. */
export const webUrl = (u: string | null | undefined): string =>
  /^https?:\/\//i.test(String(u || "")) ? String(u) : "";
export const initials = (name: string | null | undefined): string =>
  (name || "")
    .replace(/^Dr\.?\s+/i, "")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => (w[0] ?? "").toUpperCase())
    .join("") || t("topbar.all");
export const sinceText = (d: string | null | undefined): string =>
  /^\d{4}-\d{2}-\d{2}$/.test(d || "") ? fmtDate(d) : d || "";

/** One facts line, the same as the visit banner: "Golden Retriever · male, neutered · 6 years". */
export const petFacts = (p: { breed?: string; species?: string; sex?: string; age?: number | null }): string =>
  [p.breed || p.species, p.sex?.toLowerCase(), p.age != null ? t("count.year", { count: p.age }) : ""]
    .filter(Boolean)
    .join(" · ");

/** A rail row's first facts, after the pet's name: "Cat, 3 years" (the species in plain words, the age in full). */
export const speciesAge = (p: { species?: string; age?: number | null }): string =>
  [speciesLabel(p.species), p.age != null ? t("count.year", { count: p.age }) : ""].filter(Boolean).join(", ");

/** The quick card's facts: "Cat · Domestic Shorthair · Female, spayed · 3 years · 9.8 lb". */
export const cardFacts = (p: {
  species?: string;
  breed?: string;
  sex?: string;
  age?: number | null;
  weight?: { value: number; unit: string } | null;
}): string[] =>
  [
    speciesLabel(p.species),
    p.breed ?? "",
    p.sex ?? "",
    p.age != null ? t("count.year", { count: p.age }) : "",
    p.weight ? `${p.weight.value} ${p.weight.unit}` : "",
  ].filter(Boolean);

/** "Sep 12" this year, "Apr 4, 2025" before it: a last visit never reads as this year's when it wasn't. */
export const pastDay = (s: string | null | undefined, today: string): string =>
  !s ? "" : s.slice(0, 4) === today.slice(0, 4) ? monthDay(s) : fmtDate(s);

export function dayName(s: string, today: string): string {
  if (s === today) return t("day.today");
  if (s === addDays(today, -1)) return t("day.yesterday");
  if (s === addDays(today, 1)) return t("day.tomorrow");
  return "";
}
export const dayTitle = (s: string, today: string): string => {
  const name = dayName(s, today);
  return name ? t("day.named", { name, date: wdMonthDay(s) }) : wdMonthDay(s);
};

/** "today 7:42 AM", "yesterday 4:10 PM", else the day and time: when a text came in, for a line of prose. */
export function messageWhen(at: string | null | undefined, now: Date = new Date()): string {
  const d = at ? new Date(at) : null;
  if (!d || Number.isNaN(d.getTime())) return "";
  const time = formatTime(d);
  const day = ymd(d);
  if (day === ymd(now)) return `${t("day.today").toLowerCase()} ${time}`;
  if (day === addDays(ymd(now), -1)) return `${t("day.yesterday").toLowerCase()} ${time}`;
  return formatDateTime(d);
}

/** An sms: link that opens the device's messages to this number; "" when it can't be texted. */
export const smsHref = (phone: string | null | undefined): string => {
  const tel = phoneHref(phone);
  return tel ? `sms:${tel.slice(4).split(";")[0]}` : "";
};

/** "Waffles'", "Biscuit's". */
export const possessive = (name: string): string => (!name ? "" : /s$/i.test(name) ? `${name}'` : `${name}'s`);

/** "Good morning", "Good afternoon" or "Good evening", by the hour. */
export function greetingFor(now: Date = new Date()): "morning" | "afternoon" | "evening" {
  const h = hourOf(now);
  return h < 12 ? "morning" : h < 17 ? "afternoon" : "evening";
}

/** "Dr. Rivera" from "Dr. Ana Rivera"; any other name stays whole. */
export const drName = (name: string): string =>
  /^Dr\.?\s/i.test(name) ? `Dr. ${name.trim().split(/\s+/).pop() ?? ""}` : name;

/** Names as a sentence says them: "Kiwi", "Kiwi and Mochi", "Hazel, Kiwi, and Mochi". */
export const andList = (names: string[]): string =>
  new Intl.ListFormat("en-US", { style: "long", type: "conjunction" }).format(names);
