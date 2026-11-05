import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router";
import type { Appointment, Household, Invoices, PastVisit, Profile } from "../../api/types";

const api = vi.hoisted(() => ({
  addPetToVisit: vi.fn(async () => ({})),
  household: vi.fn(),
  patientProfile: vi.fn(),
  patientVisits: vi.fn(),
  invoices: vi.fn(),
  documents: vi.fn(async () => []),
  letters: vi.fn(async () => []),
  forget: vi.fn(async () => true),
}));
vi.mock("../../api", () => ({ api }));

import { useApp } from "../../state/app";
import { RecordView } from "./RecordView";
import { PatientRedirect, RecordScreen } from "./RecordScreen";
import { aboutPet, pastVisits, type RecordTab, type RecordVisit } from "./record";

const client = {
  id: "cli-1",
  first_name: "Jordan",
  last_name: "Lee",
  name: "Jordan Lee",
  phones: ["+12175550142"],
  emails: ["jordan@example.com"],
  prefers: "text",
  client_since: "2019-04-12",
};
const pet = (id: string, name: string, extra: Partial<Household["pets"][number]> = {}) => ({
  id,
  name,
  species: "Canine",
  breed: "Beagle",
  age: 5,
  sex: "",
  alerts: [],
  last_visit: null,
  due: [],
  next_due: null,
  tags: [],
  alert_tags: [],
  today: null,
  spend_12m: 0,
  ...extra,
});
const household = {
  client,
  pets: [
    pet("p1", "Biscuit", { breed: "Golden Retriever" }),
    pet("p2", "Waffles", {
      breed: "Dachshund",
      alerts: ["Back problems, lift with support"],
      today: {
        appointment_id: "a5",
        time: "13:30",
        reason: "Limping, back legs",
        visit_status: "not_started",
        encounter_id: "",
      },
    }),
    pet("p3", "Hazel"),
  ],
  balance: 86.9,
  book_url: "",
  spend_12m: 0,
  coming_up: [],
  messages: [
    { at: "2026-10-31T09:00:00", direction: "in", text: "Biscuit is shaking his head again" },
    { at: "2026-10-31T10:00:00", direction: "out", text: "Hi Jordan, Waffles is booked for 1:30 PM." },
  ],
  remember: [
    {
      id: "r1",
      patient_id: "p1",
      patient_name: "Biscuit",
      text: "Adopted Biscuit on Nov 2",
      kind: "milestone",
      said_at: "2026-07-04",
    },
  ],
} as unknown as Household;

const profile = (id: string, name: string, extra: Partial<Profile["patient"]> = {}) =>
  ({
    patient: { ...pet(id, name), sex: "Male, neutered", age: 6, microchip: "985112004567891", color: "", ...extra },
    weight: {
      latest: { date: "2026-07-04", value: "72", unit: "lb" },
      history: [
        { date: "2025-07-09", value: "69", unit: "lb", note: "" },
        { date: "2026-01-05", value: "70", unit: "lb", note: "" },
        { date: "2026-07-04", value: "72", unit: "lb", note: "" },
      ],
    },
    reminders_due: [{ patient_id: id, patient_name: name, text: "Rabies vaccine", due: "2099-11-21" }],
    client,
    other_pets: [],
  }) as unknown as Profile;

const visit = (id: string, date: string, extra: Partial<PastVisit> = {}): PastVisit =>
  ({
    id,
    date,
    appointment_id: "",
    kind: "sick",
    type: "Sick",
    reason: "Itchy face",
    provider_name: "Dr. Ana Rivera",
    summary: "Suspected environmental allergy.",
    related: false,
    note: null,
    sections: null,
    medications: [],
    photos: [],
    ...extra,
  }) as PastVisit;

const invoices = {
  balance: 86.9,
  last_12_months: 168,
  last_payment: null,
  invoices: [
    {
      id: "i1",
      date: "2026-07-04",
      patient_id: "p1",
      patient_name: "Biscuit",
      visit: "Annual wellness",
      provider_name: "",
      total: 100,
      status: "paid",
      items: [{ name: "Exam", qty: 1, price: 60 }],
      paid_by: null,
    },
    {
      id: "i2",
      date: "2026-08-29",
      patient_id: "p2",
      patient_name: "Waffles",
      visit: "Itchy skin",
      provider_name: "",
      total: 68,
      status: "open",
      items: [],
      paid_by: null,
    },
  ],
} as unknown as Invoices;

