import { useTranslation } from "react-i18next";
import type { Encounter } from "../../api/types";
import { overallStatus, pimsItems, useSendToPims, type PimsItemStatus, type PimsRow } from "../../lib/pims";
import { useToast } from "@blinq-scribe/ui";

/** The prescription is never sent by Blinq (PRD 65): the front desk enters it in the PIMS. */
export const isPrescription = (i: PimsRow): boolean => i.kind === "prescription";

export interface PimsState {
  /** Every item, as shown in the list; while it sends, the ones on their way say so. */
  items: PimsRow[];
  /** The items Blinq sends (everything but the prescription). */
  counted: PimsRow[];
  saved: number;
  overall: PimsItemStatus;
  /** Something Blinq sends isn't saved: the list opens itself and the bar offers Send. */
  needsVet: boolean;
  /** Only the signing vet sends it. */
  canSend: boolean;
  sending: boolean;
  send: () => Promise<void>;
}

/**
 * Where each item of the signed note stands in the PIMS: the note, its photos, the prescription.
 * Signing sends it in one step; when it wasn't sent (Sign only, or it waits for staff) or couldn't be
 * saved, the signing vet sends it from the pinned bar.
 */
export function usePims(e: Encounter, setCurrent: (e: Encounter) => void): PimsState {
  const { t } = useTranslation();
  const toast = useToast();
  const pims = useSendToPims({
    done: (updated) => {
      setCurrent(updated);
      toast.show(overallStatus(pimsItems(updated)) === "synced" ? t("pims.sent") : t("pims.stillWaiting"));
    },
    failed: toast.show,
  });
  const sending = pims.sending === e.id;
  const items = pimsItems(e).map((i) => (sending && !isPrescription(i) ? { ...i, status: "sending" as const } : i));
  const counted = items.filter((i) => !isPrescription(i));
  const overall = overallStatus(items);
  const needsVet = overall === "not_sent" || overall === "failed";
  return {
    items,
    counted,
    saved: counted.filter((i) => i.status === "synced").length,
    overall,
    needsVet,
    canSend: needsVet && e.can?.sign !== false,
    sending,
    send: () => pims.send(e.id),
  };
}
