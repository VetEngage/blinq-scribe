import { useEffect, useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import type { Appointment, Encounter } from "../../api/types";
import { useApp } from "../../state/app";
import { keepPlace, readPlace } from "../../state/visitMemory";
import { Tabs } from "@blinq-scribe/ui";
import { RecordView } from "../record/RecordView";
import type { RecordTab } from "../record/record";
import { useVisitTabs, VisitTabsContext, type VisitTab } from "./visitTabState";

/**
 * Visit | Record on every visit page, at the top of the content card. Recording, the draft and the
 * pinned bar carry on under either tab: the Visit panel is only hidden, never unmounted. A new step of
 * the visit (started, drafting, drafted, signed) comes back to the Visit tab, where that step is. Where
 * the provider was (tab, pet, section) is kept, so a reload or signing back in lands there again.
 */
export function VisitTabsProvider({
  visitKey,
  petId,
  stage,
  appt,
  current,
  children,
}: {
  /** The appointment: what this page remembers its tab by. */
  visitKey: string;
  petId: string;
  stage: string;
  appt: Appointment;
  current: Encounter | null;
  children: ReactNode;
}) {
  const [back] = useState(() => readPlace(visitKey));
  const [tab, setTabState] = useState<VisitTab>(back?.tab ?? "visit");
  const [pet, setPet] = useState(back?.pet || petId);
  const [section, setSection] = useState<RecordTab>((back?.section as RecordTab) || "overview");
  const [opened, setOpened] = useState(back?.tab === "record");
  const [lastStage, setLastStage] = useState(stage);
  if (stage !== lastStage) {
    setLastStage(stage);
    // Loading the visit isn't a new step.
    if (lastStage !== "loading") setTabState("visit");
  }
  useEffect(() => {
    keepPlace(visitKey, { tab, pet, section });
  }, [visitKey, tab, pet, section]);
  const setTab = (next: VisitTab) => {
    if (next === "record") setOpened(true);
    setTabState(next);
  };
  const showRecord = (id: string) => {
    setPet(id);
    setTab("record");
    // Keyboard and screen reader users land on the tab that just opened.
    requestAnimationFrame(() => document.getElementById("visitTab-record")?.focus());
  };
  return (
    <VisitTabsContext.Provider
      value={{ tab, setTab, pet, setPet, section, setSection, opened, showRecord, appt, current }}
    >
      <Tabs.Root value={tab} onValueChange={(v) => setTab(v as VisitTab)} className="contents">
        {children}
      </Tabs.Root>
    </VisitTabsContext.Provider>
  );
}

/** Visit | Record, at the top of the content card. */
export function VisitTabList() {
  const { t } = useTranslation();
  const tabs = useVisitTabs();
  if (!tabs) return null;
  return (
    <Tabs.List aria-label={t("visitTabs.label")} className="visit-tabs">
      <Tabs.Trigger value="visit" id="visitTab-visit">
        {t("visitTabs.visit")}
      </Tabs.Trigger>
      <Tabs.Trigger value="record" id="visitTab-record">
        {t("visitTabs.record")}
      </Tabs.Trigger>
    </Tabs.List>
  );
}

/**
 * The content card under the banner: Visit | Record at its top, then the Visit tab's panel (everything
 * between the banner and the pinned bar) or the Record tab's. Its parts are plain sections with
 * dividers, not cards of their own.
 */
export function VisitPanel({ children, className }: { children: ReactNode; className?: string }) {
  const tabs = useVisitTabs();
  if (!tabs) return <>{children}</>;
  return (
    <section className="visit-body">
      <VisitTabList />
      <Tabs.Content
        value="visit"
        forceMount
        hidden={tabs.tab !== "visit"}
        className={className ? `visit-panel ${className}` : "visit-panel"}
      >
        {children}
      </Tabs.Content>
      <RecordPanel appt={tabs.appt} current={tabs.current} />
    </section>
  );
}

/** The Record tab's panel: the record of this visit's household, read when first opened. */
function RecordPanel({ appt, current }: { appt: Appointment; current: Encounter | null }) {
  const tabs = useVisitTabs();
  const visitPets = useApp((s) => s.visitPetsBy[appt.id]);
  if (!tabs) return null;
  const petIds = current?.patient_ids.length ? current.patient_ids : (visitPets?.map((p) => p.id) ?? [appt.patient.id]);
  return (
    <Tabs.Content
      value="record"
      forceMount
      hidden={tabs.tab !== "record"}
      className="visit-record flex min-w-0 flex-col"
    >
      {tabs.opened && (
        <RecordView
          clientId={appt.client.id}
          petId={tabs.pet}
          onPet={tabs.setPet}
          tab={tabs.section}
          onTab={tabs.setSection}
          placement="visit"
          visit={{ appt, petIds, encounterIds: [current?.id ?? "", current?.group_id ?? ""] }}
        />
      )}
    </Tabs.Content>
  );
}
