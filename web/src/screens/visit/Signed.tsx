import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { api } from "../../api";
import type { Appointment, Encounter, FollowUp, Profile, ShareResult, Summary } from "../../api/types";
import { useApp } from "../../state/app";
import { onScreen } from "../../state/nav";
import { useOpen, visitPath } from "../../state/open";
import { useNavigate } from "react-router";
import { keepBlob, openBlob, showBlob } from "../../lib/blobs";
import { andList, followupTitle, monthDay, possessive, webUrl } from "../../lib/format";
import { FollowUpCard } from "./FollowUpCard";
import { linkStatusText, reminderText, sharedLinkText, waitsFor } from "./linkStatus";
import { PetTabs } from "./household";
import { useGroup } from "./useGroup";
import { useQueuedLinks } from "./useQueuedLinks";
import { PhotosCard, StateLine, VisitHeader } from "./parts";
import { VisitPanel } from "./visitTabs";
import { SignedNote } from "./NoteView";
import { PimsItems, PimsLine } from "./PimsStatus";
import { usePims } from "./usePims";

import {
  ActionBar,
  ActionBarStatus,
  MainAction,
  Alert,
  Button,
  Card,
  DemoTag,
  Icon,
  KeyValueList,
  KeyValueRow,
  ListRow,
  MessagePreview,
  RadioCards,
  Segmented,
  formatDateTime,
  formatPhone,
  formatPhonesIn,
  formatTime,
  maskPhone,
} from "@blinq-scribe/ui";
import { shownAt } from "../../lib/demoTime";
import { Loading } from "../../components/common";

/**
 * The signed visit. The banner says it once: Signed by Dr. Ana Rivera at 9:28 AM, then Saved to the
 * PIMS (which opens the per item list) and, once sent, the summary. The page holds, in order, anything
 * not saved, Share the visit summary until it's sent, one Follow ups list and the signed note. The
 * pinned bar holds the single next step: Send to the PIMS, else Send summary, else the next visit.
 */