const appt = {
  id: "a1",
  start: "2026-11-01T09:00:00",
  patient: { id: "p1", name: "Biscuit" },
  client: { id: "cli-1" },
} as unknown as Appointment;

function Where() {
  const loc = useLocation();
  return <p data-testid="where">{loc.pathname + loc.search}</p>;
}

/** The record with its pet and tab kept in state, as both placements do. */
function Harness({
  start = "p1",
  startTab = "overview",
  ...rest
}: {
  start?: string;
  startTab?: RecordTab;
  placement?: "visit" | "page";
  visit?: RecordVisit;
}) {
  const [petId, setPet] = useState(start);
  const [tab, setTab] = useState<RecordTab>(startTab);
  return (
    <RecordView
      clientId="cli-1"
      petId={petId}
      onPet={setPet}
      tab={tab}
      onTab={setTab}
      placement={rest.placement ?? "page"}
      visit={rest.visit}
    />
  );
}

const inVisit: RecordVisit = { appt, petIds: ["p1"], encounterIds: ["enc-1", ""] };

function show(props: Parameters<typeof Harness>[0] = {}) {
  return render(
    <MemoryRouter>
      <Harness {...props} />
    </MemoryRouter>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  useApp.setState({ openAppt: null, visitPetsBy: {}, today: "2026-11-01" });
  api.household.mockResolvedValue(household);
  api.patientProfile.mockImplementation(async (id: string) =>
    id === "p2"
      ? profile("p2", "Waffles", { alerts: ["Back problems, lift with support"], breed: "Dachshund" })
      : profile(id, "Biscuit", { breed: "Golden Retriever" }),
  );
  api.invoices.mockResolvedValue(invoices);
  api.patientVisits.mockResolvedValue([]);
});

describe("the owner header and the pet tabs", () => {
  it("names the owner once, as the page's Display on its own page and a Title inside a visit", async () => {
    const { unmount } = show();
    expect(await screen.findByRole("heading", { level: 1, name: "Jordan Lee" })).toHaveClass("text-display");
    expect(screen.getByText(/client since 2019/).closest("p")).toHaveClass("text-meta");
    expect(screen.getByText("$86.90")).toHaveClass("font-num");
    expect(screen.getByRole("link", { name: "Text" })).toHaveAttribute("href", "sms:+12175550142");
    unmount();
    show({ placement: "visit", visit: inVisit });
    expect(await screen.findByRole("heading", { level: 2, name: "Jordan Lee" })).toHaveClass("text-title");
    expect(screen.queryByRole("heading", { level: 1 })).not.toBeInTheDocument();
  });

  it("has a tab per pet: the visit's pet says This visit, the rest their breed, and a caution is an amber dot", async () => {
    show({ placement: "visit", visit: inVisit });
    const pets = await screen.findByRole("tablist", { name: "Pets" });
    const tabs = within(pets).getAllByRole("tab");
    expect(tabs.map((t) => t.textContent)).toEqual(["BiscuitThis visit", "Waffles, CautionDachshund", "HazelBeagle"]);
    expect(tabs[0]).toHaveAttribute("aria-selected", "true");
    expect(tabs[1]!.querySelector(".bg-caution")).not.toBeNull();
    // No Owner and pets tab, and the read only cue is one Meta line.
    const sections = screen.getByRole("tablist", { name: "Biscuit's record" });
    expect(
      within(sections)
        .getAllByRole("tab")
        .map((t) => t.textContent),
    ).toEqual(["Overview", "Past visits", "Documents", "Invoices", "Texts"]);
    expect(screen.getByText("From the PIMS · read only")).toHaveClass("text-meta");
  });

  it("shows the first pet when the one asked for isn't this owner's, and switches pets from the tabs", async () => {
    show({ start: "pat-elsewhere" });
    expect(await screen.findByRole("tab", { name: /^Biscuit/, selected: true })).toBeInTheDocument();
    await userEvent.click(screen.getByRole("tab", { name: /^Waffles/ }));
    expect(await screen.findByText("Back problems, lift with support")).toBeInTheDocument();
    expect(api.patientProfile).toHaveBeenCalledWith("p2");
  });

  it("says so when the household can't be read", async () => {
    api.household.mockRejectedValue(new Error("no"));
    show();
    expect(await screen.findByText("This record isn't available yet.")).toBeInTheDocument();
  });
});

