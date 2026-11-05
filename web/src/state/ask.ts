// Asking Blinq: one thread for the Morning brief card and the Ask Blinq panel. The brief is Blinq's
// first message, so "Yes" to "Want to hear more?" means something.
import { api, type ChatTurn } from "../api";
import { useSession } from "../api/session";
import type { Brief, BriefPart } from "../api/types";
import { t } from "../i18n";
import { useApp } from "./app";
import { useChat, type AskMessage } from "./chat";

/** The brief's sentence in parts, as the server counts it: what Home's buckets and Follow-ups waiting list. */
export function briefParts(brief: Brief | null): BriefPart[] {
  return brief?.sentence ?? [];
}

/** The brief's sentence as plain text (the server's spoken paragraph from an older server). */
export const briefText = (brief: Brief | null): string => {
  const parts = briefParts(brief);
  return parts.length ? parts.map((p) => p.text).join("") : (brief?.spoken ?? "");
};

/** What Read aloud says for the brief: the sentence, then the question. */
export const briefSpoken = (brief: Brief | null): string => {
  const said = briefText(brief);
  return said ? `${said} ${t("ask.hearMore")}` : "";
};

/** Ask one question. Resolves with Blinq's answer once it is in the thread, or null if it was dropped. */
export async function ask(raw: string): Promise<AskMessage | null> {
  const q = raw.trim();
  const chat = useChat.getState();
  if (!q || chat.busy) return null;
  const { history, thread } = chat;
  useChat.setState({ history: [...history, { role: "user", content: q }], busy: true, checking: "" });
  const { openAppt, current, openPatient, provider, brief } = useApp.getState();
  const context = {
    appointment_id: openAppt?.id ?? "",
    patient_id: current?.patient_id ?? openPatient?.id ?? "",
    showing: chat.showing,
  };
  const said = briefSpoken(brief);
  const sent: ChatTurn[] = [
    ...(said ? [{ role: "assistant" as const, content: said }] : []),
    ...history.map(({ role, content }) => ({ role, content })),
  ];
  const epoch = useSession.getState().epoch; // signing out bumps it: a late answer is never shown to the next person
  const live = () => epoch === useSession.getState().epoch && thread === useChat.getState().thread;
  let answer: AskMessage;
  try {
    const r = await api.ask(q, sent, provider, context, (a) => {
      if (live() && !a.done) useChat.setState({ checking: a.checking });
    });
    answer = { role: "assistant", content: r.reply, links: r.links, sources: r.sources, followups: r.followups };
  } catch (err) {
    answer = {
      role: "assistant",
      content: t("chat.wrong", { message: err instanceof Error ? err.message : String(err) }),
    };
  }
  if (!live()) return null;
  useChat.setState({ history: [...useChat.getState().history, answer], busy: false, checking: "" });
  return answer;
}
