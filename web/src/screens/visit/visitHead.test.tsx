import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router";
import type { Appointment, EndOfDay, Encounter, RecordPanelData, Segment } from "../../api/types";

const api = vi.hoisted(() => ({ recordPanel: vi.fn(), nameSpeaker: vi.fn(), followUp: vi.fn(), endOfDay: vi.fn() }));
vi.mock("../../api", () => ({ api }));

import { useDayLeft } from "../../state/eod";
import { useApp } from "../../state/app";

import { VisitHeaderCard } from "./VisitHeaderCard";
import { SpeakerLines } from "./SpeakerLines";

const appt = (alerts: string[] = []) =>
  ({
    id: "a1",
    start: "2026-11-01T14:30:00",
    duration_min: 30,
    room: "Exam 1",
    reason: "Itchy ears",
    provider_name: "Dr. Ana Rivera",
    patient: {
      id: "pat-1",
      name: "Biscuit",
      species: "Canine",
      breed: "Golden Retriever",
      sex: "Male, neutered",
      age: 6,
      alerts,
    },
    client: {
      id: "cl-1",
      first_name: "Jordan",
      last_name: "Lee",
      phones: ["+12175550142"],
      emails: [],
      prefers: "text",
    },
  }) as unknown as Appointment;
const panel = {
  patient: {
    id: "pat-1",
    name: "Biscuit",
    species: "Canine",
    breed: "Golden Retriever",
    age: 6,
    sex: "MN",
    alerts: [],
  },
  weight: { latest: { date: "2026-06-24", value: "72", unit: "lb" } },
  reminders_due: [],
  recent_visits: [
    {
      id: "v1",
      date: "2026-06-24",
      kind: "wellness",
      type: "Wellness",
      reason: "Annual wellness",
      provider_name: "",
    },
  ],
} as unknown as RecordPanelData;

function header(alerts: string[] = [], data: Partial<RecordPanelData> = {}, current: Encounter | null = null) {
  api.recordPanel.mockResolvedValue({ ...panel, ...data });
  return render(
    <MemoryRouter>
      <VisitHeaderCard appt={appt(alerts)} current={current} pets={1} step={current ? "draft" : "record"} />
    </MemoryRouter>,
  );
}

const daysAgo = (n: number) => new Date(Date.now() - n * 86_400_000).toISOString().slice(0, 10);

