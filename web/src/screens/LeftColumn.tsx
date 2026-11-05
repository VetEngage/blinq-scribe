import { useEffect, useState, type ReactNode } from "react";
import { useLocation, useNavigate } from "react-router";
import { useTranslation } from "react-i18next";
import { t } from "../i18n";
import { useShallow } from "zustand/react/shallow";
import {
  DateSwitcher,
  DemoTag,
  DropdownMenu,
  formatPhone,
  formatTime,
  hourOf,
  Icon,
  IconButton,
  Num,
  RailCard,
  RailFree,
  RailGroup,
  RailHousehold,
  RailMore,
  RailNow,
  RailPetRow,
  RailRow,
  RailStatus,
  Skeleton,
  Switch,
  cx,
  type RailDot,
  type RailTrack,
} from "@blinq-scribe/ui";
import type { Appointment, OpenItem, Patient, VisitStatus } from "../api/types";
import { clinicDayOf, dayClock, demoClockOn, isHousehold, isSeen, needsMe, petCount } from "../lib/day";
import { useRecorder } from "../recorder/store";
import { hasOpenVisit, useScheduleRefresh } from "../state/useScheduleRefresh";
import { myProviderId, useApp } from "../state/app";
import { useDayLeft } from "../state/eod";
import { useOpen, visitPath } from "../state/open";
import { addDays, cardFacts, clip, dayTitle, pastDay, speciesAge, wdMonthDay } from "../lib/format";
import { plainWords } from "../lib/plainWords";
import { CALLS_AND_TEXTS, followRows } from "../lib/followups";
import { SkeletonRows } from "../components/common";

type Filter = "all" | "needs" | "cautions" | "sign";

const cautionsOf = (p: Patient) => p.alert_chips ?? p.alerts.map((x) => ({ text: x, short: clip(x, 24) }));

/** The left rail: the day (with its switcher), then its visits. On End of day it folds to a summary. */
export function LeftColumn() {
  const { t } = useTranslation();
  const onEndOfDay = useLocation().pathname === "/end-of-day";
  return (
    <section className="col left" aria-label={t("day.yourDay")}>
      {onEndOfDay ? <DaySummary /> : <Schedule />}
    </section>
  );
}

function useDayHead() {
  const { t } = useTranslation();
  const { appts, viewDate, today, provider, doctors, me, schedulePending, apptsFor, busyDay } = useApp(
    useShallow((s) => ({
      appts: s.appts,
      viewDate: s.viewDate,
      today: s.today,
      provider: s.provider,
      doctors: s.doctors,
      me: s.me,
      schedulePending: s.schedulePending,
      apptsFor: s.apptsFor,
      busyDay: s.health?.busy_day ?? "",
    })),
  );
  const who = provider
    ? doctors.find((d) => d.id === provider)?.name || ""
    : me?.role === "vet" && me.via !== "open"
      ? doctors.find((d) => d.id === myProviderId(me, doctors))?.name || ""
      : t("topbar.allDoctors");
  // Loading until this day's rows are in: never "No appointments today" or "0 visits" before then.
  const pending = schedulePending || apptsFor !== `${provider}|${viewDate}`;
  // The day the provider's day is read at: today, or the busy demo day while it is on screen.
  const day = clinicDayOf(today, viewDate, busyDay);
  return { appts, viewDate, today, provider, who, pending, busy: !!busyDay && viewDate === busyDay, day };
}

/**
 * "5 visits · Dr. Ana Rivera", or "20 visits · 24 pets" when households make the pets more than the
 * visits (whose day it is stays in the top bar's day menu).
 */
function daySub(appts: Appointment[], who: string): string {
  const pets = petCount(appts);
  return [t("count.visit", { count: appts.length }), pets > appts.length ? t("count.pet", { count: pets }) : who]
    .filter(Boolean)
    .join(" · ");
}

