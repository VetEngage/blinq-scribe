import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router";
import { ToastProvider } from "@blinq-scribe/ui";
import type { Appointment, Encounter, PreRoomCard, Segment, SoapNote } from "../../api/types";

const api = vi.hoisted(() => ({
  recordPanel: vi.fn(() => new Promise(() => {})),
  endOfDay: vi.fn(() => new Promise(() => {})),
  assist: vi.fn(),
  saveNote: vi.fn(),
  sign: vi.fn(),
  signPreview: vi.fn(() => new Promise(() => {})),
  templates: vi.fn(async () => []),
  remember: vi.fn(async () => ({ suggestions: [], left_out: 0 })),
  group: vi.fn(async () => []),
  noteTypes: vi.fn(async () => []),
  planReminder: vi.fn(),
}));
vi.mock("../../api", () => ({ api }));

import { useApp } from "../../state/app";
import { Review } from "./Review";
import { VisitTabsProvider } from "./visitTabs";

const appt = {
  id: "a1",
  start: "2026-11-01T09:00:00",
  duration_min: 30,
  room: "Exam 1",
  reason: "Ear scratching",
  provider_name: "Dr. Ana Rivera",
  patient: { id: "pat-1", name: "Biscuit", species: "Canine", breed: "Golden Retriever", alerts: [] },
  client: { id: "cl-1", first_name: "Jordan", last_name: "Lee", phones: ["+12175550142"], emails: [], prefers: "text" },
} as unknown as Appointment;

const seg = (line: number, offset: number, text: string, extra: Partial<Segment> = {}): Segment => ({
  id: `s${line}`,
  line,
  speaker_id: "vet",
  speaker_name: "Dr. Ana Rivera",
  role: "vet",
  offset_seconds: offset,
  text,
  ...extra,
});

const note = (extra: Partial<SoapNote> = {}): SoapNote =>
  ({
    subjective: "Owner reports scratching at the right ear for four days.",
    objective: "- Right ear canal red and swollen",
    assessment: "Right otitis externa.",
    plan: "- Clean right ear in clinic today\n- Ear drops in the right ear twice a day\n- [confirm: ear drop product and duration]",
    vitals: { weight: "74 lb" },
    medications: [],
    client_summary: "Biscuit has an ear infection. Use the drops twice a day.",
    ...extra,
  }) as SoapNote;

const enc = (n: SoapNote = note()): Encounter =>
  ({
    id: "enc-1",
    status: "draft_ready",
    patient_id: "pat-1",
    patient_ids: ["pat-1"],
    group_id: "",
    note_type: "sick",
    note: n,
    followups: [],
    photos: [],
    transcript: "Dr. Rivera: Biscuit weighs 74 lb.\nJordan: He's been scratching his right ear for four days.",
    audio_seconds: 42,
    can: { sign: true, edit: true },
    segments: [
      seg(1, 12, "Biscuit weighs 74 lb."),
      seg(2, 27, "He's been scratching his right ear for four days.", {
        speaker_id: "owner",
        speaker_name: "Jordan Lee",
        role: "owner",
      }),
      seg(3, 40, "That one's me.", { speaker_id: "speaker-3", speaker_name: "Speaker 3", role: "unknown" }),
    ],
  }) as unknown as Encounter;

const card = {
  spoken: "",
  owner_message: { who: "Jordan", text: "Biscuit is shaking his head again.", at: "2026-10-31T16:12:00" },
  walk_in: [
    {
      date: "2026-08-31",
      kind: "plan",
      who: "Dr. Ana Rivera",
      mine: true,
      text: "Itchy face. Suspect environmental allergy.",
      items: [{ text: "Recheck in 4 weeks", status: "Was due Sep 28, not booked", note: "" }],
    },
  ],
} as unknown as PreRoomCard;

function page(e = enc()) {
  const setCurrent = vi.fn();
  render(
    <MemoryRouter>
      <ToastProvider>
        <VisitTabsProvider visitKey="a1" petId="pat-1" stage="review" appt={appt} current={e}>
          <Review
            appt={appt}
            current={e}
            setCurrent={setCurrent}
            voice={null}
            onRedraft={vi.fn()}
            status=""
            card={card}
          />
        </VisitTabsProvider>
      </ToastProvider>
    </MemoryRouter>,
  );
  return setCurrent;
}

