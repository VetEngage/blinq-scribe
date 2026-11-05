import { create } from "zustand";
import { api } from "../api";
import type { EndOfDay } from "../api/types";
import { dayChanged, useApp } from "./app";
import { clinicDayOf } from "../lib/day";

/**
 * What is left of the provider's day: today's open items and earlier days', what's done and tomorrow
 * (`GET /api/end-of-day`). Home's Follow-ups waiting, End of day and the rail's summary all read it, so
 * they count the same things.
 */
export const useDayLeft = create<{
  /** null while loading; false when it couldn't be read. */
  data: EndOfDay | null | false;
  /** Whose day and which: "provider|day". */
  for: string;
  load: () => Promise<void>;
}>((set, get) => ({
  data: null,
  for: "",
  async load() {
    const { provider, today, viewDate, health } = useApp.getState();
    // Today's, or the demo's busy day's while it is on screen.
    const day = clinicDayOf(today, viewDate, health?.busy_day);
    const key = `${provider}|${day}`;
    if (get().for !== key) set({ data: null, for: key });
    const data = await api.endOfDay(provider, day).catch(() => false as const);
    if (get().for !== key) return;
    // A refresh that fails keeps what's on screen.
    if (data || !get().data) set({ data });
  },
}));

dayChanged.push(() => void useDayLeft.getState().load());
