import { useState } from "react";
import { Trans, useTranslation } from "react-i18next";
import { api } from "../../api";
import type { Profile, RememberItem } from "../../api/types";
import { useApp } from "../../state/app";
import { useOpen } from "../../state/open";
import { fmtDate, fmtMonthYear } from "../../lib/format";
import {
  Button,
  buttonClasses,
  Card,
  Caution,
  FactsLine,
  formatTime,
  Icon,
  LabelValue,
  LabelValueGrid,
  ListRow,
  Num,
  StatusText,
} from "@blinq-scribe/ui";
import { Loading, Unavailable, WeightFact } from "../../components/common";
import { useCached } from "./useCached";
import type { HouseholdPet } from "./record";

/** What a reminder is, by its words: a vaccine, a test, else a date. */
const dueIcon = (text: string): string =>
  /vaccin|rabies|dhpp|da2pp|fvrcp|felv|bordetella|lepto|booster|lyme/i.test(text)
    ? "vaccines"
    : /test|panel|blood|urine|heartworm|fecal|lab|x-?ray|dental/i.test(text)
      ? "labs"
      : "event";

/**
 * Overview: the facts line, cautions (only when there is one), what's due, weight with a small trend,
 * the PIMS details, and what to remember (staff only; staff can remove an item here).
 */
export function Overview({
  pet,
  clientId,
  remember,
  onForgot,
  visitApptId = "",
  onAddToVisit,
  bookUrl = "",
}: {
  pet: HouseholdPet;
  clientId: string;
  remember: RememberItem[];
  onForgot: (id: string) => void;
  /** The visit this record is open in: its own appointment isn't something due. */
  visitApptId?: string;
  /** Opened in a visit this pet isn't in: overdue care can bring it into today's visit. */
  onAddToVisit?: () => void;
  /** The clinic's online booking for this owner, for overdue care outside a visit. */
  bookUrl?: string;
}) {
  const { t } = useTranslation();
  const go = useOpen();
  const today = useApp((s) => s.today);
  const [profile] = useCached(pet.id, api.patientProfile);
  const [busy, setBusy] = useState("");
  const [status, setStatus] = useState("");

  if (profile === null) return <Loading />;
  if (!profile) return <Unavailable what={t("record.overviewWhat")} />;

  const p = profile.patient;
  const w = profile.weight.latest;
  // Overdue first, then the visit today and what comes next.
  const isOverdue = (r: { due: string }) => !!r.due && r.due < today;
  const due = profile.reminders_due.filter((r) => r.patient_id === pet.id);
  const overdue = due.filter(isOverdue);
  const upcoming = due.filter((r) => !isOverdue(r));
  // Overdue care has one action: into today's visit when the record is open in one, else book it.
  const overdueAction = onAddToVisit ? (
    <Button size="sm" icon="add" onClick={onAddToVisit}>
      {t("record.addToVisit")}
    </Button>
  ) : bookUrl ? (
    <a href={bookUrl} target="_blank" rel="noopener noreferrer" className={buttonClasses("secondary", "sm")}>
      <Icon name="edit_calendar" size={16} />
      {t("record.bookIt")}
    </a>
  ) : undefined;
  const dueRow = (r: (typeof due)[number]) => (
    <ListRow
      key={`${r.text}:${r.due}`}
      lead={dueIcon(r.text)}
      title={r.text}

      meta={
        isOverdue(r) ? (
          // "Overdue" in Body strong ink: bold, no color. Amber is for clinical cautions only.
          <Trans
            i18nKey="record.overdue"
            values={{ date: fmtDate(r.due) }}
            components={{ b: <b className="text-body-strong text-text" /> }}
          />
        ) : r.due ? (
          t("record.dueOn", { date: fmtDate(r.due) })
        ) : (
          ""
        )
      }
    >
      {isOverdue(r) && overdueAction && <span className="flex pt-2">{overdueAction}</span>}
    </ListRow>
  );
  const visit =
    pet.today && pet.today.visit_status !== "signed" && pet.today.appointment_id !== visitApptId ? pet.today : null;
  const kept = remember.filter((r) => !r.patient_id || r.patient_id === pet.id);

  const forget = async (id: string) => {
    setBusy(id);
    setStatus("");
    try {
      await api.forget(clientId, id);
      onForgot(id);
    } catch (err) {
      setStatus(err instanceof Error ? err.message : String(err));
    }
    setBusy("");
  };

  return (
    <div className="flex flex-col gap-6">
      <FactsLine
        items={[
          p.breed || p.species,
          p.sex ? p.sex.toLowerCase() : "",
          p.age != null ? t("count.year", { count: p.age }) : "",
          w ? <WeightFact key="w" latest={w} previous={profile.weight.previous} /> : "",
        ]}
      />
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 md:gap-8">
        <div className="flex min-w-0 flex-col gap-6">
          {p.alerts.length > 0 && (
            <Card.Section title={t("record.cautions")}>
              <Caution
                items={p.alerts}
                size="body"
                label={t("visitHead.caution")}
                className="flex-col items-start gap-y-1"
              />
            </Card.Section>
          )}
          <Card.Section title={t("record.due")}>
            {visit || due.length ? (
              <div className="[&>*:first-child]:border-t-0">
                {overdue.map(dueRow)}
                {visit && (
                  <ListRow
                    lead="event"
                    title={visit.reason || t("record.visit")}
                    meta={
                      <Trans
                        i18nKey="record.visitToday"
                        values={{ time: formatTime(visit.time) }}
                        components={{ n: <Num /> }}
                      />
                    }
                    onClick={() => void go.item({ appointment_id: visit.appointment_id, date: today })}
                  />
                )}
                {upcoming.map(dueRow)}
              </div>
            ) : (
              <p className="text-meta">{t("record.nothingDue")}</p>
            )}
          </Card.Section>
          {kept.length > 0 && (
            <Card.Section title={t("record.remember")}>
              <div className="[&>*:first-child]:border-t-0">
                {kept.map((r) => (
                  <ListRow
                    key={r.id}
                    title={<span className="text-body">{t("record.quoted", { text: r.text })}</span>}
                    meta={[t("record.staffOnly"), r.said_at ? t("record.said", { date: fmtDate(r.said_at) }) : ""]
                      .filter(Boolean)
                      .join(" · ")}
                    action={
                      <Button
                        size="sm"
                        variant="ghost"
                        disabled={busy === r.id}
                        aria-label={t("record.removeLabel", { text: r.text })}
                        onClick={() => void forget(r.id)}
                      >
                        {t("record.remove")}
                      </Button>
                    }
                  />
                ))}
              </div>
              <StatusText>{status}</StatusText>
            </Card.Section>
          )}
        </div>
        <div className="flex min-w-0 flex-col gap-6">
          <Card.Section title={t("record.weight")}>
            {w ? (
              <>
                <p className="text-body">
                  <Num>
                    {w.value} {w.unit}
                  </Num>
                  <span className="text-meta"> · {fmtDate(w.date)}</span>
                </p>
                <WeightTrend history={profile.weight.history} />
              </>
            ) : (
              <p className="text-meta">{t("record.noWeight")}</p>
            )}
          </Card.Section>
          <Card.Section title={t("record.details")}>
            <LabelValueGrid>
              <LabelValue label={t("record.patientId")} value={p.id} num />
              <LabelValue label={t("record.microchip")} value={p.microchip} num />
              <LabelValue label={t("record.color")} value={p.color} />
            </LabelValueGrid>
          </Card.Section>
        </div>
      </div>
    </div>
  );
}

