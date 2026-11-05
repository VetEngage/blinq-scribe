import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Button, Tag } from "@blinq-scribe/ui";
import { api } from "../api";
import type { FollowRow } from "../lib/followups";
import { useSendToPims } from "../lib/pims";
import { useApp } from "../state/app";
import { useCan } from "../state/can";
import { useDayLeft } from "../state/eod";
import { useOpen } from "../state/open";

/** After an action: everything that counts what is left reads again. */
function reload() {
  const app = useApp.getState();
  void app.loadBrief();
  void app.loadNotes();
  void app.loadWaiting();
  void useDayLeft.getState().load();
}

/**
 * The one action a follow up row has, and only one that really works here: Resend a text that didn't
 * send, Resend link, Review a follow up to decide, Mark entered for a prescription, Send to the PIMS.
 */
export function useFollowActions(
  onError: (message: string) => void,
  { failedLabel = "follow.resend" }: { failedLabel?: "follow.resend" | "follow.retry" } = {},
) {
  const { t } = useTranslation();
  const go = useOpen();
  const today = useApp((s) => s.today);
  const mayEnter = useCan("prescription.enter");
  const [busy, setBusy] = useState("");
  const [sent, setSent] = useState<Record<string, true>>({});
  const pims = useSendToPims({ done: reload, failed: onError });
  const run = async (
    key: string,
    work: () => Promise<unknown>,
    failed: "follow.resendFailed" | "follow.enterFailed",
  ) => {
    setBusy(key);
    try {
      await work();
      setSent((x) => ({ ...x, [key]: true }));
      reload();
    } catch (err) {
      onError(t(failed, { message: err instanceof Error ? err.message : String(err) }));
    }
    setBusy("");
  };
  const open = (r: FollowRow) => {
    const it = r.item;
    if (it) void go.item({ ...it, date: it.date || today }, r.kind === "followup" ? (it.followup_id ?? "") : "");
  };

  const action = (r: FollowRow) => {
    const it = r.item;
    if (sent[r.key])
      return (
        <Tag tone="success" icon="check">
          {r.kind === "prescription" ? t("follow.entered") : t("follow.sentAgain")}
        </Tag>
      );
    if (r.kind === "failed_text" && it?.followup_id)
      return (
        <Button
          size="sm"
          icon="refresh"
          loading={busy === r.key}
          onClick={() =>
            void run(
              r.key,
              () =>
                api.followUp(it.encounter_id, it.followup_id ?? "", {
                  action: "retry_text",
                  message_draft: null,
                  slot_start: null,
                }),
              "follow.resendFailed",
            )
          }
        >
          {t(failedLabel)}
        </Button>
      );
    if (r.kind === "link" && r.link) {
      const fid = r.link.followup_id;
      return (
        <Button
          size="sm"
          icon="send"
          loading={busy === r.key}
          onClick={() => void run(r.key, () => api.resend(fid), "follow.resendFailed")}
        >
          {t("follow.resendLink")}
        </Button>
      );
    }
    if (r.kind === "prescription")
      return mayEnter && it ? (
        <Button
          size="sm"
          icon="check"
          loading={busy === r.key}
          aria-label={t("follow.markEnteredLabel", { what: r.title })}
          onClick={() => void run(r.key, () => api.markPrescriptionEntered(it.encounter_id), "follow.enterFailed")}
        >
          {t("follow.markEntered")}
        </Button>
      ) : null;
    if ((r.kind === "not_sent" || r.kind === "pims_failed") && it?.encounter_id)
      return (
        <Button
          size="sm"
          icon="cloud_upload"
          loading={pims.sending === it.encounter_id}
          onClick={() => void pims.send(it.encounter_id)}
        >
          {r.kind === "pims_failed" ? t("pims.tryAgain") : t("pims.send")}
        </Button>
      );
    if (it?.appointment_id || it?.encounter_id)
      return (
        <Button size="sm" onClick={() => open(r)}>
          {t("follow.review")}
        </Button>
      );
    return null;
  };
  return { action };
}
