import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router";
import { ToastProvider } from "@blinq-scribe/ui";
import type { Appointment, Encounter, FollowUp, PreRoomCard, Profile } from "../../api/types";

const api = vi.hoisted(() => ({
  recordPanel: vi.fn(() => new Promise(() => {})),
  sendToPims: vi.fn(),
  share: vi.fn(),
  followUp: vi.fn(),
  group: vi.fn(async () => []),
  encounter: vi.fn(),
  endOfDay: vi.fn(() => new Promise(() => {})),
  setPlanChecks: vi.fn(async () => []),
}));
vi.mock("../../api", () => ({ api }));

import { ymd } from "../../lib/format";
import { useApp } from "../../state/app";
import { Signed } from "./Signed";
import { Pets, WalkIn } from "./BeforeVisit";

const appt = (extra: Partial<Appointment> = {}) =>
  ({
    id: "a1",
    start: "2026-11-01T09:00:00",
    duration_min: 30,
    room: "Exam 1",
    reason: "Ear scratching",
    provider_name: "Dr. Ana Rivera",
    visit_status: "signed",
    patient: { id: "pat-1", name: "Biscuit", alerts: [] },
    client: {
      id: "cl-1",
      first_name: "Jordan",
      last_name: "Lee",
      phones: ["+12175551234"],
      emails: ["jordan@example.com"],
      prefers: "text",
    },
    ...extra,
  }) as unknown as Appointment;

const miso = appt({
  id: "a2",
  start: "2026-11-01T09:30:00",
  reason: "Kidney recheck",
  room: "Exam 2",
  visit_status: "not_started",
  patient: { id: "pat-2", name: "Miso", alerts: [] } as unknown as Appointment["patient"],
});

const item = (kind: string, status: string, label = kind) => ({
  kind,
  id: kind,
  label,
  status,
  synced_at: status === "synced" ? "2026-11-01T09:28:00" : null,
  pims_id: "",
  detail: "",
});

const signed = (extra: Partial<Encounter> = {}) =>
  ({
    id: "enc-1",
    status: "signed",
    signed_at: "2026-11-01T09:28:00",
    signed_by: "Dr. Ana Rivera",
    can: { sign: true, share: true },
    photos: [],
    followups: [],
    patient_ids: ["pat-1"],
    patient_id: "pat-1",
    group_id: "",
    note_type: "soap",
    note: {
      subjective: "Scratching the right ear.",
      plan: "Recheck in 14 days.",
      client_summary: "",
      vitals: {},
      medications: ["Cefpodoxime 100 mg"],
    },
    pims_items: [item("note", "synced", "Note"), item("prescription", "not_sent", "Prescription")],
    ...extra,
  }) as unknown as Encounter;

function page(e: Encounter, setCurrent = vi.fn()) {
  useApp.setState({ appts: [appt(), miso], noteTypes: [] });
  return render(
    <MemoryRouter>
      <ToastProvider>
        <Signed appt={appt()} current={e} profile={false} setCurrent={setCurrent} />
      </ToastProvider>
    </MemoryRouter>,
  );
}

const bar = () => screen.getByRole("region", { name: "Next step" });

