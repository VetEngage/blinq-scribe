import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { clip } from "../../lib/format";
import { api } from "../../api";
import type { Appointment, Encounter, SignPreview } from "../../api/types";
import { onScreen } from "../../state/nav";
import {
  Alert,
  Button,
  Dialog,
  formatTime,
  FormField,
  KeyValueList,
  KeyValueRow,
  ListRow,
  StatusText,
  TextField,
} from "@blinq-scribe/ui";
import { Loading } from "../../components/common";
import { useVisitTabs } from "./visitTabState";

export type SignMode = "send" | "only";

/**
 * Before signing: where the note goes (the pet and owner with their PIMS ids, checked against
 * today's appointment), what goes (note, photos, prescription) and the texts that follow. The
 * server answers all of it in one preview, from the note as saved.
 */
export function SignConfirm({
  mode,
  appt,
  e,
  busy,
  onConfirm,
  onClose,
  signer,
}: {
  mode: SignMode;
  appt: Appointment;
  e: Encounter;
  busy: boolean;
  onConfirm: () => void;
  onClose: () => void;
  /** The open demo, where no one is signed in: who signs, typed here. */
  signer?: { value: string; onChange: (v: string) => void };
}) {
  const { t } = useTranslation();
  const [p, setP] = useState<SignPreview | null | false>(null);
  const [failed, setFailed] = useState("");
  const tabs = useVisitTabs();

  useEffect(() => {
    const here = onScreen();
    api
      .signPreview(e.id)
      .then((r) => here() && setP(r))
      .catch((err: unknown) => {
        if (!here()) return;
        setP(false);
        setFailed(err instanceof Error ? err.message : String(err));
      });
  }, [e.id]);

  const owner = appt.client.first_name || (p ? p.owner.name : "");

  return (
    <Dialog
      open
      onOpenChange={(v) => !v && !busy && onClose()}
      title={mode === "send" ? t("signConfirm.titleSend") : t("signConfirm.titleOnly")}
      closeLabel={t("signConfirm.cancel")}
    >
      {p === null ? (
        <Loading />
      ) : p === false ? (
        <Alert tone="error">{t("signConfirm.unavailable", { message: failed })}</Alert>
      ) : (
        <>
          <section className="flex flex-col gap-2" aria-labelledby="scWhere">
            <h3 id="scWhere" className="sec-title">
              {t("signConfirm.where")}
            </h3>
            <KeyValueList>
              <KeyValueRow
                label={t("signConfirm.pet")}
                value={`${p.patient.name} · ${t("signConfirm.pimsId", { id: p.patient.pims_id })}`}
              />
              <KeyValueRow
                label={t("signConfirm.owner")}
                value={`${p.owner.name} · ${t("signConfirm.pimsId", { id: p.owner.pims_id })}`}
              />
            </KeyValueList>
            {!p.matches ? (
              <Alert tone="error">{p.mismatch}</Alert>
            ) : (
              p.appointment && (
                <p className="text-meta">
                  {t("signConfirm.matches", { time: formatTime(p.appointment.start), vet: appt.provider_name })}
                </p>
              )
            )}
            {/* The record this goes to, on the visit's Record tab; the note stays as it is. */}
            {tabs && (
              <div>
                <Button
                  size="sm"
                  icon="family_restroom"
                  onClick={() => {
                    onClose();
                    tabs.showRecord(e.patient_id || appt.patient.id);
                  }}
                >
                  {t("signConfirm.openRecord")}
                </Button>
              </div>
            )}
          </section>

          <section className="flex flex-col gap-1" aria-labelledby="scWhat">
            <h3 id="scWhat" className="sec-title">
              {mode === "send" ? t("signConfirm.whatSend") : t("signConfirm.whatOnly")}
            </h3>
            {p.note && <ListRow lead="description" title={t("pims.items.note")} />}
            {p.photos > 0 && <ListRow lead="photo_camera" title={t("count.photo", { count: p.photos })} />}
            {mode === "only" && <p className="text-meta">{t("signConfirm.onlyHelp")}</p>}
            {p.prescription.length > 0 && <p className="text-meta">{t("signConfirm.prescription")}</p>}
          </section>

          <section className="flex flex-col gap-1" aria-labelledby="scTexts">
            <h3 id="scTexts" className="sec-title">
              {t("signConfirm.texts")}
            </h3>
            {p.texts.length ? (
              p.texts.map((x) => (
                <ListRow
                  key={x.followup_id}
                  lead="sms"
                  title={t("signConfirm.textTo", { owner, what: clip(x.reason) })}
                  meta={x.message}
                />
              ))
            ) : (
              <p className="text-meta">{t("signConfirm.noTexts")}</p>
            )}
          </section>
        </>
      )}

      {signer && (
        <FormField id="signer" label={t("review.signedBy")} className="divided">
          <TextField value={signer.value} onChange={(ev) => signer.onChange(ev.target.value)} />
        </FormField>
      )}
      <div className="divided flex flex-wrap items-center gap-2">
        <Button
          variant="primary"
          icon={mode === "send" ? "send" : "draw"}
          loading={busy}
          disabled={busy || !p}
          onClick={onConfirm}
        >
          {mode === "send" ? t("signConfirm.confirmSend") : t("signConfirm.confirmOnly")}
        </Button>
        <Button disabled={busy} onClick={onClose}>
          {t("signConfirm.cancel")}
        </Button>
        <StatusText>{busy ? t("signConfirm.signing") : ""}</StatusText>
      </div>
    </Dialog>
  );
}
