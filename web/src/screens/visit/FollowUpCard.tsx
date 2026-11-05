import { useState } from "react";
import { useTranslation } from "react-i18next";
import { api, type FollowUpBody } from "../../api";
import type { Appointment, Encounter, FollowUp } from "../../api/types";
import { useApp } from "../../state/app";
import { onScreen } from "../../state/nav";
import { addDays, followupTitle, monthDay, webUrl, ymd } from "../../lib/format";
import { linkStatusText, reminderText } from "./linkStatus";
import {
  Alert,
  Button,
  Card,
  CheckboxField,
  FormField,
  Icon,
  MessagePreview,
  RadioCards,
  RadioChips,
  StatusText,
  TextArea,
  formatDateTime,
  formatPhone,
} from "@blinq-scribe/ui";
import { useNavigate } from "react-router";
import { useCan } from "../../state/can";
import { newLetterPath } from "../record/letters";
import { shownAt } from "../../lib/demoTime";

const ICONS: Record<string, string> = {
  recheck: "event_repeat",
  client_update: "sms",
  callback: "call",
  lab_result: "science",
  task: "task_alt",
};

/**
 * One follow up: Approve, Dismiss, and for a recheck, Send a booking link (the owner picks the time)
 * or Book it now (the vet picks the time).
 */
