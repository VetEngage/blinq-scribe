import { useEffect, useState } from "react";
import { api } from "../../api";
import type { Encounter } from "../../api/types";
import { onScreen } from "../../state/nav";

/**
 * The encounters of a group visit, primary first, kept in step with the one on screen. A new `version`
 * reads them again (after a line moved from one pet's note to another's, or a sign).
 */
export function useGroup(current: Encounter, version = 0): Encounter[] {
  const [group, setGroup] = useState<Encounter[]>([]);
  useEffect(() => {
    if (!current.group_id) return;
    const here = onScreen();
    api
      .group(current.group_id)
      .then((l) => {
        if (here()) setGroup(l);
      })
      .catch(() => undefined);
  }, [current.group_id, version]);
  return group.map((g) => (g.id === current.id ? current : g));
}
