import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { api } from "../../api";
import type { Encounter, Photo, PhotoEdit } from "../../api/types";
import { cachedPhoto } from "../../lib/blobs";
import {
  FULL,
  cropOf,
  cropToSave,
  outlinesOf,
  withOutline,
  outlineOf,
  rotationOf,
  clampBox,
  fromView,
  normalizeRotation,
  sameBox,
  toView,
  type Box,
  type Rotation,
} from "../../lib/photoGeometry";
import { grabFrame, startCamera, stopCamera } from "../../recorder/camera";
import { heardWord, speechRecognition, type SpeechRecognitionLike } from "../../lib/speech";
import { onScreen } from "../../state/nav";
import { usePhotoAutosave } from "./usePhotoAutosave";
import { BoxEditor, PhotoCanvas } from "./PhotoView";
import {
  AiLabel,
  Alert,
  Button,
  ConfirmDialog,
  Dialog,
  FileInput,
  FormError,
  FormField,
  Icon,
  RadioCards,
  Spinner,
  StatusText,
  SwitchField,
  TextArea,
  TextField,
  ToolButton,
  buttonClasses,
} from "@blinq-scribe/ui";

type Source = "glasses" | "camera" | "file";
export type PhotoDialogState = { mode: "capture"; retakeOf?: string } | { mode: "edit"; photoId: string } | null;

const errText = (err: unknown) => (err instanceof Error ? err.message : String(err));
const GLASSES_POLL_MS = 2000;
// How long Save shows "Saved" before the view closes.
const SAVED_MS = 700;
// What the server takes; the camera always sends JPEG.
const PHOTO_TYPES = ["image/jpeg", "image/png"];

/** Add photo and the edit view, one dialog: capture a photo, then edit it while Blinq reads it. */
export function PhotoDialog({
  state,
  onState,
  e,
  setCurrent,
  onDeleted,
}: {
  state: PhotoDialogState;
  onState: (s: PhotoDialogState) => void;
  e: Encounter;
  setCurrent: (e: Encounter) => void;
  /** A photo was deleted from the edit view (the card offers Undo). */
  onDeleted?: (photoId: string) => void;
}) {
  const { t } = useTranslation();
  // While a capture uploads, the edit view shows it from the local file and draws the outline in.
  const [pending, setPending] = useState<{ url: string; retakeOf?: string } | null>(null);
  const [error, setError] = useState("");
  const close = () => {
    stopCamera();
    onState(null);
  };

  useEffect(() => () => stopCamera(), []);
  useEffect(
    () => () => {
      if (pending) URL.revokeObjectURL(pending.url);
    },
    [pending],
  );

  // A retake leaves an old photo to remove once the new one is in. If that fails, the new photo
  // stays and the vet is offered to remove the old one again: never a second upload.
  const [leftover, setLeftover] = useState<{ photoId: string; error: string } | null>(null);
  const removeOld = useCallback(
    async (oldId: string): Promise<boolean> => {
      const here = onScreen();
      try {
        const updated = await api.deletePhoto(e.id, oldId);
        if (here()) {
          setCurrent(updated);
          setLeftover(null);
        }
        return true;
      } catch (err) {
        if (here()) setLeftover({ photoId: oldId, error: errText(err) });
        return false;
      }
    },
    [e.id, setCurrent],
  );

  /** A new photo is on the visit (uploaded here or sent by the glasses): open it, and finish a retake. */
  const arrived = useCallback(
    async (updated: Encounter, newId: string | undefined, retakeOf?: string) => {
      const here = onScreen();
      setCurrent(updated);
      setPending(null);
      onState(newId ? { mode: "edit", photoId: newId } : null);
      if (retakeOf && newId && here()) await removeOld(retakeOf);
    },
    [onState, removeOld, setCurrent],
  );

  const uploaded = useCallback(
    async (file: File, hint: string, retakeOf?: string) => {
      const here = onScreen();
      const before = new Set(e.photos.map((p) => p.id));
      setError("");
      setPending({ url: URL.createObjectURL(file), retakeOf });
      let updated: Encounter;
      try {
        updated = await api.uploadPhoto(e.id, file, hint);
      } catch (err) {
        if (!here()) return;
        setPending(null);
        setError(t("photo.uploadFailed", { message: errText(err) }));
        onState({ mode: "capture", retakeOf });
        return;
      }
      if (!here()) return;
      await arrived(updated, updated.photos.find((p) => !before.has(p.id))?.id, retakeOf);
    },
    [arrived, e.id, e.photos, onState, t],
  );

  const photo = state?.mode === "edit" ? e.photos.find((p) => p.id === state.photoId) : undefined;
  const signed = e.status === "signed";
  return (
    <Dialog
      open={!!state || !!pending}
      onOpenChange={(open) => {
        if (!open) close();
      }}
      closeLabel={t("photo.close")}
      title={
        pending || photo
          ? t("photo.editTitle")
          : state?.mode === "capture"
            ? state.retakeOf
              ? t("photo.retakeTitle")
              : t("photo.addTitle")
            : t("photo.gone")
      }
    >
      {pending ? (
        <ReadingPhoto url={pending.url} />
      ) : state?.mode === "capture" ? (
        <Capture
          e={e}
          retakeOf={state.retakeOf}
          error={error}
          onFile={uploaded}
          onGlassesPhoto={(updated, id) => void arrived(updated, id, state.retakeOf)}
        />
      ) : photo ? (
        <>
          {leftover && (
            <Alert
              tone="error"
              urgent
              action={
                <Button size="sm" onClick={() => void removeOld(leftover.photoId)}>
                  {t("photo.removeOld")}
                </Button>
              }
            >
              {t("photo.oldStuck", { message: leftover.error })}
            </Alert>
          )}
          <Edit
            key={photo.id}
            e={e}
            photo={photo}
            signed={signed}
            setCurrent={setCurrent}
            onRetake={() => onState({ mode: "capture", retakeOf: photo.id })}
            onClose={close}
            onDeleted={() => {
              close();
              onDeleted?.(photo.id);
            }}
          />
        </>
      ) : null}
    </Dialog>
  );
}