export function FollowUpCard({
  f,
  e,
  appt,
  onUpdated,
  focused,
}: {
  f: FollowUp;
  e: Encounter;
  appt: Appointment;
  onUpdated: (e: Encounter) => void;
  /** Opened from the brief or To do for this follow up: highlighted. */
  focused?: boolean;
}) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const canLetter = useCan("letter.write");
  const done = f.status !== "draft";
  const booked = f.booking?.status === "written";
  const isRecheck = f.kind === "recheck";
  const [mode, setMode] = useState<"link" | "book">(f.booking_mode || (isRecheck ? "link" : "book"));
  const [slot, setSlot] = useState(f.suggested_slots[0]?.start ?? "");
  const [message, setMessage] = useState(f.message_draft);
  const [remind, setRemind] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const canBook = isRecheck && f.suggested_slots.length > 0 && !booked && f.status !== "dismissed";
  const owner = appt.client.first_name || t("followup.theOwner");
  // The days the owner can pick from: the link's own once it's made, else the window the server
  // makes it with (around the due date, from the visit's own day), never the closest slots' day.
  const visitDay = ymd(new Date(appt.start));
  const dueDay = f.due_in_days ? addDays(visitDay, f.due_in_days) : "";
  const spread = Math.max(2, Math.floor((f.due_in_days ?? 0) / 7));
  const slotDays = f.suggested_slots.map((x) => ymd(new Date(x.start))).sort();
  const from =
    f.booking_link?.from || (dueDay ? [addDays(dueDay, -spread), addDays(visitDay, 1)].sort()[1] : slotDays[0]);
  const to = f.booking_link?.to || (dueDay ? addDays(dueDay, spread) : slotDays[slotDays.length - 1]);
  const title = followupTitle(f);
  // The reason in full only when it says more than the title.
  const details = f.reason.trim() && f.reason.trim() !== title ? f.reason.trim() : "";
  const win = !from
    ? ""
    : monthDay(from) === monthDay(to || from)
      ? t("followup.windowOn", { date: monthDay(from) })
      : t("followup.window", { from: monthDay(from), to: monthDay(to || from) });
  const showModes = isRecheck && !done;
  const linkMode = showModes && mode === "link";
  const sub = [
    f.due_in_days ? t("followup.inDays", { count: f.due_in_days }) : "",
    dueDay ? t("followup.dueOn", { date: monthDay(dueDay) }) : "",
    isRecheck && f.suggested_slots.length ? t("count.openTime", { count: f.suggested_slots.length }) : "",
  ]
    .filter(Boolean)
    .join(" · ");
  const hasMessage = !!f.message_draft || f.kind !== "task";

  const act = async (action: FollowUpBody["action"]) => {
    const here = onScreen();
    setBusy(true); // one click, one booking
    setError("");
    const body: FollowUpBody = {
      action,
      message_draft: hasMessage && !done && action !== "book" ? message : null,
      slot_start: action === "dismiss" || linkMode || !slot ? null : slot,
      ...(showModes && action === "approve" ? { booking_mode: mode } : {}),
      ...(linkMode && action === "approve" ? { remind_unbooked: remind } : {}),
    };
    try {
      const updated = await api.followUp(e.id, f.id, body);
      useApp.getState().refreshAfter(appt);
      if (here()) onUpdated(updated);
    } catch (err) {
      if (here()) {
        setError(err instanceof Error ? err.message : String(err));
        setBusy(false);
      }
    }
  };

  const slots =
    canBook && (!done ? !linkMode : !f.booking_link) ? (
      <RadioChips
        aria-label={t("followup.recheckTime")}
        value={slot}
        onValueChange={setSlot}
        disabled={busy}
        options={f.suggested_slots.map((s) => ({ value: s.start, label: formatDateTime(s.start) }))}
      />
    ) : null;

  return (
    <Card density="compact" id={`fu-${f.id}`} highlighted={focused} className="scroll-mt-4">
      <div className="followup-head">
        <Icon name={ICONS[f.kind] ?? "task_alt"} />
        <span className="followup-title">
          <b className="truncate" title={title}>
            {title}
          </b>
          {sub && <span className="text-meta whitespace-nowrap">{sub}</span>}
        </span>
        {f.suggest_letter && canLetter && (
          <Button
            size="sm"
            icon="send"
            onClick={() =>
              void navigate(newLetterPath(e.patient_id, "referral", { encounter: e.id, reason: details || title }))
            }
          >
            {t("followup.createLetter")}
          </Button>
        )}
      </div>
      {details && (
        <details className="followup-details">
          <summary>{t("followup.details")}</summary>
          <p className="line-clamp-3">{details}</p>
        </details>
      )}
      {showModes && (
        <>
          <RadioCards
            aria-label={t("followup.howToBook")}
            value={mode}
            onValueChange={(v) => setMode(v as "link" | "book")}
            disabled={busy}
            options={[
              {
                value: "link",
                icon: "link",
                title: t("followup.linkTitle"),
                description: t("followup.linkHelp", { owner, window: win }),
              },
              ...(f.suggested_slots.length > 0
                ? [
                    {
                      value: "book",
                      icon: "event_available",
                      title: t("followup.bookTitle"),
                      description: t("followup.bookHelp"),
                    },
                  ]
                : []),
            ]}
          />
          {linkMode && (
            <>
              <CheckboxField
                id={`remind-${f.id}`}
                checked={remind}
                disabled={busy}
                onCheckedChange={(v) => setRemind(v === true)}
                label={t("followup.remind", { owner })}
              />
            </>
          )}
        </>
      )}
      {slots}
      {hasMessage && !done && (
        <FormField
          id={`msg-${f.id}`}
          label={t("followup.textToOwner")}
        >
          <TextArea
            placeholder={t("followup.messagePlaceholder")}
            value={message}
            onChange={(ev) => setMessage(ev.target.value)}
          />
        </FormField>
      )}
      {done ? (
        f.status === "approved" ? (
          <>
            <Alert
              icon="check_circle"
              iconClassName="text-primary"
              action={
                f.sms?.status === "failed" ? (
                  <Button variant="link" icon="refresh" disabled={busy} onClick={() => void act("retry_text")}>
                    {t("followup.retry")}
                  </Button>
                ) : null
              }
            >
              {t("followup.approved")}
              {f.booking &&
                (f.booking.status === "written" ? (
                  f.booked_slot ? (
                    t("followup.booked", { when: formatDateTime(f.booked_slot.start) })
                  ) : (
                    ""
                  )
                ) : (
                  <>
                    {" "}
                    <span className="text-error">{f.booking.detail}</span>
                  </>
                ))}
              {f.booking_link && !f.booked_slot ? ` ${linkStatusText(f, appt, e.status === "signed")}` : ""}
              {reminderText(f) ? ` ${reminderText(f)}.` : ""}
              {f.sms &&
                (f.sms.status === "sent" ? (
                  t("followup.texted", { to: formatPhone(f.sms.to_masked) })
                ) : f.sms.status === "failed" ? (
                  <>
                    {" "}
                    <span className="text-error">{t("followup.textFailed", { detail: f.sms.detail })}</span>
                  </>
                ) : f.sms.status === "preview" ? (
                  t("followup.textReady")
                ) : (
                  t("followup.textingOff")
                ))}
            </Alert>
            {f.sms?.status === "preview" && <MessagePreview label={t("followup.demoText")} text={f.sms.text} />}
            <LinkPreview f={f} />
            {canBook && !f.booking_link && (
              <div>
                <Button icon="event_available" disabled={busy} onClick={() => void act("book")}>
                  {t("followup.bookThis")}
                </Button>
              </div>
            )}
          </>
        ) : (
          <Alert icon={null}>{t("followup.dismissed")}</Alert>
        )
      ) : (
        <div className="row">
          <Button variant="primary" icon="check" disabled={busy} onClick={() => void act("approve")}>
            {t("followup.approve")}
          </Button>
          <Button disabled={busy} onClick={() => void act("dismiss")}>
            {t("followup.dismiss")}
          </Button>
        </div>
      )}
      <StatusText>{error}</StatusText>
    </Card>
  );
}

/** Only the link the owner gets. The booking page itself is the clinic's online booking. */
function LinkPreview({ f }: { f: FollowUp }) {
  const { t } = useTranslation();
  const l = f.booking_link;
  if (!l?.url || f.booked_slot || (f.sms?.status === "preview" && String(f.sms.text).includes(l.url))) return null;
  const href = webUrl(l.url);
  return (
    <span className="text-meta">
      {t("followup.bookingLink")}
      {href ? (
        <a href={href} target="_blank" rel="noopener">
          {l.url}
        </a>
      ) : (
        l.url
      )}
      {l.expires_at ? t("followup.worksUntil", { date: monthDay(shownAt(l.expires_at)) }) : ""}
    </span>
  );
}