const bar = () => screen.getByRole("region", { name: "Sign the note" });

beforeEach(() => {
  localStorage.clear();
  useApp.setState({ noteTypes: [], appts: [appt], me: { via: "open", user: null, admin: false } });
  api.saveNote.mockReset().mockImplementation(async (_id: string, n: SoapNote) => ({ ...enc(n) }));
  api.assist.mockReset().mockImplementation(async (_id: string, input: { text: string }) => ({
    suggestion: input.text,
    sources: input.text.includes("scratching") ? [{ sentence: input.text, lines: [2], text: "" }] : [],
    unsourced: [],
    refused: "",
    mock: false,
  }));
  window.HTMLElement.prototype.scrollIntoView = vi.fn();
});

describe("the draft note", () => {
  it("says Drafted by Blinq once, puts a time chip at the end of a line that jumps to the transcript", async () => {
    page();
    expect(screen.getByRole("heading", { name: "Draft note" })).toBeInTheDocument();
    expect(screen.getAllByText("Drafted by Blinq")).toHaveLength(1);
    const chip = await screen.findByRole("button", {
      name: "0:27 · Jordan Lee · Owner, go to this line in the transcript",
    });
    expect(chip).toHaveTextContent("0:27");
    expect(chip.closest(".ai-line")).toHaveTextContent("Owner reports scratching at the right ear for four days.");
    await userEvent.click(chip);
    // Transcript and photos opens at that line.
    expect((document.getElementById("transcriptPhotos") as HTMLDetailsElement).open).toBe(true);
    // The vitals on one line, with where they were said.
    const vitals = screen.getByRole("region", { name: "Vitals" });
    expect(within(vitals).getByText("74 lb")).toHaveClass("font-num");
    expect(within(vitals).getByRole("button", { name: /^0:12/ })).toBeInTheDocument();
    // No section pills, and no Sources toggles: the chips are the sources.
    expect(screen.queryByRole("navigation", { name: "Note sections" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^Sources for/ })).not.toBeInTheDocument();
  });

  it("shows a mark in a medication as the purple Confirm, never the bracket", () => {
    page(enc(note({ medications: ["Cefpodoxime 100 mg once a day for 10 days", "ear drops [confirm: name and dose]"] })));
    const meds = screen.getByText("Medications").closest("section")!;
    expect(meds).not.toHaveTextContent("[confirm");
    expect(within(meds).getByText("Confirm: name and dose").tagName).toBe("MARK");
  });

  it("the right column: the last plan, Jordan's message and the transcript in one line", () => {
    page();
    const aside = screen.getByRole("complementary", { name: "About this visit" });
    expect(aside).toHaveTextContent("Was due Sep 28, not booked");
    expect(aside).toHaveTextContent("Biscuit is shaking his head again.");
    expect(aside).toHaveTextContent("0:42 recorded · 3 speakers");
    expect(within(aside).getByText("Speaker 3 is unnamed.")).toBeInTheDocument();
    expect(within(aside).getByRole("button", { name: "Name them" })).toBeInTheDocument();
  });
});

describe("the one green action steps forward (D1)", () => {
  it("names the thing to confirm, goes to it, and becomes Sign once it's confirmed", async () => {
    page();
    // Never a greyed out Sign: the primary names the next step.
    const primary = within(bar()).getByRole("button", { name: /^Fill in ear drop product and duration/ });
    expect(primary).toBeEnabled();
    expect(within(bar()).queryByRole("button", { name: /^Sign/ })).not.toBeInTheDocument();
    expect(within(bar()).getByText("Then: Sign and send to the PIMS")).toBeInTheDocument();
    expect(within(bar()).getByText("1 thing to confirm · Plan")).toBeInTheDocument();
    // The confirm item is at its field, in purple, with Confirm and Edit right there.
    const item = screen.getByText("✦ Check: ear drop product and duration").closest(".confirm-item") as HTMLElement;
    expect(item).toHaveTextContent("Ear drops in the right ear twice a day");
    await userEvent.click(primary);
    expect(within(item).getByRole("button", { name: /^Looks right: Ear drops/ })).toHaveFocus();
    await userEvent.click(within(item).getByRole("button", { name: /^Looks right: Ear drops/ }));
    expect(screen.queryByText(/Check: ear drop/)).not.toBeInTheDocument();
    expect(within(bar()).getByRole("button", { name: /^Sign and send to the PIMS/ })).toBeEnabled();
    expect(within(bar()).getByRole("button", { name: "Sign only" })).toBeInTheDocument();
    expect(within(bar()).getByText("Then: Text summary to Jordan")).toBeInTheDocument();
  });

  it("⌘↵ does the named step", async () => {
    page();
    const item = screen.getByText("✦ Check: ear drop product and duration").closest(".confirm-item") as HTMLElement;
    await userEvent.keyboard("{Control>}{Enter}{/Control}");
    expect(within(item).getAllByRole("button")[0]).toHaveFocus();
  });
});

