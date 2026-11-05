import { create } from "zustand";
import type { AssistLink } from "../api/types";

/** One turn of the conversation with Blinq. An answer carries its link chips, sources and follow ups. */
export interface AskMessage {
  role: "user" | "assistant";
  content: string;
  links?: AssistLink[];
  sources?: AssistLink[];
  followups?: string[];
}

const DOCK_KEY = "blinq.ask.docked";

function savedDock(): boolean | null {
  try {
    const v = localStorage.getItem(DOCK_KEY);
    return v === "1" ? true : v === "0" ? false : null;
  } catch {
    return null;
  }
}

interface ChatState {
  /** The Ask Blinq panel is open. */
  open: boolean;
  /** Docked on the right, the vet's choice in this browser; null means none yet (docks on wide visit pages). */
  docked: boolean | null;
  /** The appointment the screen already shows (Home's Up next card), so answers don't repeat it. */
  showing: string;
  /** One thread across screens; the brief is always its first message, so it isn't stored here. */
  history: AskMessage[];
  busy: boolean;
  checking: string;
  /** Bumped by New conversation, so an answer still on its way lands nowhere. */
  thread: number;
  setOpen: (open: boolean) => void;
  setDocked: (docked: boolean) => void;
  /** New conversation: an empty thread, the panel stays as it is. */
  clear: () => void;
  reset: () => void;
}

export const useChat = create<ChatState>((set) => ({
  open: false,
  docked: savedDock(),
  showing: "",
  history: [],
  busy: false,
  checking: "",
  thread: 0,
  setOpen: (open) => set({ open }),
  setDocked: (docked) => {
    try {
      localStorage.setItem(DOCK_KEY, docked ? "1" : "0");
    } catch {
      /* storage off: the choice lasts until reload */
    }
    set({ docked });
  },
  clear: () => set((s) => ({ history: [], busy: false, checking: "", thread: s.thread + 1 })),
  reset: () => set((s) => ({ open: false, history: [], busy: false, checking: "", thread: s.thread + 1 })),
}));
