import { cardFacts, duration, pastDay, speciesAge } from "./format";

describe("duration", () => {
  it("reads seconds as minutes and seconds into a visit", () => {
    expect(duration(0)).toBe("0:00");
    expect(duration(66)).toBe("1:06");
    expect(duration(4500)).toBe("75:00");
  });

  it("pads the minutes for the recording timer", () => {
    expect(duration(48, { padMinutes: true })).toBe("00:48");
    expect(duration(272.9, { padMinutes: true })).toBe("04:32");
  });

  it("never goes below zero", () => {
    expect(duration(-3)).toBe("0:00");
  });
});

describe("the rail's facts", () => {
  it("says species and age in plain words, never shorthand", () => {
    expect(speciesAge({ species: "Feline", age: 3 })).toBe("Cat, 3 years");
    expect(speciesAge({ species: "Canine", age: 1 })).toBe("Dog, 1 year");
    expect(speciesAge({ species: "Guinea pig", age: null })).toBe("Guinea pig");
    expect(speciesAge({ species: "", age: 6 })).toBe("6 years");
  });

  it("gives the quick card species, breed, sex, age and weight, leaving out what isn't on file", () => {
    expect(
      cardFacts({
        species: "Feline",
        breed: "Domestic Shorthair",
        sex: "Female, spayed",
        age: 3,
        weight: { value: 9.8, unit: "lb" },
      }),
    ).toEqual(["Cat", "Domestic Shorthair", "Female, spayed", "3 years", "9.8 lb"]);
    expect(cardFacts({ species: "Avian", breed: "", age: null, weight: null })).toEqual(["Bird"]);
  });

  it("dates a last visit with its year only when it was before this year", () => {
    expect(pastDay("2026-09-12", "2026-11-02")).toBe("Sep 12");
    expect(pastDay("2025-04-04", "2026-11-02")).toBe("Apr 4, 2025");
    expect(pastDay("", "2026-11-02")).toBe("");
  });
});
