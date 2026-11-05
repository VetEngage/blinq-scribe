import { act, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes, useLocation } from "react-router";
import type { Appointment, Brief, EndOfDay, NoteToSign, WaitingLink } from "../api/types";

const api = vi.hoisted(() => ({
  brief: vi.fn(),
  schedule: vi.fn(),
  days: vi.fn(),
  encounter: vi.fn(),
  preRoomCard: vi.fn(),
  notesToSign: vi.fn(),
  waiting: vi.fn(),
  endOfDay: vi.fn(),
  followUp: vi.fn(),
  resend: vi.fn(),
}));
vi.mock("../api", () => ({ api }));
const voice = vi.hoisted(() => ({ say: vi.fn() }));
vi.mock("../state/voice", async (real) => ({ ...(await real<object>()), say: voice.say }));

import { useApp } from "../state/app";
import { useDayLeft } from "../state/eod";
import { Home } from "./Home";

const appt = (id: string, name: string, start: string, extra: Partial<Appointment> = {}) =>
  ({
    id,
    start,
    encounter_id: "",
    visit_status: "not_started",
    reason: "",
    room: "",
    patient: { id: `pat-${id}`, client_id: `cl-${id}`, name, species: "Canine", breed: "", age: 6, alerts: [] },
    client: { id: `cl-${id}`, first_name: "Jordan", last_name: "Lee", phones: [], emails: [] },
    ...extra,
  }) as unknown as Appointment;

const today = "2026-11-01";
const appts = [
  appt("a1", "Biscuit", "2099-11-01T09:00:00", {
    reason: "Ear scratching, head shaking",
    room: "Exam 1",
  }),
  appt("a2", "Miso", "2099-11-01T09:30:00", {
    reason: "Kidney recheck",
    patient: {
      id: "pat-a2",
      client_id: "cl-a2",
      name: "Miso",
      species: "Feline",
      breed: "",
      age: 14,
      alerts: ["Fractious, use towel wrap"],
      alert_chips: [{ text: "Fractious, use towel wrap", short: "Towel wrap" }],
    },
  } as Partial<Appointment>),
];
const brief: Brief = {
  spoken: "",
  date: today,
  sentence: [
    { text: "5 visits", emphasis: "bold", kind: "visits" },
    { text: " today. ", emphasis: "none", kind: "" },
    { text: "1 text that didn't send", emphasis: "failed", kind: "failed" },
    { text: ".", emphasis: "none", kind: "" },
  ],
  new_since_yesterday: [
    {
      kind: "reply",
      text: "Jordan Lee replied: Biscuit is shaking his head again",
      at: "2026-10-31T16:12:00",
      patient_name: "Biscuit",
      patient_id: "pat-a1",
      client_id: "cl-a1",
    },
  ],
};
const note = (id: string, bucket: "ready" | "pending", extra: Partial<NoteToSign> = {}): NoteToSign => ({
  encounter_id: id,
  appointment_id: `appt-${id}`,
  patient_id: "p",
  patient_name: id,
  owner_name: "Jordan Lee",
  client_id: "cl",
  provider_id: "prov-1",
  provider_name: "Dr. Ana Rivera",
  date: "2026-10-27",
  time: "10:15",
  visit_reason: "Nail trim",
  assessment: "Healthy.",
  status: "draft_ready",
  bucket,
  to_confirm: 0,
  followups_undecided: 0,
  reason: "",
  waiting_days: 5,
  ...extra,
});
const left: EndOfDay = {
  spoken: "",
  visits_seen: 0,
  left_to_do: [
    {
      kind: "failed_text",
      text: "Text to Jordan Lee about Waffles did not send",
      label: "Text to Jordan didn't send",
      encounter_id: "enc-w",
      appointment_id: "thu-1@2026-10-29",
      followup_id: "f1",
      date: "2026-10-29",
      patient_name: "Waffles",
    },
    {
      kind: "unsigned",
      text: "Sign Luna's note",
      encounter_id: "enc-l",
      appointment_id: "fri-1@2026-10-30",
      date: "2026-10-30",
      patient_name: "Luna",
    },
  ],
  done_today: [],
  waiting_on_owners: [],
  tomorrow: null,
};
const link: WaitingLink = {
  encounter_id: "enc-k",
  followup_id: "f9",
  patient_id: "pat-8",
  patient_name: "Kiwi",
  owner_name: "Jordan Lee",
  reason: "Recheck Kiwi's weight",
  url: "",
  sent_at: "2026-10-28T15:00:00Z",
  days_waiting: 4,
  status: "sent",
};

function Where() {
  const l = useLocation();
  return <p data-testid="where">{l.pathname + l.search}</p>;
}