export function Signed({
  appt,
  current: e,
  profile,
  setCurrent,
}: {
  appt: Appointment;
  current: Encounter;
  profile: Profile | null | false;
  setCurrent: (e: Encounter) => void;
}) {
  const { t } = useTranslation();
  const go = useOpen();
  const navigate = useNavigate();
  const appts = useApp((s) => s.appts);
  const noteTypes = useApp((s) => s.noteTypes);
  const group = useGroup(e);
  // A household visit: another pet's note still to sign comes first, and the summary waits for it, so
  // the owner gets one text for every pet.
  const petLeft = group.find((g) => g.id !== e.id && g.status !== "signed");
  useQueuedLinks(e, setCurrent);
  const pims = usePims(e, setCurrent);
  const share = useShare(appt, e, profile);
  const canShare = e.can?.share !== false;
  const next = appts
    .filter((a) => a.id !== appt.id && a.start > appt.start && a.visit_status !== "signed")
    .sort((a, b) => a.start.localeCompare(b.start))[0];
  const step = pims.canSend ? "pims" : petLeft ? "pet" : canShare && !share.done ? "share" : next ? "next" : null;
  // The step bar: Share until the summary goes, then Follow up while anything waits on the provider.
  const followOpen = e.followups.some(
    (f) => f.status === "draft" || f.sms?.status === "failed" || (!!f.booking && f.booking.status !== "written"),
  );
  const at = canShare && !share.done ? "share" : followOpen ? "follow" : "done";

  // The item list opens on its own when something Blinq sends isn't saved.
  const [pimsOpen, setPimsOpen] = useState(pims.needsVet);
  useEffect(() => {
    if (pims.needsVet) setPimsOpen(true);
  }, [pims.needsVet]);
  // The note opens when nothing is left to do but the next visit.
  const [noteOpen, setNoteOpen] = useState(step === "next" || step === null);
  const typeName = noteTypes.find((n) => n.id === e.note_type)?.name ?? "";
  // What isn't in the PIMS, in words: "The note", "2 photos", "The note and 1 photo".
  const unsaved = pims.counted.filter((i) => i.status !== "synced");
  const noteLeft = unsaved.some((i) => i.kind === "note");
  const photosLeft = unsaved.filter((i) => i.kind === "photo").length;
  const photoWords = t("pims.photos", { count: photosLeft });
  const unsavedWhat =
    noteLeft && photosLeft
      ? t("pims.and", { a: t("pims.theNote"), b: photoWords })
      : noteLeft
        ? t("pims.theNote")
        : photoWords;

  return (
    <>
      <VisitHeader
        appt={appt}
        current={e}
        step={at}
        state={
          <>
            <StateLine icon="check_circle" iconClassName="tone-success">
              {e.signed_at
                ? t("visit.stateSignedAt", { who: e.signed_by, time: formatTime(shownAt(e.signed_at)) })
                : t("visit.stateSigned", { who: e.signed_by })}
            </StateLine>
            {pims.items.length > 0 && (
              <StateLine indent>
                <PimsLine pims={pims} open={pimsOpen} onToggle={() => setPimsOpen((o) => !o)} />
              </StateLine>
            )}
            {share.line && <StateLine indent>{share.line}</StateLine>}
          </>
        }
      />
      <VisitPanel>
        <PetTabs appt={appt} current={e} group={group} />
        {pimsOpen && <PimsItems e={e} pims={pims} onUpdated={setCurrent} />}
        {group.length > 1 && !petLeft && (
          <p className="text-meta">{t("signed.oneText", { pets: t("count.pet", { count: group.length }) })}</p>
        )}
        {canShare && !share.done && !petLeft && <ShareCard share={share} />}
        {share.done && <SharedCard share={share} />}
        <FollowUps e={e} appt={appt} setCurrent={setCurrent} group={group} />
        {e.note && (
          <Card as="section" aria-labelledby="signedNoteTitle">
            <div className="flex items-center gap-3">
              <Card.Title id="signedNoteTitle" className="flex-1">
                {t("signed.signedNote")}
              </Card.Title>
              {typeName && <span className="text-meta">{typeName}</span>}
              <Button
                variant="ghost"
                size="sm"
                icon={noteOpen ? "expand_less" : "expand_more"}
                aria-expanded={noteOpen}
                aria-controls="signedNoteBody"
                aria-label={noteOpen ? t("signed.hideNote") : t("signed.showNote")}
                onClick={() => setNoteOpen((o) => !o)}
              />
            </div>
            {noteOpen && (
              <div id="signedNoteBody">
                <SignedNote note={e.note} noteType={e.note_type} />
              </div>
            )}
          </Card>
        )}
        {e.photos.length > 0 && <PhotosCard e={e} setCurrent={setCurrent} />}
      </VisitPanel>
      {step && (
        <ActionBar label={t("signed.region")}>
          <span className="flex min-w-0 flex-[1_1_0] items-center gap-3">
            {step === "pims" ? (
              <ActionBarStatus
                title={
                  pims.overall === "failed"
                    ? t("pims.lineFailed")
                    : t("pims.barNotSaved", { count: pims.counted.length - pims.saved, what: unsavedWhat })
                }
                sub={
                  pims.overall === "failed"
                    ? e.pims_next_try_at
                      ? t("pims.nextTry", { time: formatTime(shownAt(e.pims_next_try_at)) })
                      : t("pims.retrying")
                    : undefined
                }
              />
            ) : step === "pet" && petLeft ? (
              <ActionBarStatus
                title={t("rail.signedOf", {
                  signed: group.filter((g) => g.status === "signed").length,
                  count: group.length,
                })}
                sub={t("signed.petLeft", { whose: possessive(petLeft.patient_name) })}
              />
            ) : step === "share" ? (
              <ActionBarStatus title={share.how} sub={share.what} />
            ) : (
              next && (
                <ActionBarStatus
                  title={
                    <>
                      <span className="text-body text-text-secondary">{t("signed.nextLabel")}</span>{" "}
                      {t("signed.nextAt", { name: next.patient.name, time: formatTime(next.start) })}
                    </>
                  }
                  sub={[next.reason, next.room].filter(Boolean).join(" · ")}
                />
              )
            )}
          </span>
          {step === "pims" ? (
            <MainAction icon="cloud_upload" loading={pims.sending} onClick={() => void pims.send()}>
              {pims.overall === "failed" ? t("pims.tryAgain") : t("pims.send")}
            </MainAction>
          ) : step === "pet" && petLeft ? (
            <MainAction icon="arrow_forward" onClick={() => void navigate(visitPath(appt, petLeft.id))}>
              {t("review.reviewPet", { pet: petLeft.patient_name })}
            </MainAction>
          ) : step === "share" ? (
            // Named for what it does and to whom: "Text summary to Jordan", the owner's way first.
            <MainAction
              icon={share.channel === "print" ? "print" : share.channel === "email" ? "mail" : "sms"}
              loading={share.busy}
              disabled={!share.ready}
              onClick={() => void share.send()}
            >
              {share.channel === "print"
                ? t("share.printSummary")
                : share.channel === "email"
                  ? t("signed.emailSummary", { name: share.o.first })
                  : t("signed.textSummary", { name: share.o.first })}
            </MainAction>
          ) : (
            next && (
              <MainAction icon="arrow_forward" onClick={() => go.appointment(next)}>
                {t("signed.nextPrimary", { name: next.patient.name })}
              </MainAction>
            )
          )}
        </ActionBar>
      )}
    </>
  );
}