describe("Overview", () => {
  it("has the facts line, what's due, the weight as a Number with a trend, and the Patient ID as a Number", async () => {
    show();
    const id = await screen.findByText("p1");
    expect(id).toHaveClass("font-num");
    expect(screen.getByText("male, neutered").closest("p")).toHaveTextContent(
      "Golden Retriever · male, neutered · 6 years · 72 lb, Jul 4",
    );
    expect(screen.getByRole("heading", { name: "What's due" })).toHaveClass("text-section");
    expect(screen.getByText("Rabies vaccine")).toBeInTheDocument();
    expect(screen.getByText("Due Nov 21, 2099")).toHaveClass("text-meta");
    expect(screen.getByRole("img", { name: /^Weight over time: 69 lb, Jul 9, 2025; 70 lb/ })).toBeInTheDocument();
    // No cautions on Biscuit: no Cautions heading.
    expect(screen.queryByRole("heading", { name: "Cautions" })).not.toBeInTheDocument();
    expect(screen.queryByText(/\d{4}-\d{2}-\d{2}/)).not.toBeInTheDocument();
  });

  it("puts overdue first, with Overdue in Body strong ink, and a new weight with its change", async () => {
    show();
    api.patientProfile.mockImplementation(async (id: string) => ({
      ...profile(id, "Biscuit"),
      weight: {
        latest: { date: "2026-11-01", value: 74, unit: "lb" },
        previous: { date: "2026-07-04", value: 72, unit: "lb" },
        history: [],
      },
      reminders_due: [
        { patient_id: id, patient_name: "Biscuit", text: "Heartworm test", due: "2099-01-01" },
        { patient_id: id, patient_name: "Biscuit", text: "Senior bloodwork", due: "2020-01-05" },
      ],
    }));
    const late = await screen.findByText("Senior bloodwork");
    const rows = screen.getAllByText(/Heartworm test|Senior bloodwork/);
    expect(rows.map((r) => r.textContent)).toEqual(["Senior bloodwork", "Heartworm test"]);
    const word = within(late.closest("div")!.parentElement!).getByText("Overdue");
    expect(word.tagName).toBe("B");
    expect(word).toHaveClass("text-body-strong", "text-text");
    expect(screen.getByText("male, neutered").closest("p")).toHaveTextContent("74 lb, up 2 lb since Jul 4");
  });

  it("gives overdue care one action: into today's visit, for a pet not in it yet", async () => {
    show({ start: "p2", placement: "visit", visit: inVisit });
    api.patientProfile.mockImplementation(async (id: string) => ({
      ...profile(id, "Waffles"),
      reminders_due: [{ patient_id: id, patient_name: "Waffles", text: "Dental check", due: "2020-01-05" }],
    }));
    const add = await screen.findByRole("button", { name: "Add to today's visit" });
    await userEvent.click(add);
    expect(api.addPetToVisit).toHaveBeenCalledWith("enc-1", "p2");
    expect(await screen.findByText("Waffles is in today's visit.")).toBeInTheDocument();
  });

  it("leads What's due with a pet's visit today, which opens it", async () => {
    show({ start: "p2" });
    const row = (await screen.findByText("Limping, back legs")).closest("button")!;
    expect(row).toHaveTextContent("Visit today at 1:30 PM");
    expect(within(row).getByText("1:30 PM")).toHaveClass("font-num");
    expect(screen.getByRole("heading", { name: "Cautions" })).toBeInTheDocument();
  });

  it("keeps what to remember, staff only, and staff can remove an item", async () => {
    show();
    expect(await screen.findByText("“Adopted Biscuit on Nov 2”")).toBeInTheDocument();
    expect(screen.getByText("Staff only · said Jul 4, 2026")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Remove: Adopted Biscuit on Nov 2" }));
    expect(api.forget).toHaveBeenCalledWith("cli-1", "r1");
    await waitFor(() => expect(screen.queryByText(/Adopted Biscuit/)).not.toBeInTheDocument());
  });
});

describe("Past visits", () => {
  it("lists rows with the related note open in two columns, filters by type, and has no Pet filter", async () => {
    api.patientVisits.mockResolvedValue([
      visit("v1", "2026-08-31", { reason: "Itchy face" }),
      visit("v2", "2026-07-04", { kind: "wellness", type: "Wellness", reason: "Annual wellness", summary: "Healthy." }),
      visit("v3", "2026-01-05", {
        reason: "Ear infection, left",
        related: true,
        note: "S: Scratching",
        sections: [
          { label: "Subjective", text: "Scratching the left ear for 4 days." },
          { label: "Plan", text: "Recheck in 10 days." },
        ],
        medications: ["Mometamax 15 g"],
      }),
    ]);
    show({ startTab: "visits", placement: "visit", visit: inVisit });
    expect(await screen.findByText("Itchy face")).toBeInTheDocument();
    expect(api.patientVisits).toHaveBeenCalledWith("p1", "a1");
    expect(screen.getByText("Related to today's reason")).toBeInTheDocument();
    // The related note is the one open, in two columns under Section headings.
    const open = screen.getByRole("button", { name: /Ear infection, left/ });
    expect(open).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByRole("heading", { name: "Subjective" }).closest(".grid")).toHaveClass("md:grid-cols-2");
    expect(screen.getByText("Mometamax 15 g")).toBeInTheDocument();
    expect(screen.queryByRole("combobox", { name: "Pet" })).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Wellness" }));
    expect(screen.queryByText("Itchy face")).not.toBeInTheDocument();
    expect(screen.getByText("Annual wellness")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "All" }));
    await userEvent.click(screen.getByRole("switch", { name: "Related to today" }));
    expect(screen.queryByText("Itchy face")).not.toBeInTheDocument();
    expect(screen.getByText("Ear infection, left")).toBeInTheDocument();
  });

  it("searches the notes", async () => {
    api.patientVisits.mockResolvedValue([
      visit("v1", "2026-08-31", { reason: "Itchy face" }),
      visit("v2", "2026-07-04", { reason: "Annual wellness", medications: ["Apoquel 16 mg"] }),
    ]);
    show({ startTab: "visits" });
    await screen.findByText("Itchy face");
    await userEvent.type(screen.getByRole("searchbox", { name: "Search past visits" }), "apoquel");
    expect(screen.queryByText("Itchy face")).not.toBeInTheDocument();
    expect(screen.getByText("Annual wellness")).toBeInTheDocument();
  });
});

