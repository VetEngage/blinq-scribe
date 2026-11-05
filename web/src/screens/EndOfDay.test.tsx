import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes, useLocation } from "react-router";
import type { Appointment, EndOfDay, NoteToSign, OpenItem, WaitingLink } from "../api/types";

const api = vi.hoisted(() => ({
  endOfDay: vi.fn(),
  schedule: vi.fn(),
  days: vi.fn(),
  brief: vi.fn(),
  notesToSign: vi.fn(),
  waiting: vi.fn(),
  encounter: vi.fn(),
  followUp: vi.fn(),
  resend: vi.fn(),
  sendToPims: vi.fn(),
  markPrescriptionEntered: vi.fn(),
}));
vi.mock("../api", () => ({ api }));

import { useApp } from "../state/app";
import { useDayLeft } from "../state/eod";
import { EndOfDayScreen } from "./EndOfDay";
import { LeftColumn } from "./LeftColumn";

const today = "2026-11-01";
const item = (over: Partial<OpenItem>): OpenItem => ({
  kind: "unsigned",
  text: "",
  encounter_id: "e1",
  appointment_id: "a1",
  date: today,
  patient_name: "Biscuit",
  ...over,
});
const visit = (id: string, name: string, start: string, status: Appointment["visit_status"]) =>
  ({
    id,
    start,
    reason: "Recheck",
    visit_status: status,
    patient: { id: `p-${id}`, client_id: "c", name, alerts: [] },
    client: { id: "c", first_name: "Jordan", last_name: "Lee" },
  }) as unknown as Appointment;
const note = (id: string, extra: Partial<NoteToSign> = {}): NoteToSign => ({
  encounter_id: id,
  appointment_id: `appt-${id}`,
  patient_id: "p",
  patient_name: id,
  owner_name: "Jordan Lee",
  client_id: "c",
  provider_id: "prov-1",
  provider_name: "Dr. Ana Rivera",
  date: today,
  time: "13:30",
  visit_reason: "Limping, back legs",
  assessment: "",
  status: "draft_ready",
  bucket: "ready",
  to_confirm: 0,
  followups_undecided: 0,
  reason: "",
  waiting_days: 0,
  ...extra,
});
const link: WaitingLink = {
  encounter_id: "e9",
  followup_id: "f9",
  patient_id: "p9",
  patient_name: "Kiwi",
  owner_name: "Jordan Lee",
  reason: "Recheck",
  url: "",
  sent_at: "2026-10-28T15:00:00Z",
  days_waiting: 4,
  status: "sent",
};
const eod = (over: Partial<EndOfDay> = {}): EndOfDay => ({
  spoken: "You saw 2 of 2 visits today.",
  visits_seen: 2,
  rechecks_booked: 0,
  recheck_links_sent: 1,
  recheck_links_booked: 0,
  left_to_do: [
    item({}),
    item({
      kind: "failed_text",
      text: "Text to Jordan did not send",
      label: "Text to Jordan didn't send",
      encounter_id: "e2",
      appointment_id: "a2",
      followup_id: "f1",
      patient_name: "Waffles",
      date: "2026-10-29",
    }),
    item({
      kind: "prescription",
      text: "Enter Biscuit's prescription in the PIMS",
      encounter_id: "e3",
      detail: "Otomax, 10 days",
    }),
  ],
  done_today: [{ text: "Signed Miso's note", encounter_id: "e4" }],
  waiting_on_owners: [],
  tomorrow: { date: "2026-11-02", visits: 4, first: "08:30", last: "14:00", prepare: [] },
  ...over,
});

function Where() {
  const l = useLocation();
  return <p data-testid="where">{l.pathname + l.search}</p>;
}