/**
 * The weight over time as a small line, oldest on the left: 2px neutral stroke, a ring at each
 * weigh-in and the latest one filled. Each point names its weight and date on hover, and the whole
 * line is described for screen readers. Two weigh-ins or more, else nothing.
 */
export function WeightTrend({ history }: { history: Profile["weight"]["history"] }) {
  const { t } = useTranslation();
  const points = [...history]
    .map((h) => ({ ...h, n: Number.parseFloat(h.value) }))
    .filter((h) => Number.isFinite(h.n))
    .sort((a, b) => String(a.date).localeCompare(String(b.date)))
    .slice(-6);
  if (points.length < 2) return null;
  const W = 360,
    H = 56,
    pad = 8;
  const lo = Math.min(...points.map((p) => p.n)),
    hi = Math.max(...points.map((p) => p.n));
  // A flat line sits in the middle; a change fills the height.
  const y = (n: number) => (hi === lo ? H / 2 : pad + ((hi - n) / (hi - lo)) * (H - 2 * pad));
  const x = (i: number) => pad + (i / (points.length - 1)) * (W - 2 * pad);
  const said = points.map((p) => `${p.value} ${p.unit}, ${fmtDate(p.date)}`).join("; ");
  const first = points[0],
    last = points[points.length - 1];
  return (
    <figure className="m-0 flex max-w-[360px] flex-col gap-1">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="h-14 w-full overflow-visible text-text-secondary"
        role="img"
        aria-label={t("record.weightTrend", { points: said })}
      >
        <polyline
          points={points.map((p, i) => `${x(i)},${y(p.n)}`).join(" ")}
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
          strokeLinejoin="round"
          vectorEffect="non-scaling-stroke"
        />
        {points.map((p, i) => {
          const end = i === points.length - 1;
          return (
            <g key={`${p.date}:${i}`}>
              <circle
                cx={x(i)}
                cy={y(p.n)}
                r={4}
                className={end ? "fill-text stroke-text" : "fill-surface stroke-current"}
                strokeWidth={2}
              />
              {/* A bigger target than the mark, for the hover. */}
              <circle cx={x(i)} cy={y(p.n)} r={12} fill="transparent">
                <title>{`${p.value} ${p.unit}, ${fmtDate(p.date)}`}</title>
              </circle>
            </g>
          );
        })}
      </svg>
      <figcaption className="flex justify-between text-meta" aria-hidden="true">
        <span>{fmtMonthYear(first?.date)}</span>
        <span>{fmtMonthYear(last?.date)}</span>
      </figcaption>
    </figure>
  );
}
