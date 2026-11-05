import { create } from "zustand";
import { api } from "../api";
import type {
  Appointment,
  Brief,
  DayMark,
  Encounter,
  Health,
  Me,
  NoteToSign,
  NoteType,
  SectionKey,
  WaitingLink,
} from "../api/types";
import { t } from "../i18n";
import { addDays, ymd } from "../lib/format";

export interface PetRef {
  id: string;
  name: string;
}

const SECTION_KEYS: SectionKey[] = ["subjective", "objective", "assessment", "plan", "client_summary"];
export const defaultSections = (): NoteType["sections"] =>
  SECTION_KEYS.map((key) => ({ key, label: t(`review.defaultSections.${key}`) }));

// Names to show until the note types arrive from the server.
const FALLBACK_TYPES: [string, string][] = [
  ["sick", "Sick visit"],
  ["wellness", "Wellness exam"],
  ["recheck", "Recheck"],
  ["surgery", "Surgery report"],
  ["dental", "Dental"],
  ["radiology", "Radiology report"],
  ["phone", "Phone call log"],
  ["progress", "Progress note"],
];

interface AppState {
  me: Me | null;
  health: Health | null;
  provider: string;
  doctors: PetRef[];
  today: string;
  viewDate: string;
  weekStart: string;
  brief: Brief | null;
  /** The brief has been asked for and answered (even with nothing): before then it is loading. */
  briefLoaded: boolean;
  days: DayMark[];
  appts: Appointment[];
  /** The schedule for another vet or day is on its way: the old rows aren't shown meanwhile. */
  schedulePending: boolean;
  /** Whose day and which day `appts` are, as "provider|day". */
  apptsFor: string;
  noteTypes: NoteType[];
  /** Every note not signed yet, any day, in its bucket (Ready to sign, Pending); null until loaded. */
  notes: NoteToSign[] | null;
  /** Booking links sent and not booked yet; null until loaded. */
  waiting: WaitingLink[] | null;
  /** The brief line was dismissed for today. */
  briefDismissed: boolean;
  /** appointment id -> pets picked for that visit, before it starts */
  visitPetsBy: Record<string, PetRef[]>;
  /** appointment id -> note type the vet picked, before it starts */
  noteTypeBy: Record<string, string>;
  /** What is open now: the schedule highlights it and Ask Blinq knows the patient. */
  openAppt: Appointment | null;
  openPatient: { id: string; client_id: string } | null;
  current: Encounter | null;
  /** A one-line message for the vet at the top of the screen (an account connected, say). */
  notice: string;

  reset: () => void;
  setProvider: (id: string) => void;
  loadDoctors: () => Promise<void>;
  loadBrief: () => Promise<void>;
  loadSchedule: () => Promise<void>;
  loadDays: () => Promise<void>;
  loadNotes: () => Promise<void>;
  loadWaiting: () => Promise<void>;
  refreshDay: (day: string) => Promise<void>;
  refreshAfter: (appt: Appointment) => void;
  goToDay: (day: string) => Promise<void>;
  shiftWeek: (n: number) => void;
  /** The day before (-1) or after (1) the one on screen. */
  shiftDay: (n: number) => Promise<void>;
  dismissBrief: () => void;
  loadNoteTypes: () => Promise<void>;
  addPetToVisit: (apptId: string, pet: PetRef, host?: PetRef) => void;
  removePetFromVisit: (apptId: string, petId: string) => void;
}

const initial = () => {
  const today = ymd(new Date());
  return {
    me: null,
    health: null,
    provider: "",
    doctors: [],
    today,
    viewDate: today,
    weekStart: addDays(today, -3),
    brief: null,
    briefLoaded: false,
    days: [],
    appts: [],
    schedulePending: false,
    apptsFor: "",
    visitPetsBy: {},
    noteTypeBy: {},
    openAppt: null,
    openPatient: null,
    current: null,
    notice: "",
    notes: null,
    waiting: null,
    briefDismissed: false,
  };
};

let noteTypesLoad: Promise<void> | null = null;

/** Called after anything that changes what is left of the day (a visit signed, a text resent). */
export const dayChanged: (() => void)[] = [];

/** The same schedule rows, field for field (the server sends them in a stable order). */
const sameRows = (a: Appointment[], b: Appointment[]): boolean =>
  a.length === b.length && JSON.stringify(a) === JSON.stringify(b);

