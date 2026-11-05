import { useEffect, useState } from "react";
import { useNavigate } from "react-router";
import { Trans, useTranslation } from "react-i18next";
import { useShallow } from "zustand/react/shallow";
import {
  ActionBar,
  ActionBarStatus,
  Badge,
  Card,
  Icon,
  MainAction,
  Num,
  Pressable,
  Skeleton,
  StatusText,
  formatPhonesIn,
  formatTime,
} from "@blinq-scribe/ui";
import type { EndOfDay, NoteToSign } from "../api/types";
import { drName, greetingFor, wdMonthDay } from "../lib/format";
import { CALLS_AND_TEXTS, followRows } from "../lib/followups";
import { useApp } from "../state/app";
import { useDayLeft } from "../state/eod";
import { useOpen } from "../state/open";
import { useNoVisit } from "../state/useNoVisit";
import { ReadAloud } from "../components/ReadAloud";
import { Unavailable } from "../components/common";
import { FollowRowList } from "./FollowUps";
import { useFollowActions } from "./useFollowActions";
import { clinicDayOf, dayClock, isSeen } from "../lib/day";

/** What happened, counted as it happened: a recheck link sent is not a booking. */
function Sentence({ r, total }: { r: EndOfDay; total: number }) {
  const { t } = useTranslation();
  if (!total) return <>{t("eod.noVisits")}</>;
  const all = r.visits_seen >= total;
  const b = { b: <b className="text-body-strong" /> };
  const links = r.recheck_links_sent ?? 0;
  const fromLinks = r.recheck_links_booked ?? 0;
  const bookedNow = (r.rechecks_booked ?? 0) - fromLinks;
  return (
    <>
      <Trans
        i18nKey={all ? "eod.sentenceAll" : "eod.sentenceSome"}
        values={{
          visits: t("count.visit", { count: total }),
          seen: t("eod.seenOf", { seen: r.visits_seen, visits: t("count.visit", { count: total }) }),
        }}
        components={b}
      />
      {links > 0 && (
        <Trans
          i18nKey={fromLinks ? "eod.linksSome" : "eod.linksNone"}
          values={{ links: t("eod.recheckLink", { count: links }), booked: fromLinks }}
          components={b}
        />
      )}
      {bookedNow > 0 && (
        <Trans i18nKey="eod.bookedNow" values={{ rechecks: t("eod.recheck", { count: bookedNow }) }} components={b} />
      )}
    </>
  );
}

/** A note left to sign: the pet and owner, the visit, and what's left on it ("1 to confirm" in Blinq's purple). */
function NoteRow({ n, today }: { n: NoteToSign; today: string }) {
  const { t } = useTranslation();
  const go = useOpen();
  return (
    <li>
      <Pressable
        className="flex w-full items-center gap-3 border-t border-divider px-4 py-3 text-left hover:bg-page"
        onClick={() => void go.item({ appointment_id: n.appointment_id, encounter_id: n.encounter_id, date: n.date })}
      >
        <span className="flex min-w-0 flex-1 flex-col">
          <span className="truncate text-body-strong">
            {n.patient_name}
            {n.owner_name && <span className="text-body text-text-secondary"> · {n.owner_name}</span>}
          </span>
          <span className="truncate text-meta">
            {[n.visit_reason, n.date === today ? t("eod.seenAt", { time: formatTime(n.time) }) : wdMonthDay(n.date)]
              .filter(Boolean)
              .join(" · ")}
          </span>
        </span>
        {n.to_confirm > 0 ? (
          <span className="inline-flex h-6 flex-none items-center gap-2 rounded-pill bg-ai-bg px-2 text-meta text-ai">
            <span className="size-2 rotate-45 rounded-[1px] bg-ai" aria-hidden="true" />
            {t("eod.toConfirm", { count: n.to_confirm })}
          </span>
        ) : n.followups_undecided > 0 ? (
          <span className="flex-none text-meta">{t("home.toDecide", { count: n.followups_undecided })}</span>
        ) : n.status !== "draft_ready" ? (
          <span className="flex-none text-meta">{t("home.notDrafted", { count: 1 })}</span>
        ) : null}
        <Icon name="chevron_right" size={20} className="text-text-tertiary" />
      </Pressable>
    </li>
  );
}

/**
 * End of day: what's left, in the order to do it. Notes left to sign first (the page's one green action
 * signs them), then calls and texts left, the front desk's and the PIMS's, what's already handled, and a
 * calm last line. The page scrolls; no card scrolls on its own.
 */
