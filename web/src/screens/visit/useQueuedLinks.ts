import { useEffect } from "react";
import { api } from "../../api";
import type { Encounter } from "../../api/types";
import { onScreen } from "../../state/nav";

// With background work on, booking links go out a moment after signing. Look again a few times
// until none is still queued, so the screen doesn't keep saying it's on its way.
const RECHECK_MS = [2000, 5000, 10000];
const hasQueuedLink = (e: Encounter) =>
  e.followups.some((f) => f.status === "approved" && f.booking_link?.status === "queued");

export function useQueuedLinks(e: Encounter, setCurrent: (e: Encounter) => void) {
  const queued = hasQueuedLink(e);
  const id = e.id;
  useEffect(() => {
    if (!queued) return;
    const here = onScreen();
    let stopped = false;
    const timers = RECHECK_MS.map((ms) =>
      setTimeout(() => {
        if (stopped) return;
        void api
          .encounter(id)
          .then((fresh) => {
            if (stopped || !here()) return;
            setCurrent(fresh);
            if (!hasQueuedLink(fresh)) stopped = true;
          })
          .catch(() => undefined);
      }, ms),
    );
    return () => {
      stopped = true;
      timers.forEach(clearTimeout);
    };
  }, [id, queued, setCurrent]);
}
