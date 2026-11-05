import { formatDateTime, formatTime } from "./time";

describe("formatTime", () => {
  it("shows the server's 24-hour clock values as 12-hour with AM/PM", () => {
    expect(formatTime("13:30")).toBe("1:30\u00a0PM");
    expect(formatTime("9:00")).toBe("9:00\u00a0AM");
    expect(formatTime("09:05")).toBe("9:05\u00a0AM");
    expect(formatTime("00:15")).toBe("12:15\u00a0AM");
    expect(formatTime("12:00")).toBe("12:00\u00a0PM");
    expect(formatTime("23:59:00")).toBe("11:59\u00a0PM");
  });

  it("shows a moment in local time", () => {
    expect(formatTime(new Date(2026, 9, 31, 22, 7))).toBe("10:07\u00a0PM");
    expect(formatTime(new Date(2026, 9, 31, 10, 30).toISOString())).toBe("10:30\u00a0AM");
  });

  it("never breaks between the time and AM or PM", () => {
    expect(formatTime("10:00")).toMatch(/^10:00\u00a0AM$/);
    expect(formatTime("10:00")).not.toContain(" ");
  });

  it("is empty for nothing or nonsense", () => {
    expect(formatTime("")).toBe("");
    expect(formatTime(null)).toBe("");
    expect(formatTime("soon")).toBe("");
  });
});

describe("formatDateTime", () => {
  it("adds the day", () => {
    expect(formatDateTime(new Date(2026, 9, 31, 13, 30))).toBe("Sat, Oct 31, 1:30\u00a0PM");
    expect(formatDateTime("")).toBe("");
  });
});
