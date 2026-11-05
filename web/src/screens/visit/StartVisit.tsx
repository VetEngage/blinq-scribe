import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import type { Appointment } from "../../api/types";
import { ActionBar, ActionBarStatus, MainAction } from "@blinq-scribe/ui";
import { StateLine } from "./parts";

const SOON_MIN = 60;

/** Minutes until the appointment starts, rechecked every half minute; null once it has started. */
function useMinutesUntil(start: string): number | null {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(id);
  }, []);
  const at = new Date(start).getTime();
  if (Number.isNaN(at) || at <= now) return null;
  return Math.ceil((at - now) / 60_000);
}

/** The practice says the pet is here: "Checked In", "checked_in", "Arrived". */
const checkedIn = (status: string): boolean => /check(ed)?[\s_-]*in|arrived|in[\s_-]*room/i.test(status || "");

/**
 * Where the appointment stands before it starts, as the banner's gray state line, when the practice
 * system says: "Checked in · starts in 12 min", or "Starts in 12 min" within the hour. Nothing when
 * it doesn't know.
 */
export function ArrivalState({ appt }: { appt: Appointment }) {
  const { t } = useTranslation();
  const mins = useMinutesUntil(appt.start);
  const here = checkedIn(appt.status);
  if (here)
    return (
      <StateLine>
        {mins !== null && mins <= SOON_MIN ? t("visit.checkedInStarts", { count: mins }) : t("visit.checkedIn")}
      </StateLine>
    );
  if (mins !== null && mins <= SOON_MIN) return <StateLine>{t("visit.startsIn", { count: mins })}</StateLine>;
  return null;
}

/**
 * Start visit, the one main action before the visit, in the pinned bar: it opens the visit straight away.
 * Nothing records yet: Start recording asks whether the owner agreed (see consent.tsx).
 */
export function StartVisitBar({
  busy,
  onStart,
  lead,
  status,
  error,
}: {
  appt: Appointment;
  busy: boolean;
  onStart: () => void;
  /** Before the status. */
  lead?: React.ReactNode;
  /** What starts: "Sick visit · Exam 1". */
  status: string;
  error?: string;
}) {
  const { t } = useTranslation();
  return (
    <ActionBar label={t("visit.startRegion")}>
      <span className="flex min-w-0 flex-[1_1_0] items-center gap-3">
        {lead}
        <ActionBarStatus title={status} sub={error ? <span className="tone-error">{error}</span> : undefined} />
      </span>
      <MainAction icon="mic" loading={busy} onClick={onStart}>
        {t("before.start")}
      </MainAction>
    </ActionBar>
  );
}
