import type { Appointment, Encounter, FollowUp } from "../../api/types";
import { t } from "../../i18n";
import { addDays, andList, monthDay, possessive, ymd } from "../../lib/format";
import { formatDateTime } from "@blinq-scribe/ui";
import { shownAt } from "../../lib/demoTime";

/** Days after a booking link goes out before its one reminder, as the server waits. */
export const REMIND_DAYS = 3;

/** Where a booking link stands, as plain text. On a signed note a queued link is on its way to the owner. */
export function linkStatusText(f: FollowUp, appt: Appointment, signed = false): string {
  const l = f.booking_link;
  if (!l) return "";
  const owner = appt.client.first_name || t("followup.theOwnerLower");
  if (l.status === "booked")
    return t("followup.linkBooked", { when: l.booked_start ? ` ${formatDateTime(l.booked_start)}` : "" });
  if (l.status === "expired") return t("followup.linkExpired");
  if (l.status === "queued") return t(signed ? "followup.linkSending" : "followup.linkQueued", { owner });
  return t("followup.linkSent", {
    how: l.status === "opened" ? t("followup.opened") : t("followup.sent"),
    when: l.sent_at ? ` ${formatDateTime(shownAt(l.sent_at))}` : "",
    owner,
  });
}

/** One link that books several pets' rechecks: "One link for Hazel's and Mochi's rechecks". */
export function sharedLinkText(pets: string[] | undefined): string {
  return pets && pets.length > 1 ? t("followup.oneLinkFor", { whose: andList(pets.map(possessive)) }) : "";
}

/**
 * The other pets in a household whose recheck this queued link waits for, so the owner gets one text
 * with one link: a recheck still to decide, or a note not signed yet with its link still to go.
 */
export function waitsFor(f: FollowUp, e: Encounter, group: Encounter[]): string[] {
  if (f.kind !== "recheck" || f.booking_link?.status !== "queued" || e.status !== "signed") return [];
  return group
    .filter((g) => g.id !== e.id)
    .filter((g) =>
      g.followups.some(
        (x) =>
          x.kind === "recheck" &&
          (x.status === "draft" ||
            (x.status === "approved" && g.status !== "signed" && x.booking_link?.status === "queued")),
      ),
    )
    .map((g) => g.patient_name);
}

/**
 * The booking link's reminder: "Reminder goes out Nov 4 if not booked", then "Reminder sent Nov 4".
 * Empty when the provider turned it off, or once the owner booked.
 */
export function reminderText(f: FollowUp): string {
  const l = f.booking_link;
  if (!l || f.booking_mode !== "link") return "";
  const r = f.reminder;
  if (r && r.status !== "sending") {
    const when = r.at ? monthDay(shownAt(r.at)) : "";
    return r.status === "failed"
      ? t("followup.reminderFailed", { detail: r.detail })
      : t("followup.reminderSent", { date: when });
  }
  if (!f.remind_unbooked || f.booked_slot || l.status === "booked" || l.status === "expired") return "";
  if (!l.sent_at) return t("followup.reminderLater");
  return t("followup.reminderOn", { date: monthDay(addDays(ymd(new Date(shownAt(l.sent_at))), REMIND_DAYS)) });
}
