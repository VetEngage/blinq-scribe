import { confirmsInNote, petNoteStatus, petSteps, type PetNote } from "./householdSteps";

const note = (id: string, extra: Partial<PetNote> = {}): PetNote => ({
  id,
  pet: id[0]!.toUpperCase() + id.slice(1),
  signed: false,
  confirms: 0,
  reviewed: false,
  ...extra,
});

describe("a household visit's stepping action (D1)", () => {
  it("confirms this pet first, then reviews the others, then signs every note", () => {
    const notes = [note("hazel", { confirms: 1, reviewed: true }), note("kiwi"), note("mochi")];
    expect(petSteps(notes, "hazel")).toEqual([
      { kind: "confirm", pet: "Hazel" },
      { kind: "review", pet: "Kiwi", id: "kiwi" },
      { kind: "review", pet: "Mochi", id: "mochi" },
      { kind: "sign", count: 3, ids: ["hazel", "kiwi", "mochi"] },
    ]);
  });

  it("steps forward as each note is confirmed and opened, and only signs once nothing is left", () => {
    const notes = [note("hazel", { reviewed: true }), note("kiwi", { reviewed: true }), note("mochi")];
    expect(petSteps(notes, "kiwi")[0]).toEqual({ kind: "review", pet: "Mochi", id: "mochi" });
    const all = notes.map((n) => ({ ...n, reviewed: true }));
    expect(petSteps(all, "mochi")).toEqual([{ kind: "sign", count: 3, ids: ["hazel", "kiwi", "mochi"] }]);
  });

  it("sends the provider back to a note opened before with something still to confirm", () => {
    const notes = [note("hazel", { reviewed: true, confirms: 1 }), note("kiwi", { reviewed: true })];
    expect(petSteps(notes, "kiwi")[0]).toEqual({ kind: "review", pet: "Hazel", id: "hazel" });
  });

  it("reviews the note on screen to its end before the next pet: opening a tab isn't reviewing it", () => {
    const notes = [note("hazel"), note("kiwi", { reviewed: true })];
    expect(petSteps(notes, "hazel")).toEqual([
      { kind: "review", pet: "Hazel", id: "hazel", here: true },
      { kind: "sign", count: 2, ids: ["hazel", "kiwi"] },
    ]);
  });

  it("counts lines from the last plan not covered like a thing to confirm, after the confirms", () => {
    const notes = [note("hazel", { confirms: 1, reminders: 2, reviewed: true }), note("kiwi", { reviewed: true })];
    expect(petSteps(notes, "hazel").slice(0, 2)).toEqual([
      { kind: "confirm", pet: "Hazel" },
      { kind: "plan", pet: "Hazel", count: 2 },
    ]);
    // On another pet's tab, a note with a reminder left is a step back to it.
    expect(petSteps(notes, "kiwi")[0]).toEqual({ kind: "review", pet: "Hazel", id: "hazel" });
  });

  it("leaves signed notes out, and has no step once every note is signed", () => {
    const notes = [note("hazel", { signed: true }), note("kiwi", { reviewed: true })];
    expect(petSteps(notes, "kiwi")).toEqual([{ kind: "sign", count: 1, ids: ["kiwi"] }]);
    expect(petSteps([note("hazel", { signed: true })], "hazel")).toEqual([]);
  });
});

describe("a pet's note", () => {
  it("counts every mark, a pet question included, and says where it stands", () => {
    expect(confirmsInNote({ subjective: "Runny nose [confirm pet: Hazel or Mochi].", plan: "[confirm: dose]" })).toBe(
      2,
    );
    expect(confirmsInNote(null)).toBe(0);
    expect(petNoteStatus({ status: "signed", note: {} })).toBe("signed");
    expect(petNoteStatus({ status: "draft_ready", note: {} })).toBe("draft");
    expect(petNoteStatus({ status: "recording", note: null })).toBe("notStarted");
  });
});
