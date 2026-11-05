import "../i18n";
import { visitTypeName } from "./visits";

describe("a past visit's type", () => {
  it("uses the practice's name, else Sick visit or Wellness, and hides other or unknown", () => {
    expect(visitTypeName({ type: "Recheck", kind: "sick" })).toBe("Recheck");
    expect(visitTypeName({ type: "", kind: "sick" })).toBe("Sick visit");
    expect(visitTypeName({ type: "", kind: "wellness" })).toBe("Wellness");
    expect(visitTypeName({ type: "", kind: "other" })).toBe("");
    expect(visitTypeName({ type: "other", kind: "other" })).toBe("");
  });
});