/**
 * One Follow ups list: a line per item, a green check (done) then gray detail. A failed text is red with
 * Retry text. Anything still waiting for the vet (approve, or book a time) keeps its full card.
 */
function FollowUps({
  e,
  appt,
  setCurrent,
  group,
}: {
  e: Encounter;
  appt: Appointment;
  setCurrent: (e: Encounter) => void;
  /** A household visit's notes, one per pet: their rechecks share one link. */
  group: Encounter[];
}) {
  const { t } = useTranslation();
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  if (!e.followups.length) return null;

  const retry = async (f: FollowUp) => {
    const here = onScreen();
    setBusy(f.id);
    setError("");
    try {
      const updated = await api.followUp(e.id, f.id, { action: "retry_text", message_draft: null, slot_start: null });
      useApp.getState().refreshAfter(appt);
      if (here()) setCurrent(updated);
    } catch (err) {
      if (here()) setError(err instanceof Error ? err.message : String(err));
    }
    if (here()) setBusy("");
  };

  // Waiting on the vet: approve or dismiss, or an approved recheck with no link that still needs a time.
  const needsCard = (f: FollowUp) =>
    f.status === "draft" ||
    (f.status === "approved" &&
      f.kind === "recheck" &&
      f.suggested_slots.length > 0 &&
      !f.booking_link &&
      !f.booked_slot &&
      f.booking?.status !== "written");

  const row = (f: FollowUp) => {
    const failed = f.sms?.status === "failed" || (!!f.booking && f.booking.status !== "written");
    if (f.status === "dismissed")
      return <ListRow key={f.id} lead="remove" title={followupTitle(f)} meta={t("signed.followUpDismissed")} />;
    const l = f.booking_link;
    const due = l?.from
      ? l.to && l.to !== l.from
        ? t("signed.dueRange", { from: monthDay(l.from), to: monthDay(l.to) })
        : t("signed.due", { from: monthDay(l.from) })
      : "";
    const parts: React.ReactNode[] = [];
    if (f.booked_slot)
      parts.push(
        `${t("signed.recheckBooked")} · ${t("signed.recheckWith", {
          when: formatDateTime(f.booked_slot.start),
          vet: appt.provider_name,
        })}`,
      );
    else if (f.booking && f.booking.status !== "written")
      parts.push(
        <span key="b" className="tone-error">
          {f.booking.detail}
        </span>,
      );
    const shared = sharedLinkText(l?.pets);
    if (shared) parts.push(shared);
    const waiting = l && !f.booked_slot ? waitsFor(f, e, group) : [];
    if (waiting.length)
      parts.push(
        `${due}${t("followup.waitsFor", {
          whose: andList(waiting.map(possessive)),
          owner: appt.client.first_name || t("followup.theOwnerLower"),
        })}`.trim(),
      );
    else if (l && !f.booked_slot) parts.push(`${due}${linkStatusText(f, appt, true)}`.trim());
    const reminder = reminderText(f);
    if (reminder)
      parts.push(
        f.reminder?.status === "failed" ? (
          <span key="r" className="tone-error">
            {reminder}
          </span>
        ) : (
          reminder
        ),
      );
    if (f.sms?.status === "sent") parts.push(t("followup.texted", { to: formatPhone(f.sms.to_masked) }).trim());
    else if (f.sms?.status === "failed")
      parts.push(
        <span key="s" className="tone-error">
          {t("followup.textFailed", { detail: f.sms.detail })}
        </span>,
      );
    else if (f.sms?.status === "preview") parts.push(t("followup.textReady").trim());
    else if (f.sms) parts.push(t("followup.textingOff").trim());
    return (
      <div key={f.id}>
        <ListRow
          lead={failed ? "error" : "check"}
          leadClassName={failed ? "text-error" : "text-primary"}
          title={
            l?.pets && l.pets.length > 1 ? t("followup.sharedTitle", { pets: andList(l.pets) }) : followupTitle(f)
          }
          meta={
            parts.length ? (
              <>
                {parts.map((p, i) => (
                  <span key={i}>
                    {i > 0 && " · "}
                    {p}
                  </span>
                ))}
              </>
            ) : undefined
          }
          action={
            f.sms?.status === "failed" ? (
              <Button variant="link" icon="refresh" disabled={busy === f.id} onClick={() => void retry(f)}>
                {t("followup.retry")}
              </Button>
            ) : undefined
          }
        />
        {f.sms?.status === "preview" && f.sms.text && (
          <details className="followup-details ps-8 pb-2">
            <summary>{t("signed.showText")}</summary>
            <MessagePreview label={t("followup.demoText")} text={f.sms.text} />
          </details>
        )}
      </div>
    );
  };

  const cards = e.followups.filter(needsCard);
  const rows = e.followups.filter((f) => !needsCard(f));
  return (
    <Card as="section" aria-labelledby="followUpsTitle">
      <Card.Title id="followUpsTitle">{t("signed.followUps")}</Card.Title>
      {rows.length > 0 && <div className="[&>*:first-child>*:first-child]:border-t-0">{rows.map(row)}</div>}
      {cards.map((f) => (
        <FollowUpCard
          key={`${f.id}:${f.status}:${f.sms?.status ?? ""}`}
          f={f}
          e={e}
          appt={appt}
          onUpdated={setCurrent}
        />
      ))}
      {error && (
        <p className="text-meta text-error" role="alert">
          {error}
        </p>
      )}
    </Card>
  );
}

