import { act, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router";
import type { Appointment, Brief } from "../api/types";

const api = vi.hoisted(() => ({ schedule: vi.fn(), days: vi.fn() }));
vi.mock("../api", () => ({ api }));

import { useApp } from "../state/app";
import { LeftColumn } from "./LeftColumn";

const today = "2026-11-01";
/** Times carry a no-break space before AM and PM: compare them as plain spaces. */
const plain = (s?: string | null) => (s ?? "").replace(/\u00a0/g, " ");
const visit = (id: string, name: string, hhmm: string, extra: Partial<Appointment> = {}) =>
  ({
    id,
    start: `${today}T${hhmm}:00`,
    reason: `${name}'s reason`,
    visit_status: "not_started",
    patient: { id: `p-${id}`, client_id: "c", name, alerts: [] },
    client: { id: "c", first_name: "Jordan", last_name: "Lee" },
    ...extra,
  }) as unknown as Appointment;
const appts = [
  visit("a1", "Biscuit", "09:00", { visit_status: "signed" }),
  visit("a2", "Miso", "09:30", {
    visit_status: "draft_ready",
    reason: "Vomiting x2 days",
    patient: {
      id: "p-a2",
      client_id: "c",
      name: "Miso",
      species: "Feline",
      breed: "Domestic Shorthair",
      sex: "Female, spayed",
      age: 14,
      alerts: ["Fractious, use towel wrap"],
      alert_chips: [{ text: "Fractious, use towel wrap", short: "Towel wrap" }],
      pims_notes: ["Gabapentin 100 mg given at home 2 hours before visits"],
      last_visit: { date: "2026-10-23", reason: "Increased thirst" },
      weight: { value: 8.9, unit: "lb" },
    },
    client: { id: "c", first_name: "Priya", last_name: "Shah", phones: ["+15550142290"], emails: [] },
    synced_at: `${today}T08:02:00`,
  } as unknown as Partial<Appointment>),
  visit("a3", "Rocket", "10:00", { visit_status: "recording" }),
  visit("a4", "Luna", "10:30"),
  visit("a6", "Waffles", "13:30"),
  ...["Hazel", "Kiwi", "Mochi", "Duke", "Coco", "Max"].map((n, i) => visit(`b${i}`, n, `${14 + i}:00`)),
];
const brief: Brief = {
  spoken: "",
  new_since_yesterday: [{ kind: "result", text: "", at: "", patient_name: "Luna", patient_id: "p-a4" }],
};

function show() {
  vi.clearAllMocks();
  api.schedule.mockResolvedValue(appts);
  api.days.mockResolvedValue([]);
  useApp.setState({
    today,
    viewDate: today,
    provider: "prov-1",
    doctors: [{ id: "prov-1", name: "Dr. Ana Rivera" }],
    me: { via: "open", admin: true, user: null, role: "", provider_id: "" },
    appts,
    apptsFor: `prov-1|${today}`,
    schedulePending: false,
    brief,
    openAppt: null,
  });
  render(
    <MemoryRouter>
      <LeftColumn />
    </MemoryRouter>,
  );
}

describe("the rail", () => {
  afterEach(() => localStorage.removeItem("blinq_clock"));

  it("has a compact date switcher, not a week strip", async () => {
    show();
    expect(screen.getByRole("heading", { name: "Today, Sun Nov 1" })).toBeInTheDocument();
    expect(screen.getByText("11 visits · Dr. Ana Rivera")).toBeInTheDocument();
    expect(screen.queryByRole("group", { name: "Pick a day" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Today" })).toBeDisabled();
    await userEvent.click(screen.getByRole("button", { name: "Day after" }));
    expect(useApp.getState().viewDate).toBe("2026-11-02");
    await userEvent.click(screen.getByRole("button", { name: "Day after" }));
    await userEvent.click(screen.getByRole("button", { name: "Today" }));
    expect(useApp.getState().viewDate).toBe("2026-11-01");
    expect(screen.getByRole("button", { name: "Today" })).toBeDisabled();
  });

  it("puts today on one line in clock order, with the Now line at the clinic's time", async () => {
    localStorage.setItem("blinq_clock", "10:15");
    show();
    // No group labels: where a visit sits on the line says where it is in the day.
    for (const name of ["In the room", "Up next", "Later today"])
      expect(screen.queryByRole("heading", { name })).not.toBeInTheDocument();
    const list = screen.getByRole("list");
    const items = within(list)
      .getAllByRole("listitem")
      .map((li) => plain(li.querySelector("[role=separator]")?.getAttribute("aria-label") ?? li.textContent));
    expect(items).toEqual([
      expect.stringMatching(/^9:00 AMBiscuit/),
      expect.stringMatching(/^9:30 AMMiso/),
      expect.stringMatching(/^10:00 AMRocket.*In visit/),
      "Now, 10:15 AM",
      expect.stringMatching(/^10:30 AMLuna/),
      "Free until 1:30 PM",
      expect.stringMatching(/^1:30 PMWaffles/),
      ...["Hazel", "Kiwi", "Mochi", "Duke", "Coco", "Max"].map((n) => expect.stringContaining(n)),
    ]);
    expect(plain(screen.getByRole("separator", { name: /^Now, 10:15\sAM$/ }).textContent)).toBe("Now 10:15 AM");
    // A standard day folds nothing: Done and "+N more" are a heavy day's.
    expect(screen.queryByRole("button", { name: /^Done · / })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /more this afternoon/ })).not.toBeInTheDocument();
    // One dot a visit, saying where it stands; the status text stays at the right.
    const dot = (name: RegExp) =>
      screen.getByRole("button", { name }).querySelector("[data-dot]")?.getAttribute("data-dot");
    expect(dot(/Biscuit/)).toBe("signed");
    expect(dot(/Miso/)).toBe("draft");
    expect(dot(/Rocket/)).toBe("visit");
    expect(dot(/Luna/)).toBe("todo");
    expect(screen.getByRole("button", { name: /Biscuit/ })).toHaveTextContent("Signed");
    expect(screen.getByRole("button", { name: /Luna/ })).not.toHaveTextContent(/Not started/);
  });

  it("puts a visit gone by above the Now line whatever its status, with no Up next", () => {
    localStorage.setItem("blinq_clock", "13:45");
    show();
    expect(screen.queryByRole("heading", { name: "Up next" })).not.toBeInTheDocument();
    const now = screen.getByRole("separator", { name: /^Now, 1:45\sPM$/ });
    const luna = screen.getByRole("button", { name: /Luna/ });
    const hazel = screen.getByRole("button", { name: /Hazel/ });
    // Luna, at 10:30 AM, never started: still above the line, an empty ring, no blame.
    expect(luna.compareDocumentPosition(now) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(
      screen.getByRole("button", { name: /Waffles/ }).compareDocumentPosition(now) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    expect(hazel.compareDocumentPosition(now) & Node.DOCUMENT_POSITION_PRECEDING).toBeTruthy();
    expect(luna.querySelector("[data-dot]")).toHaveAttribute("data-dot", "todo");
  });

  it("puts the Now line at the top before the first visit and at the bottom after the last", () => {
    localStorage.setItem("blinq_clock", "07:00");
    show();
    let items = within(screen.getByRole("list")).getAllByRole("listitem");
    expect(plain(items[0]!.querySelector("[role=separator]")?.getAttribute("aria-label"))).toBe("Now, 7:00 AM");
    localStorage.setItem("blinq_clock", "22:00");
    act(() => useApp.setState({ appts: [...appts] }));
    items = within(screen.getByRole("list")).getAllByRole("listitem");
    expect(plain(items[items.length - 1]!.querySelector("[role=separator]")?.getAttribute("aria-label"))).toBe(
      "Now, 10:00 PM",
    );
  });

  it("has no Now line on another day", async () => {
    show();
    await userEvent.click(screen.getByRole("button", { name: "Day after" }));
    act(() => useApp.setState({ appts, apptsFor: "prov-1|2026-11-02", schedulePending: false }));
    expect(screen.queryByRole("separator")).not.toBeInTheDocument();
    expect(screen.getAllByRole("listitem").length).toBeGreaterThan(0);
  });

  it("keeps one quiet Needs me toggle: notes to sign and what came in overnight", async () => {
    show();
    const toggle = screen.getByRole("switch", { name: "Needs me · 2" });
    await userEvent.click(toggle);
    const rows = screen.getAllByRole("button").filter((b) => /AM|PM/.test(b.textContent ?? ""));
    expect(rows.map((b) => b.textContent)).toEqual([expect.stringContaining("Miso"), expect.stringContaining("Luna")]);
    expect(screen.queryByText("To do")).not.toBeInTheDocument();
    // The line joins the dots that are left: from Miso's down, to Luna's up.
    const [miso, luna] = rows as [HTMLElement, HTMLElement];
    expect(miso.querySelectorAll("[data-dot]")).toHaveLength(1);
    expect(miso.querySelector("[aria-hidden=true].top-0")).toBeNull();
    expect(miso.querySelector("[aria-hidden=true].bottom-0")).not.toBeNull();
    expect(luna.querySelector("[aria-hidden=true].top-0")).not.toBeNull();
    expect(luna.querySelector("[aria-hidden=true].bottom-0")).toBeNull();
  });

  it("filters by cautions from the small menu", async () => {
    show();
    await userEvent.click(screen.getByRole("button", { name: "Filter visits" }));
    await userEvent.click(screen.getByRole("menuitemradio", { name: "Cautions" }));
    const rows = screen.getAllByRole("button").filter((b) => /AM|PM/.test(b.textContent ?? ""));
    expect(rows).toHaveLength(1);
    expect(rows[0]).toHaveTextContent("Caution: Fractious, use towel wrap");
  });
});

describe("the rail's rows", () => {
  it("are two lines: the pet's name, species and age, the breed, the reason in plain words", async () => {
    show();
    const miso = screen.getByRole("button", { name: /Miso/ });
    expect(miso).toHaveTextContent(/^9:30 AMMisoCat, 14 yearsDraft readyDomestic ShorthairVomiting for 2 days/);
    // Its caution is its own amber line, heard as "Caution: Towel wrap".
    expect(miso.querySelector("[data-caution]")).toHaveClass("text-warning");
    expect(miso).toHaveAccessibleName(/Caution: Fractious, use towel wrap$/);
  });

  it("never say Not started, today or on a day gone by", () => {
    show();
    expect(screen.queryByText("Not started")).not.toBeInTheDocument();
    useApp.setState({ today: "2026-11-02" });
    expect(screen.queryByText("Not started")).not.toBeInTheDocument();
  });

  it("open a read only quick card on keyboard focus, from what the schedule carries", async () => {
    show();
    const miso = screen.getByRole("button", { name: /Miso/ });
    act(() => miso.focus());
    const card = await screen.findByRole("tooltip");
    expect(miso).toHaveAttribute("aria-describedby", card.id);
    expect(card).toHaveTextContent("Cat · Domestic Shorthair · Female, spayed · 14 years · 8.9 lb");
    expect(card).toHaveTextContent("Priya Shah · (555) 014-2290");
    expect(card).toHaveTextContent("Oct 23 · Increased thirst");
    // The PIMS's notes, in plain words, with when the schedule was read.
    expect(card).toHaveTextContent("Gabapentin 100 mg given at home 2 hours before visits");
    expect(card).toHaveTextContent("Vomiting for 2 days");
    expect(card).toHaveTextContent("Synced 8:02 AM");
    expect(card).toHaveTextContent("Fractious, use towel wrap");
    expect(within(card).queryAllByRole("button")).toHaveLength(0);
    expect(api.schedule).not.toHaveBeenCalled();
    await userEvent.keyboard("{Escape}");
    expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();
  });
});

// The demo's busy day: 20 visits and 24 pets two days ahead, read at its own clock, with households.
const busy = "2026-11-03";
const pet = (id: string, name: string, status = "not_started", alerts: string[] = []) => ({
  patient: { id, client_id: "cli-1", name, alerts },
  reason: `${name}'s reason`,
  visit_status: status,
  encounter_id: status === "not_started" ? "" : `e-${id}`,
});
const busyVisit = (id: string, name: string, hhmm: string, extra: Partial<Appointment> = {}) =>
  ({ ...visit(id, name, hhmm), start: `${busy}T${hhmm}:00`, demo_clock: "13:15", ...extra }) as Appointment;
const lee = busyVisit("bz-12", "Hazel", "14:00", {
  client: { id: "cli-1", first_name: "Jordan", last_name: "Lee", phones: [], emails: [] },
  pets: [pet("p7", "Hazel", "signed"), pet("p8", "Kiwi", "draft_ready"), pet("p9", "Mochi")],
} as unknown as Partial<Appointment>);
const busyDay = [
  ...Array.from({ length: 9 }, (_, i) =>
    busyVisit(`d${i}`, `Done${i}`, `${String(8 + i).padStart(2, "0")}:00`, { visit_status: "signed" }),
  ),
  busyVisit("n1", "Smokey", "13:30"),
  busyVisit("n2", "Ziggy", "13:45"),
  lee,
  ...["Shadow", "Bruno", "Daisy", "Rosie", "Milo", "Willow", "Thor"].map((n, i) =>
    busyVisit(`l${i}`, n, `${15 + i}:00`),
  ),
  busyVisit("bz-14", "Coco", "15:15", {
    client: { id: "cli-8", first_name: "Ana", last_name: "Garcia", phones: [], emails: [] },
    pets: [pet("p13", "Coco"), pet("p26", "Pancho"), pet("p27", "Lola")],
  } as unknown as Partial<Appointment>),
].sort((a, b) => a.start.localeCompare(b.start));

function showBusy(openAppt: Appointment | null = null, current: { patient_id: string } | null = null) {
  vi.clearAllMocks();
  api.schedule.mockResolvedValue(busyDay);
  useApp.setState({
    today,
    viewDate: busy,
    provider: "prov-1",
    doctors: [{ id: "prov-1", name: "Dr. Ana Rivera" }],
    me: { via: "open", admin: true, user: null, role: "", provider_id: "" },
    appts: busyDay,
    apptsFor: `prov-1|${busy}`,
    schedulePending: false,
    brief: null,
    openAppt,
    current: current as never,
  });
  render(
    <MemoryRouter>
      <LeftColumn />
    </MemoryRouter>,
  );
}

describe("the rail on a heavy day", () => {
  it("counts the pets and folds the day: Done at the top of the line, no Now line at the demo clock, and the rest after six", async () => {
    showBusy();
    expect(screen.getByText("20 visits · 24 pets")).toBeInTheDocument();
    for (const name of ["In the room", "Up next", "Later today"])
      expect(screen.queryByRole("heading", { name })).not.toBeInTheDocument();
    expect(screen.getByRole("switch", { name: /^Needs me · \d+$/ })).toBeInTheDocument();
    const items = within(screen.getByRole("list")).getAllByRole("listitem");
    // Done first, on the line with its dot. The busy demo day reads at its own clock, which stands still, so
    // it draws no Now line.
    const done = within(items[0]!).getByRole("button", { name: "Done · 9" });
    expect(done).toHaveAttribute("aria-expanded", "false");
    expect(done.querySelector("[data-dot]")).toHaveAttribute("data-dot", "signed");
    expect(screen.queryByRole("separator", { name: /^Now, / })).not.toBeInTheDocument();
    // Six to come, then "+5 more this afternoon", which opens in place.
    const more = screen.getByRole("button", { name: "+5 more this afternoon" });
    expect(items.slice(1, -1).map((li) => li.textContent)).toEqual(
      ["Smokey", "Ziggy", "Jordan Lee", "Shadow", "Ana Garcia", "Bruno"].map((n) => expect.stringContaining(n)),
    );
    expect(items[items.length - 1]).toContainElement(more);
    await userEvent.click(more);
    expect(screen.getByRole("button", { name: /Thor/ })).toBeInTheDocument();
    // Done opens under its row, at the top, before the visits still to come.
    await userEvent.click(done);
    expect(
      screen.getByRole("button", { name: /Done8/ }).compareDocumentPosition(more) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });

  it("folds a household to the owner and its pets, nothing else", () => {
    showBusy();
    const row = screen.getByRole("button", { name: /Jordan Lee/ });
    expect(row).toHaveTextContent(/^2:00 PMJordan Lee3 pets$/);
    expect(row).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByRole("button", { name: /Kiwi/ })).not.toBeInTheDocument();
  });

  it("opens the household on screen: x of y signed, and each pet with its status", () => {
    showBusy(lee, { patient_id: "p8" });
    const row = screen.getByRole("button", { name: /Jordan Lee/ });
    expect(row).toHaveAttribute("aria-expanded", "true");
    expect(row).toHaveTextContent("1 of 3 signed");
    expect(screen.getByRole("button", { name: /Hazel/ })).toHaveTextContent("Signed");
    expect(screen.getByRole("button", { name: /Kiwi/ })).toHaveTextContent("Draft ready");
    expect(screen.getByRole("button", { name: /Kiwi/ })).toHaveAttribute("aria-current", "true");
    // Not started is the default: the pet's row says nothing about it.
    expect(screen.getByRole("button", { name: /Mochi/ })).not.toHaveTextContent("Not started");
    // The other household stays folded.
    expect(screen.getByRole("button", { name: /Ana Garcia/ })).toHaveAttribute("aria-expanded", "false");
  });
});