describe("the signed visit", () => {
  beforeEach(() => {
    api.share.mockReset();
    api.sendToPims.mockReset();
  });

  it("says it once in the banner, keeps the PIMS list closed when all is saved, and the bar sends the summary", async () => {
    api.share.mockResolvedValue({
      channel: "text",
      language: "en",
      status: "preview",
      detail: "",
      text: "Hi Jordan, here's Biscuit's visit summary.",
      url: "",
      expires_at: null,
    });
    page(signed());
    expect(screen.getByText("Signed by Dr. Ana Rivera at 9:28 AM")).toBeInTheDocument();
    // The prescription is the front desk's, so it doesn't keep the line from saying saved.
    const line = screen.getByRole("button", { name: "Saved to the PIMS" });
    expect(line).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByText("In the PIMS")).not.toBeInTheDocument();
    // No green Signed banner, no Locked tag, no Next visit button on the page.
    expect(screen.queryByText("Locked")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^Next visit/ })).not.toBeInTheDocument();
    // The note is collapsed while there's still a step to take.
    expect(screen.getByRole("button", { name: "Show the signed note" })).toHaveAttribute("aria-expanded", "false");
    // The share card has no send of its own: the bar holds the one main action.
    const share = screen.getByRole("region", { name: "Share the visit summary with Jordan" });
    expect(within(share).queryByRole("button", { name: "Send summary" })).not.toBeInTheDocument();
    expect(within(bar()).getByText("Text a link")).toBeInTheDocument();
    expect(within(bar()).getByText(/1234 · English$/)).toBeInTheDocument();
    // The one green action says what it does and to whom, the owner's way first.
    await userEvent.click(within(bar()).getByRole("button", { name: /^Text summary to Jordan/ }));
    expect(api.share).toHaveBeenCalledWith("enc-1", "text", "en");
    // Sent: the card goes, the banner says so, and the bar moves on to the next visit.
    expect(await screen.findByText(/^Demo: summary text ready at \d{1,2}:\d{2}\s[AP]M$/)).toBeInTheDocument();
    expect(screen.queryByRole("region", { name: "Share the visit summary with Jordan" })).not.toBeInTheDocument();
    expect(screen.getByText("Demo mode: the text the owner would get")).toBeInTheDocument();
    expect(within(bar()).getByText("Miso at 9:30 AM")).toBeInTheDocument();
    expect(within(bar()).getByText("Kidney recheck · Exam 2")).toBeInTheDocument();
    expect(within(bar()).getByRole("button", { name: /^Next: Miso/ })).toBeInTheDocument();
    // The step bar: shared, so the visit is past Share.
    expect(screen.getByRole("list", { name: "Where this visit is" })).not.toHaveTextContent("Share, current");
    // The PIMS list is one click away.
    await userEvent.click(line);
    expect(screen.getByText("In the PIMS")).toBeInTheDocument();
    expect(screen.getByText("Front desk enters it")).toBeInTheDocument();
  });

  it("opens the PIMS list on its own when something isn't saved, and the bar sends it first", () => {
    page(
      signed({
        pims_items: [
          item("note", "synced", "Note"),
          item("photo", "not_sent", "Photo: Right ear"),
          item("prescription", "not_sent", "Prescription"),
        ],
      } as unknown as Partial<Encounter>),
    );
    expect(screen.getByRole("button", { name: "1 of 2 saved to the PIMS" })).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByText("In the PIMS")).toBeInTheDocument();
    // What isn't there, in words, with the action beside it.
    expect(within(bar()).getByText("1 photo isn't in the PIMS yet")).toBeInTheDocument();
    const buttons = within(bar())
      .getAllByRole("button")
      .filter((b) => b.getAttribute("aria-label") !== "Ask Blinq by voice");
    expect(buttons.map((b) => b.textContent?.replace(/Ctrl$/, ""))).toEqual(["Send to the PIMS"]);
    // Never a Send on the prescription row.
    expect(screen.getAllByRole("button", { name: /Send/ })).toHaveLength(1);
  });

  it("shows one Follow ups list, a line each, a failed text in red with Retry", () => {
    const f = (id: string, extra: Partial<FollowUp>): FollowUp =>
      ({
        id,
        kind: "client_update",
        reason: "Check in if not better",
        title: "Check in if not better",
        due_in_days: 3,
        message_draft: "",
        status: "approved",
        suggested_slots: [],
        sms: null,
        booked_slot: null,
        booking: null,
        booking_mode: null,
        booking_link: null,
        ...extra,
      }) as unknown as FollowUp;
    page(
      signed({
        followups: [
          f("f1", { sms: { status: "sent", detail: "", text: "", to_masked: "***1234" } }),
          f("f2", {
            title: "Lab results",
            reason: "Lab results",
            sms: { status: "failed", detail: "Carrier refused", text: "", to_masked: "" },
          }),
        ],
      }),
    );
    expect(screen.getAllByRole("heading", { name: "Follow ups" })).toHaveLength(1);
    expect(screen.queryByText("After the visit")).not.toBeInTheDocument();
    expect(screen.getByText("Text failed: Carrier refused")).toHaveClass("tone-error");
    expect(screen.getByRole("button", { name: "Retry text" })).toBeInTheDocument();
  });

  it("with nothing left, the note opens and the bar opens the next visit", () => {
    page(signed({ can: { sign: true, share: false } } as unknown as Partial<Encounter>));
    expect(screen.getByRole("button", { name: "Hide the signed note" })).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByText("Scratching the right ear.")).toBeInTheDocument();
    expect(within(bar()).getByRole("button", { name: /^Next: Miso/ })).toBeInTheDocument();
  });
});