type Channel = "text" | "email" | "print";
type Shared = { r: ShareResult; at: string };

/**
 * Sharing the visit summary: the channel and language picked on the card, sent from the pinned bar.
 * Only the For the owner section, medicines, home care and next visit. Every pet in a visit has the
 * same owner, so the record's profile has their contact.
 */
function useShare(appt: Appointment, e: Encounter, profile: Profile | null | false) {
  const { t } = useTranslation();
  const c = profile ? profile.client : null;
  const a = appt.client;
  const o = {
    first: c?.first_name || a.first_name || t("followup.theOwnerLower"),
    phone: (c?.phones ?? a.phones ?? [])[0] ?? "",
    email: (c?.emails ?? a.emails ?? [])[0] ?? "",
    prefers: c?.prefers || a.prefers || "",
  };
  const [lang, setLang] = useState<"en" | "es">("en");
  const [picked, setPicked] = useState<Channel | null>(null);
  const channel: Channel = picked ?? (o.prefers === "email" && o.email ? "email" : "text");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<ShareResult | { error: string } | null>(null);
  const [shared, setShared] = useState<Shared | null>(null);
  const [fallback, setFallback] = useState("");
  const [preview, setPreview] = useState<Summary | "loading" | "error" | null>(null);

  const loadPreview = async (l = lang) => {
    const here = onScreen();
    setPreview("loading");
    const s = await api.summary(e.id, l).catch(() => null);
    if (here()) setPreview(s ?? "error");
  };
  const openPdf = async (l = lang) => {
    setFallback("");
    try {
      const r = await openBlob(() => api.summaryPdfUrl(e.id, l));
      if (r.fallbackUrl) setFallback(r.fallbackUrl);
    } catch (err) {
      setError({ error: err instanceof Error ? err.message : String(err) });
    }
  };
  const send = async () => {
    const here = onScreen();
    const id = e.id,
      ch = channel,
      l = lang;
    setBusy(true);
    setError(null);
    // Print opens the PDF tab inside the click so the browser allows it.
    const w = ch === "print" ? window.open("", "_blank") : null;
    try {
      const r = await api.share(id, ch, l);
      if (!here()) {
        w?.close();
        return;
      }
      if (r.status === "failed") setError(r);
      else setShared({ r, at: new Date().toISOString() });
      if (ch === "print" && r.status !== "failed") {
        const url = await api.summaryPdfUrl(id, l);
        if (!here()) {
          w?.close();
          URL.revokeObjectURL(url);
          return;
        }
        if (w) showBlob(w, url);
        else {
          keepBlob(url);
          setFallback(url);
        }
      }
    } catch (err) {
      w?.close();
      if (here()) setError({ error: err instanceof Error ? err.message : String(err) });
    }
    if (here()) setBusy(false);
  };

  const masked = o.phone ? maskPhone(o.phone) : "";
  const how = channel === "text" ? t("share.text") : channel === "email" ? t("share.email") : t("share.print");
  const to = channel === "text" ? masked : channel === "email" ? o.email : "";
  const language = lang === "es" ? t("share.spanish") : t("share.english");
  const time = shared ? formatTime(shownAt(shared.at)) : "";
  const line = !shared
    ? ""
    : shared.r.channel === "text"
      ? shared.r.status === "preview"
        ? t("signed.summaryTextedDemo", { time })
        : t("signed.summaryTexted", { to: masked, time })
      : shared.r.channel === "email"
        ? t("signed.summaryEmailed", { to: o.email, time })
        : shared.r.channel === "print"
          ? t("signed.summaryPrinted", { time })
          : t("signed.summaryPdf", { time });
  return {
    o,
    lang,
    setLang: (l: "en" | "es") => {
      setLang(l);
      if (preview) void loadPreview(l);
    },
    channel,
    setChannel: setPicked,
    busy,
    error,
    shared,
    done: !!shared,
    fallback,
    preview,
    loadPreview,
    openPdf,
    send,
    // The bar can send only where it can reach the owner.
    ready: channel === "text" ? !!o.phone : channel === "email" ? !!o.email : true,
    how,
    what: t("signed.shareWhat", { how: to || t("share.printSub"), language }),
    line,
  };
}

