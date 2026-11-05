import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router";
import { useTranslation } from "react-i18next";
import { useShallow } from "zustand/react/shallow";
import {
  ActionBar,
  ActionBarStatus,
  Button,
  Checkbox,
  Dialog,
  EmptyState,
  formatTime,
  Icon,
  IconButton,
  MainAction,
  Num,
  RadioCards,
  Spinner,
  Tabs,
  cx,
} from "@blinq-scribe/ui";
import { api } from "../api";
import type { NoteToSign } from "../api/types";
import { wdMonthDay } from "../lib/format";
import { useApp } from "../state/app";
import { useCan } from "../state/can";
import { useDayLeft } from "../state/eod";
import { useOpen } from "../state/open";
import { useNoVisit } from "../state/useNoVisit";
import { SkeletonRows } from "../components/common";

type Bucket = "ready" | "pending";
type Step = "waiting" | "signing" | "signed" | "failed";

/** A note to sign, as the sign dialog lists it. */
export type SignableNote = Pick<
  NoteToSign,
  "encounter_id" | "patient_name" | "provider_name" | "date" | "time" | "visit_reason" | "owner_name"
>;

/** "Tue Oct 27, 10:00 AM": the visit, with its time as a Number. */
function When({ n }: { n: SignableNote }) {
  return (
    <>
      {wdMonthDay(n.date)}
      {n.time && (
        <>
          , <Num>{formatTime(n.time)}</Num>
        </>
      )}
    </>
  );
}

/**
 * Sign several notes at once: each note by pet and date, who signs, and where they go (the PIMS by
 * default, or sign only). Signing goes one note at a time, each with its own progress and error. Also
 * a household visit's notes, one per pet. The server refuses any note still marked to confirm.
 */
export function SignNotesDialog({
  notes: picked,
  signer,
  onClose,
  onDone,
}: {
  notes: SignableNote[];
  signer: string;
  onClose: () => void;
  onDone: () => void;
}) {
  const { t } = useTranslation();
  const me = useApp((s) => s.me);
  // The notes as they were picked: once signed they leave the list behind, but stay here with their result.
  const [notes] = useState(picked);
  const [mode, setMode] = useState<"send" | "only">("send");
  const [steps, setSteps] = useState<Record<string, { step: Step; error?: string }>>({});
  const started = Object.keys(steps).length > 0;
  const running = Object.values(steps).some((s) => s.step === "signing" || s.step === "waiting");
  const failed = Object.values(steps).filter((s) => s.step === "failed").length;
  const finished = started && !running;

  const signAll = async () => {
    setSteps(Object.fromEntries(notes.map((n) => [n.encounter_id, { step: "waiting" as Step }])));
    for (const n of notes) {
      setSteps((s) => ({ ...s, [n.encounter_id]: { step: "signing" } }));
      try {
        // A signed-in provider signs as themselves; the open demo signs as the visit's provider.
        await api.sign(n.encounter_id, me?.via === "session" ? "" : n.provider_name || signer, mode === "send");
        setSteps((s) => ({ ...s, [n.encounter_id]: { step: "signed" } }));
      } catch (err) {
        setSteps((s) => ({
          ...s,
          [n.encounter_id]: { step: "failed", error: err instanceof Error ? err.message : String(err) },
        }));
      }
    }
    onDone();
  };

  const count = notes.length;
  return (
    <Dialog
      open
      onOpenChange={(open) => !open && !running && onClose()}
      title={t("notes.signTitle", { count })}
      closeLabel={t("notes.close")}
      size="sm"
    >
      <ul className="m-0 flex list-none flex-col rounded-tile border border-border p-0">
        {notes.map((n) => {
          const s = steps[n.encounter_id];
          return (
            <li
              key={n.encounter_id}
              className="flex items-start gap-3 border-t border-divider px-3 py-3 first:border-t-0"
            >
              <span className="mt-px flex size-5 flex-none items-center justify-center">
                {s?.step === "signing" ? (
                  <Spinner label={t("notes.signing")} />
                ) : s?.step === "signed" ? (
                  <Icon name="check_circle" fill size={20} className="text-primary" />
                ) : s?.step === "failed" ? (
                  <Icon name="error" fill size={20} className="text-error" />
                ) : (
                  <Icon name="edit_note" size={20} className="text-text-secondary" />
                )}
              </span>
              <span className="flex min-w-0 flex-col">
                <span className="text-body-strong">{n.patient_name}</span>
                <span className="text-meta">
                  <When n={n} />
                  {[n.visit_reason, n.owner_name].filter(Boolean).map((x) => ` · ${x}`)}
                </span>
                {s?.step === "failed" && <span className="text-meta text-error">{s.error}</span>}
              </span>
            </li>
          );
        })}
      </ul>
      <p className="text-meta">{t("notes.signedAs", { name: signer })}</p>
      {!started && (
        <RadioCards
          aria-label={t("notes.where")}
          value={mode}
          onValueChange={(v) => setMode(v as "send" | "only")}
          className="grid-cols-1"
          options={[
            { value: "send", title: t("review.signAndSend") },
            { value: "only", title: t("review.signOnly") },
          ]}
        />
      )}
      {finished && (
        <p role="status" className={cx("text-body-strong", failed ? "text-error" : "text-primary")}>
          {failed
            ? t("notes.someFailed", { failed, count })
            : mode === "send"
              ? t("notes.allSent", { count })
              : t("notes.allSigned", { count })}
        </p>
      )}
      <div className="flex flex-wrap justify-end gap-2 pt-2">
        {finished ? (
          <Button onClick={onClose}>{t("notes.done")}</Button>
        ) : (
          <>
            <Button disabled={running} onClick={onClose}>
              {t("notes.cancel")}
            </Button>
            <Button variant="primary" icon="draw" loading={running} disabled={running} onClick={() => void signAll()}>
              {t("notes.signN", { count })}
            </Button>
          </>
        )}
      </div>
    </Dialog>
  );
}

