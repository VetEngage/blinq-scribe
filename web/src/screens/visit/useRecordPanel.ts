import { useEffect, useState } from "react";
import { api } from "../../api";
import type { RecordPanelData } from "../../api/types";
import { onScreen } from "../../state/nav";

/** A pet's Record panel data: null while it loads, false when it couldn't. Not read when `skip`. */
export function useRecordPanel(petId: string, skip = false): RecordPanelData | null | false {
  const [got, setGot] = useState<{ petId: string; data: RecordPanelData | false } | null>(null);
  useEffect(() => {
    if (skip) return;
    const here = onScreen();
    void api
      .recordPanel(petId)
      .catch(() => false as const)
      .then((data) => here() && setGot({ petId, data }));
  }, [petId, skip]);
  return got?.petId === petId ? got.data : null;
}