type ShareState = ReturnType<typeof useShare>;

/** Share the visit summary: how and in which language. The pinned bar sends it. */
function ShareCard({ share }: { share: ShareState }) {
  const { t } = useTranslation();
  const { o, lang, channel } = share;
  return (
    <Card as="section" aria-labelledby="shareTitle">
      <Card.Header>
        <Card.Title id="shareTitle">{t("share.title", { first: o.first })}</Card.Title>
        <Segmented
          aria-label={t("share.language")}
          value={lang}
          onValueChange={(v) => share.setLang(v as "en" | "es")}
          options={[
            { value: "en", label: t("share.english") },
            { value: "es", label: t("share.spanish") },
          ]}
        />
      </Card.Header>
      <p className="text-meta">{t("share.what")}</p>
      <RadioCards
        aria-label={t("share.how")}
        value={channel}
        onValueChange={(v) => share.setChannel(v as Channel)}
        options={[
          {
            value: "text",
            icon: "sms",
            title: t("share.text"),
            description: o.phone
              ? `${o.prefers === "text" ? t("share.prefersTexts", { first: o.first }) : ""}${maskPhone(o.phone)}`
              : t("share.noPhone"),
          },
          {
            value: "email",
            icon: "mail",
            title: t("share.email"),
            description: o.email || t("share.noEmail"),
          },
          { value: "print", icon: "print", title: t("share.print"), description: t("share.printSub") },
        ]}
      />
      <div className="row">
        <Button variant="link" icon="smartphone" onClick={() => void share.loadPreview()}>
          {t("share.previewPage")}
        </Button>
        <Button variant="link" icon="picture_as_pdf" onClick={() => void share.openPdf()}>
          {t("share.previewPdf")}
        </Button>
      </div>
      <div aria-live="polite">
        {share.error && <ShareResultView r={share.error} onOpenPdf={() => void share.openPdf()} />}
        {share.fallback && (
          <a className="text-body-strong" href={share.fallback} target="_blank" rel="noopener">
            {t("record.openTheFile")}
          </a>
        )}
      </div>
      {share.preview && <SummaryPreview s={share.preview} lang={lang} first={o.first} />}
    </Card>
  );
}

