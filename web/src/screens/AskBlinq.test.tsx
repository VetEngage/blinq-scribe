import { act, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router";
import type { Appointment, AskReply, Brief } from "../api/types";

const api = vi.hoisted(() => ({ ask: vi.fn(), listen: vi.fn() }));
vi.mock("../api", () => ({ api }));
const speech = vi.hoisted(() => ({ speak: vi.fn(), stop: vi.fn() }));
vi.mock("../lib/speak", () => ({
  useSpeech: () => ({ speaking: false, loading: false, toggle: vi.fn(), speak: vi.fn(), stop: vi.fn() }),
  speak: speech.speak,
  stopSpeech: speech.stop,
}));
// The mic: Done hands over one short clip.
vi.mock("../recorder/mic", () => ({
  startMic: (onChunk: (wav: Blob) => void) =>
    Promise.resolve({
      stop: (keep = true) => keep && onChunk(new Blob(["RIFF"], { type: "audio/wav" })),
      level: () => 0.5,
    }),
}));

import { useApp } from "../state/app";
import { useChat } from "../state/chat";
import { useVoice } from "../state/voice";
import { AskBlinq, AskBlinqPill } from "./AskBlinq";

const today = "2026-11-01";
const brief = {
  spoken: "",
  date: today,
  from_yesterday: [],
  sentence: [
    { text: "5 visits", emphasis: "bold", kind: "visits" },
    { text: " today. Nothing needs you.", emphasis: "none", kind: "" },
  ],
  suggestions: ["What's first?", "Miso's kidney results"],
  new_since_yesterday: [
    {
      kind: "reply",
      text: "Jordan Lee replied: Biscuit is shaking his head again",
      at: "2026-10-31T20:40:00",
      patient_name: "Biscuit",
      patient_id: "pat-1",
    },
  ],
} as Brief;
const biscuit = {
  id: "appt-1",
  start: "2026-11-01T09:00:00",
  patient: { id: "pat-1", name: "Biscuit", alerts: [] },
  client: { id: "cli-1", first_name: "Jordan", last_name: "Lee" },
} as unknown as Appointment;
const answer: AskReply = {
  reply: "First up is Biscuit at 9:00 AM.",
  links: [],
  sources: [],
  followups: ["Biscuit's last visit", "What needs me?"],
};

function wide(matches: boolean) {
  window.matchMedia = ((q: string) => ({
    matches,
    media: q,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
  })) as unknown as typeof window.matchMedia;
}

function show(path = "/", { docked = null as boolean | null, isWide = false } = {}) {
  vi.clearAllMocks();
  wide(isWide);
  api.ask.mockResolvedValue(answer);
  api.listen.mockResolvedValue({ text: "What's first?", via: "mock" });
  useApp.setState({
    brief,
    today,
    provider: "",
    openAppt: path.startsWith("/visit/") ? biscuit : null,
    current: null,
    health: { ok: true, ai: "mock", practice: "mock", stt: "mock", sam: "", sms: "" },
  });
  useChat.setState({ open: false, docked, history: [], busy: false, checking: "" });
  useVoice.setState({ phase: "idle", caption: "", error: "", reading: "" });
  return render(
    <MemoryRouter initialEntries={[path]}>
      <AskBlinqPill />
      <AskBlinq />
    </MemoryRouter>,
  );
}

describe("Ask Blinq", () => {
  it("has one way in, the top bar's pill: ⌘J opens the panel at today's brief, Esc closes it", async () => {
    show();
    expect(screen.getByRole("button", { name: "Talk to Blinq" })).toBeInTheDocument();
    const pill = screen.getByRole("button", { name: /^Ask Blinq/ });
    expect(pill).toHaveAttribute("title", expect.stringMatching(/\((⌘J|Ctrl\+J)\)$/));
    expect(pill).toHaveAttribute("aria-expanded", "false");
    await userEvent.keyboard("{Control>}j{/Control}");
    const panel = screen.getByRole("dialog", { name: "Ask Blinq" });
    expect(within(panel).getByText("Your day")).toBeInTheDocument();
    expect(within(panel).getByText("Today's brief")).toBeInTheDocument();
    expect(within(panel).getByText("5 visits")).toHaveClass("text-ai");
    expect(within(panel).getByRole("button", { name: "What's first?" })).toBeInTheDocument();
    // The pill stays in the top bar, pressed; there is no floating launcher.
    expect(pill).toHaveAttribute("aria-expanded", "true");
    expect(document.querySelector(".ask-launcher")).toBeNull();
    // Only the composer's mic inside the panel.
    expect(within(panel).getAllByRole("button", { name: "Talk to Blinq" })).toHaveLength(1);
    await userEvent.keyboard("{Escape}");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    await userEvent.click(pill);
    expect(screen.getByRole("dialog", { name: "Ask Blinq" })).toBeInTheDocument();
  });

  it("docks on a wide visit page, names the visit, and remembers Collapse", async () => {
    localStorage.clear();
    show("/visit/appt-1", { isWide: true });
    act(() => useChat.setState({ open: true }));
    const panel = screen.getByRole("complementary", { name: "Ask Blinq" });
    expect(document.documentElement).toHaveClass("ask-docked");
    expect(within(panel).getByText("Biscuit's visit")).toBeInTheDocument();
    expect(within(panel).getByRole("textbox", { name: "Ask Blinq about Biscuit" })).toBeInTheDocument();
    // Questions about the open visit to start with.
    expect(within(panel).getByRole("button", { name: "Biscuit's last visit" })).toBeInTheDocument();
    expect(within(panel).getByRole("button", { name: "Draft a reply to Jordan" })).toBeInTheDocument();
    await userEvent.click(within(panel).getByRole("button", { name: "Collapse" }));
    expect(screen.getByRole("dialog", { name: "Ask Blinq" })).toBeInTheDocument();
    expect(document.documentElement).not.toHaveClass("ask-docked");
    expect(localStorage.getItem("blinq.ask.docked")).toBe("0");
  });

  it("floats on a narrow window, with no Expand", () => {
    show("/visit/appt-1", { docked: true, isWide: false });
    act(() => useChat.setState({ open: true }));
    const panel = screen.getByRole("dialog", { name: "Ask Blinq" });
    expect(within(panel).queryByRole("button", { name: "Expand" })).not.toBeInTheDocument();
  });

  it("asks, shows your words in gray and Blinq's in ink, and New conversation starts over", async () => {
    show();
    act(() => useChat.setState({ open: true }));
    const panel = screen.getByRole("dialog", { name: "Ask Blinq" });
    await userEvent.type(within(panel).getByRole("textbox", { name: "Ask Blinq about today" }), "What's first?");
    await userEvent.click(within(panel).getByRole("button", { name: "Send" }));
    const log = within(panel).getByRole("log");
    expect(within(log).getByText("What's first?")).toHaveClass("bg-surface-muted");
    expect(within(log).getByText(answer.reply)).not.toHaveClass("text-ai");
    expect(within(panel).getByRole("group", { name: "Follow up questions" })).toBeInTheDocument();
    await userEvent.click(within(panel).getByRole("button", { name: "New conversation" }));
    expect(within(log).queryByText(answer.reply)).not.toBeInTheDocument();
    expect(useChat.getState().history).toEqual([]);
  });

  it("press to talk from the top bar: listens in the pill, then the panel opens with the answer read back", async () => {
    show();
    await userEvent.click(screen.getByRole("button", { name: "Talk to Blinq" }));
    // Listening in the pill itself: the mic part becomes Done.
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    await act(async () => {}); // the mic starts
    const done = screen.getByRole("button", { name: "Done" });
    expect(done).toHaveAttribute("aria-pressed", "true");
    await userEvent.click(done);
    expect(api.listen).toHaveBeenCalledTimes(1);
    expect(api.ask.mock.calls[0]?.[0]).toBe("What's first?");
    expect(speech.speak).toHaveBeenCalledWith(answer.reply, "ask");
    const panel = screen.getByRole("dialog", { name: "Ask Blinq" });
    // The answer is marked where it is, not shown twice; one Stop, in the header.
    expect(within(panel).getAllByText(answer.reply)).toHaveLength(1);
    expect(within(panel).getByRole("status", { name: "" })).toHaveTextContent("Blinq is speaking");
    expect(within(panel).getAllByRole("button", { name: "Stop" })).toHaveLength(1);
    // The field stays, with its mic to cut in; the follow ups sit above it.
    expect(within(panel).getByRole("textbox", { name: "Ask Blinq about today" })).toBeInTheDocument();
    expect(within(panel).getByRole("button", { name: "Biscuit's last visit" })).toBeInTheDocument();
    await userEvent.click(within(panel).getByRole("button", { name: "Stop" }));
    expect(within(panel).queryByText("Blinq is speaking")).not.toBeInTheDocument();
    expect(within(panel).queryByText("Anything else?")).not.toBeInTheDocument();
  });

  it("listening in the panel turns the field into the voice bar, in place", async () => {
    show();
    act(() => useChat.setState({ open: true }));
    const panel = screen.getByRole("dialog", { name: "Ask Blinq" });
    await userEvent.click(within(panel).getByRole("button", { name: "Talk to Blinq" }));
    expect(within(panel).queryByRole("textbox")).not.toBeInTheDocument();
    expect(within(panel).getByText("Listening…")).toBeInTheDocument();
    expect(within(panel).getByRole("button", { name: "Done" })).toBeInTheDocument();
    await userEvent.keyboard("{Escape}");
    expect(within(panel).getByRole("textbox", { name: "Ask Blinq about today" })).toBeInTheDocument();
  });

  it("shows old answers as plain sentences", () => {
    show();
    act(() =>
      useChat.setState({
        open: true,
        history: [
          { role: "user", content: "What's first?" },
          { role: "assistant", content: "**Biscuit**\n- 6yo\n- Cefpodoxime SID x10d [confirm product]" },
        ],
      }),
    );
    expect(
      screen.getByText("Biscuit. 6 year old. Cefpodoxime once a day for 10 days (product not confirmed yet)."),
    ).toBeInTheDocument();
  });

  it("says when it didn't catch anything", async () => {
    show();
    api.listen.mockResolvedValue({ text: "", via: "mock" });
    act(() => useChat.setState({ open: true }));
    const panel = screen.getByRole("dialog", { name: "Ask Blinq" });
    await userEvent.click(within(panel).getByRole("button", { name: "Talk to Blinq" }));
    await act(async () => {});
    await userEvent.click(within(panel).getByRole("button", { name: "Done" }));
    expect(screen.getByText("Blinq didn't catch that. Try again, or type it.")).toBeInTheDocument();
    expect(api.ask).not.toHaveBeenCalled();
  });
});