/**
 * Notes: every note not signed yet, on any day, in two buckets. Ready to sign (nothing left to confirm
 * or decide) can be signed several at once; Pending opens each note, since something is left.
 */
export function NotesScreen() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const go = useOpen();
  useNoVisit();
  const [params, setParams] = useSearchParams();
  const bucket: Bucket = params.get("bucket") === "pending" ? "pending" : "ready";
  const { notes, me, provider, doctors } = useApp(
    useShallow((s) => ({ notes: s.notes, me: s.me, provider: s.provider, doctors: s.doctors })),
  );
  const maySign = useCan("note.sign");
  // Another vet's day is view only: their notes are theirs to sign.
  const viewOnly = me?.role === "vet" && !!provider && provider !== me.provider_id;
  const canSign = maySign && !viewOnly;
  const [picked, setPicked] = useState<string[] | null>(null);
  const [confirming, setConfirming] = useState(false);

  useEffect(() => {
    void useApp.getState().loadNotes();
  }, [provider]);

  const ready = (notes ?? []).filter((n) => n.bucket === "ready");
  const pending = (notes ?? []).filter((n) => n.bucket === "pending");
  // Every ready note is picked until the provider changes it.
  const selected = (picked ?? ready.map((n) => n.encounter_id)).filter((id) =>
    ready.some((n) => n.encounter_id === id),
  );
  const chosen = ready.filter((n) => selected.includes(n.encounter_id));
  const signer =
    me?.user?.name || chosen[0]?.provider_name || doctors.find((d) => d.id === provider)?.name || t("notes.you");
  const list = bucket === "ready" ? ready : pending;
  const openNote = (n: NoteToSign) =>
    void go.item({ appointment_id: n.appointment_id, encounter_id: n.encounter_id, date: n.date });
  const toggle = (id: string, on: boolean) =>
    setPicked(on ? [...selected.filter((x) => x !== id), id] : selected.filter((x) => x !== id));
  const all = ready.length > 0 && selected.length === ready.length;

  const cols = cx(
    "grid items-center gap-4 px-4",
    bucket === "ready" && canSign
      ? "grid-cols-[24px_minmax(120px,1fr)_minmax(150px,1fr)_minmax(0,1.4fr)_88px_auto]"
      : "grid-cols-[minmax(120px,1fr)_minmax(150px,1fr)_minmax(0,1.4fr)_88px_auto]",
    "max-[900px]:grid-cols-[auto_minmax(0,1fr)_auto]",
  );

  return (
    <>
      <div className="flex items-center gap-3">
        <IconButton
          icon="arrow_back"
          aria-label={t("notes.back")}
          title={t("notes.back")}
          onClick={() => void navigate("/")}
        />
        <h1 className="text-display">{t("notes.title")}</h1>
      </div>
      <Tabs.Root value={bucket} onValueChange={(v) => setParams({ bucket: v }, { replace: true })}>
        <Tabs.List aria-label={t("notes.buckets")}>
          <Tabs.Trigger value="ready">
            {t("notes.ready")} <span className="text-meta font-num">{notes ? ready.length : ""}</span>
          </Tabs.Trigger>
          <Tabs.Trigger value="pending">
            {t("notes.pending")} <span className="text-meta font-num">{notes ? pending.length : ""}</span>
          </Tabs.Trigger>
        </Tabs.List>
        {(["ready", "pending"] as const).map((b) => (
          <Tabs.Content key={b} value={b} className="flex flex-col pt-4">
            {b === bucket && (
              <section
                aria-label={bucket === "ready" ? t("notes.ready") : t("notes.pending")}
                className="flex flex-col"
              >
                {notes === null ? (
                  <SkeletonRows rows={3} />
                ) : !list.length ? (
                  <EmptyState icon="task_alt" size="sm">
                    {bucket === "ready" ? t("notes.noneReady") : t("notes.nonePending")}
                  </EmptyState>
                ) : (
                  <>
                    {bucket === "ready" && canSign && (
                      <div className="flex items-center gap-3 pb-3">
                        <Checkbox
                          id="selectAll"
                          className="data-[state=checked]:border-text data-[state=checked]:bg-text"
                          checked={all ? true : selected.length ? "indeterminate" : false}
                          onCheckedChange={(on) => setPicked(on === true ? ready.map((n) => n.encounter_id) : [])}
                        />
                        <label htmlFor="selectAll" className="cursor-pointer text-body-strong">
                          {t("notes.selectAll")}
                        </label>
                        <span className="text-meta">{t("notes.selected", { count: selected.length })}</span>
                      </div>
                    )}
                    <div className={cx(cols, "border-b border-divider pb-2 max-[900px]:hidden")} aria-hidden="true">
                      {bucket === "ready" && canSign && <span />}
                      <span className="text-label">{t("notes.colPet")}</span>
                      <span className="text-label">{t("notes.colVisit")}</span>
                      <span className="text-label">
                        {bucket === "ready" ? t("notes.colAssessment") : t("notes.colLeft")}
                      </span>
                      <span className="text-label">{t("notes.colWaiting")}</span>
                      <span />
                    </div>
                    <ul className="m-0 list-none p-0">
                      {list.map((n) => (
                        <li key={n.encounter_id} className={cx(cols, "border-b border-divider py-3")}>
                          {bucket === "ready" && canSign && (
                            <Checkbox
                              className="data-[state=checked]:border-text data-[state=checked]:bg-text"
                              aria-label={t("notes.pick", { pet: n.patient_name, date: wdMonthDay(n.date) })}
                              checked={selected.includes(n.encounter_id)}
                              onCheckedChange={(on) => toggle(n.encounter_id, on === true)}
                            />
                          )}
                          <span className="flex min-w-0 flex-col">
                            <span className="truncate text-body-strong">{n.patient_name}</span>
                            <span className="truncate text-meta">{n.owner_name}</span>
                            {/* Narrow: the visit and what's left fold under the pet. */}
                            <span className="hidden text-meta max-[900px]:block">
                              <When n={n} />
                              {bucket === "pending" && n.reason ? ` · ${n.reason}` : ""}
                            </span>
                          </span>
                          <span className="flex min-w-0 flex-col max-[900px]:hidden">
                            <span className="text-body">
                              <When n={n} />
                            </span>
                            <span className="truncate text-meta">{n.visit_reason}</span>
                          </span>
                          <span className="line-clamp-2 min-w-0 text-body max-[900px]:hidden">
                            {bucket === "ready" ? n.assessment : n.reason}
                          </span>
                          <span className="text-meta max-[900px]:hidden">
                            {n.waiting_days ? t("count.day", { count: n.waiting_days }) : t("day.today")}
                          </span>
                          <Button variant="link" iconEnd="chevron_right" onClick={() => openNote(n)}>
                            {bucket === "ready" ? t("notes.review") : t("notes.open")}
                          </Button>
                        </li>
                      ))}
                    </ul>
                  </>
                )}
              </section>
            )}
          </Tabs.Content>
        ))}
      </Tabs.Root>
      {bucket === "ready" && canSign && ready.length > 0 && (
        <ActionBar label={t("notes.barRegion")}>
          <ActionBarStatus
            lead={<Icon name="edit_note" className="text-text-secondary" />}
            title={t("notes.selected", { count: selected.length })}
            sub={t("notes.signedAs", { name: signer })}
          />
          <MainAction icon="draw" disabled={!selected.length} onClick={() => setConfirming(true)}>
            {t("notes.signN", { count: selected.length })}
          </MainAction>
        </ActionBar>
      )}
      {confirming && (
        <SignNotesDialog
          notes={chosen}
          signer={signer}
          onClose={() => {
            setConfirming(false);
            setPicked(null);
          }}
          onDone={() => {
            const app = useApp.getState();
            void app.loadNotes();
            void app.loadSchedule();
            void app.loadBrief();
            void app.loadWaiting();
            void useDayLeft.getState().load();
          }}
        />
      )}
    </>
  );
}