describe("pastVisits", () => {
  const visitIn: RecordVisit = { appt: { ...appt, id: "a1" }, petIds: ["p1"], encounterIds: ["enc-today"] };

  it("never lists this visit or anything after it started", () => {
    const rows = [
      visit("blinq-enc-today", "2026-11-01T09:20:00", { appointment_id: "" }),
      visit("visit-a1", "2026-11-01T00:00:00", { appointment_id: "a1" }),
      visit("later", "2026-11-02"),
      visit("v1", "2026-08-30"),
    ];
    expect(pastVisits(rows, visitIn).map((v) => v.id)).toEqual(["v1"]);
    // On its own page every visit is past.
    expect(pastVisits(rows).map((v) => v.id)).toEqual(["later", "blinq-enc-today", "visit-a1", "v1"]);
  });

  it("folds a note saved again into the first one: Same note on Oct 28", () => {
    const rows = [
      visit("copy", "2026-10-28", { note: "Suspected  allergy. Started Apoquel." }),
      visit("first", "2026-08-31", { note: "Suspected allergy. Started Apoquel." }),
      visit("other", "2026-07-04", { note: "Healthy." }),
    ];
    const out = pastVisits(rows);
    expect(out.map((v) => v.id)).toEqual(["first", "other"]);
    expect(out[0]!.same).toEqual(["2026-10-28"]);
  });

  it("shows the repeat as one Meta line on the row", async () => {
    api.patientVisits.mockResolvedValue([
      visit("copy", "2026-10-28", { note: "Same text." }),
      visit("first", "2026-08-31", { note: "Same text." }),
    ]);
    show({ startTab: "visits" });
    expect(await screen.findByText("Same note on Oct 28")).toBeInTheDocument();
    expect(screen.getAllByText("Itchy face")).toHaveLength(1);
  });
});

