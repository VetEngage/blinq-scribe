import { useEffect } from "react";
import { Trans, useTranslation } from "react-i18next";
import type { Appointment, Encounter, RecordPanelData, Weight } from "../../api/types";
import { duration, monthDay, smsHref, ymd } from "../../lib/format";
import { useDayLeft } from "../../state/eod";
import { useApp } from "../../state/app";
import { useFollowActions } from "../useFollowActions";
import { followRows, type FollowRow } from "../../lib/followups";
import {
  Avatar,
  Button,
  buttonClasses,
  Caution,
  FactsLine,
  formatTime,
  Icon,
  Num,
  phoneHref,
  RailPill,
  StepBar,
  type Step,
} from "@blinq-scribe/ui";
import { WeightFact } from "../../components/common";
import { useRecordPanel } from "./useRecordPanel";
import { useVisitTabs } from "./visitTabState";

/** The steps of a visit, in order; the banner's step bar shows where this one is. */
export const STEPS = ["record", "draft", "sign", "share", "follow"] as const;
export type StepKey = (typeof STEPS)[number] | "done";

const DAY = 86_400_000;
const STALE_DAYS = 365;

/**
 * The pet's alert line, facts on record only: each caution labeled ("Caution: Back care"), the weight
 * trend from the PIMS when no weight was taken in this visit ("72 lb (Jul 4), up 1.5 lb from Jan"),
 * "Last weighed 18 months ago" when it's old, and any care overdue. Nothing when there's nothing.
 */
function AlertLine({ r, inVisit }: { r: RecordPanelData; inVisit: boolean }) {
  const { t } = useTranslation();
  const today = ymd(new Date());
  const w = r.weight.latest;
  const parts: React.ReactNode[] = [];
  if (w && !inVisit) {
    const age = (Date.now() - new Date(String(w.date)).getTime()) / DAY;
    if (age > STALE_DAYS) {
      const months = Math.round(age / 30.4);
      parts.push(<span key="w">{t("visitHead.weighedAgo", { ago: t("count.month", { count: months }) })}</span>);
    } else {
      const before = (r.weight.history ?? []).find((h: Weight) => String(h.date) < String(w.date) && h.unit === w.unit);
      const diff = before ? Math.round((Number(w.value) - Number(before.value)) * 10) / 10 : 0;
      const change = !before
        ? ""
        : diff > 0
          ? t("visitHead.weightUp", { amount: diff, unit: w.unit })
          : diff < 0
            ? t("visitHead.weightDown", { amount: -diff, unit: w.unit })
            : t("visitHead.weightSame");
      const from = before ? new Date(String(before.date)).toLocaleDateString([], { month: "short" }) : "";
      parts.push(
        <span key="w">
          <Trans
            i18nKey={before ? "visitHead.weightTrendChange" : "visitHead.weightTrend"}
            values={{ value: w.value, unit: w.unit, date: monthDay(String(w.date)), change, from }}
            components={{ n: <Num /> }}
          />
        </span>,
      );
    }
  }
  for (const d of r.reminders_due) {
    if (d.patient_id === r.patient.id && d.due && d.due.slice(0, 10) < today)
      parts.push(
        <span key={`d-${d.text}`}>{t("visitHead.overdueSince", { what: d.text, date: monthDay(d.due) })}</span>,
      );
  }
  const cautions = r.patient.alerts;
  if (!cautions.length && !parts.length) return null;
  return (
    <p className="vh-alerts" aria-label={t("visitHead.alerts")}>
      <Caution items={cautions} labeled label={t("visitHead.caution")} />
      {parts.map((p, i) => (
        <span key={i} className="vh-alert">
          {p}
        </span>
      ))}
    </p>
  );
}

/**
 * A text to this owner that didn't send: a red row with Retry. It is the same item Home's Follow-ups
 * waiting and End of day list, so resending clears it everywhere at once.
 */
function FailedText({ appt }: { appt: Appointment }) {
  const left = useDayLeft((s) => s.data);
  const today = useApp((s) => s.today);
  useEffect(() => {
    if (useDayLeft.getState().data === null) void useDayLeft.getState().load();
  }, []);
  if (!left) return null;
  const row = followRows(left.left_to_do, [], today).find(
    (x) => x.kind === "failed_text" && x.item?.client_id === appt.client.id,
  );
  return row ? <FailedTextRow appt={appt} row={row} /> : null;
}

function FailedTextRow({ appt, row }: { appt: Appointment; row: FollowRow }) {
  const { t } = useTranslation();
  const { action } = useFollowActions(() => undefined, { failedLabel: "follow.retry" });
  return (
    <div className="vh-failed" role="alert">
      <Icon name="sms_failed" className="tone-error" />
      <span className="min-w-0 flex-1">
        <b className="text-body-strong text-error">
          {t("visitHead.textFailed", { name: appt.client.first_name || t("visit.theOwner") })}
        </b>{" "}
        <span className="text-meta">{row.meta}</span>
      </span>
      {action(row)}
    </div>
  );
}

/** Record > Draft > Sign > Share > Follow up: what's done, where the visit is, what's left. */
function VisitSteps({ at, recorded }: { at: StepKey; recorded: string }) {
  const { t } = useTranslation();
  const here = at === "done" ? STEPS.length : STEPS.indexOf(at);
  const steps: Step[] = STEPS.map((k, i) => ({
    key: k,
    label: t(`visitHead.step.${k}`),
    state: i < here ? "done" : i === here ? "current" : "todo",
    meta: k === "record" && recorded ? recorded : undefined,
  }));
  return <StepBar steps={steps} label={t("visitHead.steps")} className="vh-steps" />;
}