/**
 * Once sent, the Share card goes and the banner says so. What went stays here only when there's
 * something to see: the text itself (in demo mode, the text the owner would get) or the PDF.
 */
function SharedCard({ share }: { share: ShareState }) {
  const { t } = useTranslation();
  const r = share.shared?.r;
  if (!r || (!r.text && r.channel === "text" && !share.fallback && r.translated !== false)) return null;
  return (
    <Card as="section" aria-label={share.line} aria-live="polite">
      <ShareResultView r={r} onOpenPdf={() => void share.openPdf()} quiet />
      {share.fallback && (
        <a className="text-body-strong" href={share.fallback} target="_blank" rel="noopener">
          {t("record.openTheFile")}
        </a>
      )}
    </Card>
  );
}

function ShareResultView({
  r,
  onOpenPdf,
  quiet,
}: {
  r: ShareResult | { error: string };
  onOpenPdf: () => void;
  /** Sent: the banner's status line already says so, so only what went shows. */
  quiet?: boolean;
}) {
  const { t } = useTranslation();
  if ("error" in r)
    return (
      <Alert tone="error" urgent>
        {t("share.failed", { message: r.error })}
      </Alert>
    );
  if (r.status === "failed")
    return (
      <Alert tone="error" urgent>
        {t("share.notSent", { detail: r.detail })}
      </Alert>
    );
  const expires = r.expires_at ? t("share.expires", { date: monthDay(shownAt(r.expires_at)) }) : "";
  const line =
    r.status === "preview"
      ? t("share.previewLine", { expires })
      : r.status === "sent"
        ? r.detail
          ? formatPhonesIn(`${r.detail}.${expires}`.replace(/\.\./g, "."))
          : t("share.sentLine", { expires })
        : r.channel === "print"
          ? t("share.printed")
          : r.detail || t("share.pdfReady");
  return (
    <>
      {r.translated === false && (
        <p className="text-meta">
          <Icon name="translate" /> {t("share.spanishFallback")}
        </p>
      )}
      {quiet ? (
        r.channel !== "text" && (
          <div>
            <Button variant="link" icon="open_in_new" onClick={onOpenPdf}>
              {t("share.openPdf")}
            </Button>
          </div>
        )
      ) : (
        <Alert
          tone="success"
          action={
            r.channel !== "text" ? (
              <Button variant="link" icon="open_in_new" onClick={onOpenPdf}>
                {t("share.openPdf")}
              </Button>
            ) : null
          }
        >
          {line}
        </Alert>
      )}
      {r.text && (
        <MessagePreview
          label={r.status === "preview" ? t("followup.demoText") : t("followup.ownerGot")}
          text={r.text}
        />
      )}
    </>
  );
}

