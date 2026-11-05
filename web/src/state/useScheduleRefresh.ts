import { useEffect } from "react";
import type { Appointment } from "../api/types";

export const SCHEDULE_REFRESH_MS = 15_000;

/**
 * Whether the schedule should poll: some visit on the day is started but not signed. Audio can begin
 * on any of them (the glasses), and the row has to show Recording within a poll. Once every visit is
 * not started or signed, nothing is left to change, so the polling stops.
 */
export const hasOpenVisit = (appts: Appointment[]): boolean =>
  appts.some((a) => a.visit_status !== "not_started" && a.visit_status !== "signed");

/**
 * While a visit is in progress, refresh the schedule every 15 seconds so Recording follows the audio
 * (the schedule isn't pushed). Nothing runs while the tab is hidden; coming back refreshes at once.
 */
export function useScheduleRefresh(active: boolean, refresh: () => void) {
  useEffect(() => {
    if (!active) return;
    const tick = () => {
      if (!document.hidden) refresh();
    };
    const timer = setInterval(tick, SCHEDULE_REFRESH_MS);
    document.addEventListener("visibilitychange", tick);
    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", tick);
    };
  }, [active, refresh]);
}
