import { useApp } from "./app";
import { keepDraft, keepPlace, keepReturnPath, readDraft, readPlace, takeReturnPath } from "./visitMemory";
import type { Me } from "../api/types";

const as = (username: string) =>
  useApp.setState({ me: { via: "session", admin: false, user: { username } } as unknown as Me });

beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
});

describe("what a visit page keeps in this browser", () => {
  it("keeps the tab, pet, scroll and open section per visit, and only for the same person", () => {
    as("ana");
    keepPlace("a1", { tab: "record", pet: "pat-6" });
    keepPlace("a1", { scroll: 420, editing: "plan" });
    expect(readPlace("a1")).toMatchObject({ tab: "record", pet: "pat-6", scroll: 420, editing: "plan" });
    as("sam");
    expect(readPlace("a1")).toBeNull();
  });

  it("keeps a household visit's pet tab and the pets' notes opened", () => {
    as("ana");
    keepPlace("bz-12", { encounter: "e-kiwi", reviewed: ["e-hazel", "e-kiwi"] });
    keepPlace("bz-12", { scroll: 120 });
    expect(readPlace("bz-12")).toMatchObject({ encounter: "e-kiwi", reviewed: ["e-hazel", "e-kiwi"], scroll: 120 });
  });

  it("keeps an unsaved edit with the note it was made on, and forgets it once cleared", () => {
    as("ana");
    keepDraft("e1", { note: { plan: "Recheck" } as never, base: "{}" });
    expect(readDraft("e1")?.base).toBe("{}");
    keepDraft("e1", null);
    expect(readDraft("e1")).toBeNull();
  });

  it("after a timeout, signing back in returns to the page, for the same person only", () => {
    as("ana");
    keepReturnPath("/visit/appt-1?date=2026-11-01");
    expect(takeReturnPath("ana")).toBe("/visit/appt-1?date=2026-11-01");
    // Taken once.
    expect(takeReturnPath("ana")).toBe("");
    keepReturnPath("/visit/appt-1");
    expect(takeReturnPath("sam")).toBe("");
  });
});