describe("Invoices and Texts", () => {
  it("shows this pet's invoices in a table with Label headers, and every pet's with All pets", async () => {
    show({ startTab: "invoices" });
    const table = await screen.findByRole("table");
    expect(within(table).getByRole("columnheader", { name: "Total" })).toBeInTheDocument();
    expect(within(table).getByText("Annual wellness")).toBeInTheDocument();
    expect(within(table).queryByText("Itchy skin")).not.toBeInTheDocument();
    expect(api.invoices).toHaveBeenCalledWith("cli-1");
    await userEvent.click(screen.getByRole("switch", { name: "All pets" }));
    expect(within(screen.getByRole("table")).getByText("Itchy skin")).toBeInTheDocument();
    expect(within(screen.getByRole("table")).getByRole("columnheader", { name: "Pet" })).toBeInTheDocument();
    const toggle = screen.getByRole("button", { name: /Annual wellness/ });
    await userEvent.click(toggle);
    expect(toggle).toHaveAttribute("aria-expanded", "true");
    // Line items sit in the table's own columns: the amount under Total, Status a column of its own.
    const col = (el: HTMLElement) => [...el.parentElement!.children].indexOf(el);
    const table2 = screen.getByRole("table");
    const total = within(table2).getByRole("columnheader", { name: "Total" });
    expect(col(within(table2).getByRole("columnheader", { name: "Status" }))).toBe(col(total) + 1);
    expect(screen.getByText("Exam")).toBeInTheDocument();
    expect(col(within(table2).getByText("$60.00"))).toBe(col(total));
    expect(col(within(table2).getByText("$100.00"))).toBe(col(total));
    expect(within(table2).getByText("× 1")).toHaveClass("font-num");
  });

  it("shows the texts that name this pet, and every text with All pets", async () => {
    show({ startTab: "texts" });
    expect(await screen.findByText("Biscuit is shaking his head again")).toBeInTheDocument();
    expect(screen.queryByText(/Waffles is booked/)).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole("switch", { name: "All pets" }));
    expect(screen.getByText(/Waffles is booked/)).toBeInTheDocument();
    expect(screen.getByText(/^The clinic ·/)).toBeInTheDocument();
  });

  it("matches a pet's name as a word", () => {
    expect(aboutPet("Is Kiwi okay?", "Kiwi")).toBe(true);
    expect(aboutPet("Kiwis are birds", "Kiwi")).toBe(false);
    expect(aboutPet("anything", "")).toBe(false);
  });
});

describe("the record page", () => {
  function at(path: string) {
    return render(
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route
            path="/record/:clientId"
            element={
              <>
                <RecordScreen />
                <Where />
              </>
            }
          />
          <Route path="/patient/:patientId" element={<PatientRedirect />} />
        </Routes>
      </MemoryRouter>,
    );
  }

  it("opens on the pet and tab in the address, and keeps them there", async () => {
    at("/record/cli-1?pet=p2&tab=texts");
    expect(await screen.findByRole("tab", { name: /^Waffles/, selected: true })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Texts", selected: true })).toBeInTheDocument();
    await userEvent.click(screen.getByRole("tab", { name: "Past visits" }));
    expect(screen.getByTestId("where")).toHaveTextContent("/record/cli-1?pet=p2&tab=visits");
    await userEvent.click(screen.getByRole("tab", { name: /^Hazel/ }));
    expect(screen.getByTestId("where")).toHaveTextContent("/record/cli-1?pet=p3&tab=visits");
  });

  it("sends the old patient page to the record, looking up the owner", async () => {
    at("/patient/p2?tab=documents");
    expect(await screen.findByTestId("where")).toHaveTextContent("/record/cli-1?pet=p2&tab=documents");
    expect(api.patientProfile).toHaveBeenCalledWith("p2");
  });
});