describe("Before you walk in", () => {
  const card = (extra: Partial<PreRoomCard> = {}): PreRoomCard => ({
    spoken: "Biscuit, 6 year old canine, in for ear scratching.",
    take: "",
    walk_in: [
      {
        // Yesterday on the local calendar (an ISO date in UTC is "today" here in the evening).
        date: ymd(new Date(Date.now() - 86_400_000)),
        kind: "message",
        who: "Jordan",
        mine: false,
        text: "Biscuit is shaking his head again, can we come in tomorrow?",
        items: [],
      },
      {
        date: "2026-08-31",
        kind: "plan",
        who: "Dr. Ana Rivera",
        mine: true,
        text: "Itchy face. Suspect environmental allergy.",
        items: [
          {
            text: "Apoquel 16 mg by mouth twice a day for 14 days, then once a day",
            status: "",
            note: "30 tablets dispensed Aug 31, none since",
          },
          { text: "Recheck in 4 weeks", status: "Was due Sep 28, not booked", note: "" },
        ],
      },
      {
        date: "2026-01-05",
        kind: "visit",
        who: "Dr. Sam Okafor",
        mine: false,
        text: "Ear infection, left. Resolved after 10 days of drops.",
        items: [],
      },
    ],
    can_do_today: ["Rabies vaccine due Nov 21"],
    remember_items: [
      {
        id: "r1",
        text: "Moving to Springfield in December",
        kind: "move",
        said_at: "2026-10-23T10:00:00",
        said_by: "Jordan Lee · Owner",
      },
    ],
    ...extra,
  });

  it("is dated facts, newest first: the owner's text, the last plan as checkboxes, an older visit", async () => {
    render(<WalkIn appt={appt()} card={card()} />);
    const list = screen.getByRole("list", { name: "Before you walk in, newest first" });
    const entries = within(list)
      .getAllByRole("listitem")
      .filter((li) => li.classList.contains("walk-entry"));
    expect(entries.map((e) => e.querySelector(".walk-date")?.textContent)).toEqual(["Yesterday", "Aug 31", "Jan 5"]);
    expect(
      within(entries[0]!).getByText(
        "Jordan texted: \u201cBiscuit is shaking his head again, can we come in tomorrow?\u201d",
      ),
    ).toBeInTheDocument();
    // The provider's own plan, quoted in plain words; nothing interpreted, nothing suggested.
    expect(within(entries[1]!).getByText("From your last plan")).toBeInTheDocument();
    const box = within(entries[1]!).getByRole("checkbox", {
      name: "Apoquel 16 mg by mouth twice a day for 14 days, then once a day, from the plan",
    });
    expect(box).not.toBeChecked();
    await userEvent.click(box);
    expect(box).toBeChecked();
    // Ticked is asked to cover today: kept with the visit on the server, for the draft.
    await waitFor(() =>
      expect(api.setPlanChecks).toHaveBeenCalledWith(appt().id, appt().patient.id, [
        "Apoquel 16 mg by mouth twice a day for 14 days, then once a day",
      ]),
    );
    expect(within(entries[1]!).getByText("30 tablets dispensed Aug 31, none since")).toBeInTheDocument();
    // Bold ink with an icon, never small gray.
    expect(within(entries[1]!).getByText("Was due Sep 28, not booked")).toHaveClass("walk-status", "text-body-strong");
    expect(document.body.textContent).not.toMatch(/\b(PO|BID|SID)\b|x14d|likely|relapse|Plan to check/);
    expect(
      within(entries[2]!).getByText(/Ear infection, left\. Resolved after 10 days of drops\./),
    ).toBeInTheDocument();
    expect(screen.getByText("Can do today: Rabies vaccine due Nov 21")).toBeInTheDocument();
    expect(screen.getByText('Jordan: "Moving to Springfield in December"')).toBeInTheDocument();
    expect(screen.getByText("From the PIMS and texts")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Read aloud/ })).toBeInTheDocument();
  });

  it("comes back with the lines ticked before, from the server", () => {
    const c = card();
    const plan = c.walk_in![1]!;
    render(
      <WalkIn
        appt={appt()}
        card={{ ...c, walk_in: [{ ...plan, items: plan.items.map((x, i) => ({ ...x, checked: i === 0 })) }] }}
      />,
    );
    expect(screen.getAllByRole("checkbox")[0]).toBeChecked();
  });

  it("says another provider's plan is theirs", () => {
    const c = card();
    render(
      <WalkIn appt={appt()} card={{ ...c, walk_in: [{ ...c.walk_in![1]!, mine: false, who: "Dr. Sam Okafor" }] }} />,
    );
    expect(screen.getByText("From Dr. Sam Okafor's last plan")).toBeInTheDocument();
  });

  it("shows nothing when there's nothing on record", () => {
    const { container } = render(
      <WalkIn appt={appt()} card={card({ walk_in: [], can_do_today: [], remember_items: [] })} />,
    );
    expect(container).toBeEmptyDOMElement();
  });
});