function show(list = appts) {
  vi.clearAllMocks();
  api.brief.mockResolvedValue(brief);
  api.schedule.mockResolvedValue(list);
  api.days.mockResolvedValue([]);
  api.notesToSign.mockResolvedValue([
    note("Mochi", "ready"),
    note("Hazel", "ready", { waiting_days: 6 }),
    note("Luna", "pending", { followups_undecided: 1, reason: "1 follow up to decide" }),
  ]);
  api.waiting.mockResolvedValue([link]);
  api.endOfDay.mockResolvedValue(left);
  api.resend.mockResolvedValue(link);
  api.preRoomCard.mockResolvedValue({
    spoken: "",
    weight: "72 lb",
    why: [
      "Last visit Aug 31 for itchy face.",
      "Jordan texted at 4:12 PM yesterday: “Biscuit is shaking his head again”",
    ],
    prep: ["Owner messaged"],
    owner_message: { who: "Jordan", text: "Biscuit is shaking his head again", at: "2026-10-31T16:12:00" },
    last_visit_on: "2026-08-31",
  });
  useDayLeft.setState({ data: null, for: "" });
  useApp.setState({
    brief,
    briefLoaded: true,
    briefDismissed: false,
    today,
    viewDate: today,
    appts: list,
    apptsFor: `prov-1|${today}`,
    schedulePending: false,
    provider: "prov-1",
    doctors: [{ id: "prov-1", name: "Dr. Ana Rivera" }],
    notes: null,
    waiting: null,
    me: { via: "open", admin: true, user: null, role: "", provider_id: "" },
  });
  localStorage.clear();
  render(
    <MemoryRouter initialEntries={["/"]}>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="*" element={<Where />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe("Home", () => {
  it("opens with one purple brief line: facts, the failed text bold (not red), Hear it and Dismiss", async () => {
    show();
    const line = screen.getByRole("region", { name: "Brief" });
    expect(within(line).getByText("1 text that didn't send")).toHaveClass("text-body-strong");
    expect(within(line).getByText("1 text that didn't send")).not.toHaveClass("text-error");
    // No field, no Talk button in the brief: Ask Blinq is the top bar's.
    expect(within(line).queryByRole("textbox")).not.toBeInTheDocument();
    expect(within(line).queryByRole("button", { name: /talk/i })).not.toBeInTheDocument();
    await userEvent.click(within(line).getByRole("button", { name: "Hear it" }));
    expect(voice.say).toHaveBeenCalledWith("5 visits today. 1 text that didn't send.", "brief");
    await userEvent.click(within(line).getByRole("button", { name: "Dismiss" }));
    expect(screen.queryByRole("region", { name: "Brief" })).not.toBeInTheDocument();
  });

  it("greets the provider by name with the day's progress, and no pace it can't know", () => {
    show();
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(
      /^Good (morning|afternoon|evening), Dr\. Rivera$/,
    );
    // Every clinic day reads as one plain sentence, not only the heavy day.
    expect(screen.getByText(/^0 of 2 seen\./)).toBeInTheDocument();
    expect(screen.getByRole("progressbar", { name: "Visits seen today" })).toHaveAttribute("aria-valuenow", "0");
    expect(screen.queryByText(/on time|behind/)).not.toBeInTheDocument();
  });

  it("shows Up next with why it matters as facts, prep chips and quiet links", async () => {
    show();
    const hero = screen.getByRole("region", { name: "Biscuit" });
    expect(within(hero).getByText(/Up next/)).toHaveTextContent("Up next · 9:00 AM · Exam 1");
    expect(await within(hero).findByText(/72 lb/)).toHaveTextContent("Owner Jordan Lee");
    expect(await within(hero).findByText("Last visit Aug 31 for itchy face.")).toBeInTheDocument();
    expect(within(hero).getByText("Why it matters")).toBeInTheDocument();
    expect(within(hero).getByText("Owner messaged")).toBeInTheDocument();
    await userEvent.click(within(hero).getByRole("button", { name: "See Jordan's text" }));
    expect(screen.getByTestId("where")).toHaveTextContent("/record/cl-a1?pet=pat-a1&tab=texts");
  });

  it("has one green action in the pinned bar, which ⌘↵ presses too", async () => {
    show();
    const bar = screen.getByRole("region", { name: "Next step" });
    expect(bar).toHaveTextContent("Up next: Biscuit at 9:00 AM · Exam 1");
    const open = within(bar).getByRole("button", { name: /Open Biscuit's visit/ });
    expect(open).toHaveClass("bg-primary");
    expect(screen.getAllByRole("button").filter((b) => b.className.includes("bg-primary"))).toEqual([open]);
    await userEvent.keyboard("{Meta>}{Enter}{/Meta}");
    expect(screen.getByTestId("where")).toHaveTextContent("/visit/a1?date=2099-11-01");
  });

  it("skips to the next visit from the bar", async () => {
    show();
    await userEvent.click(screen.getByRole("button", { name: "Skip to Miso" }));
    expect(screen.getByRole("button", { name: /Open Miso's visit/ })).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "Miso" })).toHaveTextContent("Caution: Fractious, use towel wrap");
  });

  it("lists follow-ups: the two note buckets, then rows with one action each", async () => {
    show();
    const card = screen.getByRole("region", { name: "Follow-ups waiting" });
    const ready = await within(card).findByRole("button", { name: /Ready to sign/ });
    expect(ready).toHaveTextContent("Oldest 6 days");
    expect(ready).toHaveTextContent("2");
    expect(within(card).getByRole("button", { name: /Pending/ })).toHaveTextContent("1 follow up to decide");
    // The failed text is the red row, with Resend; the unsigned note is a bucket, never a row.
    const failed = await within(card).findByText("Text to Jordan didn't send");
    expect(failed).toHaveClass("text-error");
    expect(within(card).queryByText(/Luna's note/)).not.toBeInTheDocument();
    await userEvent.click(within(card).getByRole("button", { name: "Resend link" }));
    expect(api.resend).toHaveBeenCalledWith("f9");
    expect(await within(card).findByText("Sent again")).toBeInTheDocument();
    await userEvent.click(ready);
    expect(screen.getByTestId("where")).toHaveTextContent("/notes?bucket=ready");
  });

  it("ties what came in since yesterday to its visit", () => {
    show();
    const since = screen.getByRole("region", { name: "Since yesterday" });
    expect(since).toHaveTextContent("Jordan Lee: “Biscuit is shaking his head again”");
    expect(since).toHaveTextContent("Biscuit, 9:00 AM");
  });

  it("loads with skeletons, never a false 'No appointments today'", () => {
    show();
    useApp.setState({ schedulePending: true, appts: [] });
    expect(screen.queryByText("No appointments today.")).not.toBeInTheDocument();
  });

  it("once every visit is seen, the green action signs the notes left", async () => {
    show([appt("a1", "Biscuit", "2026-11-01T09:00:00", { visit_status: "signed" })]);
    const bar = await screen.findByRole("region", { name: "Next step" });
    await waitFor(() =>
      expect(within(bar).getByRole("button", { name: /Review and sign 3 notes/ })).toBeInTheDocument(),
    );
    await userEvent.click(within(bar).getByRole("button", { name: /Review and sign 3 notes/ }));
    expect(screen.getByTestId("where")).toHaveTextContent("/notes?bucket=ready");
  });
});

describe("Home between visits on a standard day", () => {
  const day = [
    appt("t1", "Biscuit", `${today}T09:00:00`, { visit_status: "signed", duration_min: 30 }),
    appt("t2", "Miso", `${today}T09:30:00`, { visit_status: "signed", duration_min: 30 }),
    appt("t3", "Waffles", `${today}T10:00:00`, { duration_min: 20, room: "Exam 1" }),
    appt("t4", "Kiwi", `${today}T10:30:00`, { duration_min: 45 }),
  ];
  it("shows the day line, the free time and quick ones, with the clock pinned to 9:45 AM", async () => {
    show(day);
    localStorage.setItem("blinq_clock", "09:45");
    useApp.setState({ appts: [...day] });
    expect(await screen.findByText(/Free until 10:00\sAM\./)).toBeInTheDocument();
    // No visit started, so no pace is claimed.
    expect(screen.queryByText(/on time|behind/)).not.toBeInTheDocument();
    expect(await screen.findByRole("region", { name: "Quick ones for the gap" })).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "Next step" })).toHaveTextContent("Up next: Waffles at 10:00 AM");
    localStorage.clear();
  });

  it("before clinic keeps Follow-ups waiting beside Up next", () => {
    show(day);
    localStorage.setItem("blinq_clock", "08:00");
    useApp.setState({ appts: [...day] });
    expect(screen.getByRole("region", { name: "Follow-ups waiting" })).toBeInTheDocument();
    expect(screen.queryByRole("region", { name: "Quick ones for the gap" })).not.toBeInTheDocument();
    localStorage.clear();
  });
});

// The demo's busy day: 20 visits, read at its own clock (1:15 PM), between visits.
const busy = "2026-11-03";
const busyAppt = (id: string, name: string, hhmm: string, extra: Partial<Appointment> = {}) =>
  appt(id, name, `${busy}T${hhmm}:00`, { demo_clock: "13:15", duration_min: 30, room: "Exam 2", ...extra });
const busyDay = [
  ...Array.from({ length: 9 }, (_, i) => {
    const hhmm = `${String(8 + Math.floor(i / 2)).padStart(2, "0")}:${i % 2 ? "30" : "00"}`;
    return busyAppt(`d${i}`, `Done${i}`, hhmm, {
      visit_status: "signed",
      // The last one seen started 15 min after its time.
      started_at: `${busy}T${i === 8 ? "12:15" : hhmm}:00`,
    });
  }),
  busyAppt("smokey", "Smokey", "13:30", { reason: "Weight loss, drinking more" }),
  busyAppt("ziggy", "Ziggy", "13:45"),
  busyAppt("lee", "Hazel", "14:00", {
    pets: ["Hazel", "Kiwi", "Mochi"].map((n) => ({
      patient: { id: n, name: n, alerts: [] },
      reason: "",
      visit_status: "not_started",
      encounter_id: "",
    })),
  } as unknown as Partial<Appointment>),
  busyAppt("bruno", "Bruno", "16:00", {
    patient: {
      id: "pat-bruno",
      client_id: "c",
      name: "Bruno",
      alerts: ["Muzzle for exams"],
      alert_chips: [{ text: "Muzzle for exams", short: "Muzzle" }],
    },
  } as unknown as Partial<Appointment>),
  ...["Shadow", "Daisy", "Rosie", "Milo", "Willow", "Thor"].map((n, i) => busyAppt(n, n, `${16 + i}:30`)),
  busyAppt("garcia", "Coco", "15:15"),
];

function showBusy() {
  show(busyDay);
  useApp.setState({ viewDate: busy, apptsFor: `prov-1|${busy}` });
}

describe("Home on a heavy day, between visits", () => {
  it("says the pace from the record and the free time in one plain line, with a slim bar and heads up", async () => {
    showBusy();
    expect(await screen.findByRole("heading", { level: 1, name: "Good afternoon, Dr. Rivera" })).toBeInTheDocument();
    expect(screen.getByText("Running about 15 min behind. Free until 1:30 PM.")).toBeInTheDocument();
    expect(screen.getByRole("progressbar", { name: "Visits seen today" })).toHaveAttribute("aria-valuenow", "9");
    const chips = screen.getByRole("list", { name: "Heads up for the rest of the day" });
    expect(
      within(chips)
        .getAllByRole("listitem")
        .map((c) => c.textContent?.replace(/\s/g, " ")),
    ).toEqual([
      "2:00 PMLee household · 3 pets",
      expect.stringContaining("Bruno ·"),
      "9:30 PMThor · last visit of the day",
    ]);
    expect(within(chips).getAllByText(/^Caution: /).length).toBeGreaterThan(0);
    // Its own brief, from its own record: today's brief stays on today. A text that didn't send still
    // needs the provider whatever day it was sent, as Quick ones for the gap shows.
    const line = await screen.findByRole("region", { name: "Brief" });
    expect(await within(line).findByText("Text to Jordan didn't send.")).toBeInTheDocument();
    expect(line).not.toHaveTextContent("5 visits");
  });

  it("has a brief that says what needs the provider on that day: notes to sign and a text that didn't send", async () => {
    const day = busyDay.map((a) => (a.id === "d8" ? { ...a, visit_status: "draft_ready" as const } : a));
    show(day);
    api.endOfDay.mockResolvedValue({
      ...left,
      left_to_do: [{ ...left.left_to_do[0]!, date: busy, appointment_id: "d3", label: "Text to Sam didn't send" }],
    });
    useApp.setState({ viewDate: busy, apptsFor: `prov-1|${busy}` });
    await act(() => useDayLeft.getState().load());
    const line = await screen.findByRole("region", { name: "Brief" });
    await waitFor(() => expect(line).toHaveTextContent("1 note is waiting on you. Text to Sam didn't send."));
  });

  it("offers quick ones that fit the gap, and one green action to open the next visit", async () => {
    showBusy();
    const quick = await screen.findByRole("region", { name: "Quick ones for the gap" });
    await waitFor(() => expect(within(quick).getAllByRole("listitem").length).toBeGreaterThan(0));
    expect(within(quick).getAllByText(/· \d min$/).length).toBeGreaterThan(0);
    expect(screen.queryByRole("region", { name: "Follow-ups waiting" })).not.toBeInTheDocument();
    const bar = screen.getByRole("region", { name: "Next step" });
    expect(bar).toHaveTextContent("Up next: Smokey at 1:30 PM · Exam 2");
    await userEvent.click(within(bar).getByRole("button", { name: /^Open Smokey's visit/ }));
    expect(screen.getByTestId("where")).toHaveTextContent("/visit/smokey");
  });
});