function Head() {
  const { t } = useTranslation();
  const { appts, viewDate, today, who, pending, busy } = useDayHead();
  return (
    <DateSwitcher
      className="px-(--size-rail-inset) pt-4 pb-3"
      title={dayTitle(viewDate, today)}
      sub={
        pending ? (
          <Skeleton className="mt-1 w-32" />
        ) : busy ? (
          // The tag goes on a line of its own when it doesn't fit beside the counts.
          <span className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
            <span className="whitespace-nowrap">{daySub(appts, who)}</span>
            <DemoTag>{t("day.busyDemoDay")}</DemoTag>
          </span>
        ) : (
          daySub(appts, who)
        )
      }
      prevLabel={t("day.dayBefore")}
      nextLabel={t("day.dayAfter")}
      todayLabel={t("day.today")}
      isToday={viewDate === today}
      onPrev={() => void useApp.getState().shiftDay(-1)}
      onToday={() => void useApp.getState().goToDay(today)}
      onNext={() => void useApp.getState().shiftDay(1)}
    />
  );
}

/** What broke for a visit, from the day's open items: a text that didn't send, a PIMS save that failed. */
export type Broken = "text" | "pims" | undefined;
const brokenOf = (a: Appointment, items: OpenItem[]): Broken => {
  const mine = items.filter((i) => i.appointment_id === a.id);
  return mine.some((i) => i.kind === "failed_text")
    ? "text"
    : mine.some((i) => i.kind === "pims_failed")
      ? "pims"
      : undefined;
};

/**
 * A visit's status in the rail, only when it carries something: In visit (a green dot, pulsing while
 * audio comes in from this computer, the glasses or another console), Draft ready, Signed, or in red
 * what broke after it (a text that didn't send). Not started is the default and shows nothing, on any day.
 */
export function StatusTag({ a, broken }: { a: Appointment; broken?: Broken }) {
  const { t } = useTranslation();
  const here = useRecorder((s) => !!a.encounter_id && s.encounterId === a.encounter_id) || !!a.audio_live;
  if (broken) return <RailStatus tone="failed">{t(broken === "text" ? "rail.textFailed" : "rail.pimsFailed")}</RailStatus>;
  return <PetStatus s={a.visit_status} live={here} />;
}

/**
 * A heavy day: more visits than a screen holds. Its done visits fold into one Done row at the top of the
 * line, and after now the rail shows the next six, then a count of the rest.
 */
const HEAVY = 12;
const NEXT = 6;
/** A break this long between one visit's end and the next one's start is a free stretch on the line. */
const FREE_MIN = 60;

/** A visit's dot on the rail's line: red only for something broken, else its status. */
const dotOf = (a: Appointment, broken?: Broken): RailDot =>
  broken
    ? "failed"
    : a.visit_status === "recording"
      ? "visit"
      : a.visit_status === "draft_ready"
        ? "draft"
        : a.visit_status === "signed"
          ? "signed"
          : "todo";

const startOf = (a: Appointment): number => new Date(a.start).getTime();
// The mock PIMS books 30 minutes when it gives no length.
const endOf = (a: Appointment): number => startOf(a) + (a.duration_min ?? 30) * 60_000;
const byClock = (list: Appointment[]): Appointment[] =>
  [...list].sort((x, y) => String(x.start).localeCompare(String(y.start)));

/** One entry on the rail's line: a visit (with its dot), the Now line, a free stretch or a fold. */
type Item = { key: string; dot?: RailDot; node: (track: RailTrack) => ReactNode };

/** A visit's or a household pet's status: In visit, Draft ready, Signed; nothing when not started. */
function PetStatus({ s, live }: { s: VisitStatus; live?: boolean }) {
  const { t } = useTranslation();
  if (s === "signed") return <RailStatus tone="signed">{t("status.signed")}</RailStatus>;
  if (s === "draft_ready") return <RailStatus tone="draft">{t("status.draftReady")}</RailStatus>;
  if (s === "recording")
    return (
      <RailStatus tone="visit" live={live}>
        {t("status.inVisit")}
      </RailStatus>
    );
  return null;
}

