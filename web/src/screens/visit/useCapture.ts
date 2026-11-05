import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { api } from "../../api";
import type { Appointment, Encounter } from "../../api/types";
import { useApp } from "../../state/app";
import { onScreen } from "../../state/nav";
import { useRecorder, waitForUploads } from "../../recorder/store";
import { useToast } from "@blinq-scribe/ui";
import { rest } from "../../api/rest";
import { askConsent } from "./consentStore";

/** Capture shared by Visit in progress and Review: transcript (typed, pasted, recorded) and photos. */
export function useCapture(
  appt: Appointment,
  current: Encounter,
  setCurrent: (e: Encounter) => void,
  setStatus: (s: string) => void,
) {
  const { t } = useTranslation();
  const toast = useToast();
  const [transcript, setTranscript] = useState(current.transcript);
  const recording = useRecorder((s) => s.encounterId === current.id);
  const shown = useRef(current.transcript);
  const localWrites = useRef(0);

  // A newer transcript from the server (recording, the glasses) replaces the box, unless the vet typed in it.
  useEffect(() => {
    setTranscript((mine) => (mine === shown.current ? current.transcript : mine));
    shown.current = current.transcript;
  }, [current.transcript]);

  const toggleRecord = () => {
    const rec = useRecorder.getState();
    if (rec.encounterId) rec.stop();
    else void startRecording();
  };
  // Nothing records until the owner agreed: asked once per visit, at the first Start recording, and saved
  // with the visit before any audio goes up (the server refuses audio until then).
  const startRecording = async () => {
    if (!current.consent_recorded) {
      const owner = appt.client.first_name || appt.client.last_name || "";
      if (!(await askConsent(owner))) return;
      try {
        setCurrent(await rest.recordConsent(current.id));
      } catch (err) {
        setStatus(err instanceof Error ? err.message : String(err));
        return;
      }
    }
    void useRecorder.getState().start(current.id);
  };
  /** Saves `text` (the box by default). True once saved. */
  const save = async (text?: string): Promise<boolean> => {
    const here = onScreen();
    useRecorder.getState().stop();
    await waitForUploads(); // let a part still at the speech model land before the box replaces it
    if (!here()) return false;
    localWrites.current++;
    try {
      const sent = text ?? transcript;
      const saved = await api.saveTranscript(current.id, sent);
      if (!here()) return false;
      // The box shows what was saved (as the server stored it), unless the vet typed while it saved.
      setTranscript((mine) => (mine === sent ? saved.transcript : mine));
      shown.current = saved.transcript;
      setCurrent(saved);
      setStatus("");
      toast.show(t("visit.saved"));
      return true;
    } catch (err) {
      if (here()) setStatus(err instanceof Error ? err.message : String(err));
      return false;
    }
  };
  // Saved straight away, so the server names who said each line and the transcript shows as speaker rows.
  const sample = async () => {
    const here = onScreen();
    const r = await api.sampleTranscript(appt.id).catch(() => null);
    if (!here() || !r) return;
    setTranscript(r.text);
    await save(r.text);
  };
  const photo = async (file: File, hint: string) => {
    const here = onScreen();
    setStatus(t("visit.readingPhoto"));
    localWrites.current++;
    try {
      const updated = await api.uploadPhoto(current.id, file, hint);
      if (!here()) return;
      setStatus("");
      setCurrent(updated);
      useApp.getState().refreshAfter(appt);
    } catch (err) {
      if (here()) setStatus(t("visit.photoNotAdded", { message: err instanceof Error ? err.message : String(err) }));
    }
  };
  return { transcript, setTranscript, recording, toggleRecord, sample, save, photo, shown, localWrites };
}
