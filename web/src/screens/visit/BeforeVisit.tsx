import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import type { TFunction } from "i18next";
import { api } from "../../api";
import type { Appointment, Encounter, PastVisit, PreRoomCard, Profile, WalkInEntry } from "../../api/types";
import { useApp } from "../../state/app";
import { onScreen } from "../../state/nav";
import { fmtDate, monthDay, possessive, ymd } from "../../lib/format";
import { plainWords } from "../../lib/plainWords";
import { VisitHeader, VisitLocked } from "./parts";
import { VisitPanel } from "./visitTabs";
import { ArrivalState, StartVisitBar } from "./StartVisit";
import { NoteSections } from "./NoteView";
import {
  AiLabel,
  Checkbox,
  Chip,
  DropdownMenu,
  formatTime,
  Icon,
  Pressable,
  Select,
  StaticChip,
  StatusText,
} from "@blinq-scribe/ui";
import { ReadAloud } from "../../components/ReadAloud";
import { useCached } from "../record/useCached";
import { useShallow } from "zustand/react/shallow";

const TWO_YEARS = 730 * 86_400_000;

/** "Yesterday", "Today" or "Aug 31": the day a fact is from, for the timeline's date column. */
function dayLabel(date: string, t: (k: "day.today" | "day.yesterday") => string): string {
  const today = ymd(new Date());
  const yesterday = ymd(new Date(Date.now() - 86_400_000));
  if (date === today) return t("day.today");
  if (date === yesterday) return t("day.yesterday");
  const d = new Date(`${date}T00:00:00`);
  return d.getFullYear() === new Date().getFullYear() ? monthDay(date) : fmtDate(date);
}

/** Who said a kept detail, by first name: "Jordan Lee · Owner" is Jordan. */
const firstNameOf = (saidBy: string | null | undefined, fallback: string): string => {
  const name = (saidBy || "").split("·")[0]?.trim() ?? "";
  return (/^owner$/i.test(name) ? "" : name.split(/\s+/)[0]) || fallback;
};

/**
 * One dated fact: the owner's text, the last plan as checkboxes, or an older visit. A ticked line is
 * asked to cover today: kept with the visit on the server, so the draft can say if the visit didn't.
 */
function Entry({ e, appt }: { e: WalkInEntry; appt: Appointment }) {
  const { t } = useTranslation();
  const [checked, setChecked] = useState<Record<number, boolean>>(() =>
    Object.fromEntries(e.items.map((item, i) => [i, !!item.checked])),
  );
  const [status, setStatus] = useState("");
  // One save at a time, in order, so the last tick is the one kept.
  const saving = useRef<Promise<unknown>>(Promise.resolve());
  const tick = (i: number, on: boolean) => {
    const next = { ...checked, [i]: on };
    setChecked(next);
    setStatus("");
    const here = onScreen();
    const lines = e.items.filter((_, j) => next[j]).map((item) => item.text);
    saving.current = saving.current
      .then(() => api.setPlanChecks(appt.id, appt.patient.id, lines))
      .catch((err: unknown) => {
        if (here()) setStatus(t("before.ticksNotSaved", { message: err instanceof Error ? err.message : String(err) }));
      });
  };
  return (
    <li className="walk-entry">
      <span className="walk-date">{dayLabel(e.date, t)}</span>
      <span className="walk-dot" aria-hidden="true" />
      <div className="flex min-w-0 flex-col gap-2">
        {e.kind === "message" ? (
          <p className="text-body">{t("before.texted", { who: e.who || appt.client.first_name, text: e.text })}</p>
        ) : e.kind === "plan" ? (
          <>
            <p className="text-body-strong">
              {e.mine ? t("before.yourLastPlan") : t("before.theirLastPlan", { who: e.who })}
            </p>
            <p className="text-meta">{t("before.ticksHelp")}</p>
            <ul className="walk-plan">
              {e.items.map((item, i) => (
                <li key={i}>
                  <div className="flex items-start gap-3">
                    {/* As tall as the first line, so the box centers on it whatever the font size. */}
                    <span className="flex h-[1lh] flex-none items-center text-body">
                      <Checkbox
                        checked={!!checked[i]}
                        onCheckedChange={(v) => tick(i, v === true)}
                        aria-label={t("before.planItem", { text: item.text })}
                      />
                    </span>
                    {/* The text ticks the box too, without moving focus, so a click never draws the
                        keyboard ring around it. Keyboard users tab to the box itself. */}
                    <span className="flex min-w-0 cursor-pointer flex-col gap-1" onClick={() => tick(i, !checked[i])}>
                      <span className="text-body">{item.text}</span>
                      {item.status && (
                        <span className="walk-status text-body-strong">
                          <Icon name="event_busy" size={16} />
                          {item.status}
                        </span>
                      )}
                      {item.note && <span className="text-meta">{item.note}</span>}
                    </span>
                  </div>
                </li>
              ))}
            </ul>
            <StatusText>{status}</StatusText>
          </>
        ) : (
          <p className="text-body">
            {e.text}
            {e.who && !e.mine && <span className="text-meta"> {e.who}</span>}
          </p>
        )}
      </div>
    </li>
  );
}

