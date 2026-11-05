import { useEffect, useState } from "react";
import { useNavigate } from "react-router";
import { useTranslation } from "react-i18next";
import { useShallow } from "zustand/react/shallow";
import {
  ActionBar,
  ActionBarStatus,
  AiLabel,
  Badge,
  BucketTile,
  Button,
  Card,
  Caution,
  DemoTag,
  EmptyState,
  formatTime,
  Icon,
  MainAction,
  Num,
  Pressable,
  Skeleton,
  StatusText,
  Tag,
} from "@blinq-scribe/ui";
import { api } from "../api";
import type { Appointment, BriefPart, BriefUpdate, EndOfDay, NoteToSign, PreRoomCard } from "../api/types";
import { clip, drName, greetingFor, monthDay, petFacts, possessive, wdMonthDay, ymd } from "../lib/format";
import { breakdown, byOwner, fitGap, followRows, minutesFor } from "../lib/followups";
import { t } from "../i18n";
import { briefSeen, useApp } from "../state/app";
import { briefParts } from "../state/ask";
import { useChat } from "../state/chat";
import { useDayLeft } from "../state/eod";
import { useOpen } from "../state/open";
import { useNoVisit } from "../state/useNoVisit";
import { say, stopTalking, useVoice } from "../state/voice";
import { BriefSentence } from "./ask/parts";
import { FollowRowList, FollowRowView } from "./FollowUps";
import { useFollowActions } from "./useFollowActions";
import {
  betweenVisits,
  dayClock,
  headsUp,
  isHousehold,
  isSeen,
  minutesUntil,
  paceMinutes,
  clinicDayOf,
  petsOf,
  pickNext,
} from "../lib/day";

/** "Oldest 6 days" for Ready to sign; what's left for Pending ("1 thing to confirm, 1 follow up to decide"). */
function bucketMeta(list: NoteToSign[], pending: boolean): string {
  if (!list.length) return t("home.bucketNone");
  if (!pending) {
    const oldest = Math.max(...list.map((n) => n.waiting_days));
    return oldest ? t("home.oldest", { days: t("count.day", { count: oldest }) }) : t("home.fromToday");
  }
  const confirm = list.reduce((n, x) => n + x.to_confirm, 0);
  const decide = list.reduce((n, x) => n + x.followups_undecided, 0);
  const notDrafted = list.filter((x) => x.status !== "draft_ready").length;
  return [
    confirm ? t("home.toConfirm", { count: confirm }) : "",
    decide ? t("home.toDecide", { count: decide }) : "",
    notDrafted ? t("home.notDrafted", { count: notDrafted }) : "",
  ]
    .filter(Boolean)
    .join(", ");
}

/**
 * The brief: one line in Blinq's purple at the top, facts only, with Hear it and Dismiss. Loading, it is
 * a line shaped like the sentence, never "not ready".
 */
function BriefLine({ day }: { day?: BriefPart[] | null }) {
  const { t } = useTranslation();
  const { brief, briefLoaded, dismissed } = useApp(
    useShallow((s) => ({ brief: s.brief, briefLoaded: s.briefLoaded, dismissed: s.briefDismissed })),
  );
  const phase = useVoice((s) => s.phase);
  const reading = useVoice((s) => s.reading === "brief");
  const [hidden] = useState(briefSeen);
  // The busy demo day's own brief (`day`, null while it loads) is dismissed on its own.
  const [dayHidden, setDayHidden] = useState(false);
  const own = day !== undefined;
  if (own ? dayHidden : dismissed || hidden) return null;
  const parts = own ? (day ?? []) : briefParts(brief);
  if ((own ? day !== null : briefLoaded) && !parts.length) return null;
  const text = parts.map((p) => p.text).join("");
  const speaking = phase === "speaking" && reading;
  return (
    <section
      aria-labelledby="briefLabel"
      className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-tile bg-ai-bg px-4 py-3"
    >
      <span id="briefLabel" className="flex-none">
        <AiLabel>{t("home.brief")}</AiLabel>
      </span>
      {parts.length ? (
        <p className="min-w-0 flex-[1_1_320px] text-body text-text">
          <BriefSentence parts={parts} />
        </p>
      ) : (
        <span role="status" aria-label={t("app.loading")} className="flex flex-[1_1_320px] flex-col gap-2">
          <Skeleton className="w-4/5" />
        </span>
      )}
      <span className="flex flex-none items-center gap-4">
        <Button
          variant="link"
          size="sm"
          className="text-ai"
          icon={speaking ? "stop" : "volume_up"}
          disabled={!text || (phase !== "idle" && !speaking)}
          onClick={() => (speaking ? stopTalking() : say(text, "brief"))}
        >
          {speaking ? t("home.stop") : t("home.hearIt")}
        </Button>
        <Button
          variant="link"
          size="sm"
          className="text-text-secondary"
          onClick={() => (own ? setDayHidden(true) : useApp.getState().dismissBrief())}
        >
          {t("home.dismiss")}
        </Button>
      </span>
    </section>
  );
}

