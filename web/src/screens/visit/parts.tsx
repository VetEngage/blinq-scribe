import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { api } from "../../api";
import type { Appointment, Encounter, Photo, VoiceProfile } from "../../api/types";
import { useApp } from "../../state/app";
import { onScreen } from "../../state/nav";
import { cachedPhoto } from "../../lib/blobs";
import { retryFailedParts, useRecorder } from "../../recorder/store";
import { PhotoDialog, type PhotoDialogState } from "./PhotoDialog";
import { PhotoCanvas } from "./PhotoView";
import { ReadText } from "./NoteView";
import { RichText } from "./NoteEditor";
import { VisitHeaderCard, type StepKey } from "./VisitHeaderCard";
import { SpeakerLines } from "./SpeakerLines";
import { useLiveRecording } from "./useLiveRecording";
import { cropOf, outlinesOf, rotationOf } from "../../lib/photoGeometry";
import {
  AiLabel,
  Alert,
  Button,
  Card,
  Icon,
  LevelBars,
  Pressable,
  DemoTag,
  TextArea,
  formatTime,
  Tile,
  TileRow,
  ListRow,
  cx,
} from "@blinq-scribe/ui";
import { shownAt } from "../../lib/demoTime";

/**
 * Someone else's visit: what it is and who can work on it. Read only, from the visit's permissions
 * (another vet's visit for a vet; every visit for front office).
 */
export function VisitLocked({ appt, current }: { appt: Appointment; current?: Encounter | null }) {
  const { t } = useTranslation();
  const noteTypes = useApp((s) => s.noteTypes);
  const type = noteTypes.find((n) => n.id === (current?.note_type || appt.note_type))?.name;
  const vet = appt.provider_name || t("visit.theVet");
  const state = current ? current.hidden || t("visit.inProgress") : t("visit.notStarted");
  return (
    <Card>
      <ListRow
        lead="lock"
        title={t("visit.lockedTitle", { vet })}
        meta={`${[type, appt.patient.name, state].filter(Boolean).join(" · ")}. ${t("visit.lockedHelp", { vet })}`}
      />
    </Card>
  );
}

export function VisitHeader({
  appt,
  current,
  state,
  step,
}: {
  appt: Appointment;
  current: Encounter | null;
  /** Where the visit stands, as gray text in the banner's visit column. */
  state?: React.ReactNode;
  /** Where the step bar is: Record, Draft, Sign, Share or Follow up. */
  step: StepKey;
}) {
  const visitPetsBy = useApp((s) => s.visitPetsBy);
  const pets =
    current && current.patient_ids.length > 1 ? current.patient_ids.length : (visitPetsBy[appt.id] ?? []).length;
  return <VisitHeaderCard appt={appt} current={current} state={state} pets={pets} step={step} />;
}

/** One gray line of the banner's state, with an optional mark before it (the Signed check). */
export function StateLine({
  icon,
  iconClassName,
  indent,
  className,
  children,
}: {
  icon?: string;
  iconClassName?: string;
  /** Lines up under a line that has a mark. */
  indent?: boolean;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <span className={cx("vh-state", indent && "indent", className)}>
      {icon && <Icon name={icon} size={18} fill className={iconClassName} />}
      <span className="min-w-0">{children}</span>
    </span>
  );
}

/**
 * The visit's state from the encounter alone, for the screens without one of their own (drafting,
 * someone else's visit): Started 9:02 AM, Draft, Signed by Dr. Ana Rivera at 9:28 AM.
 */
export function VisitState({ e }: { e: Encounter }) {
  const { t } = useTranslation();
  if (e.status === "signed")
    return (
      <StateLine icon="check_circle" iconClassName="tone-success">
        {e.signed_at
          ? t("visit.stateSignedAt", { who: e.signed_by, time: formatTime(shownAt(e.signed_at)) })
          : t("visit.stateSigned", { who: e.signed_by })}
      </StateLine>
    );
  if (e.note) return <StateLine>{t("visit.stateDraft")}</StateLine>;
  return e.created_at ? (
    <StateLine>{t("visit.stateStarted", { time: formatTime(shownAt(e.created_at)) })}</StateLine>
  ) : null;
}

