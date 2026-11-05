import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router";
import { useTranslation } from "react-i18next";
import { api } from "../../api";
import type {
  Clinic,
  Encounter,
  Letter,
  LetterChannel,
  LetterEdit,
  LetterKind,
  LetterRecipient,
  LetterSendResult,
  OutsideDoc,
  PastNote,
  Profile,
} from "../../api/types";
import { onScreen } from "../../state/nav";
import { useCan } from "../../state/can";
import { useApp } from "../../state/app";
import { openBlob } from "../../lib/blobs";
import { fmtDate, petFacts, webUrl } from "../../lib/format";
import { RichText } from "../visit/NoteEditor";
import { letterPath, letterTitle } from "./letters";
import {
  ActionBar,
  AiLabel,
  Alert,
  Button,
  Card,
  CheckboxField,
  Chip,
  ConfirmDialog,
  DemoTag,
  FormError,
  FormField,
  KeyValueList,
  KeyValueRow,
  LabeledValue,
  MessagePreview,
  PageHeader,
  RadioCards,
  RadioChips,
  StatusText,
  TextArea,
  TextField,
  TypingDots,
  formatPhone,
  formatPhonesIn,
} from "@blinq-scribe/ui";
import { Loading, Unavailable } from "../../components/common";

const KINDS: LetterKind[] = ["referral", "records", "owner"];
const URGENCIES = ["routine", "soon", "urgent"] as const;
const CONFIRM = /\[confirm:/g;
const errText = (err: unknown) => (err instanceof Error ? err.message : String(err));

interface Form {
  kind: LetterKind;
  recipient: { name: string; clinic: string; email: string };
  reason: string;
  urgency: (typeof URGENCIES)[number];
  /** Signed visits whose notes go with the letter. */
  notes: string[];
  photos: string[];
  docs: string[];
  invoices: boolean;
  consent: boolean;
  body: string;
}

const formOf = (l: Letter): Form => ({
  kind: l.kind,
  recipient: { ...l.recipient },
  reason: l.reason,
  urgency: (URGENCIES as readonly string[]).includes(l.urgency) ? l.urgency : "routine",
  notes: [...l.attachments.note_encounter_ids],
  photos: l.attachments.photos.map((p) => p.photo_id),
  docs: [...l.attachments.document_ids],
  invoices: l.attachments.invoice_ids.length > 0,
  consent: l.owner_consent,
  body: l.body,
});

/** Create a letter (Documents, sent): who it's for and why on the left, Blinq's draft on the right, then Send it. */
export function LetterScreen() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { patientId = "", letterId = "new" } = useParams();
  const [params] = useSearchParams();
  const isNew = letterId === "new";
  const fromVisit = params.get("encounter") ?? "";
  const canWrite = useCan("letter.write");
  const canSend = useCan("letter.send");
  const signer = useApp((s) => s.me?.user?.name) ?? "";
  // Opened from this pet's visit: going back lands on the visit.
  const atVisit = useApp((s) => s.openAppt?.patient.id === patientId);

  const [letter, setLetter] = useState<Letter | null | false>(null);
  const [profile, setProfile] = useState<Profile | null | false>(null);
  const [docs, setDocs] = useState<OutsideDoc[]>([]);
  const [contacts, setContacts] = useState<LetterRecipient[]>([]);
  const [pastNotes, setPastNotes] = useState<PastNote[]>([]);
  const [clinic, setClinic] = useState<Clinic | null>(null);
  const [invoiceIds, setInvoiceIds] = useState<string[]>([]);
  const [visit, setVisit] = useState<Encounter | null>(null);
  const [form, setForm] = useState<Form>(() => ({
    kind: (KINDS as string[]).includes(params.get("kind") ?? "") ? (params.get("kind") as LetterKind) : "referral",
    recipient: { name: "", clinic: "", email: "" },
    reason: params.get("reason") ?? "",
    urgency: "routine",
    notes: [],
    photos: [],
    docs: [],
    invoices: false,
    consent: false,
    body: "",
  }));
  const [busy, setBusy] = useState<"" | "draft" | "save" | "send">("");
  const [editing, setEditing] = useState(false);
  const [channel, setChannel] = useState<LetterChannel>("email");
  const [ownerCopy, setOwnerCopy] = useState(true);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const [results, setResults] = useState<LetterSendResult[]>([]);
  const made = useRef("");

  // The pet, its documents and past letters (for saved contacts), then the letter itself.
  useEffect(() => {
    const here = onScreen();
    void api
      .patientProfile(patientId)
      .catch(() => false as const)
      .then((p) => here() && setProfile(p));
    void api
      .documents(patientId)
      .catch(() => [])
      .then((d) => here() && setDocs(d));
    void api
      .letterhead()
      .then((c) => here() && setClinic(c))
      .catch(() => undefined);
    void api
      .contacts()
      .catch(() => [])
      .then((c) => here() && setContacts(c));
    void api
      .previousNotes(patientId)
      .catch(() => [])
      .then((n) => here() && setPastNotes(n.filter((x) => x.source === "blinq")));
  }, [patientId]);

  // The pet's invoices, attached only when the vet checks them.
  const clientId = profile ? (profile.client?.id ?? "") : "";
  useEffect(() => {
    if (!clientId) return;
    const here = onScreen();
    void api
      .invoices(clientId)
      .then((r) => here() && setInvoiceIds(r.invoices.filter((i) => i.patient_id === patientId).map((i) => i.id)))
      .catch(() => undefined);
  }, [clientId, patientId]);

  useEffect(() => {
    if (isNew) {
      setLetter(null);
      return;
    }
    // A letter made on this screen is already here; the address only caught up with it.
    if (made.current === letterId) return;
    const here = onScreen();
    api
      .letter(letterId)
      .then((l) => {
        if (!here()) return;
        setLetter(l);
        setForm(formOf(l));
      })
      .catch(() => here() && setLetter(false));
  }, [isNew, letterId]);

  const encounterId = (letter && letter.encounter_id) || fromVisit;
  useEffect(() => {
    if (!encounterId) return;
    const here = onScreen();
    void api
      .encounter(encounterId)
      .then((e) => here() && setVisit(e))
      .catch(() => undefined);
  }, [encounterId]);

  const pet = profile ? profile.patient : null;
  const client = profile ? profile.client : null;
  const petName = pet?.name || (letter ? letter.patient_name : "") || t("record.patient");
  const ownerFirst = client?.first_name || t("letters.theOwner");
  const toName = form.recipient.clinic || form.recipient.name;
  const locked = !!letter && letter.status !== "draft";
  const editable = canWrite && !locked;
  const confirms = (form.body.match(CONFIRM) ?? []).length;
  const toClinic = form.kind !== "owner";
  // Signed notes to offer: this visit's first, then the pet's other signed visits.
  const noteChoices = useMemo(() => {
    const list: { id: string; title: string; sub: string }[] = [];
    if (visit?.status === "signed")
      list.push({ id: visit.id, title: t("letters.attachNote"), sub: fmtDate(visit.signed_at) });
    for (const n of pastNotes) {
      const id = n.id.replace(/^blinq-/, "");
      if (list.some((x) => x.id === id)) continue;
      list.push({
        id,
        title: t("letters.attachPastNote", { date: fmtDate(n.date) }),
        sub: [n.provider_name, n.text.split("\n")[0]].filter(Boolean).join(" · "),
      });
    }
    return list;
  }, [visit, pastNotes, t]);

  const edit = (patch: Partial<Form>) => setForm((f) => ({ ...f, ...patch }));
  const input = useCallback(
    (f: Form): LetterEdit => ({
      kind: f.kind,
      recipient: f.recipient,
      reason: f.reason,
      urgency: f.urgency,
      body: f.body,
      owner_consent: f.consent,
      attachments: {
        note_encounter_ids: f.notes,
        photos: visit ? f.photos.map((id) => ({ encounter_id: visit.id, photo_id: id })) : [],
        document_ids: f.docs,
        invoice_ids: f.invoices ? invoiceIds : [],
      },
    }),
    [visit, invoiceIds],
  );

  /** The letter on the server as the form says: made the first time (drafted by Blinq if asked), then updated. */
  const save = async (withDraft = false): Promise<Letter> => {
    if (letter) {
      const l = await api.updateLetter(letter.id, input(form));
      setLetter(l);
      return l;
    }
    const from = fromVisit ? { encounter: fromVisit } : { patient: patientId };
    const l = await api.createLetter(from, input(form), withDraft);
    made.current = l.id;
    setLetter(l);
    void navigate(letterPath(l), { replace: true });
    return l;
  };

  const run = async (kind: "draft" | "save" | "send", work: () => Promise<void>) => {
    setBusy(kind);
    setError("");
    setStatus("");
    try {
      await work();
    } catch (err) {
      setError(errText(err));
    } finally {
      setBusy("");
    }
  };

  const draft = () =>
    run("draft", async () => {
      // A new letter is drafted as it's made; an existing one is saved first, then drafted on its own
      // (drafting is an AI step and goes alone).
      const drafted = letter ? await api.draftLetter((await save()).id) : await save(true);
      setLetter(drafted);
      edit({ body: drafted.body });
      setEditing(false);
    });

  const saveDraft = () =>
    run("save", async () => {
      await save();
      setStatus(t("letters.saved"));
    });

  // What still stands between the vet and Sign and send.
  const needs = [
    !toName && form.kind !== "owner" ? t("letters.needs.recipient") : "",
    !form.reason.trim() ? t("letters.needs.reason") : "",
    !form.body.trim() ? t("letters.needs.body") : "",
    channel === "email" && !form.recipient.email.trim() ? t("letters.needs.email") : "",
    toClinic && !form.consent ? t("letters.needs.consent") : "",
  ].filter(Boolean);

  const signAndSend = () =>
    run("send", async () => {
      const l = await save();
      const sent = await api.sendLetter(l.id, [channel], form.recipient.email.trim(), channel === "email" && ownerCopy);
      setLetter(sent.letter);
      setResults(sent.results);
    });

  const remove = () =>
    run("save", async () => {
      if (letter) await api.deleteLetter(letter.id);
      void navigate(-1);
    });

  const openPdf = async () => {
    if (!letter) return;
    try {
      await openBlob(() => api.letterPdfUrl(letter.id));
    } catch (err) {
      setError(t("letters.couldNotOpen", { message: errText(err) }));
    }
  };

  const attachable = useMemo(
    () => ({
      photos: visit?.photos ?? [],
      docs,
    }),
    [visit, docs],
  );

  if (letter === false) return <Unavailable what={t("letters.what")} />;
  if (!isNew && !letter) return <Loading />;

  const re = [
    petName,
    pet ? petFacts(pet) : "",
    client ? t("record.ownerName", { name: [client.first_name, client.last_name].filter(Boolean).join(" ") }) : "",
    t(`letters.urgency.${form.urgency}`),
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <>
      <PageHeader
        eyebrow={t("letters.eyebrow", { name: petName })}
        title={letter && letter.status !== "draft" ? letterTitle(letter, ownerFirst) : t("letters.title")}
        sub={t("letters.sub", { name: petName })}
        actions={
          <Button icon="arrow_back" onClick={() => void navigate(-1)}>
            {fromVisit || atVisit ? t("letters.backToVisit") : t("letters.backTo", { name: petName })}
          </Button>
        }
      />
      {locked && letter && <Alert icon="lock">{t("letters.signedLocked", { name: letter.signed_by })}</Alert>}
      {!canWrite && !locked && <Alert icon="visibility">{t("letters.notAllowed")}</Alert>}

      <div className="letter-grid">
        <Card as="section" aria-labelledby="letterFormTitle">
          <Card.Title id="letterFormTitle">{t("letters.letter")}</Card.Title>
          <fieldset className="contents" disabled={!editable}>
            <div role="group" aria-label={t("letters.kind")} className="flex flex-wrap gap-2">
              {KINDS.map((k) => (
                <Chip key={k} pressed={form.kind === k} disabled={!editable} onClick={() => edit({ kind: k })}>
                  {t(`letters.kinds.${k}`)}
                </Chip>
              ))}
            </div>
            {contacts.length > 0 && editable && form.kind !== "owner" && (
              <div className="flex flex-col gap-2">
                <span className="text-meta">{t("letters.savedContacts")}</span>
                <div className="flex flex-wrap gap-2">
                  {contacts.map((c) => (
                    <Chip
                      key={c.email}
                      icon="contact_mail"
                      className="h-auto min-h-8 max-w-full py-1 text-left whitespace-normal"
                      selected={form.recipient.email === c.email}
                      onClick={() => edit({ recipient: { ...c } })}
                    >
                      {[c.name, c.clinic].filter(Boolean).join(" · ")}
                    </Chip>
                  ))}
                </div>
              </div>
            )}
            <FormField
              id="letterName"
              label={t(`letters.recipient.${form.kind}`)}
              hint={form.kind !== "owner" ? t("letters.newContactHelp") : undefined}
            >
              <TextField
                value={form.recipient.name}
                placeholder={
                  form.kind === "owner" ? [client?.first_name, client?.last_name].filter(Boolean).join(" ") : ""
                }
                onChange={(ev) => edit({ recipient: { ...form.recipient, name: ev.target.value } })}
              />
            </FormField>
            {form.kind !== "owner" && (
              <FormField id="letterClinic" label={t("letters.recipientClinic")}>
                <TextField
                  value={form.recipient.clinic}
                  onChange={(ev) => edit({ recipient: { ...form.recipient, clinic: ev.target.value } })}
                />
              </FormField>
            )}
            <FormField id="letterEmail" label={t("letters.recipientEmail")}>
              <TextField
                type="email"
                value={form.recipient.email}
                placeholder={form.kind === "owner" ? (client?.emails[0] ?? "") : ""}
                onChange={(ev) => edit({ recipient: { ...form.recipient, email: ev.target.value } })}
              />
            </FormField>
            <FormField id="letterReason" label={t(`letters.reason.${form.kind}`)}>
              <TextArea
                minHeight={96}
                value={form.reason}
                placeholder={t(`letters.reasonPh.${form.kind}`)}
                onChange={(ev) => edit({ reason: ev.target.value })}
              />
            </FormField>
            {form.kind === "referral" && (
              <LabeledValue id="letterSoon" label={t("letters.howSoon")}>
                <RadioChips
                  aria-label={t("letters.howSoon")}
                  value={form.urgency}
                  disabled={!editable}
                  onValueChange={(v) => edit({ urgency: v as Form["urgency"] })}
                  options={URGENCIES.map((u) => ({ value: u, label: t(`letters.urgency.${u}`) }))}
                />
              </LabeledValue>
            )}
            <div className="flex flex-col gap-1" role="group" aria-labelledby="letterAttach">
              <span className="text-meta" id="letterAttach">
                {t("letters.attach")}
              </span>
              {noteChoices.map((n) => (
                <CheckboxField
                  key={n.id}
                  id={`attachNote-${n.id}`}
                  className="attach-row"
                  label={<AttachLabel title={n.title} sub={n.sub} />}
                  checked={form.notes.includes(n.id)}
                  disabled={!editable}
                  onCheckedChange={(v) =>
                    edit({ notes: v === true ? [...form.notes, n.id] : form.notes.filter((x) => x !== n.id) })
                  }
                />
              ))}
              {visit && visit.status !== "signed" && (
                <p className="text-meta py-1">{t("letters.attachNoteNotYet")}</p>
              )}
              {attachable.photos.map((p) => (
                <CheckboxField
                  key={p.id}
                  id={`attachPhoto-${p.id}`}
                  className="attach-row"
                  label={<AttachLabel title={t("letters.attachPhoto")} sub={p.label || p.caption} />}
                  checked={form.photos.includes(p.id)}
                  disabled={!editable}
                  onCheckedChange={(v) =>
                    edit({ photos: v === true ? [...form.photos, p.id] : form.photos.filter((x) => x !== p.id) })
                  }
                />
              ))}
              {attachable.docs.map((d) => (
                <CheckboxField
                  key={d.id}
                  id={`attachDoc-${d.id}`}
                  className="attach-row"
                  label={
                    <AttachLabel
                      title={d.name}
                      sub={[t("count.page", { count: d.pages || 1 }), d.uploaded_at ? fmtDate(d.uploaded_at) : ""]
                        .filter(Boolean)
                        .join(" · ")}
                    />
                  }
                  checked={form.docs.includes(d.id)}
                  disabled={!editable}
                  onCheckedChange={(v) =>
                    edit({ docs: v === true ? [...form.docs, d.id] : form.docs.filter((x) => x !== d.id) })
                  }
                />
              ))}
              {invoiceIds.length > 0 && (
                <CheckboxField
                  id="attachInvoices"
                  className="attach-row"
                  label={
                    <AttachLabel
                      title={t("letters.attachInvoices", { count: invoiceIds.length })}
                      sub={t("letters.attachInvoicesHelp")}
                    />
                  }
                  checked={form.invoices}
                  disabled={!editable}
                  onCheckedChange={(v) => edit({ invoices: v === true })}
                />
              )}
              {!noteChoices.length && !attachable.photos.length && !attachable.docs.length && !invoiceIds.length && (
                <p className="text-meta py-1">{t("letters.nothingToAttach")}</p>
              )}
            </div>
            {toClinic && (
              <div className="consent-box">
                <CheckboxField
                  id="letterConsent"
                  label={
                    <AttachLabel
                      title={t("letters.consent", { owner: ownerFirst, to: toName || t("letters.anotherClinic") })}
                      sub={t("letters.consentHelp")}
                    />
                  }
                  checked={form.consent}
                  disabled={!editable}
                  onCheckedChange={(v) => edit({ consent: v === true })}
                />
              </div>
            )}
          </fieldset>
        </Card>

        <div className="flex min-w-0 flex-col gap-2">
          <Card as="section" aria-labelledby="letterDraftTitle">
            <Card.Header>
              <AiLabel>
                <span id="letterDraftTitle">{t("letters.draftedFrom", { name: petName })}</span>
                {letter && letter.drafted === "mock" && <DemoTag>{t("letters.demoDraft")}</DemoTag>}
              </AiLabel>
              <span className="row">
                {editable && form.body && !editing && (
                  <Button variant="link" icon="edit" onClick={() => setEditing(true)}>
                    {t("letters.edit")}
                  </Button>
                )}
                {letter && (
                  <Button variant="link" icon="picture_as_pdf" onClick={() => void openPdf()}>
                    {t("letters.previewPdf")}
                  </Button>
                )}
              </span>
            </Card.Header>
            {busy === "draft" ? (
              <div className="letter-page theme-light flex flex-col gap-2" aria-busy="true">
                <AiLabel size="sm">
                  <TypingDots />
                  {t("letters.drafting", { name: petName })}
                </AiLabel>
              </div>
            ) : form.body || editing ? (
              <article className="letter-page theme-light" aria-label={t("letters.letterBody")}>
                <div className="letterhead">
                  {clinic && (
                    <span className="flex min-w-0 flex-col">
                      <b className="text-title">{clinic.name}</b>
                      <span className="text-meta">
                        {[clinic.address, formatPhone(clinic.phone)].filter(Boolean).join(" · ")}
                      </span>
                    </span>
                  )}
                  <span className="text-meta ml-auto">
                    {fmtDate(letter ? letter.updated_at : new Date().toISOString())}
                  </span>
                </div>
                {form.kind !== "owner" && (
                  <p>
                    {form.recipient.name}
                    {form.recipient.clinic && (
                      <>
                        <br />
                        {form.recipient.clinic}
                      </>
                    )}
                  </p>
                )}
                <p className="text-body-strong">{t("letters.re", { line: re })}</p>
                {editing ? (
                  <div className="sec-editor">
                    <TextArea
                      aria-label={t("letters.letterBody")}
                      autoFocus
                      minHeight={320}
                      value={form.body}
                      onChange={(ev) => edit({ body: ev.target.value })}
                      onKeyDown={(ev) => ev.key === "Escape" && setEditing(false)}
                    />
                    <div className="flex justify-end">
                      <Button size="sm" onClick={() => setEditing(false)}>
                        {t("letters.done")}
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="letter-body">
                    <RichText text={form.body} />
                  </div>
                )}
                <p className="flex flex-col">
                  <span>{(letter && (letter.signer_title || letter.signed_by)) || signer}</span>
                  {!(letter && letter.signed_by) && <span className="text-meta">{t("letters.signedWhenSent")}</span>}
                </p>
              </article>
            ) : (
              <div className="flex flex-col items-start gap-3">
                <p className="text-meta">{t("letters.draftHelp")}</p>
                {editable && (
                  <Button variant="primary" icon="auto_awesome" disabled={!!busy} onClick={() => void draft()}>
                    {t("letters.draftWithBlinq")}
                  </Button>
                )}
              </div>
            )}
            {editable && form.body && busy !== "draft" && (
              <div>
                <Button variant="link" icon="refresh" disabled={!!busy} onClick={() => void draft()}>
                  {t("letters.draftAgain")}
                </Button>
              </div>
            )}
          </Card>
          <p className="text-meta px-1">{t("letters.rules")}</p>
        </div>
      </div>

      {(editable || results.length > 0) && canSend && (
        <Card as="section" aria-labelledby="sendTitle">
          <Card.Title id="sendTitle">{t("letters.sendIt")}</Card.Title>
          {!locked && (
            <>
              <RadioCards
                aria-label={t("letters.sendIt")}
                value={channel}
                onValueChange={(v) => setChannel(v as LetterChannel)}
                options={[
                  {
                    value: "email",
                    icon: "forward_to_inbox",
                    title: t("letters.channels.email.title"),
                    description: form.recipient.email
                      ? t("letters.channels.email.sub", { to: form.recipient.email })
                      : t("letters.channels.emailNoAddress"),
                  },
                  {
                    value: "owner_text",
                    icon: "sms",
                    title: t("letters.channels.owner_text.title", { owner: ownerFirst }),
                    description: t("letters.channels.owner_text.sub"),
                  },
                  {
                    value: "print",
                    icon: "print",
                    title: t("letters.channels.print.title"),
                    description: t("letters.channels.print.sub"),
                  },
                ]}
              />
              {channel === "email" && (
                <CheckboxField
                  id="ownerCopy"
                  label={t("letters.ownerCopy", { owner: ownerFirst })}
                  checked={ownerCopy}
                  onCheckedChange={(v) => setOwnerCopy(v === true)}
                />
              )}
            </>
          )}
          {results.map((r, i) => (
            <SendResult key={i} r={r} owner={ownerFirst} />
          ))}
          {locked && results.length > 0 && (
            <div>
              <Button icon="arrow_back" onClick={() => void navigate(-1)}>
                {t("letters.backToDocs", { name: petName })}
              </Button>
            </div>
          )}
        </Card>
      )}
      <FormError>{error}</FormError>
      <StatusText>{status}</StatusText>
      {/* Sign and send stays in reach while the vet reads the letter, like Sign note. */}
      {editable && canSend && !locked && (
        <ActionBar label={t("letters.sendRegion")}>
          <Button
            variant="primary"
            icon={channel === "print" ? "print" : "send"}
            loading={busy === "send"}
            disabled={!!busy || confirms > 0 || needs.length > 0}
            onClick={() => void signAndSend()}
          >
            {channel === "print" ? t("letters.signAndPrint") : t("letters.signAndSend")}
          </Button>
          <Button loading={busy === "save"} disabled={!!busy} onClick={() => void saveDraft()}>
            {t("letters.saveDraft")}
          </Button>
          {confirms > 0 ? (
            <span className="text-meta text-ai">{t("letters.toConfirm", { count: confirms })}</span>
          ) : (
            needs[0] && <span className="text-meta">{needs[0]}</span>
          )}
          {letter && (
            <ConfirmDialog
              trigger={
                <Button variant="danger-ghost" icon="delete">
                  {t("letters.deleteDraft")}
                </Button>
              }
              title={t("letters.deleteTitle")}
              description={t("letters.deleteHelp")}
              confirmLabel={t("letters.delete")}
              cancelLabel={t("letters.keep")}
              tone="danger"
              onConfirm={() => void remove()}
            />
          )}
        </ActionBar>
      )}
    </>
  );
}