/**
 * The busy demo day's brief, from that day's own record: its notes left to sign, owner texts that didn't
 * send and follow ups to decide. The rail's Needs me counts the same visits. Null while loading.
 */
function dayBrief(appts: Appointment[], left: EndOfDay | null | false, day: string): BriefPart[] | null {
  if (left === null) return null;
  const notes = appts.flatMap(petsOf).filter((p) => p.visit_status === "draft_ready").length;
  const items = (left ? left.left_to_do : []).filter((i) => i.date === day);
  // A text that didn't send needs the provider whatever day it was sent, as Quick ones for the gap shows.
  const failed = (left ? left.left_to_do : []).filter((i) => i.kind === "failed_text");
  const decide = items.filter((i) => i.kind === "followup").length;
  const bold = (text: string): BriefPart => ({ text, emphasis: "bold", kind: "" });
  const plain = (text: string): BriefPart => ({ text, emphasis: "none", kind: "" });
  const out: BriefPart[] = [];
  if (notes) out.push(bold(t("home.dayBriefNotes", { count: notes })), plain(" "));
  if (failed.length === 1)
    out.push(plain(t("home.dayBriefText", { label: failed[0]?.label || failed[0]?.text || "" })), plain(" "));
  else if (failed.length) out.push(bold(t("home.dayBriefTexts", { count: failed.length })), plain(" "));
  if (decide) out.push(plain(t("home.dayBriefDecide", { count: decide })), plain(" "));
  if (!out.length) out.push(plain(t("home.dayBriefNone")));
  return out.map((p, i, all) => (i === all.length - 1 ? { ...p, text: p.text.trimEnd() } : p)).filter((p) => p.text);
}

/** Who is here for the next visit, when the PIMS says: "Priya is in the room", "Smokey is checked in". */
function arrival(a: Appointment): string {
  if (a.visit_status === "recording") return "";
  if (/in[\s_-]*room/i.test(a.status || ""))
    return t("home.ownerInRoom", { name: a.client.first_name || a.patient.name });
  if (/check(ed)?[\s_-]*in|arrived/i.test(a.status || "") || a.checked_in_at)
    return t("home.petCheckedIn", { name: isHousehold(a) ? a.client.first_name : a.patient.name });
  return "";
}

/** "Good afternoon, Dr. Rivera" at the day's clock. */
function Hello({ clock }: { clock: Date }) {
  const { t } = useTranslation();
  const { provider, doctors } = useApp(useShallow((s) => ({ provider: s.provider, doctors: s.doctors })));
  const name = doctors.find((d) => d.id === provider)?.name ?? "";
  const part = greetingFor(clock);
  return (
    <h1 className="text-display">
      {name ? t(`home.greetingNamed.${part}`, { name: drName(name) }) : t(`home.greeting.${part}`)}
    </h1>
  );
}

