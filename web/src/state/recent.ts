import { create } from "zustand";

/** A patient the provider opened lately: enough to show the row and open the record again. */
export interface RecentPatient {
  id: string;
  client_id: string;
  name: string;
  species?: string;
  breed?: string;
  owner_name?: string;
  /** When it was opened, ISO. */
  at: string;
}

const KEY = "blinq.recent";
const MAX = 5;

function saved(): RecentPatient[] {
  try {
    const list: unknown = JSON.parse(localStorage.getItem(KEY) ?? "[]");
    return Array.isArray(list) ? (list as RecentPatient[]).filter((p) => p && p.id && p.client_id).slice(0, MAX) : [];
  } catch {
    return [];
  }
}

/** The last five records opened in this browser, newest first: search shows them before anything is typed. */
export const useRecent = create<{ list: RecentPatient[] }>(() => ({ list: saved() }));

export function rememberPatient(p: Omit<RecentPatient, "at">): void {
  if (!p.id || !p.client_id) return;
  const list = [
    { ...p, at: new Date().toISOString() },
    ...useRecent.getState().list.filter((x) => x.id !== p.id),
  ].slice(0, MAX);
  useRecent.setState({ list });
  try {
    localStorage.setItem(KEY, JSON.stringify(list));
  } catch {
    /* storage off: the list lasts until reload */
  }
}