/** While vision and SAM work: the photo, with the outline drawing in. */
function ReadingPhoto({ url }: { url: string }) {
  const { t } = useTranslation();
  return (
    <div className="flex flex-col gap-3" aria-busy="true">
      <div className="photo-stage">
        <PhotoCanvas src={url} alt={t("photo.newPhoto")} drawing />
      </div>
      <AiLabel icon="auto_awesome">
        <Spinner />
        {t("photo.reading")}
      </AiLabel>
    </div>
  );
}

function Capture({
  e,
  retakeOf,
  error,
  onFile,
  onGlassesPhoto,
}: {
  e: Encounter;
  retakeOf?: string;
  error: string;
  onFile: (file: File, hint: string, retakeOf?: string) => void;
  onGlassesPhoto: (updated: Encounter, photoId: string) => void;
}) {
  const { t } = useTranslation();
  const [source, setSource] = useState<Source>("camera");
  const [hint, setHint] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [camError, setCamError] = useState("");
  const [live, setLive] = useState(false);
  const video = useRef<HTMLVideoElement>(null);
  const arrived = useRef(onGlassesPhoto);
  arrived.current = onGlassesPhoto;

  // This computer's camera runs only while it is the chosen source and the dialog is open.
  useEffect(() => {
    if (source !== "camera") return;
    let gone = false;
    let mine: MediaStream | null = null;
    setCamError("");
    startCamera()
      .then((s) => {
        mine = s;
        if (gone) {
          stopCamera(s);
          return;
        }
        if (video.current) {
          video.current.srcObject = s;
          void video.current.play().catch(() => undefined);
        }
        setLive(true);
      })
      .catch((err: unknown) => {
        if (!gone) setCamError(t("photo.cameraUnavailable", { message: errText(err) }));
      });
    return () => {
      gone = true;
      setLive(false);
      if (mine) stopCamera(mine);
    };
  }, [source, t]);

  // The glasses: wait for the next photo the glasses app sends for this visit.
  useEffect(() => {
    if (source !== "glasses") return;
    const known = new Set(e.photos.map((p) => p.id));
    const here = onScreen();
    const timer = setInterval(async () => {
      const fresh = await api.encounter(e.id).catch(() => null);
      if (!fresh || !here()) return;
      const added = fresh.photos.find((p) => !known.has(p.id));
      if (added) {
        clearInterval(timer);
        arrived.current(fresh, added.id);
      }
    }, GLASSES_POLL_MS);
    return () => clearInterval(timer);
  }, [source, e.id, e.photos]);

  // Saying "capture" takes the photo too, where the browser can listen. Only while the live view is on.
  const takeRef = useRef<() => void>(() => {});
  const [listening, setListening] = useState(false);
  useEffect(() => {
    const Rec = speechRecognition();
    if (source !== "camera" || !live || !Rec) return;
    let rec: SpeechRecognitionLike | null = new Rec();
    rec.continuous = true;
    rec.interimResults = true;
    rec.lang = "en-US";
    rec.onresult = (ev) => {
      for (let i = ev.resultIndex; i < ev.results.length; i++) {
        if (heardWord(ev.results[i]?.[0].transcript ?? "", "capture")) {
          takeRef.current();
          return;
        }
      }
    };
    // Recognition stops itself after a pause; start it again while the view is open.
    rec.onend = () => {
      try {
        rec?.start();
      } catch {
        /* already running */
      }
    };
    rec.onerror = () => setListening(false);
    try {
      rec.start();
      setListening(true);
    } catch {
      rec = null;
    }
    return () => {
      const r = rec;
      rec = null;
      setListening(false);
      if (!r) return;
      r.onend = null;
      r.onresult = null;
      try {
        r.stop();
      } catch {
        /* already stopped */
      }
    };
  }, [source, live]);

  const take = async () => {
    if (source === "file") {
      if (file) onFile(file, hint, retakeOf);
      return;
    }
    if (source !== "camera" || !video.current) return;
    try {
      const shot = await grabFrame(video.current);
      stopCamera();
      onFile(shot, hint, retakeOf);
    } catch (err) {
      setCamError(errText(err));
    }
  };

  takeRef.current = () => void take();

  const sources: [Source, string, string][] = [
    ["glasses", "eyeglasses", t("photo.sources.glasses")],
    ["camera", "photo_camera", t("photo.sources.camera")],
    ["file", "upload_file", t("photo.sources.file")],
  ];
  return (
    <div className="flex flex-col gap-3">
      <RadioCards
        aria-label={t("photo.source")}
        value={source}
        onValueChange={(v) => setSource(v as Source)}
        options={sources.map(([v, icon, label]) => ({ value: v, icon, title: label }))}
      />
      {source === "camera" && (
        <div className="camera-view">
          <video ref={video} muted playsInline aria-label={t("photo.liveView")} />
          {!live && !camError && <span className="text-meta text-on-media">{t("photo.cameraStarting")}</span>}
        </div>
      )}
      {source === "glasses" && (
        <div role="status">
          <Alert icon={null}>
            <span className="flex items-center gap-2">
              <Spinner />
              {t("photo.waitingGlasses")}
            </span>
          </Alert>
        </div>
      )}
      {source === "file" && (
        <FileInput
          className="dropzone"
          label={t("photo.chooseFile")}
          accept={PHOTO_TYPES.join(",")}
          onFile={(f) => {
            if (!f) return;
            if (!PHOTO_TYPES.includes(f.type)) {
              setCamError(t("photo.imagesOnly"));
              return;
            }
            setCamError("");
            setFile(f);
          }}
        >
          <Icon name="image" />
          <span className="flex-[1_1_220px]">{file ? file.name : t("photo.pickFile")}</span>
          <span className={buttonClasses()}>
            <Icon name="add" />
            {t("photo.chooseFile")}
          </span>
        </FileInput>
      )}
      {source !== "glasses" && (
        <FormField id="photoHint" label={t("photo.hint")}>
          <TextField placeholder={t("visit.photoHint")} value={hint} onChange={(ev) => setHint(ev.target.value)} />
        </FormField>
      )}
      <FormError>{camError || error}</FormError>
      {source !== "glasses" && (
        <div className="row">
          <Button
            variant="primary"
            size="lg"
            icon="photo_camera"
            disabled={source === "camera" ? !live : !file}
            onClick={() => void take()}
          >
            {t("photo.take")}
          </Button>
          {source === "camera" && listening && (
            <span className="text-meta">
              <Icon name="mic" /> {t("photo.sayCapture")}
            </span>
          )}
        </div>
      )}
    </div>
  );
}