/** "Good morning, Dr. Rivera", then "0 of 5 seen" and a slim bar. No pace: there are no check-in times. */
function Greeting({ appts }: { appts: Appointment[] }) {
  const { t } = useTranslation();
  const seen = appts.filter(isSeen).length;
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
      <Hello clock={new Date()} />
      {!!appts.length && (
        <>
          <span className="text-meta">{t("home.seen", { seen, count: appts.length })}</span>
          <span
            role="progressbar"
            aria-label={t("home.dayProgress")}
            aria-valuemin={0}
            aria-valuemax={appts.length}
            aria-valuenow={seen}
            className="ms-auto h-1.5 w-60 max-w-full overflow-hidden rounded-pill bg-divider"
          >
            <span
              className="block h-full rounded-pill bg-primary transition-[width]"
              style={{ width: `${(100 * seen) / appts.length}%` }}
            />
          </span>
        </>
      )}
    </div>
  );
}

/**
 * A heavy day at a glance, in place of a timeline: the greeting, one plain sentence (between visits, the
 * pace and the free time; otherwise how many are seen, the pace and the last visit), a slim bar, and up
 * to three heads-up chips for the rest of the day. Pace is said only when the record supports it.
 */
function DayLine({
  appts,
  clock,
  gap,
  demo,
}: {
  appts: Appointment[];
  clock: Date;
  gap: Appointment | null;
  demo: boolean;
}) {
  const { t } = useTranslation();
  const seen = appts.filter(isSeen).length;
  const pace = paceMinutes(appts, clock);
  const paceText = pace == null ? "" : pace >= 5 ? t("home.paceBehind", { minutes: pace }) : t("home.paceOnTime");
  const last = [...appts].sort((a, b) => String(a.start).localeCompare(String(b.start))).pop();
  const sentence = gap
    ? [paceText, t("home.freeUntil", { time: formatTime(gap.start) })]
    : [
        t("home.seenSentence", { seen, count: appts.length }),
        paceText,
        last ? t("home.lastVisit", { time: formatTime(last.start) }) : "",
      ];
  const chips = headsUp(appts, clock, gap ? [gap.id] : []);
  return (
    <section aria-labelledby="dayLine" className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <Hello clock={clock} />
        {demo && <DemoTag>{t("home.demoClock", { time: formatTime(clock) })}</DemoTag>}
      </div>
      <p id="dayLine" className="text-body">
        {sentence.filter(Boolean).join(" ")}
      </p>
      <span
        role="progressbar"
        aria-label={t("home.dayProgress")}
        aria-valuemin={0}
        aria-valuemax={appts.length}
        aria-valuenow={seen}
        aria-valuetext={t("home.seen", { seen, count: appts.length })}
        className="h-1.5 w-full max-w-[520px] overflow-hidden rounded-pill bg-divider"
      >
        <span
          className="block h-full rounded-pill bg-primary transition-[width]"
          style={{ width: `${(100 * seen) / Math.max(1, appts.length)}%` }}
        />
      </span>
      {!!chips.length && (
        <ul aria-label={t("home.headsUp")} className="m-0 flex list-none flex-wrap gap-2 p-0">
          {chips.map(({ a, kind }) => {
            const pets = a.pets?.length ? a.pets.map((p) => p.patient) : [a.patient];
            const caution = kind === "caution" ? pets.find((p) => p.alerts.length) : undefined;
            return (
              <li key={a.id}>
                <Tag variant="fact" className="gap-2">
                  <Num className="text-body-strong">{formatTime(a.start)}</Num>
                  {kind === "household" ? (
                    t("home.headsUpHousehold", {
                      name: a.client.last_name || a.client.first_name,
                      pets: t("count.pet", { count: pets.length }),
                    })
                  ) : caution ? (
                    <>
                      {caution.name} ·
                      <Caution
                        labeled
                        compact
                        max={1}
                        label={t("rail.caution")}
                        items={caution.alert_chips ?? caution.alerts.map((x) => ({ text: x, short: clip(x, 24) }))}
                      />
                    </>
                  ) : (
                    t("home.headsUpLast", {
                      pet: isHousehold(a)
                        ? t("home.household", { name: a.client.last_name || a.client.first_name })
                        : a.patient.name,
                    })
                  )}
                </Tag>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

/**
 * Quick ones for the gap between visits: up to three follow ups the provider can do now that fit before
 * the next visit, each with about how long it takes and its one action; then how many more can wait.
 */
function QuickOnes({ minutes }: { minutes: number }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { waiting, today } = useApp(
    useShallow((s) => ({ waiting: s.waiting, today: clinicDayOf(s.today, s.viewDate, s.health?.busy_day) })),
  );
  const left = useDayLeft((s) => s.data);
  const [status, setStatus] = useState("");
  const { action } = useFollowActions(setStatus);
  const loading = left === null || waiting === null;
  const rows = left ? followRows(left.left_to_do, waiting ?? [], today) : [];
  const quick = fitGap(rows, minutes);
  const total = quick.reduce((n, r) => n + (minutesFor(r) ?? 0), 0);
  return (
    <Card as="section" density="flush" className="gap-0" aria-labelledby="quickTitle">
      <div className="flex items-center justify-between gap-3 px-4 pt-4 pb-3">
        <Card.Title id="quickTitle">{t("home.quickTitle")}</Card.Title>
        {!!total && <span className="text-meta">{t("home.quickAbout", { minutes: total })}</span>}
      </div>
      {loading ? (
        <div role="status" aria-label={t("app.loading")} className="flex flex-col gap-2 border-t border-divider p-4">
          <Skeleton className="w-3/5" />
          <Skeleton className="w-2/5" />
        </div>
      ) : quick.length ? (
        <ul className="m-0 list-none p-0">
          {quick.map((r) => (
            <FollowRowView
              key={r.key}
              row={{
                ...r,
                meta: [r.meta, t("home.quickMinutes", { minutes: minutesFor(r) ?? 1 })].filter(Boolean).join(" · "),
              }}
              action={action(r)}
            />
          ))}
        </ul>
      ) : (
        <p className="border-t border-divider px-4 py-3 text-meta">{t("home.quickNone")}</p>
      )}
      <div className="flex items-center justify-between gap-3 border-t border-divider px-4 py-3">
        <Button variant="link" className="underline" onClick={() => void navigate("/end-of-day")}>
          {t("home.seeAll")}
        </Button>
        {rows.length > quick.length && (
          <span className="text-meta">{t("home.moreCanWait", { count: rows.length - quick.length })}</span>
        )}
      </div>
      <StatusText className="px-4 pb-3">{status}</StatusText>
    </Card>
  );
}

/** Up next: the page's one subject. The pet, the visit, why it matters (facts, in purple) and prep chips. */
function UpNext({ a, card }: { a: Appointment; card: PreRoomCard | null }) {
  const { t } = useTranslation();
  const open = useOpen();
  const going = a.visit_status === "recording";
  const owner = [a.client.first_name, a.client.last_name].filter(Boolean).join(" ");
  const clientId = a.patient.client_id || a.client.id;
  if (isHousehold(a)) return <UpNextHousehold a={a} owner={owner} />;
  const facts = [petFacts(a.patient), card?.weight ?? ""].filter(Boolean).join(" · ");
  const msg = card?.owner_message;
  return (
    <Card as="section" className="gap-0 p-6" aria-labelledby="upNextName">
      <span className="text-meta">
        {going ? t("home.inTheRoom") : t("home.upNext")} · <Num>{formatTime(a.start)}</Num>
        {a.room ? ` · ${a.room}` : ""}
        {a.checked_in_at && !going ? ` · ${t("home.checkedInAt", { time: formatTime(a.checked_in_at) })}` : ""}
      </span>
      <h2 id="upNextName" className="mt-1 text-display">
        {a.patient.name}
      </h2>
      <p className="text-meta">
        {facts}
        {owner ? ` · ${t("home.owner", { name: owner })}` : ""}
      </p>
      {a.reason && <p className="mt-3 text-body-strong">{a.reason}</p>}
      {!!a.patient.alerts.length && (
        <Caution
          className="mt-2"
          labeled
          compact
          label={t("rail.caution")}
          items={a.patient.alert_chips ?? a.patient.alerts.map((x) => ({ text: x, short: clip(x, 24) }))}
        />
      )}
      {!card ? (
        <div role="status" aria-label={t("app.loading")} className="mt-4 flex flex-col gap-2 rounded-tile bg-ai-bg p-4">
          <Skeleton className="w-24" />
          <Skeleton className="w-4/5" />
          <Skeleton className="w-3/5" />
        </div>
      ) : (
        !!card.why?.length && (
          <div className="mt-4 rounded-r-tile border-l-2 border-ai bg-ai-bg px-4 py-3">
            <AiLabel>{t("home.whyItMatters")}</AiLabel>
            <ul className="mt-2 flex list-none flex-col gap-1 p-0">
              {card.why.map((line) => (
                <li key={line} className="flex gap-2 text-body text-text">
                  <span className="mt-2 size-1 flex-none rounded-pill bg-ai" aria-hidden="true" />
                  <span className="min-w-0">{line}</span>
                </li>
              ))}
            </ul>
          </div>
        )
      )}
      {!!card?.prep?.length && (
        <div className="mt-4 flex flex-wrap gap-2">
          {card.prep.map((p) => (
            <Tag key={p} variant="fact">
              {p}
            </Tag>
          ))}
        </div>
      )}
      {(card?.last_visit_on || msg) && (
        <div className="mt-6 flex flex-wrap items-center gap-x-6 gap-y-2 border-t border-divider pt-4">
          {card?.last_visit_on && (
            <Button
              variant="link"
              className="underline"
              onClick={() => open.household(clientId, a.patient.id, "visits")}
            >
              {t("home.readNote", { date: monthDay(card.last_visit_on) })}
            </Button>
          )}
          {msg && (
            <Button
              variant="link"
              className="underline"
              onClick={() => open.household(clientId, a.patient.id, "texts")}
            >
              {t("home.seeText", { whose: possessive(msg.who) })}
            </Button>
          )}
        </div>
      )}
    </Card>
  );
}

/** Up next when it is a household visit: the owner's household, then each pet with its own reason. */
function UpNextHousehold({ a, owner }: { a: Appointment; owner: string }) {
  const { t } = useTranslation();
  const going = a.visit_status === "recording";
  const pets = a.pets ?? [];
  return (
    <Card as="section" className="gap-0 p-6" aria-labelledby="upNextName">
      <span className="text-meta">
        {going ? t("home.inTheRoom") : t("home.upNext")} · <Num>{formatTime(a.start)}</Num>
        {a.room ? ` · ${a.room}` : ""}
      </span>
      <h2 id="upNextName" className="mt-1 text-display">
        {t("home.household", { name: a.client.last_name || owner })}
      </h2>
      <p className="text-meta">
        {[t("count.pet", { count: pets.length }), t("home.owner", { name: owner })].join(" · ")}
      </p>
      <ul className="mt-4 m-0 flex list-none flex-col border-b border-divider p-0">
        {pets.map((p) => (
          <li key={p.patient.id} className="flex flex-col gap-1 border-t border-divider py-3">
            <span className="text-body">
              <b className="text-body-strong">{p.patient.name}</b>
              {p.reason ? ` · ${p.reason}` : ""}
            </span>
            {!!p.patient.alerts.length && (
              <Caution
                labeled
                compact
                label={t("rail.caution")}
                items={p.patient.alert_chips ?? p.patient.alerts.map((x) => ({ text: x, short: clip(x, 24) }))}
              />
            )}
          </li>
        ))}
      </ul>
    </Card>
  );
}

/**
 * Follow-ups waiting: the two note buckets as neutral tiles, then up to three things to do with one
 * action each, then how many more.
 */
function FollowUpsWaiting() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { notes, waiting, today } = useApp(
    useShallow((s) => ({
      notes: s.notes,
      waiting: s.waiting,
      today: clinicDayOf(s.today, s.viewDate, s.health?.busy_day),
    })),
  );
  const left = useDayLeft((s) => s.data);
  const [status, setStatus] = useState("");
  const { action } = useFollowActions(setStatus);
  const loading = notes === null || left === null || waiting === null;
  const rows = left ? followRows(left.left_to_do, waiting ?? [], today) : [];
  const ready = (notes ?? []).filter((n) => n.bucket === "ready");
  const pending = (notes ?? []).filter((n) => n.bucket === "pending");
  const total = ready.length + pending.length + rows.length;
  // One owner's rows together, so a household reads as one place; the top three shown.
  const grouped = byOwner(rows).map((x) => x.row);
  const shown = grouped.slice(0, 3);
  return (
    <Card as="section" density="flush" className="gap-0" aria-labelledby="followTitle">
      <div className="flex items-center justify-between px-4 pt-4 pb-3">
        <Card.Title id="followTitle">{t("home.followUps")}</Card.Title>
        {!loading && (
          <Badge>
            <span aria-hidden="true">{total}</span>
            <span className="sr-only">{t("home.followUpsCount", { count: total })}</span>
          </Badge>
        )}
      </div>
      <div className="grid grid-cols-1 gap-2 px-4 pb-4">
        {notes === null ? (
          <>
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-16 w-full" />
          </>
        ) : (
          <>
            <BucketTile
              icon="edit_note"
              title={t("notes.ready")}
              count={ready.length}
              meta={bucketMeta(ready, false)}
              onClick={() => void navigate("/notes?bucket=ready")}
            />
            <BucketTile
              icon="pending_actions"
              title={t("notes.pending")}
              count={pending.length}
              meta={bucketMeta(pending, true)}
              onClick={() => void navigate("/notes?bucket=pending")}
            />
          </>
        )}
      </div>
      {loading ? (
        <div role="status" aria-label={t("app.loading")} className="flex flex-col gap-2 border-t border-divider p-4">
          <Skeleton className="w-3/5" />
          <Skeleton className="w-2/5" />
        </div>
      ) : shown.length ? (
        <FollowRowList rows={shown} action={action} />
      ) : (
        <p className="border-t border-divider px-4 py-3 text-meta">{t("home.nothingWaiting")}</p>
      )}
      {rows.length > shown.length && (
        <div className="flex items-center justify-between gap-3 border-t border-divider px-4 py-3">
          <Button variant="link" className="underline" onClick={() => void navigate("/end-of-day")}>
            {t("home.more", { count: rows.length - shown.length })}
          </Button>
          <span className="min-w-0 truncate text-meta">{breakdown(grouped.slice(3))}</span>
        </div>
      )}
      <StatusText className="px-4 pb-3">{status}</StatusText>
    </Card>
  );
}

/** "Sat 4:12 PM", or the time alone today. */
function sinceWhen(at: string, today: string): string {
  const d = new Date(at);
  if (Number.isNaN(d.getTime())) return "";
  const day = ymd(d);
  if (day === today) return formatTime(d);
  return `${d.toLocaleDateString("en-US", { weekday: "short" })} ${formatTime(d)}`;
}

/** Since yesterday: what came in overnight, plain rows under a label, each tied to its visit. */
function SinceYesterday({ appts }: { appts: Appointment[] }) {
  const { t } = useTranslation();
  const open = useOpen();
  const { brief, today } = useApp(useShallow((s) => ({ brief: s.brief, today: s.today })));
  const list = brief?.new_since_yesterday ?? [];
  if (!list.length) return null;
  const said = (u: BriefUpdate) => {
    if (u.kind === "reply") {
      const [who = "", text = ""] = u.text.split(" replied: ");
      return text ? t("home.ownerSaid", { who, text }) : u.detail || u.text;
    }
    if (u.kind === "result")
      return t("home.resultIn", { what: u.detail || t("home.results"), whose: possessive(u.patient_name) });
    return u.text;
  };
  return (
    <section aria-labelledby="sinceTitle" className="flex flex-col">
      <h2 id="sinceTitle" className="pb-2 text-label">
        {t("home.sinceYesterday")}
      </h2>
      <ul className="m-0 list-none border-b border-divider p-0">
        {list.map((u, i) => {
          const appt = appts.find((a) => a.patient.id === u.patient_id);
          const tied = appt ? `${u.patient_name}, ${formatTime(appt.start)}` : u.patient_name;
          const go = () => {
            if (appt) return open.appointment(appt);
            if (u.client_id)
              open.household(u.client_id, u.patient_id ?? "", u.kind === "reply" ? "texts" : "documents");
          };
          return (
            <li key={i}>
              <Pressable
                onClick={go}
                className="grid w-full grid-cols-[96px_minmax(0,1fr)_auto] items-center gap-4 border-t border-divider py-3 text-left text-text hover:bg-surface-muted max-[640px]:grid-cols-[minmax(0,1fr)]"
              >
                <span className="text-meta font-num whitespace-nowrap">{sinceWhen(u.at, today)}</span>
                <span className="min-w-0 truncate text-body">{said(u)}</span>
                <span className="text-meta whitespace-nowrap">{tied}</span>
              </Pressable>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

/**
 * Home: one page that knows the moment. The brief line, the greeting with the day's progress, Up next
 * beside Follow-ups waiting, then Since yesterday. The pinned bar holds the one green action: open the
 * next visit (⌘↵).
 */
export function Home() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const open = useOpen();
  useNoVisit();
  const { appts, viewDate, today, notes, schedulePending, apptsFor, provider } = useApp(
    useShallow((s) => ({
      appts: s.appts,
      viewDate: s.viewDate,
      today: s.today,
      notes: s.notes,
      schedulePending: s.schedulePending,
      apptsFor: s.apptsFor,
      provider: s.provider,
    })),
  );
  const [skipped, setSkipped] = useState<string[]>([]);
  const left = useDayLeft((s) => s.data);
  const [card, setCard] = useState<{ id: string; card: PreRoomCard } | null>(null);
  const pending = schedulePending || apptsFor !== `${provider}|${viewDate}`;
  // The day's clock: now on today, the demo clinic's own clock on its busy day.
  const clock = pending ? null : dayClock(appts, viewDate, today);
  const demo = viewDate !== today && !!clock;
  const todays = viewDate === today || demo ? appts : [];
  // A clinic day (today, or the demo's busy day): read as one sentence, a slim bar and a few heads up.
  const clinicDay = !!clock && todays.length > 0;
  // Between visits on any clinic day: nobody in the room, the clinic open, the next visit still to come.
  const gap = clock ? betweenVisits(todays, clock) : null;
  const next = pickNext(todays, skipped, clock ?? undefined);
  const after = next ? pickNext(todays, [...skipped, next.id], clock ?? undefined) : undefined;
  const id = next?.id ?? "";

  useEffect(() => {
    const app = useApp.getState();
    void app.loadBrief();
    void app.loadNotes();
    void app.loadWaiting();
    void useDayLeft.getState().load();
  }, [provider]);
  useEffect(() => {
    if (!id) return;
    let live = true;
    api
      .preRoomCard(id)
      .then((c) => live && setCard({ id, card: c }))
      .catch(() => undefined);
    return () => {
      live = false;
    };
  }, [id]);
  // Ask Blinq knows the page shows this visit already, so it doesn't repeat it.
  useEffect(() => {
    useChat.setState({ showing: id });
    return () => useChat.setState({ showing: "" });
  }, [id]);

  const ready = (notes ?? []).filter((n) => n.bucket === "ready");
  const toSign = notes ?? [];
  const going = next?.visit_status === "recording";
  const signAll = () => {
    if (ready.length) return void navigate("/notes?bucket=ready");
    const first = toSign[0];
    if (first)
      void open.item({ appointment_id: first.appointment_id, encounter_id: first.encounter_id, date: first.date });
  };

  return (
    <>
      {demo ? <BriefLine day={dayBrief(todays, left, viewDate)} /> : <BriefLine />}
      {clinicDay && clock ? (
        <DayLine appts={todays} clock={clock} gap={gap && gap.id === next?.id ? gap : null} demo={demo} />
      ) : (
        <Greeting appts={todays} />
      )}
      {viewDate !== today && !demo ? (
        <EmptyState icon="calendar_today">{t("home.otherDay", { day: wdMonthDay(viewDate) })}</EmptyState>
      ) : (
        <div className="grid grid-cols-[minmax(0,1.45fr)_minmax(0,1fr)] items-start gap-6 max-[1180px]:grid-cols-1">
          {pending ? (
            <Card className="gap-3 p-6" aria-busy="true">
              <Skeleton className="w-40" />
              <Skeleton className="h-8 w-48" />
              <Skeleton className="w-3/5" />
              <Skeleton className="h-24 w-full" />
            </Card>
          ) : next ? (
            <UpNext a={next} card={card?.id === next.id ? card.card : null} />
          ) : (
            <Card className="items-start gap-2 p-6">
              <Icon name="task_alt" size={24} className="text-primary" />
              <h2 className="text-title">
                {todays.length ? t("home.allSeen", { count: todays.length }) : t("day.noneToday")}
              </h2>
              {todays.length > 0 && <p className="text-meta">{t("home.allSeenSub")}</p>}
            </Card>
          )}
          {gap && clock && gap.id === next?.id ? (
            <QuickOnes minutes={minutesUntil(gap, clock)} />
          ) : (
            <FollowUpsWaiting />
          )}
        </div>
      )}
      {!demo && <SinceYesterday appts={todays} />}
      {next ? (
        <ActionBar label={t("home.barRegion")}>
          <ActionBarStatus
            lead={<Icon name="schedule" className="text-text-secondary" />}
            title={
              <>
                <b className="text-body-strong">{going ? t("home.barInRoom") : t("home.barUpNext")}</b>{" "}
                <span className="text-body">
                  {t("home.barWhat", {
                    pet: isHousehold(next)
                      ? t("home.household", { name: next.client.last_name || next.client.first_name })
                      : next.patient.name,
                    time: formatTime(next.start),
                  })}
                  {next.room ? ` · ${next.room}` : ""}
                </span>
              </>
            }
            sub={arrival(next) || undefined}
          />
          {after && (
            <Button variant="link" className="underline" onClick={() => setSkipped([...skipped, next.id])}>
              {t("home.skipTo", { pet: after.patient.name })}
            </Button>
          )}
          <MainAction icon="arrow_forward" onClick={() => open.appointment(next)}>
            {isHousehold(next)
              ? t(going ? "home.continueHousehold" : "home.openHousehold", {
                  name: next.client.last_name || next.client.first_name,
                })
              : going
                ? t("home.continueVisit", { whose: possessive(next.patient.name) })
                : t("home.openVisit", { whose: possessive(next.patient.name) })}
          </MainAction>
        </ActionBar>
      ) : viewDate === today && toSign.length > 0 ? (
        <ActionBar label={t("home.barRegion")}>
          <ActionBarStatus
            lead={<Icon name="edit_note" className="text-text-secondary" />}
            title={t("eod.notesToSign", { count: toSign.length })}
          />
          <MainAction icon="draw" onClick={signAll}>
            {t("eod.reviewAndSign", { count: toSign.length })}
          </MainAction>
        </ActionBar>
      ) : null}
    </>
  );
}

/** The old Morning address lands on Home. */
export const Morning = Home;
