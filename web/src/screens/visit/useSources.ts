import { useEffect, useState } from "react";
import { api } from "../../api";
import type { AssistResult, SectionKey } from "../../api/types";

/** Where each sentence of a section came from in the transcript: asked for once per text, never saved. */
export function useSources(encounterId: string, k: SectionKey | "vitals", text: string, skip = false) {
  const [found, setFound] = useState<{ text: string; result: AssistResult } | null>(null);
  useEffect(() => {
    if (skip || !text.trim()) return;
    let live = true;
    const id = setTimeout(() => {
      void api
        .assist(encounterId, { section: k, action: "sources", text, instruction: "" })
        .then((result) => live && setFound({ text, result }))
        .catch(() => undefined);
    }, 150);
    return () => {
      live = false;
      clearTimeout(id);
    };
  }, [encounterId, k, text, skip]);
  return found?.text === text ? found.result : null;
}