/** The rail beside the page (wider than 1100 px), where a row's quick card has room to its right. */
const BESIDE = "(min-width: 1101px)";
function useBeside(): boolean {
  const query = () => typeof window === "undefined" || !window.matchMedia || window.matchMedia(BESIDE).matches;
  const [beside, setBeside] = useState(query);
  useEffect(() => {
    const mq = window.matchMedia?.(BESIDE);
    if (!mq) return;
    const on = () => setBeside(mq.matches);
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, []);
  return beside;
}

/**
 * A row's quick card, read only: the pet and its facts, the owner with a phone, the last visit, today's
 * reason, the PIMS's own notes with when the schedule was read, its alerts, and Open visit. Only what
 * the day's schedule already carries: no request on hover.
 */
function QuickCard({ a, p, reason, href, onOpen }: { a: Appointment; p: Patient; reason: string; href: string; onOpen: () => void }) {
  const { t } = useTranslation();
  const today = useApp((s) => s.today);
  const owner = [a.client.first_name, a.client.last_name].filter(Boolean).join(" ");
  const phone = formatPhone(a.client.phones?.[0]);
  const last = p.last_visit;
  return (
    <RailCard
      name={p.name}
      facts={cardFacts(p)}
      details={[
        {
          label: t("rail.card.owner"),
          value:
            owner || phone ? (
              <>
                {owner}
                {owner && phone && " · "}
                {phone && <Num>{phone}</Num>}
              </>
            ) : (
              ""
            ),
        },
        { label: t("rail.card.lastVisit"), value: last ? [pastDay(last.date, today), plainWords(last.reason)].filter(Boolean).join(" · ") : "" },
      ]}
      reason={reason ? { label: t("rail.card.reason"), text: plainWords(reason) } : undefined}
      notes={{
        label: t("rail.card.fromPims"),
        aside: a.synced_at ? t("rail.card.synced", { time: formatTime(a.synced_at) }) : undefined,
        items: (p.pims_notes ?? []).map(plainWords),
      }}
      alerts={{ label: t("rail.card.alerts"), items: p.alerts, none: t("rail.card.noAlerts") }}
      readOnly={t("rail.card.readOnly")}
      open={{ label: t("rail.card.open"), href, onClick: onOpen }}
    />
  );
}

/** One visit's row: two lines, its status, and (beside the page) its quick card. */
function VisitRow({
  a,
  current,
  broken,
  beside,
  track,
}: {
  a: Appointment;
  current?: boolean;
  broken?: Broken;
  beside: boolean;
  track?: RailTrack;
}) {
  const { t } = useTranslation();
  const open = useOpen();
  const go = () => open.appointment(a);
  return (
    <RailRow
      time={formatTime(a.start)}
      title={a.patient.name}
      facts={speciesAge(a.patient)}
      sub={a.patient.breed}
      reason={a.reason ? plainWords(a.reason) : undefined}
      cautions={cautionsOf(a.patient)}
      cautionLabel={t("rail.caution")}
      status={<StatusTag a={a} broken={broken} />}
      card={beside ? <QuickCard a={a} p={a.patient} reason={a.reason} href={visitPath(a)} onOpen={go} /> : undefined}
      current={current}
      track={track}
      className="appt"
      onClick={go}
    />
  );
}

function Schedule() {
  const { t } = useTranslation();
  const open = useOpen();
  const navigate = useNavigate();
  const { appts, viewDate, today, pending } = useDayHead();
  const { openAppt, current, brief, loadSchedule } = useApp(
    useShallow((s) => ({ openAppt: s.openAppt, current: s.current, brief: s.brief, loadSchedule: s.loadSchedule })),
  );
  const [filter, setFilter] = useState<Filter>("all");
  const [doneOpen, setDoneOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  useScheduleRefresh(hasOpenVisit(appts), loadSchedule);
  const isToday = viewDate === today;
  // Today, or the demo clinic's busy day at its own clock: the Now line sits on the day's line at that time.
  const clock = useClock(appts, viewDate, today);
  const live = !pending && !!clock;
  const left = useDayLeft((s) => s.data);
  // Needs me counts what the brief says: notes to sign and owner texts that didn't send, on this day.
  const dayItems = left ? left.left_to_do : [];
  const needs = live ? appts.filter((a) => needsMe(a, brief, dayItems)) : [];
  const beside = useBeside();

  /**
   * A household visit: folded to the owner and how many pets, open (with each pet's row) when it is on
   * screen or in the room.
   */
  const household = (a: Appointment, track?: RailTrack) => {
    const pets = a.pets ?? [];
    const here = openAppt?.id === a.id;
    const signed = pets.filter((p) => p.visit_status === "signed").length;
    return (
      <RailHousehold
        key={a.id}
        className="appt"
        time={formatTime(a.start)}
        owner={[a.client.first_name, a.client.last_name].filter(Boolean).join(" ")}
        count={t("count.pet", { count: pets.length })}
        pets={pets.map((p) => p.patient.name)}
        status={
          <RailStatus tone={signed === pets.length ? "signed" : "count"}>
            {t("rail.signedOf", { signed, count: pets.length })}
          </RailStatus>
        }
        open={here || a.visit_status === "recording"}
        current={here}
        track={track}
        onClick={() => open.appointment(a)}
      >
        {pets.map((p, i) => {
          const go = () => (p.encounter_id ? void navigate(visitPath(a, p.encounter_id)) : open.appointment(a));
          return (
            <RailPetRow
              key={p.patient.id}
              title={p.patient.name}
              facts={speciesAge(p.patient)}
              sub={p.patient.breed}
              reason={p.reason ? plainWords(p.reason) : undefined}
              cautions={cautionsOf(p.patient)}
              cautionLabel={t("rail.caution")}
              status={<PetStatus s={p.visit_status} />}
              card={
                beside ? (
                  <QuickCard a={a} p={p.patient} reason={p.reason} href={visitPath(a, p.encounter_id)} onOpen={go} />
                ) : undefined
              }
              current={here && current?.patient_id === p.patient.id}
              last={i === pets.length - 1}
              onClick={go}
            />
          );
        })}
      </RailHousehold>
    );
  };

  const row = (a: Appointment, track?: RailTrack) =>
    isHousehold(a) ? (
      household(a, track)
    ) : (
      <VisitRow
        key={a.id}
        a={a}
        current={openAppt?.id === a.id}
        broken={brokenOf(a, dayItems)}
        beside={beside}
        track={track}
      />
    );
  const visit = (a: Appointment): Item => ({
    key: a.id,
    dot: dotOf(a, brokenOf(a, dayItems)),
    node: (tr) => row(a, tr),
  });

  /**
   * Visits in clock order on one line: a break of an hour or more between one visit's end and the next
   * one's start is a free stretch, and on a day with a now the Now line goes at the clinic's time, so
   * every visit that started before it sits above it whatever its status (before the first visit it is
   * at the top, after the last at the bottom).
   */
  const timeline = (list: Appointment[], clockAt: Date | null): Item[] => {
    // A demo clock stands still, so a Now line there would never move: none then (see demoClockOn).
    const now = demoClockOn(appts, viewDate, today) ? null : clockAt;
    const at = now?.getTime();
    const nowItem: Item = {
      key: "now",
      node: (tr) => (
        <RailNow
          label={t("rail.now", { time: formatTime(now) })}
          name={t("rail.nowLabel", { time: formatTime(now) })}
          track={tr}
        />
      ),
    };
    const out: Item[] = [];
    let placed = at === undefined;
    list.forEach((a, i) => {
      const prev = list[i - 1];
      const free: Item[] =
        prev && startOf(a) - endOf(prev) >= FREE_MIN * 60_000
          ? [
              {
                key: `free-${a.id}`,
                node: (tr) => <RailFree label={t("rail.freeUntil", { time: formatTime(a.start) })} track={tr} />,
              },
            ]
          : [];
      if (!placed && at !== undefined && startOf(a) >= at) {
        placed = true;
        // Now inside a free stretch sits in it; before the last visit ends, above the stretch.
        out.push(...(prev && at < endOf(prev) ? [nowItem, ...free] : [...free, nowItem]));
      } else out.push(...free);
      out.push(visit(a));
    });
    if (!placed) out.push(nowItem);
    return out;
  };

  /** The rail as a list on the line: it starts at the first dot and ends at the last. */
  const line = (items: Item[]) => {
    const dots = items.flatMap((it, i) => (it.dot ? [i] : []));
    const first = dots[0] ?? -1;
    const last = dots[dots.length - 1] ?? -1;
    return (
      <ul role="list" className="m-0 flex list-none flex-col p-0">
        {items.map((it, i) => (
          <li key={it.key}>{it.node({ dot: it.dot, above: first >= 0 && i > first, below: i < last })}</li>
        ))}
      </ul>
    );
  };

  const shown =
    filter === "needs"
      ? needs
      : filter === "cautions"
        ? appts.filter((a) =>
            (a.pets?.length ? a.pets.map((p) => p.patient) : [a.patient]).some((p) => p.alerts.length),
          )
        : filter === "sign"
          ? appts.filter((a) => a.visit_status === "draft_ready")
          : appts;

  let body;
  if (pending) body = <SkeletonRows time rows={5} />;
  else if (!appts.length)
    body = (
      <p className="px-(--size-rail-inset) py-3 text-meta">{isToday ? t("day.noneToday") : t("day.noneThisDay")}</p>
    );
  else if (filter !== "all")
    body = (
      <RailGroup label={t(`rail.filters.${filter}`)}>
        {shown.length ? (
          line(timeline(byClock(shown), live ? clock : null))
        ) : (
          <p className="px-(--size-rail-inset) py-3 text-meta">{t("rail.noneMatch")}</p>
        )}
      </RailGroup>
    );
  else if (!live || appts.length <= HEAVY) body = line(timeline(byClock(appts), live ? clock : null));
  else {
    // A heavy day: the done visits fold into one Done row at the top of the line, above the Now line, and
    // after now the next six show, then a count of the rest, so the rail never grows past a screen. A
    // household on screen stays out of Done, open, until every pet's note is signed; a visit with
    // something broken stays out too, so its red dot shows.
    const here = (a: Appointment) => isHousehold(a) && openAppt?.id === a.id && a.visit_status === "draft_ready";
    const done = byClock(appts.filter((a) => isSeen(a) && !here(a) && !brokenOf(a, dayItems)));
    const at = clock?.getTime() ?? 0;
    const main = byClock(appts.filter((a) => !done.includes(a)));
    const gone = main.filter((a) => startOf(a) < at);
    const toCome = main.filter((a) => startOf(a) >= at);
    const rest = toCome.slice(NEXT);
    const afternoon = rest.every((a) => hourOf(a.start) >= 12);
    const folded: Item[] = done.length
      ? [
          {
            key: "done",
            dot: done.every((a) => a.visit_status === "signed") ? "signed" : "draft",
            node: (tr) => (
              <RailMore open={doneOpen} onClick={() => setDoneOpen(!doneOpen)} track={tr}>
                {t("rail.done", { count: done.length })}
              </RailMore>
            ),
          },
          ...(doneOpen ? done : done.filter((a) => isHousehold(a) && openAppt?.id === a.id)).map(visit),
        ]
      : [];
    const more: Item[] = rest.length
      ? [
          {
            key: "more",
            node: () => (
              <RailMore link open={moreOpen} onClick={() => setMoreOpen(!moreOpen)}>
                {afternoon
                  ? t("rail.moreAfternoon", { count: rest.length })
                  : t("rail.moreLater", { count: rest.length })}
              </RailMore>
            ),
          },
        ]
      : [];
    body = line([...folded, ...timeline([...gone, ...(moreOpen ? toCome : toCome.slice(0, NEXT))], clock), ...more]);
  }

  return (
    <>
      <Head />
      {live && !!appts.length && (
        <div className="flex items-center gap-2 pt-1 pr-4 pb-2 pl-(--size-rail-inset)">
          <label className="flex flex-1 cursor-pointer items-center gap-2 text-rail-time font-num text-text-secondary">
            <Switch quiet checked={filter === "needs"} onCheckedChange={(on) => setFilter(on ? "needs" : "all")} />
            {t("rail.needsMe", { count: needs.length })}
          </label>
          <DropdownMenu.Root>
            <DropdownMenu.Trigger asChild>
              <IconButton
                variant="ghost"
                size="sm"
                icon="filter_list"
                className={cx("size-7", filter !== "all" && filter !== "needs" && "text-text")}
                aria-label={t("rail.filter")}
                title={t("rail.filter")}
              />
            </DropdownMenu.Trigger>
            <DropdownMenu.Content>
              <DropdownMenu.RadioGroup value={filter} onValueChange={(v) => setFilter(v as Filter)}>
                <DropdownMenu.RadioItem value="cautions">{t("rail.filters.cautions")}</DropdownMenu.RadioItem>
                <DropdownMenu.RadioItem value="sign">{t("rail.filters.sign")}</DropdownMenu.RadioItem>
                <DropdownMenu.RadioItem value="needs">{t("rail.filters.needs")}</DropdownMenu.RadioItem>
                <DropdownMenu.RadioItem value="all">{t("rail.filters.all")}</DropdownMenu.RadioItem>
              </DropdownMenu.RadioGroup>
            </DropdownMenu.Content>
          </DropdownMenu.Root>
        </div>
      )}
      <div className="schedule-list flex flex-1 flex-col" aria-busy={pending}>
        {body}
      </div>
    </>
  );
}

/**
 * The clock the rail reads its day at (see dayClock), ticking each minute so the Now line moves; null on
 * a day with no now.
 */
function useClock(appts: Appointment[], viewDate: string, today: string): Date | null {
  const [, tick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => tick((n) => n + 1), 60_000);
    return () => clearInterval(id);
  }, []);
  return dayClock(appts, viewDate, today);
}