export function VoiceLine({ voice, appt }: { voice: VoiceProfile | null; appt: Appointment }) {
  const { t } = useTranslation();
  if (!voice) return null;
  const vet = appt.provider_name || t("visit.thisVet");
  return (
    <p className="text-meta">
      {voice.source === "default" ? (
        <>
          <DemoTag>{t("visit.demoDefault")}</DemoTag> {t("visit.voiceDefault", { vet })}
        </>
      ) : (
        t("visit.voiceLearned", { vet, count: voice.notes_used })
      )}
    </p>
  );
}

/** The visit's photos as drawn from their edits. Each opens the edit view. */
export function PhotoList({ e, onOpen }: { e: Encounter; onOpen: (photoId: string) => void }) {
  const { t } = useTranslation();
  if (!e.photos.length) return null;
  return (
    <div className="photos">
      {e.photos.map((p) => {
        const name = p.label || p.caption || t("photo.thisPhoto");
        return (
          <Pressable
            key={p.id}
            className="photo-thumb"
            aria-label={t("photo.open", { name })}
            onClick={() => onOpen(p.id)}
          >
            <span className="frame">
              <PhotoThumb e={e} p={p} />
              <span className="edit-badge" aria-hidden="true">
                <Icon name="edit" size={16} />
              </span>
            </span>
            <span className="flex min-w-0 flex-auto flex-col gap-1">
              <span className="text-body-strong">{p.label || p.caption}</span>
              <span className="text-meta">
                {p.label ? p.caption : p.findings}
                {p.segments.length
                  ? ` ${t("visit.outlined", { areas: t("count.area", { count: p.segments.length }) })}`
                  : ""}
              </span>
              <span className="row gap-2">
                <AiLabel size="sm">{t("visit.describedBy")}</AiLabel>
                {!p.in_note && <span className="text-meta">{t("photo.notInNote")}</span>}
                {p.show_owner && <span className="text-meta">{t("photo.forOwner")}</span>}
              </span>
            </span>
          </Pressable>
        );
      })}
    </div>
  );
}

/** Photos load with the auth header, then show from a blob URL; redraws reuse it. */
function PhotoThumb({ e, p }: { e: Encounter; p: Photo }) {
  const [src, setSrc] = useState("");
  useEffect(() => {
    let live = true;
    void cachedPhoto(`${e.id}/${p.id}`, () => api.photoUrl(e.id, p.id)).then((u) => {
      if (live) setSrc(u);
    });
    return () => {
      live = false;
    };
  }, [e.id, p.id]);
  return src ? (
    <PhotoCanvas
      src={src}
      crop={cropOf(p)}
      rotation={rotationOf(p)}
      outlines={outlinesOf(p)}
      alt={p.label || p.caption}
      fill
    />
  ) : null;
}

/** While recording: the newest words with a live caret, as each part comes back transcribed. */
export function RecordingLive({ transcript }: { transcript: string }) {
  const { t } = useTranslation();
  const words = transcript.trim().split(/\s+/).filter(Boolean).slice(-24).join(" ");
  return (
    <p className="live-words sec-body" aria-label={t("recording.newest")} aria-live="polite">
      {words ? <>…{words}</> : <span className="muted">{t("recording.waiting")}</span>}
      <span className="cursor" aria-hidden="true" />
    </p>
  );
}

/** The header's progress: the part on its way and how many arrived, from this computer or the glasses. */
/**
 * Uploads stay out of sight while they work. A part that didn't reach the server is a red row with
 * Retry; a visit from the glasses says so once it's in.
 */
