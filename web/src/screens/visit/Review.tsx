import { useCallback, useEffect, useRef, useState } from "react";
import { useLocation, useNavigate, useSearchParams } from "react-router";
import { useTranslation } from "react-i18next";
import type { TFunction } from "i18next";
import { api } from "../../api";
import type {
  Appointment,
  Encounter,
  PlanReminder,
  Profile,
  PreRoomCard,
  RememberSuggestions,
  SectionKey,
  Segment,
  SoapNote,
  Template,
  VoiceProfile,
} from "../../api/types";
import { sectionsFor, useApp } from "../../state/app";
import { onScreen } from "../../state/nav";
import { visitPath } from "../../state/open";
import { keepDraft, keepPlace, readDraft, readPlace } from "../../state/visitMemory";
import { useRecorder, waitForUploads } from "../../recorder/store";
import { FollowUpCard } from "./FollowUpCard";
import { PlanReminderItem, RichText, SectionEditor, SectionView, TimeChip } from "./NoteEditor";
import { lineId } from "../../lib/speakers";
import { CONFIRM, appendLine, confirmMark, isValue, petChoices, takeMarkedLine } from "./confirm";
import { PetTabs, RoomLine } from "./household";
import { confirmsInNote, petSteps, type PetStep } from "./householdSteps";
import { SignNotesDialog } from "../Notes";
import { useGroup } from "./useGroup";
import { NOTE_END, useNoteSeen } from "./useNoteSeen";
import { PhotosCard, StateLine, TranscriptCard, VisitHeader, VoiceLine } from "./parts";
import { VisitPanel } from "./visitTabs";
import { useCapture } from "./useCapture";
import { SignConfirm, type SignMode } from "./SignConfirm";

import { andList, clip, duration, messageWhen, monthDay } from "../../lib/format";
import {
  ActionBar,
  AiLabel,
  Alert,
  Button,
  Card,
  CheckboxField,
  Icon,
  MainAction,
  Select,
  StatusText,
  Tag,
  TextArea,
  ToolButton,
  formatTime,
} from "@blinq-scribe/ui";
import { shownAt } from "../../lib/demoTime";

/** Where the draft's autosave stands, for the banner's state line. */
type SaveState =
  { kind: "idle" } | { kind: "saving" } | { kind: "saved"; at: string } | { kind: "failed"; message: string };

/**
 * Autosave: every edit is saved a moment after the vet stops typing, and before anything that needs it.
 * Until the server has it, the edit is also kept in this browser, so a reload, a crash or signing back
 * in brings it back (review principle 16).
 */
function useAutosave(
  current: Encounter,
  note: React.RefObject<SoapNote>,
  setCurrent: (e: Encounter) => void,
  server: React.RefObject<string>,
) {
  const [saved, setSaved] = useState<SaveState>({ kind: "idle" });
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const saving = useRef<Promise<void>>(Promise.resolve());
  const id = current.id;

  const flush = useCallback((): Promise<void> => {
    if (!timer.current) return saving.current;
    clearTimeout(timer.current);
    timer.current = null;
    const body = { ...note.current };
    const here = onScreen();
    saving.current = saving.current
      .then(() => api.saveNote(id, body))
      .then((res) => {
        server.current = JSON.stringify(body);
        // Saved: nothing of this edit is left only in the browser.
        if (JSON.stringify(note.current) === server.current) {
          const kept = readDraft(id);
          keepDraft(id, kept?.summaryPlan != null ? { summaryPlan: kept.summaryPlan } : null);
        }
        // Keep anything typed while the save was on its way: the local note wins.
        if (here()) {
          setCurrent({ ...res, note: { ...note.current } });
          setSaved({ kind: "saved", at: new Date().toISOString() });
        }
      })
      .catch((err: unknown) => {
        if (here()) setSaved({ kind: "failed", message: err instanceof Error ? err.message : String(err) });
      });
    return saving.current;
  }, [id, note, setCurrent, server]);

  const queue = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    setSaved({ kind: "saving" });
    keepDraft(id, { ...readDraft(id), note: { ...note.current }, base: server.current });
    timer.current = setTimeout(() => void flush(), 800);
  }, [flush, id, note, server]);

  // Leaving the screen saves what's pending; the save still lands for this visit.
  useEffect(
    () => () => {
      void flush();
    },
    [flush],
  );
  const cancel = () => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    return saving.current;
  };
  return { saved, queue, flush, cancel };
}

/** The draft's state, once, as the banner's gray line: Draft saved 9:26 AM. A failed save is red. */
function DraftState({ saved }: { saved: SaveState }) {
  const { t } = useTranslation();
  return (
    <span role="status">
      {saved.kind === "saved" ? (
        <StateLine>{t("visit.stateDraftSaved", { time: formatTime(shownAt(saved.at)) })}</StateLine>
      ) : saved.kind === "saving" ? (
        <StateLine>{t("visit.stateDraftSaving")}</StateLine>
      ) : saved.kind === "failed" ? (
        <StateLine className="tone-error">{t("visit.stateDraftNotSaved", { message: saved.message })}</StateLine>
      ) : null}
    </span>
  );
}

const VITAL_KEYS = ["weight", "temperature", "heart_rate", "respiratory_rate", "body_condition_score"] as const;
const vitalLabel = (k: string, t: TFunction): string =>
  (VITAL_KEYS as readonly string[]).includes(k)
    ? t(`review.vitalLabels.${k as (typeof VITAL_KEYS)[number]}`)
    : k.replace(/_/g, " ");

/** The first transcript line that says this value's numbers: where a vital came from. */
function vitalSource(value: string, segments: Segment[] | undefined): number | null {
  const nums = String(value).match(/\d+(?:\.\d+)?/g);
  if (!nums || !segments?.length) return null;
  const hit = segments.find((s) =>
    nums.every((n) => new RegExp(`(?<![\\d.])${n.replace(".", "\\.")}(?![\\d])`).test(s.text)),
  );
  return hit ? hit.line : null;
}