/**
 * End of day's rail: the day folded to a summary ("All 5 seen · last visit at 1:30 PM", or "3 of 5
 * seen"), two quiet counts, tomorrow in one line, and Done, folded.
 */
function DaySummary() {
  const { t } = useTranslation();
  const { appts, viewDate, today, pending, day } = useDayHead();
  const { notes, waiting } = useApp(useShallow((s) => ({ notes: s.notes, waiting: s.waiting })));
  const left = useDayLeft((s) => s.data);
  const [doneOpen, setDoneOpen] = useState(false);
  const beside = useBeside();
  // Today's, or the busy demo day's while it is on screen.
  const todays = viewDate === day ? appts : [];
  const pets = petCount(todays);
  const seen = todays.filter(isSeen);
  const all = !!todays.length && seen.length === todays.length;
  const last = seen[seen.length - 1];
  const rows = left ? followRows(left.left_to_do, waiting ?? [], today) : [];
  const calls = rows.filter((r) => CALLS_AND_TEXTS.has(r.kind)).length;
  const tm = left ? left.tomorrow : null;
  return (
    <>
      <Head />
      <div className="flex flex-col gap-4 px-(--size-rail-inset) pb-4">
        {pending ? (
          <Skeleton className="h-16 w-full" />
        ) : all ? (
          <div className="flex items-center gap-3 rounded-tile bg-selected px-4 py-3">
            <Icon name="check_circle" fill size={24} className="text-primary" />
            <span className="flex min-w-0 flex-col">
              <span className="text-body-strong">
                {pets > todays.length
                  ? t("rail.allSeenPets", { count: todays.length, pets: t("count.pet", { count: pets }) })
                  : t("rail.allSeen", { count: todays.length })}
              </span>
              {last && <span className="text-meta">{t("rail.lastVisit", { time: formatTime(last.start) })}</span>}
            </span>
          </div>
        ) : (
          <div className="flex flex-col rounded-tile border border-border px-4 py-3">
            <span className="text-body-strong">{t("rail.someSeen", { seen: seen.length, count: todays.length })}</span>
          </div>
        )}
        <dl className="m-0 flex flex-col gap-2">
          <div className="flex justify-between gap-3">
            <dt className="text-meta">{t("rail.notesToSign")}</dt>
            <dd className="m-0 text-body-strong font-num">{notes ? notes.length : "–"}</dd>
          </div>
          <div className="flex justify-between gap-3">
            <dt className="text-meta">{t("rail.callsAndTexts")}</dt>
            <dd className="m-0 text-body-strong font-num">{left ? calls : "–"}</dd>
          </div>
        </dl>
        {tm && (
          <div className="flex flex-col">
            <span className="text-meta">{t("day.tomorrow")}</span>
            <span className="text-body">
              {[
                wdMonthDay(tm.date || addDays(today, 1)),
                tm.visits
                  ? t("rail.tomorrowVisits", {
                      visits: t("count.visit", { count: tm.visits }),
                      first: formatTime(tm.first),
                    })
                  : t("eod.noneTomorrow"),
              ].join(" · ")}
            </span>
          </div>
        )}
      </div>
      {!!seen.length && (
        <div className="mt-auto border-t border-border">
          <RailMore open={doneOpen} onClick={() => setDoneOpen(!doneOpen)}>
            {t("rail.done", { count: seen.length })}
          </RailMore>
          {doneOpen &&
            seen.map((a) => (
              <VisitRow key={a.id} a={a} broken={brokenOf(a, left ? left.left_to_do : [])} beside={beside} />
            ))}
        </div>
      )}
    </>
  );
}