function SummaryPreview({ s, lang, first }: { s: Summary | "loading" | "error"; lang: "en" | "es"; first: string }) {
  const { t } = useTranslation();
  if (s === "loading") return <Loading />;
  if (s === "error") return <p className="text-meta">{t("share.previewUnavailable")}</p>;
  const es = lang === "es";
  const list = (title: string, items: string[]) =>
    items.length ? (
      <div>
        <b>{title}</b>
        <ul>
          {items.map((x, i) => (
            <li key={i}>{x}</li>
          ))}
        </ul>
      </div>
    ) : null;
  return (
    <div className="summary-preview">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <span className="text-meta">{t("share.previewTitle", { first })}</span>
        {s.mock && <DemoTag>{t("share.demo")}</DemoTag>}
      </div>
      {s.translated === false && <p className="text-meta">{t("share.spanishFallback")}</p>}
      <div>
        <b className="text-body-strong">{s.clinic.name}</b>
        <br />
        <span className="text-meta">{[s.clinic.address, formatPhone(s.clinic.phone)].filter(Boolean).join(" · ")}</span>
      </div>
      <div className="divided flex flex-col gap-1">
        <b>{es ? t("share.visitDetailsEs") : t("share.visitDetails")}</b>
        <KeyValueList>
          <KeyValueRow label={es ? t("share.dateEs") : t("share.date")} value={s.visit.when} hideEmpty />
          {s.pets.map((p) => (
            <KeyValueRow
              key={p.patient_id}
              label={es ? t("share.petEs") : t("share.pet")}
              value={[p.name, p.species, p.breed, p.sex, p.age_text].filter(Boolean).join(" · ")}
            />
          ))}
          <KeyValueRow label={es ? t("share.ownerEs") : t("share.owner")} value={s.owner_name} hideEmpty />
          <KeyValueRow label={es ? t("share.seenByEs") : t("share.seenBy")} value={s.visit.provider_name} hideEmpty />
        </KeyValueList>
      </div>
      {s.pets.map((p) => (
        <div key={p.patient_id} className="divided flex flex-col gap-2">
          <b className="text-section">{p.name}</b>
          <p className="pre">{p.for_owner}</p>
          {list(es ? t("share.medicinesEs") : t("share.medicines"), p.medicines)}
          {list(es ? t("share.homeCareEs") : t("share.homeCare"), p.home_care)}
          {p.next_visit && p.next_visit.kind !== "none" && (
            <div>
              <b>{es ? t("share.nextVisitEs") : t("share.nextVisit")}</b>
              <br />
              {p.next_visit.text}
              {p.next_visit.kind === "pick_a_time" && webUrl(p.next_visit.url) && (
                <>
                  {" "}
                  <a href={webUrl(p.next_visit.url)} target="_blank" rel="noopener">
                    {es ? t("share.pickTimeEs") : t("share.pickTime")}
                  </a>
                </>
              )}
            </div>
          )}
        </div>
      ))}
      {s.when_to_call && (
        <div className="divided">
          <b>{es ? t("share.whenToCallEs") : t("share.whenToCall")}</b>
          <p>{s.when_to_call}</p>
        </div>
      )}
    </div>
  );
}