describe("the pets in a visit", () => {
  const pet = (id: string, name: string, due: string[] = []) => ({
    id,
    name,
    species: "Dog",
    breed: "",
    age: 3,
    alerts: [],
    last_visit: null,
    due,
  });
  const profile = (pets: ReturnType<typeof pet>[]) => ({ other_pets: pets }) as unknown as Profile;
  beforeEach(() => {
    useApp.setState({
      visitPetsBy: {},
      appts: [appt(), appt({ id: "a2", start: "2026-11-01T13:30:00", patient: { id: "p-waffles", name: "Waffles", alerts: [] } } as unknown as Partial<Appointment>)],
    });
  });

  it("shows each pet once: reasons as chips, the rest in a menu of what's left", async () => {
    render(
      <Pets
        appt={appt()}
        profile={profile([
          pet("p-waffles", "Waffles"),
          pet("p-hazel", "Hazel"),
          pet("p-kiwi", "Kiwi", ["Wellness exam due 2020-01-01"]),
          pet("p-mochi", "Mochi"),
        ])}
      />,
    );
    expect(screen.getByRole("button", { name: /^Waffles ?· visit today at 1:30\sPM$/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^Kiwi ?· wellness exam overdue$/ })).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "2 more pets" }));
    expect((await screen.findAllByRole("menuitem")).map((m) => m.textContent)).toEqual(["Hazel", "Mochi"]);
  });

  it("with no reasons, offers the whole household in the menu", () => {
    render(<Pets appt={appt()} profile={profile([pet("p-hazel", "Hazel"), pet("p-mochi", "Mochi")])} />);
    expect(screen.getByRole("button", { name: /^Add a pet from Jordan.s household ?\(2\)$/ })).toBeInTheDocument();
  });

  it("drops the menu when every other pet has a chip", () => {
    render(<Pets appt={appt()} profile={profile([pet("p-waffles", "Waffles")])} />);
    expect(screen.queryByRole("button", { name: /more pet|Add a pet/ })).not.toBeInTheDocument();
  });
});
