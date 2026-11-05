import { useCallback, useEffect, useRef, useState } from "react";
import { useParams, useSearchParams } from "react-router";
import { useTranslation } from "react-i18next";
import { api } from "../../api";
import type { Appointment, DraftStep, Encounter, PreRoomCard, Profile, VoiceProfile } from "../../api/types";
import { useApp } from "../../state/app";
import { onScreen } from "../../state/nav";
import { onTranscribed, useRecorder, waitForUploads } from "../../recorder/store";
import { BeforeVisit } from "./BeforeVisit";
import { useCapture } from "./useCapture";
import { MicPicker } from "./MicPicker";
import { Drafting } from "./Drafting";
import { Review } from "./Review";
import { Signed } from "./Signed";
import { VisitPanel, VisitTabsProvider } from "./visitTabs";
import { PhotosCard, StateLine, TranscriptCard, VisitHeader, VisitLocked, VisitState, VoiceLine } from "./parts";
import {
  ActionBar,
  ActionBarStatus,
  Button,
  EmptyState,
  Icon,
  MainAction,
  StatusText,
  formatTime,
} from "@blinq-scribe/ui";

import { keepPlace, readPlace } from "../../state/visitMemory";
import { useLiveRecording } from "./useLiveRecording";
import { Loading } from "../../components/common";
import { duration } from "../../lib/format";
import { shownAt, readAtClockOf } from "../../lib/demoTime";

/** Finds the appointment for /visit/:id (from the schedule of its day), then shows that visit. */
export function VisitScreen() {
  const { t } = useTranslation();
  const { appointmentId = "" } = useParams();
  const [params] = useSearchParams();
  const day = params.get("date") ?? "";
  const encounterId = params.get("e") ?? "";
  const appts = useApp((s) => s.appts);
  const viewDate = useApp((s) => s.viewDate);
  const known = useApp((s) => s.openAppt);
  const [missing, setMissing] = useState(false);

  const appt = (known?.id === appointmentId ? known : null) ?? appts.find((a) => a.id === appointmentId) ?? null;

  useEffect(() => {
    if (appt) return;
    // The address already moved on to another visit (it changes at once; the page follows a beat later): this
    // page is on its way out, so it must not take the rail back to its own day.
    if (!decodeURIComponent(window.location.pathname).endsWith(`/visit/${appointmentId}`)) return;
    // Opened from a link or a reload: load that day's schedule to find the appointment.
    if (day && day !== viewDate) void useApp.getState().goToDay(day);
    else if (appts.length) setMissing(true);
  }, [appt, day, viewDate, appts.length, appointmentId]);

  if (!appt) return missing ? <EmptyState>{t("app.pickVisit")}</EmptyState> : <Loading />;
  return <Visit key={`${appt.id}:${encounterId}`} appt={appt} encounterId={encounterId} />;
}