function AttachLabel({ title, sub }: { title: string; sub?: string }) {
  return (
    <span className="flex flex-col">
      <span>{title}</span>
      {sub && <span className="text-meta">{sub}</span>}
    </span>
  );
}

/** What a send did; in demo mode, exactly what would have gone out. */
function SendResult({ r, owner }: { r: LetterSendResult; owner: string }) {
  const { t } = useTranslation();
  if (r.status === "failed" || r.status === "skipped")
    return <Alert tone="error">{t("letters.result.failed", { detail: r.detail })}</Alert>;
  if (r.channel === "print")
    return (
      <Alert tone="success" icon="print">
        {t("letters.result.print")}
      </Alert>
    );
  if (r.status === "preview")
    return (
      <MessagePreview role="status" className="gap-2">
        <b>{r.channel === "email" ? t("letters.result.emailPreview") : t("letters.result.textPreview", { owner })}</b>
        <KeyValueList>
          {r.channel === "email" ? (
            <>
              <KeyValueRow label={t("letters.result.to")} value={formatPhonesIn(r.to)} />
              <KeyValueRow label={t("letters.result.subject")} value={r.subject} />
            </>
          ) : (
            webUrl(r.url) && <KeyValueRow label={t("letters.result.link")} value={webUrl(r.url)} />
          )}
        </KeyValueList>
        <p className="m-0 whitespace-pre-wrap [overflow-wrap:anywhere]">{r.channel === "email" ? r.body : r.text}</p>
      </MessagePreview>
    );
  return (
    <Alert tone="success" icon="check_circle">
      {r.channel === "email"
        ? t("letters.result.emailSent", { to: formatPhonesIn(r.to) })
        : t("letters.result.textSent", { owner })}
    </Alert>
  );
}
