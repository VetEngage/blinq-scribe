import { useEffect, useState } from "react";
import { Navigate, useParams, useSearchParams } from "react-router";
import { useTranslation } from "react-i18next";
import { api } from "../../api";
import { useApp } from "../../state/app";
import { onScreen } from "../../state/nav";
import { recordPath } from "../../state/open";
import { Loading, Unavailable } from "../../components/common";
import { RecordView } from "./RecordView";
import { isRecordTab, type RecordTab } from "./record";

/**
 * The record on its own page, /record/:clientId?pet=&tab=: from search, To do, a pet's name or a
 * household link. Full width beside the left column; the owner is the page's Display. No visit, so
 * no pinned bar and nothing green. The pet and tab are in the address, so a reload or a link lands there.
 */
export function RecordScreen() {
  const { clientId = "" } = useParams();
  const [params, setParams] = useSearchParams();
  const pet = params.get("pet") ?? "";
  const asked = params.get("tab");
  const tab: RecordTab = isRecordTab(asked) ? asked : "overview";

  useEffect(() => {
    useApp.setState({ openAppt: null, current: null, openPatient: { id: pet, client_id: clientId } });
  }, [pet, clientId]);

  const go = (next: { pet?: string; tab?: RecordTab }) => {
    const q = new URLSearchParams(params);
    if (next.pet !== undefined) {
      q.set("pet", next.pet);
      q.delete("doc"); // the document to open belonged to the last pet
    }
    if (next.tab !== undefined) q.set("tab", next.tab);
    setParams(q, { replace: true });
  };

  return (
    <RecordView
      key={clientId}
      clientId={clientId}
      petId={pet}
      onPet={(id) => go({ pet: id })}
      tab={tab}
      onTab={(t) => go({ tab: t })}
      placement="page"
      openDocument={params.get("doc") ?? ""}
    />
  );
}

/** The old household page, /household/:clientId: the record, first pet. */
export function HouseholdRedirect() {
  const { clientId = "" } = useParams();
  return <Navigate replace to={recordPath(clientId)} />;
}

/** The old patient page, /patient/:patientId: the record with that pet, its owner looked up when the link doesn't say. */
export function PatientRedirect() {
  const { t } = useTranslation();
  const { patientId = "" } = useParams();
  const [params] = useSearchParams();
  const tab = params.get("tab") ?? "";
  const doc = params.get("doc") ?? "";
  const given = params.get("client") ?? "";
  const [found, setFound] = useState<string | null | false>(given || null);

  useEffect(() => {
    if (given) return;
    const here = onScreen();
    api
      .patientProfile(patientId)
      .then((p) => p.client?.id || p.patient.client_id || false)
      .catch(() => false as const)
      .then((id) => here() && setFound(id));
  }, [patientId, given]);

  if (found === null) return <Loading />;
  if (!found) return <Unavailable what={t("record.what")} />;
  return <Navigate replace to={recordPath(found, patientId, isRecordTab(tab) ? tab : undefined, doc)} />;
}