function Visit({ appt, encounterId }: { appt: Appointment; encounterId: string }) {
  const { t } = useTranslation();
  // On the busy demo day, the visit's times read at the demo's clock.
  readAtClockOf(appt);
  const [current, setCurrentState] = useState<Encounter | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [card, setCard] = useState<PreRoomCard | null>(null);
  const [voice, setVoice] = useState<VoiceProfile | null>(null);
  const [profile, setProfile] = useState<Profile | null | false>(null);
  const [drafting, setDrafting] = useState<DraftStep[] | null>(null);
  const [status, setStatus] = useState("");
  const recError = useRecorder((s) => s.error);

  const setCurrent = useCallback((e: Encounter) => {
    setCurrentState(e);
    useApp.setState({ current: e });
  }, []);

  useEffect(() => {
    const here = onScreen();
    const app = useApp.getState();
    useApp.setState({ openAppt: appt, openPatient: { id: appt.patient.id, client_id: appt.client.id }, current: null });
    if (!app.visitPetsBy[appt.id]) {
      // A household appointment starts with every pet booked in it.
      const booked = appt.pets?.length ? appt.pets.map((p) => p.patient) : [appt.patient];
      useApp.setState({
        visitPetsBy: { ...app.visitPetsBy, [appt.id]: booked.map((p) => ({ id: p.id, name: p.name })) },
      });
    }
    api
      .voiceProfile(appt.provider_id)
      .then((v) => {
        if (here()) setVoice(v);
      })
      .catch(() => undefined);
    api
      .patientProfile(appt.patient.id)
      .catch(() => false as const)
      .then((p) => {
        if (here()) setProfile(p);
      });
    // Before you walk in: before the visit, and beside the draft.
    const cardRead = api.preRoomCard(appt.id).catch(() => null);
    void cardRead.then((c) => {
      if (here()) setCard(c);
    });
    // A visit already started for this appointment opens where it left off: a household visit on the
    // pet tab it was on.
    const kept = readPlace(appt.id)?.encounter ?? "";
    const encId = encounterId || kept || appt.encounter_id;
    void (async () => {
      if (encId) {
        let existing = await api.encounter(encId).catch(() => null);
        if (existing && existing.appointment_id !== appt.id && appt.encounter_id && encId !== appt.encounter_id)
          existing = await api.encounter(appt.encounter_id).catch(() => null);
        if (!here()) return;
        if (existing) {
          setCurrent(existing);
          setLoaded(true);
          return;
        }
      }
      // Nothing started yet: wait for the card, so the page doesn't jump when it lands.
      await cardRead;
      if (!here()) return;
      setLoaded(true);
    })();
    return () => {
      useApp.setState({ current: null });
    };
    // The visit is keyed by appointment and encounter, so this runs once per visit.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Each recorded part's transcript lands on the visit it was recorded in, and only shows if that's this one.
  useEffect(() => {
    onTranscribed((e) => {
      setCurrentState((cur) => {
        if (!cur || cur.id !== e.id) return cur;
        useApp.setState({ current: e });
        return e;
      });
    });
    return () => onTranscribed(() => {});
  }, []);

  const draft = useCallback(
    async (transcript: string) => {
      if (!current) return;
      const here = onScreen();
      const e = current;
      setStatus(t("visit.writing"));
      setDrafting([]);
      try {
        useRecorder.getState().stop();
        await waitForUploads(); // the last part, even one still at the speech model, goes into the draft
        if (!here()) return;
        await api.saveTranscript(e.id, transcript);
        const drafted = await api.draft(e.id, (step) => {
          if (here()) setDrafting((steps) => [...(steps ?? []).filter((s) => s.step !== step.step), step]);
        });
        useApp.getState().refreshAfter(appt);
        if (!here()) return;
        setStatus("");
        setCurrent(drafted);
      } catch (err) {
        if (here()) setStatus(err instanceof Error ? err.message : String(err));
      } finally {
        if (here()) setDrafting(null);
      }
    },
    [current, appt, setCurrent, t],
  );

  // Someone else's visit still being worked on: who it belongs to, no draft or transcript.
  const locked = !!current && current.status !== "signed" && !!current.can && !current.can.edit && !current.can.record;
  const stage = !loaded
    ? "loading"
    : !current
      ? "before"
      : drafting
        ? "drafting"
        : locked
          ? "locked"
          : current.status === "signed"
            ? "signed"
            : current.note
              ? "review"
              : "progress";
  // The pet the banner shows: in a group visit, the one this note is about.
  const petId = current?.patient_id || appt.patient.id;
  return (
    <VisitTabsProvider visitKey={appt.id} petId={petId} stage={stage} appt={appt} current={current}>
      <RestoreScroll visitKey={appt.id} ready={loaded} />
      {!loaded ? (
        <>
          <VisitHeader appt={appt} current={null} step="record" />
          <VisitPanel>
            <Loading />
          </VisitPanel>
        </>
      ) : !current ? (
        <BeforeVisit
          appt={appt}
          card={card}
          profile={profile}
          onStarted={(e) => {
            useApp.getState().refreshAfter(appt);
            setCurrent(e);
          }}
        />
      ) : drafting ? (
        <Drafting appt={appt} current={current} steps={drafting} />
      ) : locked ? (
        <>
          <VisitHeader
            appt={appt}
            current={current}
            state={<VisitState e={current} />}
            step={current.note ? "sign" : "record"}
          />
          <VisitPanel>
            <VisitLocked appt={appt} current={current} />
          </VisitPanel>
        </>
      ) : current.status === "signed" ? (
        <Signed appt={appt} current={current} profile={profile} setCurrent={setCurrent} />
      ) : current.note ? (
        <Review
          appt={appt}
          current={current}
          setCurrent={setCurrent}
          voice={voice}
          onRedraft={draft}
          status={status}
          card={card}
          profile={profile}
        />
      ) : (
        <InProgress
          appt={appt}
          current={current}
          setCurrent={setCurrent}
          voice={voice}
          onDraft={draft}
          status={status || recError}
          setStatus={setStatus}
        />
      )}
    </VisitTabsProvider>
  );
}

function InProgress({
  appt,
  current,
  setCurrent,
  voice,
  onDraft,
  status,
  setStatus,
}: {
  appt: Appointment;
  current: Encounter;
  setCurrent: (e: Encounter) => void;
  voice: VoiceProfile | null;
  onDraft: (transcript: string) => void;
  status: string;
  setStatus: (s: string) => void;
}) {
  const { t } = useTranslation();
  const cap = useCapture(appt, current, setCurrent, setStatus);
  const live = useLiveRecording(current);
  const box = useRef<HTMLTextAreaElement>(null);
  const pending = useRecorder((s) => s.pending);

  // While the glasses record, the transcript fills in here. Never over what the vet is typing.
  useEffect(() => {
    const id = current.id;
    const timer = setInterval(async () => {
      if (cap.recording || pending || document.hidden) return;
      const writes = cap.localWrites.current;
      const here = onScreen();
      const e = await api.encounter(id).catch(() => null);
      if (
        !e ||
        !here() ||
        writes !== cap.localWrites.current ||
        useRecorder.getState().pending ||
        useRecorder.getState().encounterId
      )
        return;
      const active = document.activeElement;
      if (
        box.current &&
        (box.current.value !== cap.shown.current || active === box.current || !!active?.closest(".dialog-panel"))
      )
        return;
      if (e.note || e.status !== current.status || e.photos.length !== current.photos.length) {
        setCurrent(e);
        void useApp.getState().loadSchedule();
        return;
      }
      if (e.transcript !== current.transcript) setCurrent(e);
    }, 4000);
    return () => clearInterval(timer);
  }, [current, cap.recording, pending, cap.localWrites, cap.shown, setCurrent]);

  const write = () => onDraft(cap.transcript);
  // Something recorded: parts arrived and they stopped coming.
  const recorded = (current.parts_received ?? 0) > 0;
  // Nothing to draft from: no words yet, and nothing still on its way in.
  const empty = !cap.transcript.trim() && !current.transcript.trim() && !cap.recording && !pending && !live.where;
  const where = [appt.patient.name, appt.room].filter(Boolean).join(" · ");
  const help = live.where
    ? t("visit.writeStops")
    : current.patient_ids.length > 1
      ? t("visit.writeHelpPets")
      : t("visit.writeHelp");
  return (
    <>
      <VisitHeader
        appt={appt}
        current={current}
        state={
          current.created_at ? (
            <StateLine>{t("visit.stateStarted", { time: formatTime(shownAt(current.created_at)) })}</StateLine>
          ) : null
        }
        step="record"
      />
      <VisitPanel>
        <TranscriptCard
          e={current}
          transcript={cap.transcript}
          setTranscript={cap.setTranscript}
          setCurrent={setCurrent}
          transcriptRef={box}
          onRecord={cap.toggleRecord}
          recordInBar={empty}
          onSample={() => void cap.sample()}
          onSave={() => cap.save()}
        />
        <PhotosCard e={current} setCurrent={setCurrent} />
        <StatusText>{status}</StatusText>
        <VoiceLine voice={voice} appt={appt} />
      </VisitPanel>
      <ActionBar label={t("visit.progressRegion")}>
        <span className="flex min-w-0 flex-[1_1_0] items-center gap-3">
          {live.where ? (
            <ActionBarStatus
              // The one red that isn't a failure (PRD 58): recording is on, with its running time.
              lead={<span className="size-3 flex-none animate-pulse-dot rounded-pill bg-error" aria-hidden="true" />}
              title={
                <>
                  {live.where === "here" ? t("visitHead.recordingHere") : t("visitHead.recordingGlasses")}{" "}
                  <span className="font-num">{live.elapsed}</span>
                </>
              }
              sub={where}
            />
          ) : recorded ? (
            // Audio came in and stopped: how much there is, in neutral gray, never a warning.
            <ActionBarStatus
              lead={<Icon name="graphic_eq" className="muted" />}
              title={
                <>
                  {t("visit.recordingEnded")} · <span className="font-num">{duration(current.audio_seconds ?? 0)}</span>
                </>
              }
              sub={where}
            />
          ) : (
            <ActionBarStatus
              lead={<Icon name="mic_off" className="muted" />}
              title={t("visit.notRecordingTitle")}
              sub={[t("visit.notRecordingSub"), where].filter(Boolean).join(" · ")}
            />
          )}
        </span>
        <span id="draftHelp" className="sr">
          {help}
        </span>
        {live.where === "here" && (
          <Button variant="danger-outline" icon="stop_circle" onClick={cap.toggleRecord}>
            {t("visit.stopOnly")}
          </Button>
        )}
        {/* The one green action names the next step: record, stop and draft, or draft. */}
        {empty ? (
          <>
            <MicPicker />
            <MainAction icon="mic" onClick={cap.toggleRecord}>
              {t("visit.startRecording")}
            </MainAction>
          </>
        ) : (
          <MainAction icon="auto_awesome" aria-describedby="draftHelp" onClick={write}>
            {live.where ? t("visit.stopAndDraft") : t("visit.write")}
          </MainAction>
        )}
      </ActionBar>
    </>
  );
}

/** Back where the provider was on this visit page after a reload or signing back in: the same scroll. */
function RestoreScroll({ visitKey, ready }: { visitKey: string; ready: boolean }) {
  useEffect(() => {
    if (!ready) return;
    const scroller = document.querySelector<HTMLElement>(".screen");
    const y = readPlace(visitKey)?.scroll ?? 0;
    // After the page has drawn, so there is somewhere to scroll to.
    const id = setTimeout(() => {
      if (y && scroller && scroller.scrollHeight > scroller.clientHeight) scroller.scrollTop = y;
      else if (y) window.scrollTo(0, y);
    }, 300);
    let timer: ReturnType<typeof setTimeout> | null = null;
    const onScroll = () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => {
        const at = scroller && scroller.scrollHeight > scroller.clientHeight ? scroller.scrollTop : window.scrollY;
        keepPlace(visitKey, { scroll: Math.round(at) });
      }, 250);
    };
    scroller?.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      clearTimeout(id);
      if (timer) clearTimeout(timer);
      scroller?.removeEventListener("scroll", onScroll);
      window.removeEventListener("scroll", onScroll);
    };
  }, [visitKey, ready]);
  return null;
}