describe("editing a section with something to confirm", () => {
  it("shows the mark as a purple chip in the editor, never the bracket, and typing over it replaces it", async () => {
    page();
    const item = screen.getByText("✦ Check: ear drop product and duration").closest(".confirm-item") as HTMLElement;
    await userEvent.click(within(item).getByRole("button", { name: /^Fill in Ear drops/ }));
    const box = screen.getByRole("textbox", { name: "Plan" }) as HTMLTextAreaElement;
    expect(box.value).not.toContain("[confirm");
    expect(box.value).toContain("Confirm: ear drop product and duration");
    // The chip behind the words, and the mark selected so typing replaces it.
    expect(document.querySelector(".confirm-back mark[data-confirm]")).toHaveTextContent(
      "Confirm: ear drop product and duration",
    );
    expect(box.value.slice(box.selectionStart, box.selectionEnd)).toBe("Confirm: ear drop product and duration");
    await userEvent.keyboard("Otomax, 4 drops twice a day for 10 days");
    expect(box.value).toContain("- Otomax, 4 drops twice a day for 10 days");
    await act(() => new Promise((r) => setTimeout(r, 900)));
    expect(api.saveNote).toHaveBeenLastCalledWith(
      "enc-1",
      expect.objectContaining({ plan: expect.stringContaining("- Otomax, 4 drops twice a day for 10 days") }),
    );
    expect(api.saveNote.mock.lastCall?.[1].plan).not.toContain("[confirm");
  });
});

