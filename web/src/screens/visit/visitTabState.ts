import { createContext, useContext } from "react";
import type { Appointment, Encounter } from "../../api/types";
import type { RecordTab } from "../record/record";

export type VisitTab = "visit" | "record";

export interface VisitTabs {
  tab: VisitTab;
  setTab: (tab: VisitTab) => void;
  /** The pet and section the Record tab shows. */
  pet: string;
  setPet: (id: string) => void;
  section: RecordTab;
  setSection: (tab: RecordTab) => void;
  /** The Record tab has been opened, so its panel stays mounted and keeps what it read. */
  opened: boolean;
  /** Switch to the Record tab on this pet (the banner's household button, the sign panel). */
  showRecord: (petId: string) => void;
  /** The visit, for the Record tab inside the content card. */
  appt: Appointment;
  current: Encounter | null;
}

export const VisitTabsContext = createContext<VisitTabs | null>(null);

/** The Visit and Record tabs of a visit page, or null outside one. */
export const useVisitTabs = (): VisitTabs | null => useContext(VisitTabsContext);
