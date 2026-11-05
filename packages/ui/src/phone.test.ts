import { describe, expect, it } from "vitest";
import { formatPhone, formatPhonesIn, maskPhone, phoneDigits, phoneHref } from "./phone";

describe("maskPhone", () => {
  it("shows only the last four digits, the way a masked number reads", () => {
    expect(maskPhone("555-014-2231")).toBe("(•••) •••-2231");
    expect(maskPhone("+1 555 014 2231")).toBe(formatPhone("***2231"));
    expect(maskPhone("")).toBe("");
    expect(maskPhone(null)).toBe("");
  });
});

describe("formatPhone", () => {
  it("formats US numbers however they were typed", () => {
    expect(formatPhone("5550142231")).toBe("(555) 014-2231");
    expect(formatPhone("555-014-2231")).toBe("(555) 014-2231");
    expect(formatPhone("(555) 014 2231")).toBe("(555) 014-2231");
    expect(formatPhone("555.014.2231")).toBe("(555) 014-2231");
  });
  it("drops a +1 or a leading 1", () => {
    expect(formatPhone("+1 555 014 2231")).toBe("(555) 014-2231");
    expect(formatPhone("+15550142231")).toBe("(555) 014-2231");
    expect(formatPhone("15550142231")).toBe("(555) 014-2231");
  });
  it("shows an extension as ext.", () => {
    expect(formatPhone("555-014-2231 x12")).toBe("(555) 014-2231 ext. 12");
    expect(formatPhone("5550142231 ext 12")).toBe("(555) 014-2231 ext. 12");
    expect(formatPhone("(555) 014-2231, ext. 7")).toBe("(555) 014-2231 ext. 7");
  });
  it("shows masked numbers with dots, never stars", () => {
    expect(formatPhone("***0101")).toBe("(•••) •••-0101");
    expect(formatPhone("•••0101")).toBe("(•••) •••-0101");
    expect(formatPhone("(***) ***-0101")).toBe("(•••) •••-0101");
  });
  it("keeps international and unreadable numbers as given", () => {
    expect(formatPhone("+44 20 7946 0958")).toBe("+44 20 7946 0958");
    expect(formatPhone("call the front desk")).toBe("call the front desk");
    expect(formatPhone("12345")).toBe("12345");
  });
  it("keeps a seven-digit local number readable", () => {
    expect(formatPhone("5550102")).toBe("555-0102");
  });
  it("is empty for nothing", () => {
    expect(formatPhone("")).toBe("");
    expect(formatPhone(null)).toBe("");
    expect(formatPhone(undefined)).toBe("");
    expect(formatPhone("   ")).toBe("");
  });
});

describe("phoneHref and phoneDigits", () => {
  it("links callable numbers, not masked ones", () => {
    expect(phoneHref("(555) 014-2231")).toBe("tel:+15550142231");
    expect(phoneHref("555-014-2231 x12")).toBe("tel:+15550142231;ext=12");
    expect(phoneHref("+44 20 7946 0958")).toBe("tel:+442079460958");
    expect(phoneHref("***0101")).toBe("");
    expect(phoneHref("")).toBe("");
  });
  it("stores digits", () => {
    expect(phoneDigits("(555) 014-2231")).toBe("5550142231");
    expect(phoneDigits("+1 555 014 2231")).toBe("5550142231");
    expect(phoneDigits("+44 20 7946 0958")).toBe("+442079460958");
  });
});

describe("formatPhonesIn", () => {
  it("formats numbers inside a sentence and leaves other numbers alone", () => {
    expect(formatPhonesIn("Texted ***0101 at 9:00 AM.")).toBe("Texted (•••) •••-0101 at 9:00 AM.");
    expect(formatPhonesIn("Call Jordan at +1 555 014 2231 about 2 pets.")).toBe(
      "Call Jordan at (555) 014-2231 about 2 pets.",
    );
    expect(formatPhonesIn("Invoice 20261101 for $120.50")).toBe("Invoice 20261101 for $120.50");
    expect(formatPhonesIn("")).toBe("");
  });
});
