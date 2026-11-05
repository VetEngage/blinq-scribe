import { useTranslation } from "react-i18next";
import type { SoapNote } from "../../api/types";
import { sectionsFor, useApp } from "../../state/app";
import { cx, Tag } from "@blinq-scribe/ui";
import { VitalsTiles } from "./parts";
import { CONFIRM } from "./confirm";

export interface NoteSectionText {
  label: string;
  text: string;
}

/**
 * Signed text as read. A signed note can't hold a "[confirm: …]" mark, but older demo data can: it
 * reads as "weight, not confirmed" in AI purple, never as the raw bracket.
 */
export function ReadText({ text }: { text: string }) {
  const { t } = useTranslation();
  const parts: React.ReactNode[] = [];
  let last = 0;
  for (const m of text.matchAll(new RegExp(CONFIRM.source, "gi"))) {
    const at = m.index ?? 0;
    if (at > last) parts.push(text.slice(last, at));
    const what = (m[1] ?? "").trim();
    parts.push(
      <span key={at} className="text-ai">
        {what ? t("review.notConfirmedWhat", { what }) : t("review.notConfirmed")}
      </span>,
    );
    last = at + m[0].length;
  }
  if (!parts.length) return <>{text}</>;
  if (last < text.length) parts.push(text.slice(last));
  return <>{parts}</>;
}

/**
 * A note as read: each section under its heading. Notes from before sections were stored (or from
 * the practice records) come as one text, shown as written.
 */
export function NoteSections({
  sections,
  raw,
  heading = "h4",
  className,
}: {
  sections?: NoteSectionText[] | null;
  raw?: string | null;
  heading?: "h3" | "h4";
  /** Lays the sections out (two columns in Past visits). */
  className?: string;
}) {
  const H = heading;
  const shown = (sections ?? []).filter((s) => (s.text || "").trim());
  if (!shown.length)
    return raw ? (
      <p className="note-raw">
        <ReadText text={raw} />
      </p>
    ) : null;
  return (
    <div className={cx("flex flex-col gap-3", className)}>
      {shown.map((s) => (
        <section key={s.label} className="note-sec">
          <H className="sec-title">{s.label}</H>
          <p className="sec-body">
            <ReadText text={s.text} />
          </p>
        </section>
      ))}
    </div>
  );
}

/** A signed visit's note, read only, in its note type's sections. */
export function SignedNote({ note, noteType }: { note: SoapNote; noteType: string }) {
  const { t } = useTranslation();
  const noteTypes = useApp((s) => s.noteTypes);
  const { body, owner } = sectionsFor(noteTypes, noteType);
  return (
    <div className="flex flex-col gap-3">
      {Object.keys(note.vitals || {}).length > 0 && (
        <section className="note-sec">
          <h3 className="sec-title">{t("review.vitals")}</h3>
          <VitalsTiles vitals={note.vitals} signed />
        </section>
      )}
      <NoteSections heading="h3" sections={body.map((s) => ({ label: s.label, text: note[s.key] }))} />
      {note.medications.length > 0 && (
        <section className="note-sec">
          <h3 className="sec-title">{t("review.medications")}</h3>
          <div className="tags">
            {note.medications.map((m) => (
              <Tag key={m} icon="medication">
                {m}
              </Tag>
            ))}
          </div>
        </section>
      )}
      <NoteSections heading="h3" sections={[{ label: owner.label, text: note.client_summary }]} />
    </div>
  );
}