export function EndOfDayScreen() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const go = useOpen();
  useNoVisit();
  const { today, provider, doctors, notes, waiting, appts, viewDate, busyDay } = useApp(
    useShallow((s) => ({
      busyDay: s.health?.busy_day ?? "",
      today: s.today,
      provider: s.provider,
      doctors: s.doctors,
      notes: s.notes,
      waiting: s.waiting,
      appts: s.appts,
      viewDate: s.viewDate,
    })),
  );
  const r = useDayLeft((s) => s.data);
  const [status, setStatus] = useState("");
  const { action } = useFollowActions(setStatus, { failedLabel: "follow.retry" });

  useEffect(() => {
    const app = useApp.getState();
    // End of day is for the day on screen when it is the busy demo day; any other day goes back to today.
    const stay = !!app.health?.busy_day && app.viewDate === app.health.busy_day;
    if (app.viewDate !== app.today && !stay) void app.goToDay(app.today);
    else void app.loadSchedule();
    void app.loadNotes();
    void app.loadWaiting();
    void app.loadBrief();
    void useDayLeft.getState().load();
  }, [provider]);

  const head = <h1 className="sr-only">{t("eod.title")}</h1>;
  if (r === false)
    return (
      <>
        {head}
        <Unavailable what={t("eod.unavailable")} />
      </>
    );

  const day = clinicDayOf(today, viewDate, busyDay);
  const todays = viewDate === day ? appts : [];
  const seen = todays.filter(isSeen).length;
  const name = doctors.find((d) => d.id === provider)?.name ?? "";
  // The busy demo day reads at its own clock.
  const part = greetingFor(dayClock(todays, viewDate, today) ?? undefined);
  const rows = r ? followRows(r.left_to_do, waiting ?? [], day) : [];
  const calls = rows.filter((x) => CALLS_AND_TEXTS.has(x.kind));
  const desk = rows.filter((x) => !CALLS_AND_TEXTS.has(x.kind));
  const toSign = notes ?? [];
  const ready = toSign.filter((n) => n.bucket === "ready");
  const signedToday = todays.filter((a) => a.visit_status === "signed").length;
  const signAll = () => {
    if (ready.length) return void navigate("/notes?bucket=ready");
    const first = toSign[0];
    if (first)
      void go.item({ appointment_id: first.appointment_id, encounter_id: first.encounter_id, date: first.date });
  };

  const card = (id: string, title: string, count: number | null, body: React.ReactNode, foot?: React.ReactNode) => (
    <Card as="section" density="flush" className="gap-0" aria-labelledby={id}>
      <div className="flex items-center justify-between gap-3 px-4 pt-4 pb-3">
        <Card.Title id={id}>{title}</Card.Title>
        {count !== null && <Badge>{count}</Badge>}
      </div>
      {body}
      {foot}
    </Card>
  );
  const loadingRows = (
    <div role="status" aria-label={t("app.loading")} className="flex flex-col gap-2 border-t border-divider p-4">
      <Skeleton className="w-3/5" />
      <Skeleton className="w-2/5" />
    </div>
  );

  return (
    <>
      {head}
      <div className="flex flex-col gap-2">
        <h2 className="text-display">
          {name ? t(`home.greetingNamed.${part}`, { name: drName(name) }) : t(`home.greeting.${part}`)}
        </h2>
        <p className="flex flex-wrap items-center gap-2 text-body">
          {r ? (
            <span>
              <Sentence r={r} total={todays.length} />
            </span>
          ) : (
            <Skeleton className="w-80" />
          )}
          {r && <ReadAloud id="eod" text={r.spoken} iconOnly />}
        </p>
        {!!todays.length && (
          <span
            role="progressbar"
            aria-label={t("home.dayProgress")}
            aria-valuemin={0}
            aria-valuemax={todays.length}
            aria-valuenow={seen}
            className="mt-2 h-1.5 w-full max-w-[520px] overflow-hidden rounded-pill bg-divider"
          >
            <span
              className="block h-full rounded-pill bg-primary"
              style={{ width: `${(100 * seen) / todays.length}%` }}
            />
          </span>
        )}
      </div>
      <div className="grid grid-cols-2 items-start gap-6 max-[1180px]:grid-cols-1">
        {card(
          "eodNotes",
          t("eod.notesLeft"),
          notes ? toSign.length : null,
          notes === null ? (
            loadingRows
          ) : toSign.length ? (
            <ul className="m-0 list-none p-0">
              {toSign.map((n) => (
                <NoteRow key={n.encounter_id} n={n} today={today} />
              ))}
            </ul>
          ) : (
            <p className="border-t border-divider px-4 py-3 text-meta">{t("eod.allSigned")}</p>
          ),
          signedToday > 0 ? (
            <p className="border-t border-divider px-4 py-3 text-meta">
              {t("eod.signedToday", { count: signedToday })}
            </p>
          ) : null,
        )}
        <div className="flex flex-col gap-6">
          {card(
            "eodCalls",
            t("eod.callsLeft"),
            r ? calls.length : null,
            !r || waiting === null ? (
              loadingRows
            ) : calls.length ? (
              <FollowRowList rows={calls} action={action} />
            ) : (
              <p className="border-t border-divider px-4 py-3 text-meta">{t("eod.noCalls")}</p>
            ),
            <StatusText className="px-4 pb-3">{status}</StatusText>,
          )}
          {desk.length > 0 &&
            card("eodDesk", t("eod.deskLeft"), desk.length, <FollowRowList rows={desk} action={action} />)}
        </div>
      </div>
      {r && r.done_today.length > 0 && (
        <section aria-labelledby="eodHandled" className="flex flex-col">
          <h2 id="eodHandled" className="pb-2 text-label">
            {t("eod.handled")}
          </h2>
          <ul className="m-0 list-none border-b border-divider p-0">
            {r.done_today.map((d, i) => (
              <li key={i} className="flex items-center gap-3 border-t border-divider py-3">
                <Icon name="check" size={20} className="text-primary" />
                <span className="min-w-0 flex-1 text-body">{formatPhonesIn(d.text)}</span>
              </li>
            ))}
          </ul>
        </section>
      )}
      {/* The closing line only once every visit today is seen; mid-day there's nothing to close. */}
      {r && todays.length > 0 && seen === todays.length && (
        <p className="text-body text-text-secondary">{t("eod.closing")}</p>
      )}
      {toSign.length > 0 && (
        <ActionBar label={t("eod.barRegion")}>
          <ActionBarStatus
            lead={<Icon name="edit_note" className="text-text-secondary" />}
            title={
              <>
                <Num>{toSign.length}</Num> {t("eod.notesToSignWord", { count: toSign.length })}
              </>
            }
          />
          <MainAction icon="draw" onClick={signAll}>
            {t("eod.reviewAndSign", { count: toSign.length })}
          </MainAction>
        </ActionBar>
      )}
    </>
  );
}