/**
 * Before you walk in: dated facts, newest first, from the PIMS and the owner's texts. The owner's
 * latest message, the last plan in the provider's own words (plain words, as checkboxes, with what the
 * record says about each line), older visits about the same problem, and care that can be done today.
 * It never interprets and never suggests. What the provider kept to remember comes last. Read aloud
 * says all of it.
 */
export function WalkIn({ appt, card }: { appt: Appointment; card: PreRoomCard }) {
  const { t } = useTranslation();
  const entries = card.walk_in ?? [];
  const soon = card.can_do_today ?? [];
  const remember = card.remember_items ?? []; // card.remember is the iPhone's display strings
  const owner = appt.client.first_name || t("followup.theOwner");
  if (!entries.length && !soon.length && !remember.length) return null;
  return (
    <section className="walk-in" aria-labelledby="walkInTitle">
      <div className="between">
        <h2 id="walkInTitle">
          <AiLabel>{t("before.walkIn")}</AiLabel>
        </h2>
        <span className="row nowrap">
          <span className="text-meta">{t("before.fromPims")}</span>
          <ReadAloud id="walkIn" text={card.spoken} iconOnly />
        </span>
      </div>
      {entries.length > 0 && (
        <ol className="walk-timeline" aria-label={t("before.timeline")}>
          {entries.map((e, i) => (
            <Entry key={`${e.date}-${i}`} e={e} appt={appt} />
          ))}
        </ol>
      )}
      {soon.length > 0 && <p className="text-body">{t("before.canDoToday", { items: soon.join(", ") })}</p>}
      {remember.length > 0 && (
        <div className="walk-in-remember divided">
          {remember.map((r) => (
            <p key={r.id} className="remember-line">
              <span className="text-meta">{t("before.remember")}</span>
              <span className="min-w-0 flex-1">
                {t("before.rememberSaid", { who: firstNameOf(r.said_by, owner), text: r.text })}
              </span>
              <span className="text-meta">
                {[t("before.staffOnly"), r.said_at ? t("before.saidOn", { date: monthDay(r.said_at) }) : ""]
                  .filter(Boolean)
                  .join(" · ")}
              </span>
            </p>
          ))}
        </div>
      )}
    </section>
  );
}

/** Why another of the owner's pets might come along today, only from what's on record. */
function petReason(pet: Profile["other_pets"][number], appts: Appointment[], appt: Appointment, t: TFunction): string {
  const today = appts.find((a) => a.patient.id === pet.id && a.id !== appt.id);
  if (today) return t("before.visitTodayAt", { time: formatTime(today.start) });
  const now = ymd(new Date());
  for (const d of pet.due ?? []) {
    const m = /^(.*) due (\d{4}-\d{2}-\d{2})/.exec(d);
    if (m && (m[2] ?? "") < now) return t("before.overdueWhat", { what: (m[1] ?? "").toLowerCase() });
  }
  return "";
}

/**
 * Pets in this visit: the ones picked, the owner's pets with a reason to come along as chips, and the
 * rest in a menu. Each pet shows once: the menu never repeats a chip, so with chips it says "2 more
 * pets"; without, "Add a pet from Jordan's household (4)".
 */
