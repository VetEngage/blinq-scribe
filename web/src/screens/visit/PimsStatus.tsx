import { useState } from "react";
import { useTranslation } from "react-i18next";
import { api } from "../../api";
import type { Encounter } from "../../api/types";
import { useApp } from "../../state/app";
import { useCan } from "../../state/can";
import { onScreen } from "../../state/nav";
import type { PimsItemStatus, PimsRow } from "../../lib/pims";
import { isPrescription, type PimsState } from "./usePims";
import { Button, Card, formatTime, Icon, ListRow, Pressable, StatusText } from "@blinq-scribe/ui";
import { shownAt } from "../../lib/demoTime";

/**
 * The banner's PIMS line: "Saved to the PIMS", "2 of 3 saved to the PIMS", or "Couldn't save to the
 * PIMS" in red. It opens and closes the item list on the page.
 */
export function PimsLine({ pims, open, onToggle }: { pims: PimsState; open: boolean; onToggle: () => void }) {
  const { t } = useTranslation();
  if (!pims.items.length) return null;
  const total = pims.counted.length;
  const text =
    pims.overall === "sending"
      ? t("pims.lineSending")
      : pims.overall === "failed"
        ? t("pims.lineFailed")
        : pims.overall === "synced"
          ? t("pims.lineSaved")
          : pims.saved > 0
            ? t("pims.lineSome", { saved: pims.saved, total })
            : t("pims.lineNone");
  return (
    <Pressable
      className={pims.overall === "failed" ? "vh-disclose tone-error" : "vh-disclose"}
      aria-expanded={open}
      aria-controls="pimsItems"
      onClick={onToggle}
    >
      {text}
      <Icon name={open ? "expand_less" : "expand_more"} size={18} />
    </Pressable>
  );
}

const LOOK: Record<PimsItemStatus, { icon: string; tone: string }> = {
  sending: { icon: "progress_activity", tone: "" },
  synced: { icon: "check", tone: "text-primary" },
  not_sent: { icon: "cloud_off", tone: "" },
  failed: { icon: "error", tone: "text-error" },
};

/**
 * Each item in the PIMS, one row each: green check and Saved; Not sent in ink; Couldn't save in red.
 * The prescription is the front desk's task: "Front desk to enter" with Mark entered, then who entered
 * it and when.
 */
export function PimsItems({
  e,
  pims,
  onUpdated,
}: {
  e: Encounter;
  pims: PimsState;
  onUpdated?: (e: Encounter) => void;
}) {
  const { t } = useTranslation();
  const mayEnter = useCan("prescription.enter");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  if (!pims.items.length) return null;
  const rx = e.prescription_task;

  const entered = async () => {
    const here = onScreen();
    setBusy(true);
    setError("");
    try {
      const updated = await api.markPrescriptionEntered(e.id);
      void useApp.getState().loadBrief();
      if (here()) onUpdated?.(updated);
    } catch (err) {
      if (here()) setError(t("follow.enterFailed", { message: err instanceof Error ? err.message : String(err) }));
    }
    if (here()) setBusy(false);
  };

  const status = (i: PimsRow) => {
    if (isPrescription(i)) {
      if (rx?.done_at)
        return (
          <span className="text-meta">
            {t("pims.enteredBy", { who: rx.done_by, time: formatTime(shownAt(rx.done_at)) })}
          </span>
        );
      if (!rx) return <span className="text-meta">{t("pims.frontDesk")}</span>;
      return (
        <span className="flex items-center gap-3">
          <span className="text-meta">{t("pims.frontDeskToEnter")}</span>
          {mayEnter && onUpdated && (
            <Button size="sm" disabled={busy} onClick={() => void entered()}>
              {t("pims.markEntered")}
            </Button>
          )}
        </span>
      );
    }
    if (i.status === "sending") return <span className="text-meta">{t("pims.sending")}</span>;
    if (i.status === "synced")
      return (
        <span className="text-meta">
          {i.syncedAt ? t("pims.savedAt", { time: formatTime(shownAt(i.syncedAt)) }) : t("pims.saved")}
        </span>
      );
    if (i.status === "failed") return <span className="text-meta text-error">{t("pims.failed")}</span>;
    return <span className="text-meta text-text">{t("pims.notSentShort")}</span>;
  };

  const sub = (i: PimsRow) => {
    // What the front desk enters: the note's medications, as written.
    if (isPrescription(i)) return (e.note?.medications ?? []).join("; ");
    if (i.status === "synced") return i.pimsId ? `#${i.pimsId}` : "";
    if (i.status === "failed")
      return [
        e.pims_next_try_at ? t("pims.nextTry", { time: formatTime(shownAt(e.pims_next_try_at)) }) : t("pims.retrying"),
        i.detail,
      ]
        .filter(Boolean)
        .join(" · ");
    if (i.status === "not_sent") return i.detail; // the server says why ("Signed only. Not sent to the PIMS yet.")
    return "";
  };

  return (
    <Card as="section" id="pimsItems" aria-labelledby="pimsTitle" aria-busy={pims.sending}>
      <Card.Title id="pimsTitle">{t("pims.title")}</Card.Title>
      <div className="[&>*:first-child]:border-t-0">
        {pims.items.map((i) => {
          const look = isPrescription(i)
            ? rx?.done_at
              ? { icon: "check", tone: "text-primary" }
              : { icon: "medication", tone: "" }
            : LOOK[i.status];
          return (
            <ListRow
              key={i.key}
              lead={look.icon}
              leadClassName={look.tone}
              title={isPrescription(i) && rx ? rx.text : i.label || t("pims.items.note")}
              meta={sub(i)}
              action={status(i)}
            />
          );
        })}
      </div>
      <StatusText>{error}</StatusText>
    </Card>
  );
}