function PartsLine({ e }: { e: Encounter }) {
  const { t } = useTranslation();
  const failed = useRecorder((s) => s.failed);
  if (failed > 0)
    return (
      <span className="text-meta inline-flex items-center gap-2 text-error" role="alert">
        <Icon name="error" className="tone-error" />
        {t("recording.partsFailed", { parts: t("count.part", { count: failed }) })}
        <Button variant="link" size="sm" icon="refresh" className="h-auto px-0" onClick={retryFailedParts}>
          {t("recording.retry")}
        </Button>
      </span>
    );
  if (e.source === "glasses" && e.status !== "recording")
    return (
      <span className="text-meta inline-flex items-center gap-1">
        <Icon name="cloud_done" className="tone-success" /> {t("visit.fromGlasses")}
      </span>
    );
  return null;
}

export function TranscriptCard({
  e,
  transcript,
  setTranscript,
  setCurrent,
  onRecord,
  recordInBar,
  onSample,
  onSave,
  transcriptRef,
  embedded,
  pet,
}: {
  e: Encounter;
  transcript: string;
  setTranscript: (v: string) => void;
  /** For Who is this?: the visit with that speaker named. */
  setCurrent?: (e: Encounter) => void;
  onRecord: () => void;
  /** The pinned bar's green Start recording is on screen: no second record button here. */
  recordInBar?: boolean;
  onSample: () => void;
  /** Saves the box; true once saved. */
  onSave: () => Promise<boolean>;
  transcriptRef?: React.Ref<HTMLTextAreaElement>;
  /** Inside another card (Review's "Transcript and photos"): a section, not a card of its own. */
  embedded?: boolean;
  /** One recording for several pets: show only this pet's lines. */
  pet?: string;
}) {
  const { t } = useTranslation();
  const recording = useRecorder((s) => s.encounterId === e.id);
  const live = !!useLiveRecording(e).where;
  const [editing, setEditing] = useState(false);
  // Who said what, while the box still holds the saved text. Typed or pasted text shows in the box
  // until it's saved, then as speaker rows too.
  const saved = transcript === e.transcript;
  const labeled = !!e.segments?.length && saved;
  const rows = labeled && !editing;
  // Nothing to show yet while recording: the newest words land here.
  const waiting = recording && !transcript.trim();
  return (
    <Part embedded={embedded}>
      <Card.Header>
        <Card.Title as="span">{t("visit.transcript")}</Card.Title>
        <PartsLine e={e} />
      </Card.Header>
      {rows ? (
        <div className="rounded-control border border-border p-3">
          <SpeakerLines e={e} setCurrent={setCurrent} live={live} pet={pet} />
        </div>
      ) : waiting ? (
        <RecordingLive transcript={transcript} />
      ) : (
        <TextArea
          id="transcript"
          aria-label={t("visit.transcript")}
          placeholder={t("visit.transcriptEmpty")}
          ref={transcriptRef}
          minHeight={150}
          value={transcript}
          onChange={(ev) => setTranscript(ev.target.value)}
        />
      )}
      <p className="text-meta flex items-start gap-2">
        <Icon name="record_voice_over" size={16} />
        {t("speakers.hint")}
      </p>
      {live && (
        <p className="text-meta flex items-center gap-2">
          <LevelBars bars={4} className="text-primary" />
          {t("recording.listeningHint")}
        </p>
      )}
      <div className="capture-row">
        {/* While recording, Stop lives in the bottom bar only. */}
        {!recording && !recordInBar && (
          <Button variant="secondary" icon="mic" onClick={onRecord}>
            {t("visit.record")}
          </Button>
        )}
        <Button variant="secondary" icon="description" onClick={onSample}>
          {t("visit.sample")}
        </Button>
        <Button
          variant="secondary"
          icon="save"
          onClick={() =>
            void onSave().then((ok) => {
              if (ok) setEditing(false);
            })
          }
        >
          {t("visit.saveText")}
        </Button>
        {rows && (
          <Button variant="ghost" icon="edit" onClick={() => setEditing(true)}>
            {t("speakers.editText")}
          </Button>
        )}
        {editing && labeled && (
          <Button variant="ghost" icon="groups" onClick={() => setEditing(false)}>
            {t("speakers.showSpeakers")}
          </Button>
        )}
      </div>
    </Part>
  );
}