describe("the visit banner", () => {
  beforeEach(() => {
    useDayLeft.setState({ data: { left_to_do: [] } as unknown as EndOfDay, load: vi.fn(async () => {}) });
  });

  it("is compact: the pet, its facts, the visit, the owner with Text, Call and the household, and the steps", async () => {
    header();
    expect(screen.getByRole("heading", { name: "Biscuit" })).toBeInTheDocument();
    // Not started is the default: no status pill.
    expect(screen.queryByText("In visit")).not.toBeInTheDocument();
    const facts = (await screen.findByText(/Golden Retriever/)).closest("p");
    expect(facts).toHaveClass("vh-facts", "text-meta");
    // No weight was taken in this visit: the PIMS's weight is on the alert line, not twice.
    expect(facts).toHaveTextContent(/^Golden Retriever · male, neutered · 6 years$/);
    expect(await screen.findByText("72 lb")).toHaveClass("font-num");
    expect(screen.getByText("2:30 PM")).toBeInTheDocument();
    expect(screen.getByText("Exam 1 · 30 min")).toBeInTheDocument();
    expect(screen.getByText("Itchy ears")).toBeInTheDocument();
    expect(screen.getByText("Owner · prefers texts")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Text Jordan" })).toHaveAttribute("href", "sms:+12175550142");
    expect(screen.getByRole("link", { name: "Call Jordan" })).toHaveAttribute("href", "tel:+12175550142");
    const steps = screen.getByRole("list", { name: "Where this visit is" });
    expect(steps).toHaveTextContent("Record, current");
    expect(within(steps).getByText("Follow up")).toBeInTheDocument();
    // No cautions, nothing to show: no "No alerts" line either.
    expect(screen.queryByText(/^Caution:/)).not.toBeInTheDocument();
    expect(api.recordPanel).toHaveBeenCalledWith("pat-1");
  });

  it("puts a weight taken in this visit in the facts with its change, and says when it didn't change", async () => {
    const drafted = {
      id: "e1",
      patient_id: "pat-1",
      status: "draft_ready",
      note: {},
      patient_ids: [],
    } as unknown as Encounter;
    const { unmount } = header(
      [],
      {
        weight: {
          latest: { date: "2026-11-01", value: 74, unit: "lb" },
          previous: { date: "2026-07-04", value: 72, unit: "lb" },
        },
      },
      drafted,
    );
    const facts = () => document.querySelector(".vh-facts");
    await waitFor(() =>
      expect(facts()).toHaveTextContent("Golden Retriever · male, neutered · 6 years · 74 lb, up 2 lb since Jul 4"),
    );
    // The status beside the name, when it isn't the default.
    expect(document.querySelector("#visitTitle")!.parentElement).toHaveTextContent("BiscuitDraft");
    unmount();
    header(
      [],
      {
        weight: {
          latest: { date: "2026-11-01", value: 25.1, unit: "lb" },
          previous: { date: "2026-10-02", value: 25.1, unit: "lb" },
        },
      },
      drafted,
    );
    await waitFor(() => expect(facts()).toHaveTextContent("25.1 lb, no change since Oct 2"));
    expect(screen.queryByText(/same as/)).not.toBeInTheDocument();
  });

  it("the alert line: the weight trend, an old weight and care overdue, only from the record", async () => {
    const { unmount } = header([], {
      weight: {
        latest: { date: "2026-07-04", value: 72, unit: "lb" },
        history: [
          { date: "2026-07-04", value: 72, unit: "lb" },
          { date: "2026-01-05", value: 70.5, unit: "lb" },
        ],
      },
      reminders_due: [{ patient_id: "pat-1", text: "Wellness exam", due: "2026-05-05" }],
    });
    const line = await screen.findByLabelText("Alerts");
    expect(line).toHaveTextContent("72 lb (Jul 4), up 1.5 lb from Jan");
    expect(line).toHaveTextContent("Wellness exam overdue since May 5");
    unmount();
    header([], { weight: { latest: { date: daysAgo(548), value: 89, unit: "g" } } });
    expect(await screen.findByText("Last weighed 18 months ago")).toBeInTheDocument();
  });

  it("labels each caution as an amber dot and plain text, never a warning icon", async () => {
    const { container } = header(["Back problems, lift with support"], {
      patient: { ...panel.patient, alerts: ["Back problems, lift with support"] },
    });
    const caution = await waitFor(() => {
      const c = container.querySelector("[data-caution]");
      expect(c).not.toBeNull();
      return c!;
    });
    expect(
      within(caution as HTMLElement).getByText("Caution: Back problems, lift with support", { ignore: ".sr-only" }),
    ).toBeVisible();
    expect(container.querySelector('[data-icon="warning"]')).toBeNull();
  });

  it("holds no main action and no recording pill: those are in the pinned bar", () => {
    api.recordPanel.mockResolvedValue(panel);
    const glasses = {
      id: "enc-1",
      patient_id: "pat-1",
      source: "glasses",
      status: "recording",
      audio_seconds: 42,
      last_part_at: new Date(Date.now() - 5_000).toISOString(),
    } as unknown as Encounter;
    render(
      <MemoryRouter>
        <VisitHeaderCard appt={appt()} current={glasses} pets={1} state={<span>Started 9:02 AM</span>} step="record" />
      </MemoryRouter>,
    );
    expect(screen.getByText("Started 9:02 AM")).toBeInTheDocument();
    expect(document.querySelector("#visitTitle")!.parentElement).toHaveTextContent("BiscuitIn visit");
    expect(screen.queryByText("Recording from glasses")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Start visit|Draft note|Sign/ })).not.toBeInTheDocument();
    // Record shows how much was recorded.
    expect(screen.getByRole("list", { name: "Where this visit is" })).toHaveTextContent("Record0:42, current");
  });

  it("a failed text to this owner is a red row with Retry, gone everywhere once it's resent", async () => {
    const failed = {
      kind: "failed_text",
      text: "Text to Jordan didn't send",
      label: "Text to Jordan didn't send",
      encounter_id: "e9",
      appointment_id: "a9",
      followup_id: "f9",
      date: "2026-10-29",
      patient_name: "Waffles",
      client_id: "cl-1",
    };
    const load = vi.fn(async () => {
      useDayLeft.setState({ data: { left_to_do: [] } as unknown as EndOfDay });
    });
    useDayLeft.setState({ data: { left_to_do: [failed] } as unknown as EndOfDay, load });
    useApp.setState({
      loadBrief: vi.fn(async () => {}),
      loadNotes: vi.fn(async () => {}),
      loadWaiting: vi.fn(async () => {}),
    });
    api.followUp.mockResolvedValue({});
    header();
    const row = await screen.findByRole("alert");
    expect(row).toHaveTextContent("Your last text to Jordan didn't send");
    await userEvent.click(within(row).getByRole("button", { name: "Retry" }));
    expect(api.followUp).toHaveBeenCalledWith("e9", "f9", expect.objectContaining({ action: "retry_text" }));
    // The one list Home, End of day and the banner read: reloaded, the row is gone from all three.
    expect(load).toHaveBeenCalled();
    await waitFor(() => expect(screen.queryByRole("alert")).not.toBeInTheDocument());
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
  can: { edit: true },
  segments: [
    seg("s1", {
      speaker_id: "vet",
      speaker_name: "Dr. Ana Rivera",
      role: "vet",
      offset_seconds: 6,
      text: "How has she been?",
    }),
    seg("s2", {
      speaker_id: "speaker-3",
      speaker_name: "Speaker 3",
      offset_seconds: 62,
      text: "She scratches at night.",
    }),
  ],
} as unknown as Encounter;

describe("who said each line", () => {
  it("names the vet and leaves anyone else as a speaker number with Who is this?", async () => {
    const setCurrent = vi.fn();
    api.nameSpeaker.mockResolvedValue({ ...visit, segments: [] });
    render(<SpeakerLines e={visit} setCurrent={setCurrent} live />);
    const rows = within(screen.getByRole("list", { name: "Transcript" })).getAllByRole("listitem");
    expect(rows[0]).toHaveTextContent("Dr. Ana Rivera · Provider0:06");
    expect(within(rows[0]!).getByText("AR")).toBeInTheDocument();
    expect(within(rows[1]!).getByText("Speaker 3")).toBeInTheDocument();
    expect(within(rows[1]!).getByText("1:02")).toBeInTheDocument();
    expect(within(rows[0]!).queryByRole("button", { name: "Who is this?" })).not.toBeInTheDocument();

    // Who is this? is one tap, right in the row: Tech, Owner or Other names every line from that voice.
    const choices = within(rows[1]!).getByRole("group", { name: "Who is Speaker 3?" });
    expect(choices).toHaveTextContent("Who is this?");
    expect(
      within(choices)
        .getAllByRole("button")
        .map((b) => b.textContent),
    ).toEqual(["Tech", "Owner", "Other"]);
    await userEvent.click(within(choices).getByRole("button", { name: "Owner" }));
    expect(api.nameSpeaker).toHaveBeenCalledWith("enc-1", "speaker-3", "owner", "");
    expect(setCurrent).toHaveBeenCalled();
  });

  it("a speaker named by the vet says so and can be changed", () => {
    const named = {
      ...visit,
      segments: [
        seg("s2", { speaker_id: "speaker-3", speaker_name: "Tech", role: "tech", offset_seconds: 62, text: "74 lb." }),
      ],
    } as Encounter;
    render(<SpeakerLines e={named} setCurrent={vi.fn()} live={false} />);
    const row = screen.getByRole("listitem");
    expect(row).toHaveTextContent("Tech · named by you1:02");
    expect(within(row).getByRole("button", { name: "Change" })).toBeInTheDocument();
  });

  it("a signed visit can't rename speakers", () => {
    render(<SpeakerLines e={{ ...visit, status: "signed" }} setCurrent={vi.fn()} live={false} />);
    expect(screen.queryByRole("group", { name: /^Who is/ })).not.toBeInTheDocument();
  });
});
