import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import userEvent from "@testing-library/user-event";
import type { Appointment, Encounter, FollowUp } from "../../api/types";

const api = vi.hoisted(() => ({
  followUp: vi.fn(),
  recordPanel: vi.fn(() => new Promise(() => {})),
  endOfDay: vi.fn(() => new Promise(() => {})),
}));
vi.mock("../../api", () => ({ api }));
vi.mock("../../state/app", () => ({
  useApp: Object.assign(() => ({}), { getState: () => ({ refreshAfter: vi.fn() }) }),
  dayChanged: [],
}));

import { FollowUpCard } from "./FollowUpCard";
import { RichText } from "./NoteEditor";
import { confirmsIn } from "./confirm";
import { Drafting } from "./Drafting";

const appt = {
  id: "appt-1",
  start: "2026-10-31T09:00:00",
  reason: "Ear scratching",
  provider_name: "Dr. Ana Rivera",
  room: "Exam 1",
  patient: { id: "pat-1", name: "Biscuit", species: "Dog", breed: "Golden Retriever", age: 6, alerts: [] },
  client: { id: "cli-1", first_name: "Jordan", last_name: "Lee", phones: [], emails: [] },
} as unknown as Appointment;
const enc = {
  id: "enc-1",
  patient_name: "Biscuit",
  patient_ids: ["pat-1"],
  patient_id: "pat-1",
  followups: [],
  status: "draft_ready",
  note: {},
} as unknown as Encounter;
const recheck: FollowUp = {
  id: "f1",
  kind: "recheck",
  reason: "Ear recheck",
  due_in_days: 14,
  message_draft: "Time for Biscuit's recheck",
  status: "draft",
  suggested_slots: [
    { start: "2026-11-14T09:00:00", end: "2026-11-14T09:30:00" },
    { start: "2026-11-14T10:00:00", end: "2026-11-14T10:30:00" },
  ],
  sms: null,
  booked_slot: null,
  booking: null,
  booking_mode: "link",
  booking_link: null,
};

describe("Follow up card", () => {
  beforeEach(() => api.followUp.mockReset().mockResolvedValue(enc));

  it("defaults a recheck to a booking link and sends no time", async () => {
    render(
      <MemoryRouter>
        <FollowUpCard f={recheck} e={enc} appt={appt} onUpdated={() => {}} />
      </MemoryRouter>,
    );
    expect(screen.getByRole("radio", { name: /Send a booking link/ })).toBeChecked();
    expect(screen.queryByRole("radiogroup", { name: "Recheck time" })).not.toBeInTheDocument();
    expect(
      screen.getByText(
        // Around the due date, counted from the visit's own day: Oct 31 + 14 days is Nov 14.
        "Jordan picks a time between Nov 12 and Nov 16",
      ),
    ).toBeInTheDocument();
    // The reminder is on unless the provider turns it off.
    const remind = screen.getByRole("checkbox", { name: "Remind Jordan if not booked in 3 days" });
    expect(remind).toBeChecked();
    await userEvent.click(screen.getByRole("button", { name: "Approve" }));
    expect(api.followUp).toHaveBeenCalledWith("enc-1", "f1", {
      action: "approve",
      message_draft: "Time for Biscuit's recheck",
      slot_start: null,
      booking_mode: "link",
      remind_unbooked: true,
    });
  });

  it("turning the reminder off says so to the server", async () => {
    render(
      <MemoryRouter>
        <FollowUpCard f={recheck} e={enc} appt={appt} onUpdated={() => {}} />
      </MemoryRouter>,
    );
    await userEvent.click(screen.getByRole("checkbox", { name: "Remind Jordan if not booked in 3 days" }));
    await userEvent.click(screen.getByRole("button", { name: "Approve" }));
    expect(api.followUp).toHaveBeenLastCalledWith("enc-1", "f1", expect.objectContaining({ remind_unbooked: false }));
  });

  it("an approved link says when its reminder goes out, then that it went", () => {
    const sent = {
      ...recheck,
      status: "approved" as const,
      remind_unbooked: true,
      booking_link: {
        url: "",
        from: "2026-11-12",
        to: "2026-11-16",
        expires_at: null,
        status: "sent" as const,
        sent_at: "2026-11-01T15:00:00",
        booked_start: null,
      },
    };
    const { rerender } = render(
      <MemoryRouter>
        <FollowUpCard f={sent} e={enc} appt={appt} onUpdated={() => {}} />
      </MemoryRouter>,
    );
    expect(screen.getByText(/Reminder goes out Nov 4 if not booked/)).toBeInTheDocument();
    rerender(
      <MemoryRouter>
        <FollowUpCard
          f={{ ...sent, reminder: { status: "preview", detail: "", text: "Hi", at: "2026-11-04T15:00:00" } }}
          e={enc}
          appt={appt}
          onUpdated={() => {}}
        />
      </MemoryRouter>,
    );
    expect(screen.getByText(/Reminder sent Nov 4/)).toBeInTheDocument();
  });

  it("keeps a garbled reason out of the title and the info line", () => {
    const garbled = "ear infection recheck after treatment start for symptom relapse ... ok HRI ?? .. ".repeat(10);
    render(
      <MemoryRouter>
        <FollowUpCard
          f={{ ...recheck, reason: garbled, title: "Recheck: ear infection" }}
          e={enc}
          appt={appt}
          onUpdated={() => {}}
        />
      </MemoryRouter>,
    );
    expect(screen.getByText("Recheck: ear infection")).toBeInTheDocument();
    expect(screen.getByText("In 14 days · Due Nov 14 · 2 open times found")).toBeInTheDocument();
    expect(screen.getByText("Details")).toBeInTheDocument();
    expect(screen.getByText(/Jordan picks a time/).textContent).not.toContain("HRI");
  });

  it("without a title, cuts the reason short for the heading", () => {
    const long = "Recheck the right ear after two weeks of drops and check the left ear for any new redness too";
    render(
      <MemoryRouter>
        <FollowUpCard f={{ ...recheck, reason: long }} e={enc} appt={appt} onUpdated={() => {}} />
      </MemoryRouter>,
    );
    const heading = screen.getByText(/^Recheck the right ear/, { selector: "b" });
    expect(heading.textContent!.length).toBeLessThanOrEqual(60);
    expect(heading.textContent).toMatch(/…$/);
  });

  it("Book it now shows the open times and books the one picked", async () => {
    render(
      <MemoryRouter>
        <FollowUpCard f={recheck} e={enc} appt={appt} onUpdated={() => {}} />
      </MemoryRouter>,
    );
    await userEvent.click(screen.getByRole("radio", { name: /Book it now/ }));
    const times = screen.getAllByRole("radio").filter((r) => r.closest("[aria-label='Recheck time']"));
    expect(times).toHaveLength(2);
    await userEvent.click(times[1]!);
    await userEvent.click(screen.getByRole("button", { name: "Approve" }));
    expect(api.followUp).toHaveBeenCalledWith(
      "enc-1",
      "f1",
      expect.objectContaining({ slot_start: "2026-11-14T10:00:00", booking_mode: "book" }),
    );
  });

  it("an approved text in demo mode shows the exact text the owner would get", () => {
    const done: FollowUp = {
      ...recheck,
      kind: "client_update",
      status: "approved",
      sms: { status: "preview", detail: "", text: "Hi Jordan, Biscuit is doing well.", to_masked: "" },
    };
    render(
      <MemoryRouter>
        <FollowUpCard f={done} e={enc} appt={appt} onUpdated={() => {}} />
      </MemoryRouter>,
    );
    expect(screen.getByText("Demo mode: the text the owner would get")).toBeInTheDocument();
    expect(screen.getByText("Hi Jordan, Biscuit is doing well.")).toBeInTheDocument();
  });
});