const UNDO_MS = 8000;

/** A card, or inside another card a section that keeps the card's spacing. */
function Part({
  embedded,
  className,
  children,
}: {
  embedded?: boolean;
  className?: string;
  children: React.ReactNode;
}) {
  return embedded ? (
    <section className={cx("flex flex-col gap-3", className)}>{children}</section>
  ) : (
    <Card>{children}</Card>
  );
}

export function PhotosCard({
  e,
  setCurrent,
  embedded,
}: {
  e: Encounter;
  setCurrent: (e: Encounter) => void;
  embedded?: boolean;
}) {
  const { t } = useTranslation();
  const [dialog, setDialog] = useState<PhotoDialogState>(null);
  // A deleted photo is kept until the visit is signed, so for a while it can come back.
  const [undo, setUndo] = useState<{ photoId: string; error: string } | null>(null);
  const signed = e.status === "signed";
  useEffect(() => {
    if (!undo || undo.error) return;
    const timer = setTimeout(() => setUndo(null), UNDO_MS);
    return () => clearTimeout(timer);
  }, [undo]);
  const restore = async (photoId: string) => {
    const here = onScreen();
    try {
      const updated = await api.restorePhoto(e.id, photoId);
      if (!here()) return;
      setCurrent(updated);
      setUndo(null);
    } catch (err) {
      if (here()) setUndo({ photoId, error: err instanceof Error ? err.message : String(err) });
    }
  };
  return (
    <Part embedded={embedded} className="divided">
      <Card.Header>
        <Card.Title as="span">{t("visit.photos")}</Card.Title>
        {!signed && (
          <Button icon="add_photo_alternate" onClick={() => setDialog({ mode: "capture" })}>
            {t("visit.addPhoto")}
          </Button>
        )}
      </Card.Header>
      {e.photos.length ? (
        <PhotoList e={e} onOpen={(photoId) => setDialog({ mode: "edit", photoId })} />
      ) : (
        <p className="text-meta">{t("visit.noPhotos")}</p>
      )}
      <div role="status">
        {undo && !signed && (
          <Alert
            tone={undo.error ? "error" : "neutral"}
            icon="delete"
            action={
              undo.error ? null : (
                <Button variant="link" icon="undo" onClick={() => void restore(undo.photoId)}>
                  {t("photo.undo")}
                </Button>
              )
            }
          >
            {undo.error ? t("photo.undoFailed", { message: undo.error }) : t("photo.deleted")}
          </Alert>
        )}
      </div>
      <PhotoDialog
        state={dialog}
        onState={setDialog}
        e={e}
        setCurrent={setCurrent}
        onDeleted={(photoId) => setUndo({ photoId, error: "" })}
      />
    </Part>
  );
}

const VITAL_KEYS = ["weight", "temperature", "heart_rate", "respiratory_rate", "body_condition_score"] as const;

/**
 * Vitals as tiles; a value Blinq wants confirmed is AI purple. On a signed note such a value (older
 * demo data only) reads "not confirmed" rather than the raw mark.
 */
export function VitalsTiles({ vitals, signed }: { vitals: Record<string, string>; signed?: boolean }) {
  const { t } = useTranslation();
  const entries = Object.entries(vitals || {});
  if (!entries.length) return null;
  return (
    <TileRow>
      {entries.map(([k, v]) => (
        <Tile
          key={k}
          tone={String(v).startsWith("[confirm") ? "ai" : "default"}
          label={
            (VITAL_KEYS as readonly string[]).includes(k)
              ? t(`review.vitalLabels.${k as (typeof VITAL_KEYS)[number]}`)
              : k.replace(/_/g, " ")
          }
          value={signed ? <ReadText text={String(v)} /> : <RichText text={String(v)} />}
        />
      ))}
    </TileRow>
  );
}
