// Where a signed visit stands in the practice system (PRD 65): one status per item that goes
// there (the note, each photo, the prescription) and one for the visit as a whole.
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { api } from "../api";
import type { Encounter } from "../api/types";
import { onScreen } from "../state/nav";

export type PimsItemStatus = "sending" | "synced" | "not_sent" | "failed";

export interface PimsRow {
  key: string;
  kind: string;
  /** "Note", "Photo: Left ear", "Prescription". */
  label: string;
  status: PimsItemStatus;
  syncedAt?: string | null;
  pimsId: string;
  detail: string;
}

const known = (s: string): PimsItemStatus => (s === "sending" || s === "synced" || s === "failed" ? s : "not_sent");

/** The visit's save, as one of the four statuses. */
function fromWriteBack(e: Encounter): PimsItemStatus {
  const s = e.write_back?.status;
  return s === "written" ? "synced" : s === "failed" ? "failed" : "not_sent";
}

/** Each item that goes to the practice system with this note, from the server's per-item report. */
export function pimsItems(e: Encounter): PimsRow[] {
  if (e.pims_items?.length)
    return e.pims_items.map((i) => ({
      key: `${i.kind}:${i.id}`,
      kind: i.kind,
      label: i.label,
      status: known(i.status),
      syncedAt: i.synced_at,
      pimsId: i.pims_id,
      detail: i.detail,
    }));
  // An older signed visit without the per-item report: the note's save stands for it.
  const wb = e.write_back;
  if (!wb) return [];
  return [
    {
      key: "note",
      kind: "note",
      label: "",
      status: fromWriteBack(e),
      syncedAt: wb.at,
      pimsId: wb.pims_id ?? "",
      detail: wb.status === "written" ? "" : wb.detail,
    },
  ];
}

/**
 * The worst of the items: what the header pill says and whether Send shows. The prescription
 * isn't sent to any PIMS yet (the server always reports it not sent), so it shows its own row but
 * doesn't hold the visit at "Not sent yet".
 */
export function overallStatus(items: PimsRow[]): PimsItemStatus {
  const counted = items.filter((i) => i.kind !== "prescription");
  const order: PimsItemStatus[] = ["failed", "not_sent", "sending", "synced"];
  return order.find((s) => counted.some((i) => i.status === s)) ?? "synced";
}

/**
 * Sends a signed visit to the PIMS, for the visit page and End of day alike. `sending` is the visit on
 * its way ("" when none). `done` gets the visit as the server has it now; a failure reaches `failed`
 * already worded for the vet. Nothing is reported once the vet has moved to another screen.
 */
export function useSendToPims({
  done,
  failed,
}: {
  done: (updated: Encounter) => void;
  failed: (message: string) => void;
}) {
  const { t } = useTranslation();
  const [sending, setSending] = useState("");
  const send = async (encounterId: string) => {
    const here = onScreen();
    setSending(encounterId);
    try {
      const updated = await api.sendToPims(encounterId);
      if (here()) done(updated);
    } catch (err) {
      if (here()) failed(t("pims.sendFailed", { message: err instanceof Error ? err.message : String(err) }));
    }
    if (here()) setSending("");
  };
  return { sending, send };
}