export function Pets({ appt, profile }: { appt: Appointment; profile: Profile | null | false }) {
  const { t } = useTranslation();
  const { noteTypes, noteTypeBy, visitPetsBy, appts } = useApp(
    useShallow((s) => ({
      noteTypes: s.noteTypes,
      noteTypeBy: s.noteTypeBy,
      visitPetsBy: s.visitPetsBy,
      appts: s.appts,
    })),
  );
  const noteType = noteTypeBy[appt.id] || appt.note_type || "sick";
  const picked = visitPetsBy[appt.id] ?? [{ id: appt.patient.id, name: appt.patient.name }];
  const others = (profile ? profile.other_pets : []).filter((p) => !picked.some((x) => x.id === p.id));
  const why = new Map(others.map((p) => [p.id, petReason(p, appts, appt, t)]));
  const promoted = others.filter((p) => why.get(p.id));
  const rest = others.filter((p) => !why.get(p.id));
  const add = (p: { id: string; name: string }) =>
    useApp
      .getState()
      .addPetToVisit(appt.id, { id: p.id, name: p.name }, { id: appt.patient.id, name: appt.patient.name });
  const owner = [appt.client.first_name, appt.client.last_name].filter(Boolean).join(" ");
  return (
    <section className="visit-pets" aria-labelledby="petsLabel">
      <h2 id="petsLabel" className="text-meta">
        {t("before.petsShort")}
      </h2>
      <div className="row min-w-0 flex-[1_1_280px]" role="group" aria-labelledby="petsLabel">
        {picked.map((p, i) =>
          i === 0 ? (
            <StaticChip key={p.id} icon="check">
              {p.name}
            </StaticChip>
          ) : (
            <Chip
              key={p.id}
              selected
              icon="check"
              aria-label={t("before.removePet", { name: p.name })}
              onClick={() => useApp.getState().removePetFromVisit(appt.id, p.id)}
            >
              {p.name}
              <Icon name="close" size={16} />
            </Chip>
          ),
        )}
        {promoted.map((p) => (
          <Chip key={p.id} dashed icon="add" onClick={() => add(p)}>
            {p.name}
            <span className="text-meta">· {why.get(p.id)}</span>
          </Chip>
        ))}
        {rest.length > 0 && (
          <DropdownMenu.Root>
            <DropdownMenu.Trigger asChild>
              <Pressable className="add-pet">
                <Icon name="add" size={16} />
                {promoted.length > 0 ? (
                  t("before.morePets", { count: rest.length })
                ) : (
                  <>
                    {t("before.addPet", { whose: possessive(appt.client.first_name || owner) })}
                    <span className="font-num text-text-secondary">
                      {t("before.addPetCount", { count: rest.length })}
                    </span>
                  </>
                )}
                <Icon name="expand_more" size={16} className="text-text-secondary" />
              </Pressable>
            </DropdownMenu.Trigger>
            <DropdownMenu.Content align="start">
              {rest.map((p) => (
                <DropdownMenu.Item key={p.id} icon="add" onSelect={() => add(p)}>
                  {p.name}
                </DropdownMenu.Item>
              ))}
            </DropdownMenu.Content>
          </DropdownMenu.Root>
        )}
      </div>
      <Select
        size="sm"
        className="w-auto max-w-[220px]"
        aria-label={t("before.noteType")}
        leading={<Icon name="description" className="text-text-secondary" />}
        value={noteType}
        onValueChange={(v) => useApp.setState({ noteTypeBy: { ...useApp.getState().noteTypeBy, [appt.id]: v } })}
        options={noteTypes.map((nt) => ({ value: nt.id, label: nt.name }))}
      />
    </section>
  );
}

/** One previous note as one line: "Aug 31, 2026 · Itchy face · Suspect environmental allergy · Apoquel". */
function oneLine(v: PastVisit): string {
  const drug = v.medications.map((m) => plainWords(m).split(/\s+\d/)[0] ?? "").filter(Boolean);
  return [v.reason, v.summary.replace(/\.$/, ""), ...drug].filter(Boolean).join(" · ");
}