function show(
  r: EndOfDay | Error = eod(),
  notes = [note("Waffles", { to_confirm: 1, bucket: "pending" }), note("Mochi")],
  appts = [
    visit("a1", "Biscuit", "2026-11-01T09:00:00", "signed"),
    visit("a2", "Miso", "2026-11-01T09:30:00", "draft_ready"),
  ],
) {
  vi.clearAllMocks();
  if (r instanceof Error) api.endOfDay.mockRejectedValue(r);
  else api.endOfDay.mockResolvedValue(r);
  api.schedule.mockResolvedValue(appts);
  api.days.mockResolvedValue([]);
  api.brief.mockResolvedValue({ spoken: "" });
  api.notesToSign.mockResolvedValue(notes);
  api.waiting.mockResolvedValue([link]);
  api.followUp.mockResolvedValue({});
  api.markPrescriptionEntered.mockResolvedValue({});
  useDayLeft.setState({ data: null, for: "" });
  useApp.setState({
    today,
    viewDate: today,
    provider: "prov-1",
    doctors: [{ id: "prov-1", name: "Dr. Ana Rivera" }],
    appts,
    apptsFor: `prov-1|${today}`,
    schedulePending: false,
    notes: null,
    waiting: null,
    me: { via: "open", admin: true, user: null, role: "", provider_id: "", permissions: ["prescription.enter"] },
  });
  render(
    <MemoryRouter initialEntries={["/end-of-day"]}>
      <Routes>
        <Route
          path="/end-of-day"
          element={
            <>
              <LeftColumn />
              <EndOfDayScreen />
            </>
          }
        />
        <Route path="*" element={<Where />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe("End of day", () => {
  it("leads with the notes left to sign, the one to confirm marked in Blinq's purple", async () => {
    show();
    const card = await screen.findByRole("region", { name: "Notes left to sign" });
    await within(card).findByText("Waffles");
    expect(within(card).getByText("1 to confirm")).toHaveClass("text-ai");
    expect(within(card).getAllByRole("button")).toHaveLength(2);
    expect(within(card).getByText("1 note signed today.")).toBeInTheDocument();
  });

  it("has one green action, Review and sign N notes, in the pinned bar; ⌘↵ presses it", async () => {
    show();
    const bar = await screen.findByRole("region", { name: "Notes to sign" });
    const main = await within(bar).findByRole("button", { name: /Review and sign 2 notes/ });
    expect(main).toHaveClass("bg-primary");
    expect(screen.getAllByRole("button").filter((b) => b.className.includes("bg-primary"))).toEqual([main]);
    await userEvent.keyboard("{Control>}{Enter}{/Control}");
    expect(screen.getByTestId("where")).toHaveTextContent("/notes?bucket=ready");
  });

  it("lists calls and texts left: the failed text red with Retry, the link neutral with Resend link", async () => {
    show();
    const card = await screen.findByRole("region", { name: "Calls and texts left" });
    const failed = await within(card).findByText("Text to Jordan didn't send");
    expect(failed).toHaveClass("text-error");
    expect(within(card).getByText("Kiwi's recheck link not booked")).not.toHaveClass("text-error");
    await userEvent.click(within(card).getByRole("button", { name: "Retry" }));
    expect(api.followUp).toHaveBeenCalledWith("e2", "f1", {
      action: "retry_text",
      message_draft: null,
      slot_start: null,
    });
    // A note to sign is never a call or a text.
    expect(within(card).queryByText(/Biscuit/)).not.toBeInTheDocument();
  });

  it("keeps the prescription task for the front desk, with Mark entered", async () => {
    show();
    const card = await screen.findByRole("region", { name: "Front desk and the PIMS" });
    await userEvent.click(within(card).getByRole("button", { name: /Mark entered in the PIMS/ }));
    expect(api.markPrescriptionEntered).toHaveBeenCalledWith("e3");
  });

  it("counts a recheck link sent as sent, not booked, and ends on a calm line", async () => {
    show();
    expect(await screen.findByText(/sent, none booked yet/)).toBeInTheDocument();
    expect(screen.getByText("1 recheck link")).toHaveClass("text-body-strong");
    expect(screen.getByRole("region", { name: "Already handled" })).toHaveTextContent("Signed Miso's note");
    expect(screen.getByText("That's the day. Everything else can wait until tomorrow.")).toBeInTheDocument();
  });

  it("says the closing line only once every visit is seen", async () => {
    show(eod(), undefined, [
      visit("a1", "Biscuit", "2026-11-01T09:00:00", "signed"),
      visit("a2", "Miso", "2026-11-01T09:30:00", "not_started"),
    ]);
    expect(await screen.findByRole("region", { name: "Already handled" })).toBeInTheDocument();
    expect(screen.queryByText("That's the day. Everything else can wait until tomorrow.")).not.toBeInTheDocument();
  });

  it("folds the rail to a summary: seen, two counts, tomorrow and Done", async () => {
    show();
    const rail = screen.getByRole("region", { name: "Your day" });
    expect(within(rail).getByText("All 2 seen")).toBeInTheDocument();
    expect(within(rail).getByText("Last visit at 9:30 AM")).toBeInTheDocument();
    await waitFor(() => expect(within(rail).getByText("Notes to sign").nextSibling).toHaveTextContent("2"));
    await waitFor(() => expect(within(rail).getByText("Calls and texts").nextSibling).toHaveTextContent("2"));
    expect(await within(rail).findByText(/Mon Nov 2 · 4 visits, first at 8:30/)).toBeInTheDocument();
    await userEvent.click(within(rail).getByRole("button", { name: "Done · 2" }));
    expect(within(rail).getByRole("button", { name: /Biscuit/ })).toBeInTheDocument();
    // No To do box and no week strip.
    expect(screen.queryByText("To do")).not.toBeInTheDocument();
  });

  it("has no green action when every note is signed", async () => {
    show(eod(), []);
    expect(await screen.findByText("Every note is signed.")).toBeInTheDocument();
    expect(screen.queryByRole("region", { name: "Notes to sign" })).not.toBeInTheDocument();
  });

  it("says when the summary isn't available", async () => {
    show(new Error("down"));
    expect(await screen.findByText(/The end of day summary/)).toBeInTheDocument();
  });
});