export const useApp = create<AppState>((set, get) => ({
  ...initial(),
  noteTypes: FALLBACK_TYPES.map(([id, name]) => ({ id, name, sections: defaultSections() })),

  reset: () => set(initial()),

  setProvider(id) {
    set({ provider: id, notes: null });
    void get().loadBrief();
    void get().loadSchedule();
    void get().loadDays();
    void get().loadNotes();
    void get().loadWaiting();
    for (const f of dayChanged) f();
  },

  async loadDoctors() {
    // Every vet in the practice, for any role (a vet's own schedule no longer lists the others).
    const list = await api.doctors().catch(() => null);
    if (list) {
      set({ doctors: list.map((d) => ({ id: d.id, name: d.name })) });
      return;
    }
    const all = await api.schedule().catch(() => [] as Appointment[]);
    const map = new Map<string, string>();
    for (const a of all) if (a.provider_id) map.set(a.provider_id, a.provider_name || a.provider_id);
    set({ doctors: [...map].map(([id, name]) => ({ id, name })) });
  },

  async loadBrief() {
    const brief = await api.brief(get().provider).catch(() => null);
    const patch: Partial<AppState> = { brief, briefLoaded: true };
    // The server's today wins, so the week strip and the brief agree on what day it is.
    const { today, viewDate } = get();
    if (brief?.date && brief.date !== today) {
      patch.today = brief.date;
      patch.weekStart = addDays(brief.date, -3);
      if (viewDate === today) patch.viewDate = brief.date;
    }
    set(patch);
  },

  async loadSchedule() {
    const { viewDate: day, today, provider } = get();
    const key = `${provider}|${day}`;
    // A refresh of the same day keeps its rows on screen; another vet or day doesn't show the old ones.
    if (get().apptsFor !== key) set({ schedulePending: true });
    // Today leaves the date off so the server decides what today is.
    const list = await api.schedule(provider, day === today ? "" : day).catch(() => [] as Appointment[]);
    // The vet picked another day or vet meanwhile: that newer load fills the list.
    if (day !== get().viewDate || provider !== get().provider) return;
    // A poll that finds nothing new leaves the store alone, so nothing that reads the schedule re-renders.
    if (get().apptsFor === key && !get().schedulePending && sameRows(get().appts, list)) return;
    set({ appts: list, apptsFor: key, schedulePending: false });
  },

  async loadNotes() {
    const provider = get().provider;
    const list = await api.notesToSign(provider).catch(() => null);
    if (provider !== get().provider) return;
    // A failed read keeps the last list; the first read failing shows none rather than loading forever.
    set({ notes: list ?? get().notes ?? [] });
  },

  async loadWaiting() {
    const list = await api.waiting().catch(() => null);
    set({ waiting: list ?? get().waiting ?? [] });
  },

  async loadDays() {
    const from = get().weekStart;
    const list = await api.days(from, addDays(from, 6), get().provider).catch(() => [] as DayMark[]);
    if (from !== get().weekStart) return;
    set({ days: Array.isArray(list) ? list : [] });
  },

  async refreshDay(d) {
    const list = await api.days(d, d, get().provider).catch(() => null);
    if (!Array.isArray(list)) return;
    set({ days: [...get().days.filter((x) => x.date !== d), ...list] });
  },

  // After a visit changes: its schedule row, its day on the week strip, and the brief when it carries that day.
  refreshAfter(appt) {
    const day = String(appt.start).slice(0, 10);
    void get().loadSchedule();
    void get().refreshDay(day);
    // The brief counts earlier days' items and today's prescriptions; the buckets hold every unsigned note.
    if (day <= get().today) void get().loadBrief();
    void get().loadNotes();
    void get().loadWaiting();
    for (const f of dayChanged) f();
  },

  async goToDay(s) {
    const { weekStart, viewDate, health } = get();
    set({ viewDate: s });
    // Onto the busy demo day or back: what is left of the day is that day's.
    const busy = health?.busy_day;
    if (busy && (s === busy) !== (viewDate === busy)) for (const f of dayChanged) f();
    if (s < weekStart || s > addDays(weekStart, 6)) {
      set({ weekStart: addDays(s, -3) });
      void get().loadDays();
    }
    await get().loadSchedule();
  },

  shiftWeek(n) {
    set({ weekStart: addDays(get().weekStart, 7 * n) });
    void get().loadDays();
  },

  shiftDay(n) {
    return get().goToDay(addDays(get().viewDate, n));
  },

  dismissBrief() {
    markBriefSeen();
    set({ briefDismissed: true });
  },

  loadNoteTypes() {
    noteTypesLoad =
      noteTypesLoad ??
      api
        .noteTypes()
        .then((list) => {
          if (Array.isArray(list) && list.length) set({ noteTypes: list });
        })
        .catch(() => {
          noteTypesLoad = null;
        });
    return noteTypesLoad;
  },

  addPetToVisit(apptId, pet, host) {
    const list = [...(get().visitPetsBy[apptId] ?? (host ? [host] : []))];
    if (!list.some((p) => p.id === pet.id)) list.push(pet);
    set({ visitPetsBy: { ...get().visitPetsBy, [apptId]: list } });
  },

  removePetFromVisit(apptId, petId) {
    set({
      visitPetsBy: { ...get().visitPetsBy, [apptId]: (get().visitPetsBy[apptId] ?? []).filter((p) => p.id !== petId) },
    });
  },
}));

/** The sections a note type shows, split into the note body and the owner's section. */
export function sectionsFor(noteTypes: NoteType[], noteType: string) {
  const type = noteTypes.find((x) => x.id === noteType);
  const secs = type?.sections?.length ? type.sections : defaultSections();
  const fallbackOwner = defaultSections()[4] as NoteType["sections"][number];
  return {
    body: secs.filter((s) => s.key !== "client_summary"),
    owner: secs.find((s) => s.key === "client_summary") ?? fallbackOwner,
  };
}

// Dismiss hides the brief line for this person today. Another vet at the same computer still gets theirs.
const briefKey = () => {
  const { me, provider, today } = useApp.getState();
  return `blinq_scribe_brief_seen:${me?.user ? me.user.id : provider || "all"}:${today}`;
};
export const briefSeen = (): boolean => {
  try {
    return localStorage.getItem(briefKey()) === "1";
  } catch {
    return false;
  }
};
export const markBriefSeen = (): void => {
  try {
    localStorage.setItem(briefKey(), "1");
  } catch {
    /* storage blocked: the brief shows again next time */
  }
};

/**
 * Whose "My day" this is: the signed-in vet's provider. The open demo has no one signed in and acts as
 * the demo clinic's vet, the first doctor.
 */
export function myProviderId(me: Me | null, doctors: { id: string }[]): string {
  if (me?.provider_id) return me.provider_id;
  return me?.via === "open" ? (doctors[0]?.id ?? "") : "";
}
