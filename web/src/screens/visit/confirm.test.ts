import {
  appendLine,
  applyEdit,
  confirmMark,
  petChoices,
  takeMarkedLine,
  toDisplay,
  toValue,
  wholeMarks,
} from "./confirm";

const label = (what: string) => `Confirm: ${what}`;

describe("confirming a mark", () => {
  it("keeps a value's words and drops a note about something missing, with its empty line", () => {
    expect(confirmMark("Weight [confirm: 74 lb]", 0)).toBe("Weight 74 lb");
    expect(confirmMark("- Ear drops twice a day\n- [confirm: ear drop product and duration]\n- Recheck", 0)).toBe(
      "- Ear drops twice a day\n- Recheck",
    );
    expect(confirmMark("Start pain medication [confirm: drug and dosing]", 0)).toBe("Start pain medication");
    expect(confirmMark("[confirm: a] and [confirm: b]", 1)).toBe("[confirm: a] and");
  });
});

describe("the editor's text", () => {
  const value = "- Ear drops BID\n- [confirm: name and dose]\n- Recheck";
  it("shows each mark as its words and stores them back as marks", () => {
    const { text, marks } = toDisplay(value, label);
    expect(text).toBe("- Ear drops BID\n- Confirm: name and dose\n- Recheck");
    expect(text).not.toContain("[");
    expect(marks).toEqual([{ start: 18, end: 40, what: "name and dose" }]);
    expect(toValue(text, marks)).toBe(value);
  });

  it("typing over a selected mark replaces it whole", () => {
    const { text, marks } = toDisplay(value, label);
    const [a, b] = wholeMarks(25, 25, marks);
    expect([a, b]).toEqual([18, 40]);
    const typed = text.slice(0, a) + "Otomax 4 drops" + text.slice(b);
    const out = applyEdit(text, typed, marks, [a, b]);
    expect(out.marks).toEqual([]);
    expect(toValue(out.text, out.marks)).toBe("- Ear drops BID\n- Otomax 4 drops\n- Recheck");
    expect(out.caret).toBe(18 + "Otomax 4 drops".length);
  });

  it("Backspace on a mark's last letter removes the whole mark", () => {
    const { text, marks } = toDisplay("Give [confirm: dose] daily", label);
    const end = marks[0]!.end;
    const out = applyEdit(text, text.slice(0, end - 1) + text.slice(end), marks);
    expect(toValue(out.text, out.marks)).toBe("Give  daily");
    expect(out.caret).toBe(5);
  });

  it("typing before or after a mark moves it and keeps it", () => {
    const { text, marks } = toDisplay("x [confirm: Cats]", label);
    const before = applyEdit(text, "x C" + text.slice(2), marks, [2, 2]);
    expect(toValue(before.text, before.marks)).toBe("x C[confirm: Cats]");
    const after = applyEdit(text, text + "!", marks, [text.length, text.length]);
    expect(toValue(after.text, after.marks)).toBe("x [confirm: Cats]!");
  });
});

describe("a line Blinq couldn't place on one pet", () => {
  const subjective = "Stiff in the mornings.\nRunny nose this morning [confirm pet: Hazel or Mochi].";
  it("asks which pet, from its mark", () => {
    expect(petChoices("pet: Hazel or Mochi")).toEqual(["Hazel", "Mochi"]);
    expect(petChoices("pet: Biscuit, Waffles or Kiwi")).toEqual(["Biscuit", "Waffles", "Kiwi"]);
    expect(petChoices("drug and dosing")).toBeNull();
  });

  it("kept on this pet, the question goes and the line stays", () => {
    expect(confirmMark(subjective, 0)).toBe("Stiff in the mornings.\nRunny nose this morning.");
  });

  it("moved, the line leaves this note without its mark and joins the other pet's, as a bullet there", () => {
    expect(takeMarkedLine(subjective, 0)).toEqual({ rest: "Stiff in the mornings.", line: "Runny nose this morning." });
    expect(appendLine("Eating less hay.", "Runny nose this morning.")).toBe(
      "Eating less hay.\nRunny nose this morning.",
    );
    expect(appendLine("- Wt 3.3 lb\n- Teeth even", "Runny nose this morning.")).toBe(
      "- Wt 3.3 lb\n- Teeth even\n- Runny nose this morning.",
    );
    expect(takeMarkedLine("No marks here.", 0)).toBeNull();
  });
});