/**
 * The visit at a glance, compact: the pet's name with its status only when it isn't the default, its
 * facts on one gray line and its alerts under them; when, where and how long, with the reason; the
 * owner with Text, Call and the household's record. A failed text to the owner is a red row. Then the
 * step bar. The banner holds no main action: that is in the pinned bar.
 */
export function VisitHeaderCard({
  appt,
  current,
  state,
  pets,
  step,
}: {
  appt: Appointment;
  current: Encounter | null;
  /** Where the visit stands, as gray text: "Checked in", "Started 9:02 AM", "Signed by …". */
  state?: React.ReactNode;
  /** Pets in a group visit. */
  pets: number;
  /** Where the step bar is. */
  step: StepKey;
}) {
  const { t } = useTranslation();
  const tabs = useVisitTabs();
  const p = appt.patient;
  // A sibling note in a group visit is about another of the owner's pets.
  const other = !!current?.patient_id && current.patient_id !== p.id;
  const petId = other ? current?.patient_id || p.id : p.id;
  const r = useRecordPanel(petId) || null;

  const pet = other ? r?.patient : p;
  const name = other ? current?.patient_name || r?.patient.name || p.name : p.name;
  // A weight taken in this visit is in the facts with its change; otherwise the PIMS's trend is an alert.
  const inVisit = !!r?.weight.previous && !!r.weight.latest;
  const c = appt.client;
  const owner = [c.first_name, c.last_name].filter(Boolean).join(" ");
  const first = c.first_name || owner;
  const phone = c.phones[0] ?? "";
  const prefers =
    c.prefers === "text" ? t("visitHead.prefersTexts") : c.prefers === "email" ? t("visitHead.prefersEmail") : "";
  const facts = [
    pet?.breed || pet?.species,
    pet?.sex ? pet.sex.toLowerCase() : "",
    pet?.age != null ? t("count.year", { count: pet.age }) : "",
    inVisit && r?.weight.latest ? <WeightFact latest={r.weight.latest} previous={r.weight.previous} /> : "",
  ];
  const status =
    current?.status === "signed" ? (
      <RailPill tone="signed">{t("status.signed")}</RailPill>
    ) : current?.note ? (
      <RailPill tone="draft">{t("status.draft")}</RailPill>
    ) : current ? (
      <RailPill tone="progress">{t("status.inVisit")}</RailPill>
    ) : null;
  const recorded = current?.audio_seconds ? duration(current.audio_seconds) : "";

  // A household appointment: the owner's household leads, with how many pets; each pet's facts are on
  // its tab and in the Record tab.
  const house = (appt.pets?.length ?? 0) > 1;
  return (
    <section aria-labelledby="visitTitle" className="visit-head">
      <div className="vh-top">
        {house ? (
          <div className="vh-pet">
            <Avatar icon="home" size={48} label={t("visitHead.householdLabel")} />
            <div className="flex min-w-0 flex-col gap-1">
              <h1 id="visitTitle" className="text-display">
                {t("visitHead.householdTitle", { name: owner })}
              </h1>
              <FactsLine
                items={[
                  t("visitHead.petsInVisit", { count: appt.pets?.length ?? 0 }),
                  (appt.pets ?? []).map((x) => x.patient.name).join(", "),
                ]}
                className="vh-facts"
              />
            </div>
          </div>
        ) : (
          <div className="vh-pet">
            <Avatar icon="pets" size={48} label={t("visitHead.pet")} />
            <div className="flex min-w-0 flex-col gap-1">
              <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1">
                <h1 id="visitTitle" className="text-display">
                  {name}
                </h1>
                {status}
              </div>
              <FactsLine items={facts} className="vh-facts" />
              {r && <AlertLine r={r} inVisit={inVisit} />}
            </div>
          </div>
        )}
        <div className="vh-when">
          <span className="text-meta">{t("visitHead.visitWhen")}</span>
          <p className="flex flex-wrap items-baseline gap-x-2">
            <Num className="text-body-strong">{formatTime(appt.start)}</Num>
            <span className="muted">
              {[appt.room, appt.duration_min ? t("visitHead.minutes", { count: appt.duration_min }) : ""]
                .filter(Boolean)
                .join(" · ")}
            </span>
          </p>
          <span className="vh-reason">{appt.reason || t("visitHead.noReason")}</span>
          {(state || (pets > 1 && !house)) && (
            <div className="vh-state-lines">
              {state}
              {pets > 1 && !house && <span className="vh-state">{t("visit.pets", { count: pets })}</span>}
            </div>
          )}
        </div>
        <div className="vh-owner">
          <span className="text-meta">{[t("visitHead.owner"), prefers].filter(Boolean).join(" · ")}</span>
          <span className="min-w-0 truncate text-body-strong">{owner}</span>
          <span className="vh-owner-actions">
            {smsHref(phone) && (
              <a
                className={buttonClasses("ghost", "sm")}
                href={smsHref(phone)}
                aria-label={t("visitHead.text", { name: first })}
              >
                <Icon name="sms" />
                {t("visitHead.textShort")}
              </a>
            )}
            {phoneHref(phone) && (
              <a
                className={buttonClasses("ghost", "sm")}
                href={phoneHref(phone)}
                aria-label={t("visitHead.call", { name: first })}
              >
                <Icon name="call" />
                {t("visitHead.callShort")}
              </a>
            )}
            {/* The household's record, on this pet: the Record tab, so recording and the draft carry on. */}
            {tabs && (
              <Button variant="ghost" size="sm" icon="family_restroom" onClick={() => tabs.showRecord(petId)}>
                {t("visitHead.household", { name: owner })}
              </Button>
            )}
          </span>
        </div>
      </div>
      <FailedText appt={appt} />
      <VisitSteps at={step} recorded={recorded} />
    </section>
  );
}