/** Previous notes from the last 24 months, collapsed to one line each; each opens to the note. */
function PreviousNotes({ appt }: { appt: Appointment }) {
  const { t } = useTranslation();
  const [rows] = useCached(`${appt.patient.id}|${appt.id}`, () => api.patientVisits(appt.patient.id, appt.id));
  const [open, setOpen] = useState<string>("");
  const since = Date.now() - TWO_YEARS;
  const day = ymd(new Date(appt.start));
  const list = Array.isArray(rows)
    ? rows.filter((v) => new Date(v.date).getTime() >= since && String(v.date).slice(0, 10) < day)
    : [];
  return (
    <section className="prev-notes" aria-labelledby="prevNotesTitle">
      <div className="flex items-baseline gap-3">
        <h2 id="prevNotesTitle" className="text-section">
          {t("before.previousNotes")}
        </h2>
        <span className="text-meta">{t("before.lastDays")}</span>
      </div>
      {rows !== null && !list.length && <p className="text-meta">{t("before.noPreviousNotes")}</p>}
      {list.map((v) => (
        <div key={v.id} className="prev-note">
          <Pressable
            className="prev-note-row"
            aria-expanded={open === v.id}
            onClick={() => setOpen(open === v.id ? "" : v.id)}
          >
            <span className="font-num whitespace-nowrap">{fmtDate(v.date)}</span>
            <span className="min-w-0 flex-1 truncate">{oneLine(v)}</span>
            <span className="text-meta whitespace-nowrap">{v.provider_name}</span>
            <Icon name={open === v.id ? "expand_less" : "expand_more"} className="text-text-secondary" />
          </Pressable>
          {open === v.id && (
            <div className="pb-3">
              {v.note || v.sections?.length ? (
                <NoteSections sections={v.sections} raw={v.note} />
              ) : (
                <p className="text-body">{v.summary}</p>
              )}
            </div>
          )}
        </div>
      ))}
    </section>
  );
}

export function BeforeVisit({
  appt,
  card,
  profile,
  onStarted,
}: {
  appt: Appointment;
  card: PreRoomCard | null;
  profile: Profile | null | false;
  onStarted: (e: Encounter) => void;
}) {
  const { noteTypes, noteTypeBy, visitPetsBy } = useApp(
    useShallow((s) => ({ noteTypes: s.noteTypes, noteTypeBy: s.noteTypeBy, visitPetsBy: s.visitPetsBy })),
  );
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("");
  const noteType = noteTypeBy[appt.id] || appt.note_type || "sick";
  const picked = visitPetsBy[appt.id] ?? [{ id: appt.patient.id, name: appt.patient.name }];
  useEffect(() => {
    void useApp.getState().loadNoteTypes();
  }, []);

  const canStart = !appt.can || appt.can.start;
  const typeName = noteTypes.find((n) => n.id === noteType)?.name ?? "";

  // Opens the visit; Start recording then asks whether the owner agreed, and saves it with the visit.
  const start = async () => {
    const here = onScreen();
    setBusy(true);
    setStatus("");
    try {
      const started = await api.startVisit(appt.id, { patient_ids: picked.map((p) => p.id), note_type: noteType });
      if (here()) onStarted(started);
    } catch (err) {
      if (here()) {
        setStatus(err instanceof Error ? err.message : String(err));
        setBusy(false);
      }
    }
  };

  return (
    <>
      <VisitHeader appt={appt} current={null} state={<ArrivalState appt={appt} />} step="record" />
      <VisitPanel>
        {card && <WalkIn appt={appt} card={card} />}
        {!canStart ? <VisitLocked appt={appt} /> : <Pets appt={appt} profile={profile} />}
        <PreviousNotes appt={appt} />
        <StatusText>{status}</StatusText>
      </VisitPanel>
      {canStart && (
        <StartVisitBar
          appt={appt}
          busy={busy}
          onStart={() => void start()}
          status={[picked.length > 1 ? picked.map((p) => p.name).join(", ") : "", typeName, appt.room]
            .filter(Boolean)
            .join(" · ")}
          error={status}
        />
      )}
    </>
  );
}
