import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { api } from "../../api";
import type { Encounter, PhotoEdit } from "../../api/types";
import { onScreen } from "../../state/nav";

const errText = (err: unknown) => (err instanceof Error ? err.message : String(err));

/** Autosave for one photo: edits go out a moment after the vet stops, only what changed. */
export function usePhotoAutosave(e: Encounter, photoId: string, setCurrent: (e: Encounter) => void) {
  const { t } = useTranslation();
  const [status, setStatus] = useState("");
  const pendingEdit = useRef<PhotoEdit>({});
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Each save waits for the one before; it resolves true once everything sent so far is saved.
  const chain = useRef<Promise<boolean>>(Promise.resolve(true));
  const flush = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    const edit = pendingEdit.current;
    if (!Object.keys(edit).length) return chain.current;
    pendingEdit.current = {};
    const here = onScreen();
    chain.current = chain.current
      .then(() => api.updatePhoto(e.id, photoId, edit))
      .then((updated) => {
        if (here()) {
          setCurrent(updated);
          setStatus(t("photo.saved"));
        }
        return true;
      })
      .catch((err: unknown) => {
        // Kept, under anything typed since, so the next save (or Save) sends it again.
        pendingEdit.current = { ...edit, ...pendingEdit.current };
        if (here()) setStatus(t("photo.notSaved", { message: errText(err) }));
        return false;
      });
    return chain.current;
  }, [e.id, photoId, setCurrent, t]);
  const queue = useCallback(
    (edit: PhotoEdit) => {
      pendingEdit.current = { ...pendingEdit.current, ...edit };
      setStatus(t("photo.saving"));
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => void flush(), 700);
    },
    [flush, t],
  );
  // Closing the edit view saves what's pending.
  useEffect(() => () => void flush(), [flush]);
  return { status, queue, flush };
}
