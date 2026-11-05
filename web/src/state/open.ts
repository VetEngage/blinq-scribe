import { useCallback, useMemo } from "react";
import { useNavigate } from "react-router";
import { api } from "../api";
import type { Appointment, OpenItem, SearchResults } from "../api/types";
import { useApp } from "./app";
import { rememberPatient } from "./recent";
import type { RecordTab } from "../screens/record/record";

export type SearchPet = SearchResults["pets"][number];
export interface PatientRef {
  id: string;
  client_id: string;
  name?: string;
  species?: string;
  breed?: string;
  sex?: string;
  age?: number | null;
  owner_name?: string;
  last_visit?: { date: string; reason: string } | null;
  next_visit?: { date: string; time: string; appointment_id: string } | null;
}

/** `followup`: open the review scrolled to that follow up, highlighted. */
export const visitPath = (appt: Appointment, encounterId = "", followup = ""): string => {
  const day = String(appt.start).slice(0, 10);
  const params = new URLSearchParams({ date: day });
  if (encounterId) params.set("e", encounterId);
  if (followup) params.set("f", followup);
  return `/visit/${encodeURIComponent(appt.id)}?${params}`;
};

/** The record page: the owner's household, on one pet (else the first) and one tab (else Overview). */
export const recordPath = (clientId: string, petId = "", tab?: RecordTab, documentId = ""): string => {
  const q = new URLSearchParams();
  if (petId) q.set("pet", petId);
  if (tab) q.set("tab", tab);
  if (documentId) q.set("doc", documentId);
  const s = q.toString();
  return `/record/${encodeURIComponent(clientId)}${s ? `?${s}` : ""}`;
};

/** A pet's record when only the pet is known: the old patient address finds its owner, then lands on the record. */
const patientPath = (patientId: string, tab?: RecordTab, documentId = ""): string => {
  const q = new URLSearchParams();
  if (tab) q.set("tab", tab);
  if (documentId) q.set("doc", documentId);
  const s = q.toString();
  return `/patient/${encodeURIComponent(patientId)}${s ? `?${s}` : ""}`;
};

/** Where a brief or to do row goes. */
export type ItemTarget =
  | { to: "visit"; appointment_id?: string; encounter_id?: string; date?: string; followup?: string }
  | { to: "household"; client_id: string; patient_id?: string; tab?: RecordTab }
  | { to: "documents"; patient_id: string; client_id?: string; document_id?: string };

/** Ways to move around the console. Each one is a navigation, so it bumps the navigation token. */
export function useOpen() {
  const navigate = useNavigate();

  const appointment = useCallback(
    (appt: Appointment, encounterId = "", followup = "") => {
      useApp.setState({ openAppt: appt });
      rememberPatient({
        id: appt.patient.id,
        client_id: appt.patient.client_id || appt.client.id,
        name: appt.patient.name,
        species: appt.patient.species,
        breed: appt.patient.breed,
        owner_name: [appt.client.first_name, appt.client.last_name].filter(Boolean).join(" "),
      });
      void navigate(visitPath(appt, encounterId, followup));
    },
    [navigate],
  );

  // Open whatever an item points at (to do, end of day, tomorrow): its day, then its visit.
  const item = useCallback(
    async (it: Partial<OpenItem> & { date?: string }, followup = "") => {
      const app = useApp.getState();
      if (it.date && it.date !== app.viewDate) await app.goToDay(it.date);
      const appts = useApp.getState().appts;
      const appt =
        appts.find((a) => a.id === it.appointment_id) ??
        appts.find((a) => !!it.encounter_id && a.encounter_id === it.encounter_id);
      if (appt) return appointment(appt, it.encounter_id ?? "", followup);
      if (!it.encounter_id) return;
      const e = await api.encounter(it.encounter_id).catch(() => null);
      const a2 = e && useApp.getState().appts.find((a) => a.id === e.appointment_id);
      if (a2 && e) appointment(a2, e.id, followup);
    },
    [appointment],
  );

  /** A pet's record; a pet with a visit still to come today opens that visit instead. */
  const patient = useCallback(
    async (p: PatientRef) => {
      const app = useApp.getState();
      if (p.next_visit?.appointment_id && (!p.next_visit.date || p.next_visit.date === app.today)) {
        if (app.viewDate !== app.today) await app.goToDay(app.today);
        const appt = useApp.getState().appts.find((a) => a.id === p.next_visit?.appointment_id);
        if (appt) return appointment(appt);
      }
      if (p.client_id && p.name)
        rememberPatient({
          id: p.id,
          client_id: p.client_id,
          name: p.name,
          species: p.species,
          breed: p.breed,
          owner_name: p.owner_name,
        });
      void navigate(p.client_id ? recordPath(p.client_id, p.id) : patientPath(p.id));
    },
    [appointment, navigate],
  );

  /** A household's record: its first pet, or the one asked for, on Overview or the tab asked for. */
  const household = useCallback(
    (clientId: string, petId = "", tab?: RecordTab) => void navigate(recordPath(clientId, petId, tab)),
    [navigate],
  );

  /** Go where a brief or to do row points: a visit (maybe one follow up), a record, or a pet's Documents. */
  const target = useCallback(
    (to: ItemTarget) => {
      if (to.to === "visit") return void item(to, to.followup ?? "");
      if (to.to === "household") return household(to.client_id, to.patient_id, to.tab);
      void navigate(
        to.client_id
          ? recordPath(to.client_id, to.patient_id, "documents", to.document_id)
          : patientPath(to.patient_id, "documents", to.document_id),
      );
    },
    [item, household, navigate],
  );

  return useMemo(
    () => ({ appointment, item, patient, household, target }),
    [appointment, item, patient, household, target],
  );
}