/** Vitals on one line, each with its value, and one source chip for where they were said. */
function VitalsLine({
  vitals,
  by = "",
  segments,
  onJump,
  onConfirm,
  onEdit,
}: {
  vitals: Record<string, string>;
  /** Who said them, when a tech did: "tech Priya", from the draft. */
  by?: string;
  segments?: Segment[];
  onJump: (line: number) => void;
  onConfirm: (key: string) => void;
  onEdit: () => void;
}) {
  const { t } = useTranslation();
  const entries = Object.entries(vitals || {});
  if (!entries.length) return null;
  const lines = entries.map(([, v]) => vitalSource(v, segments)).filter((x): x is number => x != null);
  const first = lines.length ? Math.min(...lines) : null;
  // Credit the tech who said them: the draft says so, or the line they came from is a tech's.
  const said = first != null ? segments?.find((s) => s.line === first) : undefined;
  const named =
    said?.speaker_name && !/^(speaker|tech|technician)\b/i.test(said.speaker_name)
      ? said.speaker_name.split(/\s+/)[0]
      : "";
  const credit = by || (said?.role === "tech" ? (named ? `tech ${named}` : t("review.theTech")) : "");
  return (
    <section className="note-sec vitals-line" id="sec-vitals" aria-label={t("review.vitals")}>
      <h3 className="sec-title">{t("review.vitals")}</h3>
      <div className="flex min-w-0 flex-1 flex-wrap items-center gap-x-6 gap-y-2">
        {entries.map(([k, v]) => {
          const m = /^\s*\[confirm:?\s*([^\]]*)\]\s*$/i.exec(String(v));
          return (
            <span key={k} className="inline-flex items-baseline gap-2">
              <span className="text-meta">{vitalLabel(k, t)}</span>
              {m ? (
                <span className="confirm-item inline">
                  <RichText text={String(v)} />
                  <Button
                    size="sm"
                    aria-label={t("review.confirmItLabel", { what: vitalLabel(k, t) })}
                    onClick={() => onConfirm(k)}
                  >
                    {t("review.confirmIt")}
                  </Button>
                  <Button size="sm" aria-label={t("review.editItLabel", { what: vitalLabel(k, t) })} onClick={onEdit}>
                    {t("review.editIt")}
                  </Button>
                </span>
              ) : (
                <span className="text-body-strong font-num">{v}</span>
              )}
            </span>
          );
        })}
      </div>
      {(first != null || credit) && (
        <span className="ms-auto flex items-center gap-2">
          {credit && <span className="text-meta">{t("review.vitalsBy", { who: credit })}</span>}
          {first != null && <TimeChip line={first} segments={segments} onJump={onJump} />}
        </span>
      )}
    </section>
  );
}

/** The things to confirm, in the order the note reads: where each is, and what the button says. */
interface ToConfirm {
  /** A vital's key, or a section's key with the mark's number in it. */
  where: { vital: string } | { section: SectionKey; n: number };
  /** "Plan", "Vitals". */
  label: string;
  /** "Fill in drug and dosing", "Confirm weight". */
  action: string;
}

