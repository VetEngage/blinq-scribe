import { act, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router";
import type { Appointment, Encounter, Segment } from "../../api/types";
import { useRecorder } from "../../recorder/store";

const api = vi.hoisted(() => ({
  recordPanel: vi.fn(() => new Promise(() => {})),
  nameSpeaker: vi.fn(),
  endOfDay: vi.fn(() => new Promise(() => {})),
}));
vi.mock("../../api", () => ({ api }));

import { ArrivalState, StartVisitBar } from "./StartVisit";
import { ConsentDialog } from "./consent";
import { askConsent } from "./consentStore";
import { VisitHeaderCard } from "./VisitHeaderCard";
import { TranscriptCard } from "./parts";

const inMinutes = (m: number) => new Date(Date.now() + m * 60_000 - 20_000).toISOString();
const appt = (extra: Partial<Appointment> = {}) =>
  ({
    id: "a1",
    start: inMinutes(12),
    status: "Checked In",
    duration_min: 30,
    room: "Exam 1",
    reason: "Itchy ears",
    provider_name: "Dr. Ana Rivera",
    patient: { id: "pat-1", name: "Biscuit", alerts: [] },
    client: { id: "cl-1", first_name: "Jordan", last_name: "Lee", phones: [], emails: [] },
    ...extra,
  }) as unknown as Appointment;

describe("Start visit", () => {
  const bar = (onStart = vi.fn(), a = appt()) =>
    render(<StartVisitBar appt={a} busy={false} onStart={onStart} status="Sick visit · Exam 1" />);

  it("opens the visit straight away: Start visit asks nothing (Start recording asks the owner)", async () => {
    const onStart = vi.fn();
    bar(onStart);
    const region = screen.getByRole("region", { name: "Start the visit" });
    expect(within(region).getByText("Sick visit · Exam 1")).toBeInTheDocument();
    await userEvent.click(within(region).getByRole("button", { name: /^Start visit/ }));
    expect(onStart).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("⌘↵ starts it too", async () => {
    const onStart = vi.fn();
    bar(onStart);
    await userEvent.keyboard("{Control>}{Enter}{/Control}");
    expect(onStart).toHaveBeenCalledTimes(1);
  });

  it("the banner says where the visit stands as gray text, with no Start visit of its own", () => {
    render(
      <MemoryRouter>
        <VisitHeaderCard appt={appt()} current={null} pets={1} state={<ArrivalState appt={appt()} />} step="record" />
      </MemoryRouter>,
    );
    expect(screen.getByText("Checked in · starts in 12 min").closest(".vh-state")).not.toBeNull();
    // The one main action lives in the pinned bar only.
    expect(screen.queryByRole("button", { name: /Start visit/ })).not.toBeInTheDocument();
  });
});

describe("the arrival state", () => {
  it("says checked in, and how soon, only when the practice system says", () => {
    const { rerender } = render(<ArrivalState appt={appt({ status: "Scheduled", start: inMinutes(12) })} />);
    expect(screen.getByText("Starts in 12 min")).toBeInTheDocument();
    rerender(<ArrivalState appt={appt({ status: "Scheduled", start: inMinutes(180) })} />);
    expect(screen.queryByText(/Starts in/)).not.toBeInTheDocument();
    rerender(<ArrivalState appt={appt({ status: "checked_in", start: inMinutes(180) })} />);
    expect(screen.getByText("Checked in")).toBeInTheDocument();
    rerender(<ArrivalState appt={appt({ status: "Arrived", start: inMinutes(5) })} />);
    expect(screen.getByText("Checked in · starts in 5 min")).toBeInTheDocument();
  });
});

const seg = (id: string, extra: Partial<Segment>): Segment => ({
  id,
  line: 1,
  speaker_id: "",
  speaker_name: "",
  role: "unknown",
  offset_seconds: 0,
  text: "",
  ...extra,
});
const visit = {
  id: "enc-1",
  status: "recording",
  source: "web",
  can: { edit: true },
  photos: [],
  transcript: "Dr. Rivera: Hi Jordan.\nOwner: He scratches.",
  segments: [
    seg("s1", { line: 1, speaker_id: "vet", speaker_name: "Dr. Ana Rivera", role: "vet", text: "Hi Jordan." }),
    seg("s2", { line: 2, speaker_id: "owner", speaker_name: "Jordan Lee", role: "owner", text: "He scratches." }),
  ],
} as unknown as Encounter;

function card(e: Encounter, transcript = e.transcript, onSave = vi.fn(async () => true)) {
  const setTranscript = vi.fn();
  render(
    <MemoryRouter>
      <TranscriptCard
        e={e}
        transcript={transcript}
        setTranscript={setTranscript}
        onRecord={() => {}}
        onSample={() => {}}
        onSave={onSave}
      />
    </MemoryRouter>,
  );
  return { setTranscript, onSave };
}

describe("the transcript", () => {
  afterEach(() => useRecorder.setState({ encounterId: "" }));

  it("a saved transcript (the sample visit, pasted text) shows who said each line, not the raw text", async () => {
    card(visit);
    const list = screen.getByRole("list", { name: "Transcript" });
    expect(within(list).getAllByRole("listitem")[1]).toHaveTextContent("Jordan Lee · Owner0:00He scratches.");
    expect(screen.queryByRole("textbox", { name: "Transcript" })).not.toBeInTheDocument();
    expect(
      screen.getByText(
        "Blinq names you and the owner on the appointment. Anyone else shows as a speaker number until you say who it is.",
      ),
    ).toBeInTheDocument();
    // Edit text opens the raw text; Show who said what goes back.
    await userEvent.click(screen.getByRole("button", { name: "Edit text" }));
    expect(screen.getByRole("textbox", { name: "Transcript" })).toHaveValue(visit.transcript);
    await userEvent.click(screen.getByRole("button", { name: "Show who said what" }));
    expect(screen.getByRole("list", { name: "Transcript" })).toBeInTheDocument();
  });

  it("text typed and not saved yet stays in the box", () => {
    card(visit, "Owner: something new");
    expect(screen.getByRole("textbox", { name: "Transcript" })).toHaveValue("Owner: something new");
  });

  it("while recording, says it's listening", () => {
    useRecorder.setState({ encounterId: "enc-1" });
    card(visit);
    expect(screen.getByText("Listening. New words show up every few seconds.")).toBeInTheDocument();
  });

  it("Save text after editing goes back to the speaker rows once saved", async () => {
    const { onSave } = card(visit);
    await userEvent.click(screen.getByRole("button", { name: "Edit text" }));
    await userEvent.click(screen.getByRole("button", { name: "Save text" }));
    expect(onSave).toHaveBeenCalled();
    expect(await screen.findByRole("list", { name: "Transcript" })).toBeInTheDocument();
  });
});

describe("Recording consent", () => {
  const ask = async (owner = "Jordan") => {
    render(<ConsentDialog />);
    let answer: boolean | undefined;
    void act(() => {
      void askConsent(owner).then((yes) => (answer = yes));
    });
    const dialog = await screen.findByRole("dialog", { name: `Did ${owner || "the owner"} agree to recording?` });
    return { dialog, answer: () => answer };
  };

  it("asks in a dialog that says what gets recorded; Owner agreed, start says yes", async () => {
    const { dialog, answer } = await ask();
    expect(within(dialog).getByText(/You review and sign the note/)).toBeInTheDocument();
    expect(within(dialog).getByRole("button", { name: "Not yet" })).toHaveFocus();
    await userEvent.click(within(dialog).getByRole("button", { name: "Owner agreed, start" }));
    await waitFor(() => expect(answer()).toBe(true));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("⌘↵ agrees; Not yet and Esc don't", async () => {
    let q = await ask();
    await userEvent.keyboard("{Control>}{Enter}{/Control}");
    await waitFor(() => expect(q.answer()).toBe(true));
    q = await ask();
    await userEvent.click(within(q.dialog).getByRole("button", { name: "Not yet" }));
    await waitFor(() => expect(q.answer()).toBe(false));
    q = await ask();
    await userEvent.keyboard("{Escape}");
    await waitFor(() => expect(q.answer()).toBe(false));
  });

  it("asks about the owner when the appointment has no name", async () => {
    await ask("");
  });
});
