// Letters from the clinic: where they open and how a row describes them.
import { formatPhonesIn } from "@blinq-scribe/ui";
import type { Letter, LetterKind } from "../../api/types";
import { t as tr } from "../../i18n";
import { monthDay } from "../../lib/format";

/** Where a new letter opens; `encounter` starts it from a visit, so that visit's note is attached. */
export function newLetterPath(
  patientId: string,
  kind: LetterKind,
  extra: { encounter?: string; reason?: string } = {},
) {
  const q = new URLSearchParams({ kind });
  if (extra.encounter) q.set("encounter", extra.encounter);
  if (extra.reason) q.set("reason", extra.reason);
  return `/patient/${encodeURIComponent(patientId)}/letters/new?${q}`;
}

export const letterPath = (l: Pick<Letter, "id" | "patient_id">) =>
  `/patient/${encodeURIComponent(l.patient_id)}/letters/${encodeURIComponent(l.id)}`;

export const attachmentCount = (l: Letter) =>
  l.attachments.note_encounter_ids.length +
  l.attachments.photos.length +
  l.attachments.document_ids.length +
  l.attachments.invoice_ids.length;

export function letterTitle(l: Letter, owner = ""): string {
  const to = l.recipient.clinic || l.recipient.name;
  if (l.kind === "owner")
    return tr("letters.titleOwner", { name: l.recipient.name || owner || tr("letters.theOwner") });
  if (l.kind === "records") return tr("letters.titleRecords", { to: to || tr("letters.anotherClinic") });
  return to ? tr("letters.titleReferral", { to }) : tr("letters.kinds.referral");
}

export function letterLine(l: Letter): string {
  if (l.status === "draft") return [l.reason.split("\n")[0], tr("letters.notSent")].filter(Boolean).join(" · ");
  // The server says where it went in words; older letters are described from their sends.
  const sends = l.sent_to.length
    ? l.sent_to.map(formatPhonesIn)
    : l.sent
        .filter((s) => s.status === "sent" || s.status === "preview" || s.status === "ready")
        .map((s) => {
          const v = { date: monthDay(s.at), to: formatPhonesIn(s.to_masked) || s.to_masked };
          if (s.channel === "owner_text" || s.channel === "owner_email") return tr("letters.sentBy.owner_text", v);
          if (s.channel === "print") return tr("letters.sentBy.print", v);
          return tr("letters.sentBy.email", v);
        });
  return [
    l.signer_title || l.signed_by ? tr("letters.signedBy", { name: l.signer_title || l.signed_by }) : "",
    ...sends,
    attachmentCount(l) ? tr("count.attachment", { count: attachmentCount(l) }) : "",
  ]
    .filter(Boolean)
    .join(" · ");
}