function toConfirmList(note: SoapNote, sections: { key: SectionKey; label: string }[], t: TFunction): ToConfirm[] {
  const out: ToConfirm[] = [];
  for (const [k, v] of Object.entries(note.vitals || {})) {
    if (/\[confirm/i.test(String(v)))
      out.push({
        where: { vital: k },
        label: t("review.vitals"),
        action: t("review.confirmWhat", { what: vitalLabel(k, t).toLowerCase() }),
      });
  }
  for (const s of sections) {
    let n = 0;
    for (const m of String(note[s.key] || "").matchAll(new RegExp(CONFIRM.source, "gi"))) {
      const what = clip((m[1] ?? "").trim(), 32) || s.label.toLowerCase();
      out.push({
        where: { section: s.key, n },
        label: s.label,
        action: petChoices(what)
          ? t("review.confirmPet")
          : isValue(what)
            ? t("review.confirmWhat", { what })
            : t("review.fillIn", { what }),
      });
      n++;
    }
  }
  return out;
}

/**
 * Beside the note: Before you walk in in short (the last plan and what the record says about it), the
 * owner's latest message, and the transcript in one line, with any speaker still to name.
 */
function ReviewAside({
  card,
  e,
  appt,
  onTranscript,
}: {
  card: PreRoomCard | null;
  e: Encounter;
  appt: Appointment;
  onTranscript: () => void;
}) {
  const { t } = useTranslation();
  const plan = card?.walk_in?.find((x) => x.kind === "plan" || x.kind === "visit");
  const msg = card?.owner_message;
  const segments = e.segments ?? [];
  const speakers = new Set(segments.map((s) => s.speaker_id).filter(Boolean)).size;
  const unnamed = segments.find((s) => s.role === "unknown" && s.speaker_id.startsWith("speaker-"));
  return (
    <aside className="review-aside" aria-label={t("review.aside")}>
      {plan && (
        <section>
          <h3 className="aside-title">{t("before.walkIn")}</h3>
          <p className="text-body-strong">
            {[monthDay(plan.date), plan.text.split(".")[0]?.toLowerCase()].filter(Boolean).join(" · ")}
          </p>
          {plan.items.map((i) => (
            <p key={i.text} className="text-body">
              {i.text}
              {i.status && <span className="block text-meta text-text">{i.status}</span>}
              {i.checked && <span className="block text-meta">{t("review.askedToday")}</span>}
            </p>
          ))}
        </section>
      )}
      {msg && (
        <section>
          <h3 className="aside-title">
            {t("review.ownerSaid", { who: msg.who || appt.client.first_name, time: messageWhen(msg.at) })}
          </h3>
          <p className="aside-quote">{msg.text}</p>
        </section>
      )}
      {(e.audio_seconds || segments.length > 0) && (
        <section>
          <h3 className="aside-title">{t("review.transcriptMeta")}</h3>
          <p className="text-body">
            {e.audio_seconds
              ? t("review.recordedSpeakers", {
                  length: duration(e.audio_seconds),
                  speakers: t("count.speaker", { count: speakers }),
                })
              : t("count.speaker", { count: speakers })}
          </p>
          {unnamed && (
            <p className="text-body">
              {t("review.unnamedSpeaker", { speaker: unnamed.speaker_name })}{" "}
              <Button variant="link" className="h-auto px-0 underline" onClick={onTranscript}>
                {t("review.nameThem")}
              </Button>
            </p>
          )}
        </section>
      )}
    </aside>
  );
}

export function Review({
  appt,
  current,
  setCurrent,
  voice,
  onRedraft,
  status: drafted,
  card,
  profile = null,
}: {
  appt: Appointment;
  current: Encounter;
  setCurrent: (e: Encounter) => void;
  voice: VoiceProfile | null;
  onRedraft: (transcript: string) => void;
  status: string;
  card: PreRoomCard | null;
  /** The owner's record, for the other pets a household visit can add. */
  profile?: Profile | null | false;
}) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const me = useApp((s) => s.me);
  const noteTypes = useApp((s) => s.noteTypes);
  // Opened for one follow up (from the brief or To do): scroll to it.
  const focusFollowup = useSearchParams()[0].get("f") ?? "";
  useEffect(() => {
    if (!focusFollowup) return;
    const id = requestAnimationFrame(() =>
      document.getElementById(`fu-${focusFollowup}`)?.scrollIntoView({ behavior: "smooth", block: "start" }),
    );
    return () => cancelAnimationFrame(id);
  }, [focusFollowup]);
  const e = current;
  // The server's note, as last known; edits kept in this browser come back only over that same note.
  const server = useRef(JSON.stringify(e.note));
  const [restored] = useState(() => {
    const kept = readDraft(e.id);
    return kept?.note && kept.base === server.current && JSON.stringify(kept.note) !== server.current
      ? kept.note
      : null;
  });
  const [note, setNoteState] = useState<SoapNote>(restored ?? (e.note as SoapNote));
  const noteRef = useRef<SoapNote>(note);
  // One section open at a time; the medications list edits as one line each. A reload opens it again.
  const [editing, setEditingState] = useState<SectionKey | "medications" | null>(
    () => (readPlace(appt.id)?.editing as SectionKey | "medications" | "") || null,
  );
  const editingRef = useRef<SectionKey | "medications" | null>(editing);
  const [focusMark, setFocusMark] = useState<number | undefined>(undefined);
  const setEditing = (k: SectionKey | "medications" | null) => {
    editingRef.current = k;
    setEditingState(k);
    keepPlace(appt.id, { editing: k ?? "" });
  };
  // An edit tool's answer only lands in the section still open, on the screen it was asked from.
  const staleFor = (k: SectionKey) => {
    const here = onScreen();
    return () => !here() || editingRef.current !== k;
  };
  const [status, setStatus] = useState(drafted);
  const [signing, setSigning] = useState(false);
  const [typeBusy, setTypeBusy] = useState(false);
  const [signer, setSigner] = useState(appt.provider_name);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [groupVersion, setGroupVersion] = useState(0);
  const group = useGroup(e, groupVersion);
  // A household visit: one note per pet, from one recording for the room.
  const household = group.length > 1;
  const [whole, setWhole] = useState(false);
  const [reviewed, setReviewed] = useState<string[]>(() => readPlace(appt.id)?.reviewed ?? []);
  const severalPets = e.patient_ids.length > 1 || (!!e.group_id && e.group_id !== e.id);
  // The pet tab on screen comes back after a reload.
  useEffect(() => {
    if (severalPets) keepPlace(appt.id, { encounter: e.id });
  }, [appt.id, e.id, severalPets]);
  // Opening a pet's note isn't reviewing it: the provider saw all of it (its end in view, or every section),
  // or pressed the green action on its tab once its end was in view. Kept for this visit page.
  const markReviewed = useCallback(() => {
    const seen = [...new Set([...(readPlace(appt.id)?.reviewed ?? []), e.id])];
    keepPlace(appt.id, { reviewed: seen });
    setReviewed(seen);
  }, [appt.id, e.id]);
  const watch = useNoteSeen(severalPets && !reviewed.includes(e.id), e.id, markReviewed);
  // Come from another pet's "Review Kiwi": this note opens at its first part not seen yet.
  const arrived = (useLocation().state as { review?: boolean } | null)?.review === true;
  useEffect(() => {
    if (!arrived) return;
    const id = requestAnimationFrame(() => goUnseen());
    return () => cancelAnimationFrame(id);
  }, [arrived, e.id]); // eslint-disable-line react-hooks/exhaustive-deps
  const save = useAutosave(e, noteRef, setCurrent, server);
  const cap = useCapture(appt, e, setCurrent, setStatus);
  const locked = e.followups.some((f) => f.status === "approved");
  const { body, owner } = sectionsFor(noteTypes, e.note_type);
  const all = [...body, owner];

  // Unsaved edits that came back after a reload go to the server.
  useEffect(() => {
    if (restored) save.queue();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // A new draft or note type replaces the note on screen; the note it already shows doesn't.
  useEffect(() => {
    if (!e.note) return;
    const now = JSON.stringify(e.note);
    if (now === server.current) return;
    server.current = now;
    if (now !== JSON.stringify(noteRef.current) && !editingRef.current) {
      noteRef.current = e.note;
      setNoteState(e.note);
    }
  }, [e.note]);

  useEffect(() => {
    void useApp.getState().loadNoteTypes();
  }, []);
  useEffect(() => {
    const here = onScreen();
    api
      .templates(e.note_type)
      .then((l) => {
        if (here()) setTemplates(Array.isArray(l) ? l : []);
      })
      .catch(() => undefined);
  }, [e.note_type]);

  // "For the owner" was written from a Plan: when Plan changes after, say so.
  const [summaryPlan, setSummaryPlan] = useState(() => {
    const kept = readDraft(e.id)?.summaryPlan;
    if (kept != null) return kept;
    keepDraft(e.id, { ...readDraft(e.id), summaryPlan: note.plan });
    return note.plan;
  });
  const keepSummaryPlan = (plan: string) => {
    setSummaryPlan(plan);
    keepDraft(e.id, { ...readDraft(e.id), summaryPlan: plan });
  };
  const flat = (x: string) => x.replace(/\s+/g, " ").trim();
  const outOfSync = !!note.client_summary.trim() && flat(note.plan) !== flat(summaryPlan);

  const setSection = (k: SectionKey, v: string) => {
    noteRef.current = { ...noteRef.current, [k]: v };
    setNoteState(noteRef.current);
    // The owner's text, edited or redone, now goes with the Plan as it is.
    if (k === owner.key) keepSummaryPlan(noteRef.current.plan);
    save.queue();
  };
  const closeEditor = () => {
    const k = editing;
    if (k === "medications") {
      noteRef.current = {
        ...noteRef.current,
        medications: noteRef.current.medications.map((m) => m.trim()).filter(Boolean),
      };
      setNoteState(noteRef.current);
      save.queue();
    }
    void save.flush();
    setEditing(null);
    setFocusMark(undefined);
    requestAnimationFrame(() => (document.querySelector(`[data-edit="${k}"]`) as HTMLElement | null)?.focus());
  };

  const [spanish, setSpanish] = useState(false);
  const [updateAsk, setUpdateAsk] = useState("");
  /** Open one section to edit (the one open closes first); `es` asks Blinq for Spanish as it opens. */
  const openSection = (k: SectionKey | "medications", es = false, mark?: number) => {
    void save.flush();
    setSpanish(es);
    setUpdateAsk("");
    setFocusMark(mark);
    setEditing(k);
  };
  // Tab in an editor moves on, in the order the note reads.
  const order: (SectionKey | "medications")[] = [
    ...body.map((s) => s.key),
    ...(note.medications.length ? (["medications"] as const) : []),
    owner.key,
  ];
  const openNext = (k: SectionKey | "medications") => {
    const next = order[order.indexOf(k) + 1];
    if (next) openSection(next);
    else closeEditor();
  };
  const setMeds = (text: string) => {
    noteRef.current = { ...noteRef.current, medications: text.split("\n") };
    setNoteState(noteRef.current);
    save.queue();
  };
  /** Confirm the nth mark of a section, at its field. */
  const confirmIn = (k: SectionKey, n: number) => setSection(k, confirmMark(String(noteRef.current[k] || ""), n));
  const confirmVital = (key: string) => {
    const v = String(noteRef.current.vitals[key] ?? "");
    noteRef.current = { ...noteRef.current, vitals: { ...noteRef.current.vitals, [key]: confirmMark(v, 0) } };
    setNoteState(noteRef.current);
    save.queue();
  };

  /**
   * A line Blinq couldn't place, moved to the pet it is about: off this note (saved as usual) and onto
   * the end of the same section of that pet's note, saved there.
   */
  const moveLine = async (k: SectionKey, n: number, pet: string) => {
    const target = group.find((g) => g.patient_name === pet && g.id !== e.id);
    const taken = takeMarkedLine(String(noteRef.current[k] || ""), n);
    if (!target?.note || !taken) return;
    const here = onScreen();
    try {
      await api.saveNote(target.id, { ...target.note, [k]: appendLine(String(target.note[k] || ""), taken.line) });
      if (!here()) return;
      setSection(k, taken.rest);
      await save.flush();
      setStatus(t("review.moved", { pet }));
      setGroupVersion((v) => v + 1);
    } catch (err) {
      if (here()) setStatus(err instanceof Error ? err.message : String(err));
    }
  };

  /** Another of the owner's pets joins the visit: its tab says Not started until the draft is redone. */
  const addPet = async (p: { id: string; name: string }) => {
    const here = onScreen();
    try {
      await api.addPetToVisit(e.id, p.id);
      if (!here()) return;
      setStatus(t("review.petAdded", { pet: p.name }));
      setGroupVersion((v) => v + 1);
    } catch (err) {
      if (here()) setStatus(err instanceof Error ? err.message : String(err));
    }
  };

  const confirmList = toConfirmList(note, all, t);
  const confirms = confirmList.length;
  const next = confirmList[0];
  // Lines of the last plan the provider asked to cover today that the visit didn't: reminders that step the
  // green action like a thing to confirm, never a block on signing.
  const reminders = (e.plan_reminders ?? []).filter((r) => r.status === "open");
  const planKey: SectionKey | undefined = body.find((s) => s.key === "plan")?.key ?? body[body.length - 1]?.key;
  const [reminding, setReminding] = useState("");
  const remind = async (r: PlanReminder, action: "added" | "dismissed") => {
    const here = onScreen();
    setReminding(r.id);
    try {
      if (action === "added" && planKey) {
        setSection(planKey, appendLine(String(noteRef.current[planKey] || ""), r.text));
        await save.flush();
      }
      const updated = await api.planReminder(e.id, r.id, action);
      if (here()) setCurrent({ ...updated, note: { ...noteRef.current } });
    } catch (err) {
      if (here()) setStatus(err instanceof Error ? err.message : String(err));
    }
    if (here()) setReminding("");
  };
  /** The green action's step for the reminders: the first one in view and focused. */
  const goReminder = () => {
    const item = document.querySelector<HTMLElement>("[data-plan-reminder]");
    if (!item) return;
    item.scrollIntoView({ behavior: "smooth", block: "center" });
    item.querySelector<HTMLElement>("button")?.focus({ preventScroll: true });
    item.classList.add("flash");
    setTimeout(() => item.classList.remove("flash"), 1600);
  };
  const remindersView = reminders.length > 0 && (
    <div className="flex flex-col gap-2" aria-label={t("review.planNotCoveredTitle")} role="group">
      {reminders.map((r) => (
        <PlanReminderItem
          key={r.id}
          text={r.text}
          busy={reminding === r.id}
          onAdd={() => void remind(r, "added")}
          onDismiss={() => void remind(r, "dismissed")}
        />
      ))}
    </div>
  );
  /** Review the note on screen: its first part not seen yet; with its end in view, it is reviewed. */
  const goUnseen = () => {
    if (watch.endInView()) return markReviewed();
    const part = watch.firstUnseen() ?? document.getElementById(NOTE_END);
    part?.scrollIntoView({ behavior: "smooth", block: "start" });
  };
  // A household: the one green action steps across the pets' notes (D1).
  const steps: PetStep[] = household
    ? petSteps(
        group.map((g) => ({
          id: g.id,
          pet: g.patient_name || t("review.pet"),
          signed: g.status === "signed",
          confirms: g.id === e.id ? confirms : confirmsInNote(g.note),
          reminders: (g.id === e.id ? e : g).plan_reminders?.filter((r) => r.status === "open").length ?? 0,
          reviewed: reviewed.includes(g.id),
        })),
        e.id,
      )
    : [];
  const step = steps[0];
  const [signingAll, setSigningAll] = useState<string[] | null>(null);
  const doStep = () => {
    if (!step) return;
    if (step.kind === "confirm") return goConfirm();
    if (step.kind === "plan") return goReminder();
    if (step.kind === "review" && step.here) return goUnseen();
    if (step.kind === "review") return void navigate(visitPath(appt, step.id), { state: { review: true } });
    // Every note left, in one go; only this note left signs as usual.
    if (step.ids.length === 1 && step.ids[0] === e.id) return void openConfirm("send");
    void save.flush().then(() => setSigningAll(step.ids));
  };
  const stepLabel = (s: PetStep): string =>
    s.kind === "confirm"
      ? t("review.confirmPetNote", { pet: s.pet })
      : s.kind === "plan"
        ? t("review.checkPlanLines", { count: s.count })
        : s.kind === "review"
          ? t("review.reviewPet", { pet: s.pet })
          : s.count > 1
            ? t("review.signNotes", { count: s.count })
            : t("review.signAndSend");
  // "Then: Review Kiwi and Mochi, sign 3 notes".
  const thenSteps = (rest: PetStep[]): string => {
    // The note on screen is this page: only the other pets are named.
    const reviews = rest.filter((s): s is Extract<PetStep, { kind: "review" }> => s.kind === "review" && !s.here);
    const sign = rest.find((s): s is Extract<PetStep, { kind: "sign" }> => s.kind === "sign");
    const parts = [
      reviews.length ? t("review.reviewPet", { pet: andList(reviews.map((r) => r.pet)) }) : "",
      sign ? (sign.count > 1 ? t("review.thenSignNotes", { count: sign.count }) : t("review.thenSignOne")) : "",
    ].filter(Boolean);
    return parts.length ? parts.join(", ").replace(/^./, (c) => c.toUpperCase()) : "";
  };
  // The primary does the named step: here, go to the first thing to confirm, in view and focused.
  const goConfirm = () => {
    if (!next) return;
    const id = "vital" in next.where ? "sec-vitals" : `sec-${next.where.section}`;
    const sec = document.getElementById(id);
    const marks = sec ? [...sec.querySelectorAll<HTMLElement>("[data-confirm]")] : [];
    const mark = "vital" in next.where ? marks[0] : marks[next.where.n];
    const target = mark ?? sec;
    target?.scrollIntoView({ behavior: "smooth", block: "center" });
    const button = mark?.closest(".confirm-item")?.querySelector<HTMLElement>("button");
    (button ?? target)?.focus({ preventScroll: true });
    mark?.closest(".confirm-item")?.classList.add("flash");
    setTimeout(() => mark?.closest(".confirm-item")?.classList.remove("flash"), 1600);
  };
  // A source's line in the transcript: open Transcript and photos, then that line, at its time.
  const jumpTo = (line: number) => {
    const box = document.getElementById("transcriptPhotos");
    if (box instanceof HTMLDetailsElement) box.open = true;
    requestAnimationFrame(() => {
      const row = document.getElementById(lineId(line));
      if (!row) return;
      row.scrollIntoView({ behavior: "smooth", block: "center" });
      row.focus({ preventScroll: true });
      row.classList.add("flash");
      setTimeout(() => row.classList.remove("flash"), 2000);
    });
  };
  const openTranscript = () => {
    const box = document.getElementById("transcriptPhotos");
    if (box instanceof HTMLDetailsElement) box.open = true;
    box?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const changeType = async (value: string) => {
    const here = onScreen();
    setTypeBusy(true);
    try {
      await save.flush();
      const updated = await api.setNoteType(e.id, value);
      if (!here()) return;
      setCurrent(updated);
    } catch (err) {
      if (here()) setStatus(t("review.noteTypeFailed", { message: err instanceof Error ? err.message : String(err) }));
    }
    if (here()) setTypeBusy(false);
  };

  // Sign and send (the default) or Sign only, each after the confirm panel.
  const [confirming, setConfirming] = useState<SignMode | null>(null);
  // The preview reads the note as saved, so edits still on their way go first.
  const openConfirm = async (mode: SignMode) => {
    await save.flush();
    setConfirming(mode);
  };
  const sign = async (mode: SignMode) => {
    const here = onScreen();
    setSigning(true);
    try {
      useRecorder.getState().stop();
      await waitForUploads();
      await save.cancel();
      if (!here()) return;
      // Sign what the vet sees: save any unsaved edits first, since signing writes the note to the practice records.
      await api.saveNote(e.id, noteRef.current);
      const by = me?.via === "session" ? "" : signer;
      const signed = await api.sign(e.id, by, mode === "send");
      keepDraft(e.id, null);
      keepPlace(appt.id, { editing: "", scroll: 0 });
      useApp.getState().refreshAfter(appt);
      if (here()) {
        setConfirming(null);
        setCurrent(signed);
      }
    } catch (err) {
      if (here()) {
        setStatus(err instanceof Error ? err.message : String(err));
        setSigning(false);
        setConfirming(null);
      }
    }
  };

  // In a group visit, a pet nobody named in the room gets a note of placeholders. Say so plainly.
  const isGroup = group.length > 1 || e.patient_ids.length > 1 || (!!e.group_id && e.group_id !== e.id);
  const placeholders = body.filter((s) => /^\s*(\[confirm[^\]]*\][\s.]*)+$/i.test(note[s.key] || "")).length;
  const unnamed = isGroup && body.length > 0 && placeholders * 2 >= body.length;
  const ownerFirst = appt.client.first_name || t("followup.theOwnerLower");
  const after =
    appt.client.prefers === "email"
      ? t("review.thenShareEmail", { name: ownerFirst })
      : t("review.thenShare", { name: ownerFirst });
  const sectionView = (
    k: SectionKey,
    label: string,
    text: string,
    extra?: React.ReactNode,
    notice?: React.ReactNode,
  ) => (
    <SectionView
      key={k}
      k={k}
      label={label}
      text={text}
      onEdit={() => openSection(k)}
      extra={extra}
      notice={notice}
      after={k === planKey ? remindersView : undefined}
      encounterId={e.id}
      segments={e.segments}
      onJump={jumpTo}
      onConfirm={(n) => confirmIn(k, n)}
      onEditMark={(n) => openSection(k, false, n)}
      pet={household ? e.patient_name : undefined}
      onMove={household ? (n, pet) => void moveLine(k, n, pet) : undefined}
    />
  );

  return (
    <>
      <VisitHeader appt={appt} current={e} state={<DraftState saved={save.saved} />} step="draft" />
      <VisitPanel className="review-panel">
        {household && (
          <div className="flex min-w-0 flex-col">
            <PetTabs
              appt={appt}
              current={e}
              group={group}
              others={(profile ? profile.other_pets : []).filter((p) => !group.some((g) => g.patient_id === p.id))}
              onAdd={(p) => void addPet(p)}
            />
            <RoomLine e={e} whole={whole} onWhole={setWhole} />
          </div>
        )}
        <div className="review-grid">
          <div className="flex min-w-0 flex-col gap-4">
            {unnamed && (
              <Alert tone="ai">
                {t("review.unnamed", {
                  name: e.patient_name || (appt.patient.id === e.patient_id ? appt.patient.name : t("record.thisPet")),
                })}
              </Alert>
            )}
            <section id="noteCard" className="note-draft" aria-labelledby="noteTitle">
              <div className="between wrap">
                <span className="flex items-baseline gap-3">
                  <h2 id="noteTitle" className="text-title">
                    {household ? t("review.petDraftNote", { pet: e.patient_name }) : t("review.draftNote")}
                  </h2>
                  <AiLabel>{t("review.drafted")}</AiLabel>
                </span>
                <Select
                  size="sm"
                  id="noteTypeR"
                  className="w-auto max-w-[260px]"
                  aria-label={t("review.noteType")}
                  leading={<Icon name="description" className="text-text-secondary" />}
                  footer={t("review.typeHint")}
                  value={e.note_type}
                  disabled={typeBusy}
                  onValueChange={(v) => void changeType(v)}
                  options={noteTypes.map((nt) => ({ value: nt.id, label: nt.name }))}
                />
              </div>
              <VitalsLine
                vitals={note.vitals}
                by={note.vitals_by}
                segments={e.segments}
                onJump={jumpTo}
                onConfirm={confirmVital}
                onEdit={() => openSection(body[1]?.key ?? body[0]?.key ?? owner.key)}
              />
              {body.map((s) =>
                editing === s.key ? (
                  <SectionEditor
                    after={s.key === planKey ? remindersView : undefined}
                    key={s.key}
                    k={s.key}
                    label={s.label}
                    value={note[s.key]}
                    onChange={(v) => setSection(s.key, v)}
                    onDone={closeEditor}
                    encounterId={e.id}
                    templates={templates}
                    staleCheck={() => staleFor(s.key)}
                    onNext={() => openNext(s.key)}
                    segments={e.segments}
                    focusMark={focusMark}
                  />
                ) : (
                  sectionView(s.key, s.label, note[s.key])
                ),
              )}
              {note.medications.length > 0 &&
                (editing === "medications" ? (
                  <section className="note-sec" id="sec-medications">
                    <h3 className="sec-title">
                      <label htmlFor="ed-medications">{t("review.medications")}</label>
                    </h3>
                    <div className="sec-editor">
                      <TextArea
                        id="ed-medications"
                        aria-describedby="medsHelp"
                        autoFocus
                        minHeight={96}
                        value={note.medications.join("\n")}
                        onChange={(ev) => setMeds(ev.target.value)}
                        onKeyDown={(ev) => {
                          if (ev.key === "Escape") closeEditor();
                          if (ev.key === "Tab" && !ev.shiftKey) {
                            ev.preventDefault();
                            openNext("medications");
                          }
                        }}
                      />
                      <div className="between text-meta">
                        <span id="medsHelp">{t("review.medsHelp")}</span>
                        <Button onClick={closeEditor}>{t("editor.done")}</Button>
                      </div>
                    </div>
                  </section>
                ) : (
                  <section className="note-sec" id="sec-medications">
                    <div className="between">
                      <h3 className="sec-title">{t("review.medications")}</h3>
                      <Button
                        variant="link"
                        icon="edit"
                        aria-label={t("review.editLabel", { label: t("review.medications") })}
                        data-edit="medications"
                        onClick={() => openSection("medications")}
                      >
                        {t("review.edit")}
                      </Button>
                    </div>
                    <div className="tags">
                      {note.medications.map((m) => (
                        <Tag key={m} icon="medication">
                          <RichText text={m} />
                        </Tag>
                      ))}
                    </div>
                  </section>
                ))}
              {editing === owner.key ? (
                <SectionEditor
                  k={owner.key}
                  label={owner.label}
                  value={note.client_summary}
                  onChange={(v) => setSection(owner.key, v)}
                  onDone={closeEditor}
                  encounterId={e.id}
                  templates={templates}
                  staleCheck={() => staleFor(owner.key)}
                  autoRun={spanish ? "translate_es" : undefined}
                  autoAsk={updateAsk || undefined}
                  focusMark={focusMark}
                />
              ) : (
                sectionView(
                  owner.key,
                  owner.label,
                  note.client_summary,
                  <ToolButton tone="ai" icon="translate" onClick={() => openSection(owner.key, true)}>
                    {t("editor.spanish")}
                  </ToolButton>,
                  outOfSync ? (
                    <p className="sync-note">
                      <Icon name="sync_problem" size={16} />
                      <span>{t("review.outOfSync")}</span>
                      <Button
                        variant="link"
                        className="h-auto px-0 underline"
                        onClick={() => {
                          openSection(owner.key);
                          setUpdateAsk(t("review.updateAsk", { plan: flat(note.plan) }));
                        }}
                      >
                        {t("review.update")}
                      </Button>
                    </p>
                  ) : undefined,
                )
              )}
              {/* The note's end: in view, the provider has seen all of it. */}
              <span id={NOTE_END} aria-hidden="true" />
            </section>
            <VoiceLine voice={voice} appt={appt} />
            {e.followups.length > 0 && (
              <section className="flex flex-col gap-3" aria-labelledby="followTitleR">
                <h2 id="followTitleR" className="text-section">
                  {t("review.followUps")}
                </h2>
                {e.followups.map((f) => (
                  <FollowUpCard
                    key={`${f.id}:${f.status}`}
                    f={f}
                    e={e}
                    appt={appt}
                    onUpdated={setCurrent}
                    focused={f.id === focusFollowup}
                  />
                ))}
              </section>
            )}
            <RememberCard e={e} />
            <details className="collapsible" id="transcriptPhotos">
              <summary>
                <span className="text-section flex-1">{t("review.transcriptPhotos")}</span>
                <Icon name="expand_more" className="chev" />
              </summary>
              <TranscriptCard
                e={e}
                transcript={cap.transcript}
                setTranscript={cap.setTranscript}
                setCurrent={setCurrent}
                onRecord={cap.toggleRecord}
                onSample={() => void cap.sample()}
                onSave={() => cap.save()}
                embedded
                pet={household && !whole ? e.patient_name : undefined}
              />
              <PhotosCard e={e} setCurrent={setCurrent} embedded />
              <div className="row gap-4">
                <Button
                  icon="refresh"
                  disabled={locked}
                  onClick={() => {
                    void save.flush().then(() => onRedraft(cap.transcript));
                  }}
                >
                  {t("review.redo")}
                </Button>
                <span className="text-meta">{locked ? t("review.redoLocked") : t("review.redoHelp")}</span>
              </div>
            </details>
            <StatusText>{status}</StatusText>
          </div>
          <ReviewAside
            // Before you walk in is the appointment's own pet's; another pet in a household has its own record.
            card={e.patient_id === appt.patient.id ? card : null}
            e={e}
            appt={appt}
            onTranscript={openTranscript}
          />
        </div>
      </VisitPanel>
      {e.can?.sign !== false && (
        <ActionBar label={t("review.signRegion")}>
          <span className="flex min-w-0 flex-[1_1_0] items-center gap-3">
            {/* Said once, here, in AI purple: Blinq isn't sure of these. */}
            {confirms ? (
              <span className="confirm-count min-w-0 truncate">
                {t("review.confirmWhere", {
                  things: t("count.thing", { count: confirms }),
                  where: household ? e.patient_name : [...new Set(confirmList.map((c) => c.label))].join(", "),
                })}
              </span>
            ) : reminders.length ? (
              <span className="confirm-count min-w-0 truncate">
                {t("review.planLinesLeft", { count: reminders.length })}
              </span>
            ) : (
              <span className="muted">{t("review.nothingToConfirm")}</span>
            )}
          </span>
          {me?.via === "session" && me.user && (
            <span className="signing-as">
              <Icon name="verified_user" />
              {t("review.signingAs")} <b>{me.user.name}</b>
            </span>
          )}
          {household && step ? (
            <>
              <span className="then-line" aria-live="polite">
                {t("review.then", { what: thenSteps(steps.slice(1)) || after })}
              </span>
              {/* This pet's note alone, as before: a quiet link once nothing is left on it. */}
              {!confirms && step.kind !== "sign" && (
                <Button
                  variant="link"
                  className="underline"
                  aria-describedby="signHelp"
                  disabled={signing}
                  onClick={() => void openConfirm("send")}
                >
                  {t("review.signPetOnly", { pet: e.patient_name })}
                </Button>
              )}
              {/* The one green action names the next step and does it; it is never greyed out (D1). */}
              <MainAction
                icon={
                  step.kind === "sign"
                    ? "send"
                    : step.kind === "review"
                      ? step.here
                        ? "visibility"
                        : "arrow_forward"
                      : step.kind === "plan"
                        ? "checklist"
                        : "edit"
                }
                aria-describedby={step.kind === "sign" ? "signHelp" : undefined}
                loading={signing}
                onClick={doStep}
              >
                {stepLabel(step)}
              </MainAction>
            </>
          ) : (
            <>
              <span className="then-line" aria-live="polite">
                {t("review.then", {
                  what:
                    confirms > 1
                      ? t("review.thenMore", { count: confirms - 1 })
                      : confirms && reminders.length
                        ? t("review.thenPlan", { count: reminders.length })
                        : confirms || reminders.length
                          ? t("review.thenSign")
                          : after,
                })}
              </span>
              {!confirms && (
                <Button
                  variant="link"
                  className="underline"
                  aria-describedby="signHelp"
                  disabled={signing}
                  onClick={() => void openConfirm("only")}
                >
                  {t("review.signOnly")}
                </Button>
              )}
              {/* The one green action names the next step; it is never greyed out (D1). */}
              {next ? (
                <MainAction icon="edit" onClick={goConfirm}>
                  {next.action}
                </MainAction>
              ) : reminders.length ? (
                <MainAction icon="checklist" onClick={goReminder}>
                  {t("review.checkPlanLines", { count: reminders.length })}
                </MainAction>
              ) : (
                <MainAction
                  icon="send"
                  aria-describedby="signHelp"
                  loading={signing}
                  onClick={() => void openConfirm("send")}
                >
                  {t("review.signAndSend")}
                </MainAction>
              )}
            </>
          )}
          <span id="signHelp" className="sr">
            {group.length > 1 ? t("review.signHelpGroup") : t("review.signHelp")}
          </span>
        </ActionBar>
      )}
      {signingAll && (
        <SignNotesDialog
          notes={group
            .filter((g) => signingAll.includes(g.id))
            .map((g) => ({
              encounter_id: g.id,
              patient_name: g.patient_name,
              provider_name: appt.provider_name,
              date: String(appt.start).slice(0, 10),
              time: String(appt.start).slice(11, 16),
              visit_reason: appt.pets?.find((p) => p.patient.id === g.patient_id)?.reason ?? appt.reason,
              owner_name: [appt.client.first_name, appt.client.last_name].filter(Boolean).join(" "),
            }))}
          signer={me?.user?.name || appt.provider_name}
          onDone={() => {
            keepDraft(e.id, null);
            useApp.getState().refreshAfter(appt);
          }}
          onClose={() => {
            setSigningAll(null);
            const here = onScreen();
            void api.encounter(e.id).then((x) => {
              if (here()) setCurrent(x);
            });
            setGroupVersion((v) => v + 1);
          }}
        />
      )}
      {confirming && (
        <SignConfirm
          mode={confirming}
          appt={appt}
          e={e}
          busy={signing}
          onConfirm={() => void sign(confirming)}
          onClose={() => setConfirming(null)}
          signer={me?.via === "session" ? undefined : { value: signer, onChange: setSigner }}
        />
      )}
    </>
  );
}

/** Remember for next time: personal milestones the owner mentioned. Staff only, the vet checks each one. */
function RememberCard({ e }: { e: Encounter }) {
  const { t } = useTranslation();
  const [data, setData] = useState<RememberSuggestions | null>(null);
  const [status, setStatus] = useState("");
  useEffect(() => {
    const here = onScreen();
    api
      .remember(e.id)
      .then((r) => {
        if (here()) setData(r);
      })
      .catch(() => undefined);
  }, [e.id]);
  if (!data || (!data.suggestions.length && !data.left_out)) return null;

  const toggle = async (id: string, checked: boolean) => {
    const keep = data.suggestions.filter((s) => (s.id === id ? checked : s.kept)).map((s) => s.id);
    setData({ ...data, suggestions: data.suggestions.map((s) => ({ ...s, kept: keep.includes(s.id) })) });
    setStatus(t("remember.saving"));
    const here = onScreen();
    try {
      await api.keepRemember(e.id, keep);
      if (here())
        setStatus(
          keep.length
            ? t("remember.keeping", { items: t("count.item", { count: keep.length }) })
            : t("remember.nothingKept"),
        );
    } catch (err) {
      if (here()) setStatus(t("remember.notSaved", { message: err instanceof Error ? err.message : String(err) }));
    }
  };

  return (
    <Card>
      <Card.Header>
        <AiLabel>{t("remember.title")}</AiLabel>
        <span className="text-meta">{t("remember.staffKept")}</span>
      </Card.Header>
      <div>
        {data.suggestions.map((s) => (
          <div key={s.id} className="rem-item">
            <CheckboxField
              id={`rem-${s.id}`}
              checked={s.kept}
              onCheckedChange={(v) => void toggle(s.id, v === true)}
              label={<b className="line-clamp-3 text-body-strong">{s.text}</b>}
            />
            {s.transcript_lines.length > 0 && (
              <details>
                <summary>
                  {s.date ? `${t("remember.on", { date: monthDay(s.date) })} · ` : ""}
                  {s.said_by ? `${t("remember.saidBy", { who: s.said_by })} · ` : ""}
                  {t("remember.showTranscript")}
                </summary>
                <blockquote>{s.transcript_lines.join("\n")}</blockquote>
              </details>
            )}
          </div>
        ))}
      </div>
      {data.left_out > 0 && (
        <Alert icon="visibility_off">
          {t("remember.leftOut", { details: t("count.detail", { count: data.left_out }) })}
        </Alert>
      )}
      <StatusText>{status}</StatusText>
    </Card>
  );
}
