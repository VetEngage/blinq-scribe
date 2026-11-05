import { api } from "../api";
import type { Me } from "../api/types";
import { myProviderId, useApp } from "./app";
import { t } from "../i18n";
import { setDemoClock } from "../lib/day";
import { loadVoiceChoice, setServerVoice, setVoiceChoice } from "../lib/speak";

/** Today's clock in the demo clinic, before the first visit (9:00 AM). */
const DEMO_MORNING = "08:50";

/** After sign in: whose day it is, what the server runs on, then the brief, schedule and week strip. */
export async function startApp(me: Me): Promise<void> {
  const params = new URLSearchParams(window.location.search);
  // A signed-in vet opens on their own day unless the link asks for another (the open demo: below).
  const provider = params.get("provider") || me.user?.provider_id || "";
  useApp.setState({ me, provider });
  // Read aloud: this person's voice, and whether the server has the natural one.
  setVoiceChoice(loadVoiceChoice(me.user?.id ?? ""));
  void api
    .speechOptions()
    .then((o) => setServerVoice(o.available))
    .catch(() => setServerVoice(false));
  // The demo clinic (it has a busy day) reads today at a morning clock, so a demo at any hour starts
  // with the day ahead. Waited for before the schedule, so the rail and Home read at it from the start.
  const health = api
    .health()
    .then((h) => {
      setDemoClock(h.busy_day ? DEMO_MORNING : "");
      useApp.setState({ health: h });
    })
    .catch(() => undefined);
  const app = useApp.getState();
  if (me.via === "open" && !provider) {
    // The open demo acts as the demo clinic's vet, so it opens on that vet's day (My day) too.
    await app.loadDoctors();
    useApp.setState({ provider: myProviderId(me, useApp.getState().doctors) });
    await useApp.getState().loadBrief();
  } else await Promise.all([app.loadDoctors(), app.loadBrief()]);
  await health;
  await useApp.getState().loadSchedule();
  void useApp.getState().loadDays();
  void useApp.getState().loadNoteTypes();
  const notice = await linkAccount((code) => api.finishOAuthLink(code), t("signin.linked"));
  if (notice) useApp.setState({ notice });
}

// Invite, reset and sign in hand-off links carry their secret after "#", which browsers never send to
// the server. Each is read once, kept in memory only, and cleared from the address bar so it isn't
// left in history.
type FragmentKey = "invite" | "reset" | "oauth" | "oauth_error" | "oauth_link";
const pending: Record<FragmentKey, string> = { invite: "", reset: "", oauth: "", oauth_error: "", oauth_link: "" };

function readFragment(): void {
  const params = new URLSearchParams(window.location.hash.slice(1));
  let found = false;
  for (const key of Object.keys(pending) as FragmentKey[]) {
    const v = params.get(key);
    if (v) {
      pending[key] = v;
      found = true;
    }
  }
  if (found) window.history.replaceState(null, "", window.location.pathname + window.location.search);
}

/** Which link brought the vet here, if any: the route that handles it. */
export function fragmentRoute(): string {
  readFragment();
  if (pending.invite) return "/invite";
  if (pending.reset) return "/reset-password";
  if (pending.oauth || pending.oauth_error) return "/sign-in";
  // #oauth_link is finished by the signed-in console itself (see linkAccount), not a route.
  return "";
}
export function takeFragment(key: FragmentKey): string {
  readFragment();
  return pending[key];
}
export function clearFragment(key: FragmentKey): void {
  pending[key] = "";
}
export const takeInvite = (): string => takeFragment("invite");
export const clearInvite = (): void => clearFragment("invite");

/**
 * Back from connecting Google or Microsoft while signed in: finish the link as this same person.
 * Returns what to tell the vet, or "" when there was nothing to finish.
 */
export async function linkAccount(finish: (code: string) => Promise<unknown>, done: string): Promise<string> {
  const code = takeFragment("oauth_link");
  if (!code) return "";
  clearFragment("oauth_link");
  try {
    await finish(code);
    return done;
  } catch (err) {
    return err instanceof Error ? err.message : String(err);
  }
}