function Edit({
  e,
  photo,
  signed,
  setCurrent,
  onRetake,
  onDeleted,
  onClose,
}: {
  e: Encounter;
  photo: Photo;
  signed: boolean;
  setCurrent: (e: Encounter) => void;
  onRetake: () => void;
  onDeleted: () => void;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const [src, setSrc] = useState("");
  const [label, setLabel] = useState(photo.label);
  const [caption, setCaption] = useState(photo.caption);
  const [findings, setFindings] = useState(photo.findings);
  const [outline, setOutline] = useState<Box | null>(outlineOf(photo));
  const [crop, setCrop] = useState<Box>(cropOf(photo));
  const [rotation, setRotation] = useState<Rotation>(rotationOf(photo));
  const [inNote, setInNote] = useState(photo.in_note);
  const [showOwner, setShowOwner] = useState(photo.show_owner);
  const [tool, setTool] = useState<"none" | "outline" | "crop">("none");
  const [deleteError, setDeleteError] = useState("");
  // Blinq's two texts are read like note sections and edited in place, one at a time.
  const [editing, setEditing] = useState<"caption" | "findings" | null>(null);
  const [moreOpen, setMoreOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);
  const save = usePhotoAutosave(e, photo.id, setCurrent);
  const edit = (change: PhotoEdit) => {
    if (!signed) save.queue(change);
  };

  useEffect(() => {
    let live = true;
    void cachedPhoto(`${e.id}/${photo.id}`, () => api.photoUrl(e.id, photo.id)).then((u) => {
      if (live) setSrc(u);
    });
    return () => {
      live = false;
    };
  }, [e.id, photo.id]);

  const setBox = (kind: "outline" | "crop", view: Box) => {
    if (kind === "outline") {
      const next = clampBox(fromView(view, crop, rotation));
      if (!outline || !sameBox(next, outline)) {
        setOutline(next);
        edit({ outline: withOutline(photo, next) });
      }
    } else {
      const next = clampBox(fromView(view, FULL, rotation));
      if (!sameBox(next, crop)) {
        setCrop(next);
        edit({ crop: cropToSave(next) });
      }
    }
  };
  const rotate = () => {
    const next = normalizeRotation(rotation + 90);
    setRotation(next);
    edit({ rotation: next });
  };
  // Save sends what autosave hasn't yet, says so for a moment, then closes the view.
  const saveAndClose = async () => {
    setSaving(true);
    const ok = await save.flush();
    setSaving(false);
    if (!ok) return;
    setDone(true);
    setTimeout(onClose, SAVED_MS);
  };
  const remove = async () => {
    setDeleteError("");
    try {
      // An edit still waiting to save goes in first, so Undo brings the photo back as the vet left it.
      await save.flush();
      setCurrent(await api.deletePhoto(e.id, photo.id));
      onDeleted();
    } catch (err) {
      setDeleteError(errText(err));
    }
  };

  const name = label || photo.caption || t("photo.thisPhoto");
  const shownCrop = tool === "crop" ? FULL : crop;
  return (
    <div className="flex flex-col gap-3">
      {signed && <Alert icon="lock">{t("photo.signedLocked")}</Alert>}
      <div className="photo-stage">
        {src ? (
          <PhotoCanvas
            src={src}
            crop={shownCrop}
            rotation={rotation}
            outlines={tool === "none" ? (outline ? [outline, ...outlinesOf(photo).slice(1)] : []) : []}
            alt={name}
          >
            {tool === "outline" && (
              <BoxEditor
                name={t("photo.outlineName")}
                box={toView(outline ?? [0.3, 0.3, 0.7, 0.7], crop, rotation)}
                onChange={(b) => setBox("outline", b)}
              />
            )}
            {tool === "crop" && (
              <BoxEditor
                name={t("photo.cropName")}
                box={toView(crop, FULL, rotation)}
                onChange={(b) => setBox("crop", b)}
              />
            )}
          </PhotoCanvas>
        ) : (
          <StatusText>{t("app.loading")}</StatusText>
        )}
      </div>
      {!signed && (
        <div className="flex flex-wrap gap-2" role="toolbar" aria-label={t("photo.tools")}>
          <ToolButton
            icon="crop_free"
            pressed={tool === "outline"}
            onClick={() => setTool(tool === "outline" ? "none" : "outline")}
          >
            {t("photo.adjustOutline")}
          </ToolButton>
          <ToolButton icon="crop" pressed={tool === "crop"} onClick={() => setTool(tool === "crop" ? "none" : "crop")}>
            {t("photo.crop")}
          </ToolButton>
          <ToolButton icon="rotate_right" onClick={rotate}>
            {t("photo.rotate")}
          </ToolButton>
          <ToolButton icon="restart_alt" onClick={onRetake}>
            {t("photo.retake")}
          </ToolButton>
        </div>
      )}
      {tool !== "none" && <p className="text-meta">{t("photo.boxHelp")}</p>}
      <div className="flex flex-col gap-3">
        <FormField id="photoLabel" label={t("photo.label")}>
          <TextField
            value={label}
            maxLength={80}
            disabled={signed}
            placeholder={t("photo.labelPh")}
            onChange={(ev) => {
              setLabel(ev.target.value);
              edit({ label: ev.target.value });
            }}
          />
        </FormField>
        <AiText
          id="photoCaption"
          label={t("photo.description")}
          value={caption}
          signed={signed}
          editing={editing === "caption"}
          onEdit={() => setEditing("caption")}
          onDone={() => setEditing(null)}
          onChange={(v) => {
            setCaption(v);
            edit({ caption: v });
          }}
        />
        <p className="text-meta">{t("photo.descriptionHelp")}</p>
        {(findings || !signed) && (
          <div className="flex flex-col gap-2">
            <div>
              <Button
                variant="link"
                icon={moreOpen ? "expand_less" : "expand_more"}
                aria-expanded={moreOpen}
                aria-controls="photoMore"
                onClick={() => setMoreOpen(!moreOpen)}
              >
                {t("photo.moreDetail")}
              </Button>
            </div>
            {moreOpen && (
              <div id="photoMore">
                <AiText
                  id="photoFindings"
                  label={t("photo.moreDetailLabel")}
                  value={findings}
                  signed={signed}
                  editing={editing === "findings"}
                  onEdit={() => setEditing("findings")}
                  onDone={() => setEditing(null)}
                  onChange={(v) => {
                    setFindings(v);
                    edit({ findings: v });
                  }}
                />
              </div>
            )}
          </div>
        )}
      </div>
      <SwitchField
        className="divided"
        id="inNote"
        label={t("photo.inNote")}
        description={t("photo.inNoteHelp")}
        checked={inNote}
        disabled={signed}
        onCheckedChange={(v) => {
          setInNote(v);
          edit({ in_note: v });
        }}
      />
      <SwitchField
        id="showOwner"
        label={t("photo.showOwner")}
        description={t("photo.showOwnerHelp")}
        checked={showOwner}
        disabled={signed}
        onCheckedChange={(v) => {
          setShowOwner(v);
          edit({ show_owner: v });
        }}
      />
      {!signed && (
        <div className="divided flex flex-wrap items-center gap-3">
          <StatusText className="flex-1">{done ? "" : save.status}</StatusText>
          <ConfirmDialog
            trigger={
              <Button variant="danger-ghost" icon="delete">
                {t("photo.delete")}
              </Button>
            }
            title={t("photo.deleteTitle")}
            description={t("photo.deleteHelp")}
            confirmLabel={t("photo.deleteConfirm")}
            cancelLabel={t("photo.keep")}
            tone="danger"
            onConfirm={() => void remove()}
          />
          <Button
            variant="primary"
            icon={done ? "check" : "save"}
            loading={saving}
            disabled={saving || done}
            onClick={() => void saveAndClose()}
          >
            {done ? t("photo.saved") : t("photo.save")}
          </Button>
        </div>
      )}
      <FormError>{deleteError}</FormError>
    </div>
  );
}

/** Text Blinq wrote about the photo, read like a note section; Edit opens it in place and autosaves. */
function AiText({
  id,
  label,
  value,
  signed,
  editing,
  onEdit,
  onDone,
  onChange,
}: {
  id: string;
  label: string;
  value: string;
  signed: boolean;
  editing: boolean;
  onEdit: () => void;
  onDone: () => void;
  onChange: (v: string) => void;
}) {
  const { t } = useTranslation();
  return (
    <section className="flex flex-col gap-2" aria-labelledby={`${id}-title`}>
      <div className="flex min-h-7 items-center justify-between gap-2">
        <AiLabel>
          <span id={`${id}-title`}>{label}</span>
        </AiLabel>
        {!signed && !editing && (
          <Button variant="link" icon="edit" aria-label={t("review.editLabel", { label })} onClick={onEdit}>
            {t("review.edit")}
          </Button>
        )}
      </div>
      {editing ? (
        <div className="sec-editor" data-keeps-escape>
          <TextArea
            id={id}
            aria-labelledby={`${id}-title`}
            autoFocus
            minHeight={96}
            value={value}
            onChange={(ev) => onChange(ev.target.value)}
            onKeyDown={(ev) => {
              // Esc finishes this text, not the whole dialog (see data-keeps-escape).
              if (ev.key === "Escape") onDone();
            }}
          />
          <div className="flex justify-end">
            <Button size="sm" onClick={onDone}>
              {t("photo.done")}
            </Button>
          </div>
        </div>
      ) : (
        <p id={id} className="sec-body">
          {value || <span className="muted">{t("photo.none")}</span>}
        </p>
      )}
    </section>
  );
}