describe("For the owner", () => {
  it("says Out of sync with Plan once Plan changes after it was written", async () => {
    page(enc(note({ plan: "- Clean right ear in clinic today" })));
    expect(screen.queryByText("Out of sync with Plan")).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Edit Plan" }));
    const box = screen.getByRole("textbox", { name: "Plan" });
    await userEvent.type(box, "\n- Recheck in 14 days");
    await userEvent.click(screen.getByRole("button", { name: "Done" }));
    expect(await screen.findByText("Out of sync with Plan")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Update" })).toBeInTheDocument();
  });
});

describe("lines from the last plan the visit didn't cover", () => {
  const withReminder = (): Encounter =>
    ({
      ...enc(note({ plan: "- Clean right ear in clinic today" })),
      plan_reminders: [{ id: "r1", text: "Apoquel 16 mg once a day", status: "open" }],
    }) as Encounter;

  it("shows each in purple at the Plan, and steps the primary like a thing to confirm, never disabled", async () => {
    page(withReminder());
    const item = document.querySelector("[data-plan-reminder]") as HTMLElement;
    expect(item).toHaveTextContent("From your last plan, not covered: Apoquel 16 mg once a day");
    expect(item.closest("#sec-plan")).not.toBeNull();
    const primary = within(bar()).getByRole("button", { name: /^Check 1 line from your last plan/ });
    expect(primary).toBeEnabled();
    expect(bar()).toHaveTextContent("1 line from your last plan to check");
    expect(bar()).toHaveTextContent("Then: Sign and send to the PIMS");
    // A reminder, not a block: Sign only stays.
    expect(within(bar()).getByRole("button", { name: "Sign only" })).toBeInTheDocument();
  });

  it("Add to Plan puts the provider's own line in the Plan, saved, and marks it added", async () => {
    api.saveNote.mockImplementation((async (_id: string, n: SoapNote) => ({ ...withReminder(), note: n })) as never);
    api.planReminder.mockResolvedValue({
      ...withReminder(),
      plan_reminders: [{ id: "r1", text: "Apoquel 16 mg once a day", status: "added" }],
    });
    page(withReminder());
    await userEvent.click(screen.getByRole("button", { name: "Add to Plan: Apoquel 16 mg once a day" }));
    await waitFor(() =>
      expect(api.saveNote).toHaveBeenCalledWith(
        "enc-1",
        expect.objectContaining({ plan: "- Clean right ear in clinic today\n- Apoquel 16 mg once a day" }),
      ),
    );
    expect(api.planReminder).toHaveBeenCalledWith("enc-1", "r1", "added");
  });
});

describe("autosave (review principle 16)", () => {
  it("an edit not yet saved comes back after a reload, and goes to the server", async () => {
    page();
    await userEvent.click(screen.getByRole("button", { name: "Edit Assessment" }));
    const box = screen.getByRole("textbox", { name: "Assessment" });
    fireEvent.change(box, { target: { value: "Right otitis externa, yeast." } });
    // The page goes before the save does (a reload, a crash).
    document.body.innerHTML = "";
    api.saveNote.mockClear();
    page();
    // The same section is open again, with the edit in it.
    expect(screen.getByRole("textbox", { name: "Assessment" })).toHaveValue("Right otitis externa, yeast.");
    await waitFor(() =>
      expect(api.saveNote).toHaveBeenCalledWith(
        "enc-1",
        expect.objectContaining({ assessment: "Right otitis externa, yeast." }),
      ),
    );
  });
});

describe("a household visit: one recording for the room, one note per pet", () => {
  const sib = (id: string, pet: string, patient: string, n: SoapNote, extra: Partial<Encounter> = {}): Encounter =>
    ({
      ...enc(n),
      id,
      patient_id: patient,
      patient_name: pet,
      patient_ids: ["pat-7", "pat-8", "pat-9"],
      group_id: "e-hazel",
      segments: [
        seg(1, 5, "Hazel and Mochi have both been sneezing.", { pets: ["Hazel", "Mochi"], pet_sure: true }),
        seg(2, 9, "One of them had a runny nose this morning.", { pets: ["Hazel", "Mochi"], pet_sure: false }),
        seg(3, 20, "Kiwi weighs 88 grams.", { pets: ["Kiwi"], pet_sure: true }),
      ],
      ...extra,
    }) as Encounter;
  const hazel = sib(
    "e-hazel",
    "Hazel",
    "pat-7",
    note({
      subjective: "Stiff in the mornings.\nRunny nose this morning [confirm pet: Hazel or Mochi].",
      plan: "- Rest",
    }),
  );
  const kiwi = sib("e-kiwi", "Kiwi", "pat-8", note({ plan: "- Wellness exam done" }));
  const mochi = sib("e-mochi", "Mochi", "pat-9", note({ subjective: "Eating less hay.", plan: "- Old hay" }));

  beforeEach(() => {
    api.group.mockReset().mockImplementation((async () => [hazel, kiwi, mochi]) as never);
  });

  it("shows a tab per pet with its status, and steps: Confirm Hazel, then Review Kiwi and Mochi, sign 3 notes", async () => {
    page(hazel);
    const tabs = await screen.findByRole("navigation", { name: "Pets in this visit, one note each" });
    expect(within(tabs).getByRole("button", { name: /Hazel/ })).toHaveAttribute("aria-current", "page");
    expect(within(tabs).getByRole("button", { name: /Kiwi/ })).toHaveTextContent("Draft");
    // The line Blinq couldn't place asks which pet, in purple, at the line.
    const noteCard = screen.getByRole("region", { name: "Hazel · Draft note" });
    const item = within(noteCard).getByText("Which pet? Hazel / Mochi").closest(".confirm-item") as HTMLElement;
    expect(within(item).getByRole("button", { name: "Keep this line on Hazel" })).toBeInTheDocument();
    expect(within(item).getByRole("button", { name: "Move to Mochi" })).toBeInTheDocument();
    // D1: never a greyed out Sign. The primary names the next step, Then: what follows.
    const primary = within(bar()).getByRole("button", { name: /^Confirm Hazel/ });
    expect(primary).toBeEnabled();
    expect(bar()).toHaveTextContent("Then: Review Kiwi and Mochi, sign 3 notes");
    expect(within(bar()).queryByRole("button", { name: /^Sign 3 notes/ })).not.toBeInTheDocument();
    // Kept on Hazel: the question goes. Opening Hazel's tab isn't reviewing it: the primary asks to
    // review Hazel to the end first; pressed with the end in view, Hazel is reviewed and it steps on.
    await userEvent.click(within(item).getByRole("button", { name: "Keep this line on Hazel" }));
    const review = within(bar()).getByRole("button", { name: /^Review Hazel/ });
    expect(bar()).toHaveTextContent("Then: Review Kiwi and Mochi, sign 3 notes");
    // The note's end on screen (jsdom has no layout, so say where it is).
    const end = document.getElementById("noteEnd")!;
    vi.spyOn(end, "getBoundingClientRect").mockReturnValue({ top: 400, bottom: 401, height: 1 } as DOMRect);
    await userEvent.click(review);
    expect(within(bar()).getByRole("button", { name: /^Review Kiwi/ })).toBeEnabled();
    expect(bar()).toHaveTextContent("Then: Review Mochi, sign 3 notes");
  });

  it("reviews a pet only once its note's end is seen, and the primary scrolls to what's left before then", async () => {
    localStorage.clear();
    const clean = { ...hazel, note: note({ subjective: "Stiff in the mornings.", plan: "- Rest" }) } as Encounter;
    api.group.mockImplementation((async () => [clean, kiwi, mochi]) as never);
    page(clean);
    const primary = await within(bar()).findByRole("button", { name: /^Review Hazel/ });
    const scrolled = vi.fn();
    const was = HTMLElement.prototype.scrollIntoView;
    HTMLElement.prototype.scrollIntoView = scrolled;
    // The end isn't on screen: the primary goes to the first part not seen, and Hazel isn't reviewed yet.
    await userEvent.click(primary);
    expect(scrolled).toHaveBeenCalled();
    expect(within(bar()).getByRole("button", { name: /^Review Hazel/ })).toBeInTheDocument();
    // With the end in view, pressing it again reviews Hazel (kept for a reload) and steps on to Kiwi.
    vi.spyOn(document.getElementById("noteEnd")!, "getBoundingClientRect").mockReturnValue({
      top: 400,
      bottom: 401,
      height: 1,
    } as DOMRect);
    await userEvent.click(within(bar()).getByRole("button", { name: /^Review Hazel/ }));
    expect(within(bar()).getByRole("button", { name: /^Review Kiwi/ })).toBeInTheDocument();
    const { readPlace } = await import("../../state/visitMemory");
    expect(readPlace("a1")?.reviewed).toEqual(["e-hazel"]);
    HTMLElement.prototype.scrollIntoView = was;
  });

  it("moves a line it couldn't place to the other pet's note", async () => {
    page(hazel);
    await screen.findByRole("navigation", { name: "Pets in this visit, one note each" });
    await userEvent.click(screen.getByRole("button", { name: "Move to Mochi" }));
    await waitFor(() =>
      expect(api.saveNote).toHaveBeenCalledWith(
        "e-mochi",
        expect.objectContaining({ subjective: "Eating less hay.\nRunny nose this morning." }),
      ),
    );
    const noteCard = screen.getByRole("region", { name: "Hazel · Draft note" });
    expect(within(noteCard).queryByText("Which pet? Hazel / Mochi")).not.toBeInTheDocument();
  });

  it("signs every note at once once each is opened and nothing is left to confirm", async () => {
    localStorage.clear();
    const clean = { ...hazel, note: note({ subjective: "Stiff in the mornings.", plan: "- Rest" }) } as Encounter;
    api.group.mockImplementation((async () => [clean, kiwi, mochi]) as never);
    const { keepPlace } = await import("../../state/visitMemory");
    keepPlace("a1", { reviewed: ["e-hazel", "e-kiwi", "e-mochi"] });
    page(mochi);
    const primary = await within(bar()).findByRole("button", { name: /^Sign 3 notes and send to the PIMS/ });
    await userEvent.click(primary);
    const dialog = await screen.findByRole("dialog", { name: "Sign 3 notes" });
    expect(within(dialog).getAllByText(/^(Hazel|Kiwi|Mochi)$/)).toHaveLength(3);
  });

  it("shows one pet's transcript lines, the unplaced one asking which pet, then the whole room", async () => {
    page(kiwi);
    await screen.findByRole("navigation", { name: "Pets in this visit, one note each" });
    expect(screen.getByText(/Showing Kiwi's lines only\./)).toBeInTheDocument();
    await userEvent.click(screen.getByRole("radio", { name: "Whole room" }));
    expect(screen.getByText(/Showing the whole room\./)).toBeInTheDocument();
  });
});
