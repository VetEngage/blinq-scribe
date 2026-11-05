import { create } from "zustand";

// The signed-in vet's session token. It only ever travels in the Authorization header, never a URL.
// "Remember me" keeps it in localStorage; otherwise it lives in sessionStorage and ends with the tab.
const KEY = "blinq_scribe_session";

function read(): string {
  try {
    return localStorage.getItem(KEY) || sessionStorage.getItem(KEY) || "";
  } catch {
    return "";
  }
}

function write(token: string, remember: boolean): void {
  try {
    localStorage.removeItem(KEY);
    sessionStorage.removeItem(KEY);
    if (token) (remember ? localStorage : sessionStorage).setItem(KEY, token);
  } catch {
    // Private mode or blocked storage: the session still works until the tab closes.
  }
}

interface SessionState {
  token: string;
  /** Bumped at every sign out, so a late answer from the last person is never shown to the next one. */
  epoch: number;
  setToken: (token: string, remember?: boolean) => void;
  clear: () => void;
}

export const useSession = create<SessionState>((set, get) => ({
  // Credentials only arrive by signing in or accepting an invite, never from a URL.
  token: read(),
  epoch: 0,
  setToken: (token, remember = false) => {
    write(token, remember);
    set({ token });
  },
  clear: () => {
    write("", false);
    set({ token: "", epoch: get().epoch + 1 });
  },
}));

export const authHeader = (): Record<string, string> => {
  const token = useSession.getState().token;
  return token ? { Authorization: `Bearer ${token}` } : {};
};
