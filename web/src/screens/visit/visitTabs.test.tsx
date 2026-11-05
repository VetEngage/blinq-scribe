import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router";
import { ActionBar, Button, TextArea } from "@blinq-scribe/ui";
import type { Appointment, Household } from "../../api/types";

const api = vi.hoisted(() => ({
  recordPanel: vi.fn(() => new Promise(() => {})),
  endOfDay: vi.fn(() => new Promise(() => {})),
  household: vi.fn(),
  patientProfile: vi.fn(() => new Promise(() => {})),
}));
vi.mock("../../api", () => ({ api }));

import { useApp } from "../../state/app";
import { VisitHeader } from "./parts";
import { VisitPanel, VisitTabsProvider } from "./visitTabs";

const appt = {
  id: "a1",
  start: "2026-11-01T09:00:00",
  duration_min: 30,
  room: "Exam 1",
  reason: "Ear scratching",
  provider_name: "Dr. Ana Rivera",
  patient: { id: "pat-1", name: "Biscuit", species: "Canine", breed: "Golden Retriever", alerts: [] },
  client: { id: "cli-1", first_name: "Jordan", last_name: "Lee", phones: [], emails: [], prefers: "text" },
} as unknown as Appointment;

const household = {
  client: { id: "cli-1", first_name: "Jordan", last_name: "Lee", name: "Jordan Lee", phones: [], emails: [] },
  pets: [
    { id: "pat-1", name: "Biscuit", species: "Canine", breed: "Golden Retriever", alerts: [], today: null },
    { id: "pat-6", name: "Waffles", species: "Canine", breed: "Dachshund", alerts: ["Back problems"], today: null },
  ],
  balance: null,
  book_url: "",
  messages: [],
  remember: [],
} as unknown as Household;

function Page({ stage = "progress" }: { stage?: string }) {
  return (
    <VisitTabsProvider visitKey="a1" petId="pat-1" stage={stage} appt={appt} current={null}>
      <VisitHeader appt={appt} current={null} step="record" />
      <VisitPanel>
        <TextArea aria-label="Transcript" />
      </VisitPanel>
      <ActionBar label="Visit in progress">
        <span>Recording from glasses</span>
        <Button variant="primary">Draft note</Button>
      </ActionBar>
    </VisitTabsProvider>
  );
}

beforeEach(() => {
  localStorage.clear();
  useApp.setState({ visitPetsBy: {}, today: "2026-11-01" });
  api.household.mockResolvedValue(household);
});

describe("Visit | Record", () => {
  it("opens the Record tab on this pet from the household button, and the visit and pinned bar keep going", async () => {
    const { rerender } = render(
      <MemoryRouter>
        <Page />
      </MemoryRouter>,
    );
    const tabs = screen.getByRole("tablist", { name: "This visit" });
    expect(within(tabs).getByRole("tab", { name: "Visit", selected: true })).toBeInTheDocument();
    // The tabs are at the top of the content card, not in the banner.
    expect(tabs.closest(".visit-body")).not.toBeNull();
    expect(tabs.closest(".visit-head")).toBeNull();
    await userEvent.type(screen.getByRole("textbox", { name: "Transcript" }), "Ears red");

    const household = screen.getByRole("button", { name: "Jordan Lee's household" });
    // Labeled in words, not an icon alone.
    expect(household).toHaveTextContent("Jordan Lee's household");
    await userEvent.click(household);
    expect(within(tabs).getByRole("tab", { name: "Record", selected: true })).toBeInTheDocument();
    // The owner is a Title here: the pet in the banner is the page's Display.
    expect(await screen.findByRole("heading", { level: 2, name: "Jordan Lee" })).toHaveClass("text-title");
    expect(screen.getByRole("tab", { name: /^Biscuit\s*This visit/, selected: true })).toBeInTheDocument();
    expect(api.household).toHaveBeenCalledWith("cli-1");
    // The visit is hidden, not gone: what was typed is still there, and the pinned bar stays.
    expect(screen.queryByRole("textbox", { name: "Transcript" })).not.toBeInTheDocument();
    expect(screen.getByRole("region", { name: "Visit in progress" })).toBeVisible();
    expect(screen.getByRole("button", { name: "Draft note" })).toBeVisible();

    await userEvent.click(within(tabs).getByRole("tab", { name: "Visit" }));
    expect(screen.getByRole("textbox", { name: "Transcript" })).toHaveValue("Ears red");

    // A new step of the visit shows on the Visit tab.
    await userEvent.click(within(tabs).getByRole("tab", { name: "Record" }));
    rerender(
      <MemoryRouter>
        <Page stage="review" />
      </MemoryRouter>,
    );
    expect(within(tabs).getByRole("tab", { name: "Visit", selected: true })).toBeInTheDocument();
  });
});

describe("coming back to a visit", () => {
  it("a reload lands on the same tab and pet", async () => {
    const first = render(
      <MemoryRouter>
        <Page />
      </MemoryRouter>,
    );
    await userEvent.click(screen.getByRole("button", { name: "Jordan Lee's household" }));
    expect(screen.getByRole("tab", { name: "Record", selected: true })).toBeInTheDocument();
    first.unmount();
    // Kept in this browser, so a real reload (or signing back in) finds it too.
    expect(localStorage.getItem("blinq_visit_place")).toContain('"tab":"record"');
    // A new page load: nothing in memory but what this browser kept.
    render(
      <MemoryRouter>
        <Page />
      </MemoryRouter>,
    );
    expect(screen.getByRole("tab", { name: "Record", selected: true })).toBeInTheDocument();
    expect(await screen.findByRole("tab", { name: /^Biscuit\s*This visit/, selected: true })).toBeInTheDocument();
  });
});
