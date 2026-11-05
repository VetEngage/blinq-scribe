// What is left after the visits, as rows with one action each: Home's Follow-ups waiting, End of day's
// Calls and texts left and Front desk and the PIMS, and the rail's counts. Notes to sign are not here:
// they are the Notes buckets.
import type { ItemKind, OpenItem, WaitingLink } from "../api/types";
import { t } from "../i18n";
import { andList, dayName, possessive, wdMonthDay, ymd } from "./format";

export type FollowKind = Exclude<ItemKind, "unsigned"> | "link";

export interface FollowRow {
  key: string;
  kind: FollowKind;
  /** Red: a text that didn't send, a note the PIMS didn't take. */
  failed: boolean;
  pet: string;
  /** The owner, when known: one owner's rows group under them. */
  owner?: string;
  /** "Text to Jordan didn't send", "Waffles' recheck link not booked". */
  title: string;
  /** "Waffles · Thu Oct 29", "Sent Wed Oct 28 · 4 days ago". */
  meta: string;
  item?: OpenItem;
  link?: WaitingLink;
}

/** Calls and texts: what waits on an owner. The rest is the front desk's and the PIMS's. */
export const CALLS_AND_TEXTS: ReadonlySet<FollowKind> = new Set<FollowKind>(["failed_text", "link", "followup"]);

const ORDER: FollowKind[] = ["failed_text", "pims_failed", "queued", "link", "followup", "not_sent", "prescription"];

/** "Yesterday", "Thu Oct 29": the day something is from; nothing for today. */
const whenShort = (date: string | undefined, today: string): string =>
  !date || date === today ? "" : dayName(date, today) || wdMonthDay(date);

function itemRow(it: OpenItem, today: string): FollowRow | null {
  if (it.kind === "unsigned") return null;
  const pet = it.patient_name || "";
  const when = whenShort(it.date, today);
  const key = `${it.kind}:${it.encounter_id}:${it.followup_id ?? ""}`;
  const failed = it.kind === "failed_text" || it.kind === "pims_failed" || it.kind === "queued";
  const title =
    it.kind === "followup"
      ? t("follow.decide", { whose: possessive(pet) })
      : it.kind === "prescription"
        ? t("follow.prescription", { whose: possessive(pet) })
        : it.label || it.text;
  const meta =
    it.kind === "prescription"
      ? [it.detail, when].filter(Boolean).join(" · ")
      : it.kind === "followup"
        ? [it.title?.replace(/^Approve follow up:\s*/i, ""), when].filter(Boolean).join(" · ")
        : [pet, when].filter(Boolean).join(" · ");
  return { key, kind: it.kind, failed, pet, owner: it.owner_name || "", title, meta, item: it };
}

function linkRow(w: WaitingLink, today: string): FollowRow {
  const sent = w.sent_at ? ymd(new Date(w.sent_at)) : "";
  return {
    key: `link:${w.followup_id}`,
    kind: "link",
    failed: false,
    pet: w.patient_name,
    owner: w.owner_name || "",
    title:
      (w.pets?.length ?? 0) > 1
        ? t("follow.sharedLinkNotBooked", { whose: andList((w.pets ?? []).map(possessive)) })
        : t("follow.linkNotBooked", { whose: possessive(w.patient_name) }),
    meta: [
      sent ? t("follow.sent", { when: whenShort(sent, today) || t("day.today") }) : "",
      w.days_waiting ? t("follow.daysAgo", { days: t("count.day", { count: w.days_waiting }) }) : "",
    ]
      .filter(Boolean)
      .join(" · "),
    link: w,
  };
}

/**
 * Every follow up still open, one row each, what failed first: today's and earlier days' open items
 * (never the notes to sign) and every booking link the owner hasn't used yet. Each item once.
 */
export function followRows(items: OpenItem[], waiting: WaitingLink[], today: string): FollowRow[] {
  const seen = new Set<string>();
  const rows: FollowRow[] = [];
  for (const it of items) {
    const row = itemRow(it, today);
    if (!row || seen.has(row.key)) continue;
    seen.add(row.key);
    rows.push(row);
  }
  for (const w of waiting) {
    if (w.status === "booked") continue;
    const row = linkRow(w, today);
    if (seen.has(row.key)) continue;
    seen.add(row.key);
    rows.push(row);
  }
  return rows.sort((a, b) => ORDER.indexOf(a.kind) - ORDER.indexOf(b.kind));
}

/**
 * One owner's rows together, where the first of them was, so an owner with several pets' follow ups reads
 * as one place: the rows reordered, and for each the owner to head it with ("" for none). An owner with
 * one row gets no heading.
 */
export function byOwner(rows: FollowRow[]): { row: FollowRow; head: string }[] {
  const count = new Map<string, number>();
  for (const r of rows) if (r.owner) count.set(r.owner, (count.get(r.owner) ?? 0) + 1);
  const out: { row: FollowRow; head: string }[] = [];
  const placed = new Set<string>();
  for (const r of rows) {
    if (placed.has(r.key)) continue;
    if (r.owner && (count.get(r.owner) ?? 0) > 1) {
      const mine = rows.filter((x) => x.owner === r.owner);
      mine.forEach((x, i) => {
        placed.add(x.key);
        out.push({ row: x, head: i === 0 ? (r.owner ?? "") : "" });
      });
    } else {
      placed.add(r.key);
      out.push({ row: r, head: "" });
    }
  }
  return out;
}

/** What the rows not shown are, by kind: "7 recheck links, 5 follow ups to decide". */
export function breakdown(rows: FollowRow[]): string {
  const order: FollowKind[] = ["link", "followup", "failed_text", "not_sent", "pims_failed", "prescription", "queued"];
  return order
    .map((k) => [k, rows.filter((r) => r.kind === k).length] as const)
    .filter(([, n]) => n > 0)
    .map(([k, n]) => t(`follow.kinds.${k}`, { count: n }))
    .join(", ");
}

/** About how long each kind takes the provider, in minutes: a text or a link to resend, a follow up to decide. */
const MINUTES: Partial<Record<FollowKind, number>> = { failed_text: 1, link: 1, not_sent: 1, followup: 2 };

/** About how long a row takes, in minutes; null for the front desk's and the PIMS's. */
export const minutesFor = (row: FollowRow): number | null => MINUTES[row.kind] ?? null;

/**
 * Quick ones for the gap between visits: up to `max` rows the provider can do themselves, in order, that
 * fit in the minutes there are. A gap too short for any is none.
 */
export function fitGap(rows: FollowRow[], minutes: number, max = 3): FollowRow[] {
  const out: FollowRow[] = [];
  let used = 0;
  for (const r of rows) {
    const m = minutesFor(r);
    if (m == null || used + m > minutes) continue;
    out.push(r);
    used += m;
    if (out.length === max) break;
  }
  return out;
}