describe("Note text", () => {
  it("shows a confirm alone on its line on the line it's about", () => {
    const { container } = render(
      <p className="pre">
        <RichText text={"- Ear drops twice a day\n- [confirm: ear drop product and duration]\n- Recheck 2 weeks"} />
      </p>,
    );
    const mark = container.querySelector("mark[data-confirm]")!;
    expect(mark).toHaveTextContent("Confirm: ear drop product and duration");
    expect(container.textContent).toBe(
      "- Ear drops twice a day Confirm: ear drop product and duration\n- Recheck 2 weeks",
    );
  });

  it("marks [confirm] lines and never renders server text as HTML", () => {
    const { container } = render(
      <p>
        <RichText text={'Weight [confirm: weight] <img src=x onerror="alert(1)">'} />
      </p>,
    );
    expect(container.querySelector("mark[data-confirm]")).toHaveTextContent("Confirm: weight");
    expect(container.querySelector("img")).toBeNull();
    expect(container).toHaveTextContent('<img src=x onerror="alert(1)">');
    expect(confirmsIn("a [confirm] b [confirm: x]")).toBe(2);
  });
});

describe("Drafting the note", () => {
  it("shows each step from draft_progress, with the note skeleton", () => {
    const { container } = render(
      <MemoryRouter>
        <Drafting
          appt={appt}
          current={enc}
          steps={[
            { step: "transcript", label: "", state: "done", detail: "12 lines" },
            { step: "photos", label: "", state: "done" },
            { step: "soap", label: "", state: "running" },
          ]}
        />
      </MemoryRouter>,
    );
    // The drafting steps, not the banner's step bar (which says Draft is where the visit is).
    const steps = [...container.querySelectorAll("ol.steps > li")];
    expect(steps.map((s) => s.getAttribute("data-state"))).toEqual(["done", "done", "running", "pending", "pending"]);
    expect(screen.getByRole("list", { name: "Where this visit is" })).toHaveTextContent("Draft, current");
    expect(steps[0]).toHaveTextContent("Reading the transcript · 12 lines");
    expect(container.querySelectorAll("[data-skeleton]").length).toBeGreaterThan(0);
  });

  it("before the first report, the first step shows as working", () => {
    const { container } = render(
      <MemoryRouter>
        <Drafting appt={appt} current={enc} steps={[]} />
      </MemoryRouter>,
    );
    expect(container.querySelector("ol.steps > li")).toHaveAttribute("data-state", "running");
  });
});
