import type { Appointment } from "../api/types";
import type { OpenItem } from "../api/types";
import {
  betweenVisits,
  clinicDayOf,
  dayClock,
  headsUp,
  minutesUntil,
  needsMe,
  paceMinutes,
  petCount,
  pickNext,
  PINNED_CLOCK,
} from "./day";
import { breakdown, byOwner, fitGap, type FollowRow } from "./followups";
import { nowShown, readAtClockOf, shownAt } from "./demoTime";

const day = "2026-11-03";
const visit = (id: string, hhmm: string, extra: Partial<Appointment> = {}) =>
  ({
    id,
    start: `${day}T${hhmm}:00`,
    duration_min: 30,
    reason: "",
    visit_status: "not_started",
    patient: { id: `p-${id}`, name: id, alerts: [] },
    client: { id: "c", first_name: "Jordan", last_name: "Lee" },
    ...extra,
  }) as unknown as Appointment;
const at = (hhmm: string) => new Date(`${day}T${hhmm}:00`);

describe("a day's clock", () => {
  it("is now on today, the demo's own clock on its busy day, and nothing on another day", () => {
    const now = new Date("2026-11-01T09:40:00");
    expect(dayClock([visit("a", "09:00")], "2026-11-01", "2026-11-01", now)).toBe(now);
    expect(dayClock([visit("a", "09:00", { demo_clock: "13:15" })], day, "2026-11-01")?.getTime()).toBe(
      at("13:15").getTime(),
    );
    expect(dayClock([visit("a", "09:00")], day, "2026-11-01")).toBeNull();
  });

  it("can be pinned to a time of day for today, for demo recordings and the end to end tests", () => {
    localStorage.setItem(PINNED_CLOCK, "09:45");
    expect(dayClock([visit("a", "09:00")], day, day)?.getTime()).toBe(at("09:45").getTime());
    // Never another day's, and never the busy day's own clock.
    expect(dayClock([visit("a", "09:00", { demo_clock: "13:15" })], day, "2026-11-01")?.getTime()).toBe(
      at("13:15").getTime(),
    );
    localStorage.setItem(PINNED_CLOCK, "nonsense");
    expect(dayClock([visit("a", "09:00")], day, day, at("11:00"))?.getTime()).toBe(at("11:00").getTime());
    localStorage.clear();
  });

  it("End of day and the brief follow the busy demo day while it is on screen, else today", () => {
    expect(clinicDayOf("2026-11-01", day, day)).toBe(day);
    expect(clinicDayOf("2026-11-01", "2026-11-02", day)).toBe("2026-11-01");
    expect(clinicDayOf("2026-11-01", day, "")).toBe("2026-11-01");
  });
});

describe("needs me", () => {
  it("counts a note to sign and a visit whose owner text didn't send, like the brief", () => {
    const failed = { kind: "failed_text", appointment_id: "b" } as OpenItem;
    expect(needsMe(visit("a", "09:00", { visit_status: "draft_ready" }), null)).toBe(true);
    expect(needsMe(visit("b", "09:00", { visit_status: "signed" }), null, [failed])).toBe(true);
    expect(needsMe(visit("c", "09:00", { visit_status: "signed" }), null, [failed])).toBe(false);
  });
});

describe("the busy demo day's clock for times shown", () => {
  it("shows what happened today in real time at the demo's clock, and the day's own times as they are", () => {
    sessionStorage.clear();
    const realNow = Date.now();
    readAtClockOf({ start: `${day}T13:30:00`, demo_clock: "13:15" });
    const signed = new Date(realNow).toISOString();
    expect(new Date(shownAt(signed)).getTime()).toBeCloseTo(at("13:15").getTime(), -4);
    expect(shownAt(`${day}T09:05:00`)).toBe(`${day}T09:05:00`);
    expect(Math.abs(nowShown() - at("13:15").getTime())).toBeLessThan(60_000);
    // Another visit: the real clock again.
    readAtClockOf({ start: "2026-11-01T09:00:00", demo_clock: "" });
    expect(shownAt(signed)).toBe(signed);
  });
});

describe("follow ups for one owner", () => {
  const row = (key: string, owner: string, kind: FollowRow["kind"] = "link") =>
    ({ key, kind, owner, pet: key, title: key, meta: "", failed: false }) as FollowRow;
  it("group under the owner where the first of them was, and say what the rest are", () => {
    const rows = [row("hazel", "Jordan Lee"), row("miso", "Priya Shah", "failed_text"), row("mochi", "Jordan Lee")];
    expect(byOwner(rows).map((x) => [x.row.key, x.head])).toEqual([
      ["hazel", "Jordan Lee"],
      ["mochi", ""],
      ["miso", ""],
    ]);
    expect(breakdown([...rows, row("x", "", "followup")])).toBe(
      "2 recheck links, 1 follow up to decide, 1 failed text",
    );
  });
});

describe("pace, from when visits really started", () => {
  it("says how late the last visit that started was, rounded to 5 minutes", () => {
    const appts = [
      visit("a", "09:00", { started_at: `${day}T09:00:00`, visit_status: "signed" }),
      visit("b", "12:30", { started_at: `${day}T12:46:00`, visit_status: "signed" }),
      visit("c", "13:30"),
    ];
    expect(paceMinutes(appts, at("13:15"))).toBe(15);
  });

  it("claims nothing when no visit started, or one started far off its time", () => {
    expect(paceMinutes([visit("a", "09:00")], at("10:00"))).toBeNull();
    // Started hours late (a demo visit opened in the afternoon): no claim about the day's pace.
    expect(paceMinutes([visit("a", "09:00", { started_at: `${day}T15:00:00` })], at("16:00"))).toBeNull();
    expect(paceMinutes([visit("a", "09:00", { started_at: `${day}T09:02:00` })], at("10:00"))).toBe(0);
    // A later visit started ahead of the clock (the demo's busy day opened at another hour) is no pace.
    const early = visit("b", "14:00", { started_at: "2026-11-01T02:07:00" });
    expect(paceMinutes([visit("a", "12:30", { started_at: `${day}T12:45:00` }), early], at("13:15"))).toBe(15);
  });
});

describe("between visits", () => {
  const appts = [visit("a", "09:00", { visit_status: "signed" }), visit("b", "13:30"), visit("c", "14:00")];
  it("is the next visit when nobody is in the room and the clinic is open", () => {
    expect(betweenVisits(appts, at("13:15"))?.id).toBe("b");
    expect(minutesUntil(appts[1]!, at("13:15"))).toBe(15);
  });

  it("is nothing with a visit in the room, before the first visit or after the last", () => {
    expect(betweenVisits([...appts, visit("r", "13:00", { visit_status: "recording" })], at("13:15"))).toBeNull();
    expect(betweenVisits(appts, at("08:00"))).toBeNull();
    expect(betweenVisits(appts, at("18:00"))).toBeNull();
    expect(betweenVisits(appts, null)).toBeNull();
  });

  it("picks the next visit at the day's clock", () => {
    expect(pickNext(appts, [], at("13:45"))?.id).toBe("c");
  });
});

describe("a heavy day's heads up", () => {
  it("names the next household, the next caution and the last visit, each once", () => {
    const appts = [
      visit("next", "13:30"),
      visit("lee", "14:00", {
        pets: [
          {
            patient: { id: "h", name: "Hazel", alerts: [] },
            reason: "",
            visit_status: "not_started",
            encounter_id: "",
          },
          { patient: { id: "k", name: "Kiwi", alerts: [] }, reason: "", visit_status: "not_started", encounter_id: "" },
        ],
      } as unknown as Partial<Appointment>),
      visit("bruno", "16:00", {
        patient: { id: "b", name: "Bruno", alerts: ["Muzzle for exams"] },
      } as unknown as Partial<Appointment>),
      visit("thor", "17:45"),
    ];
    expect(headsUp(appts, at("13:15"), ["next"]).map((x) => [x.a.id, x.kind])).toEqual([
      ["lee", "household"],
      ["bruno", "caution"],
      ["thor", "last"],
    ]);
    expect(petCount(appts)).toBe(5);
  });
});

describe("quick ones for the gap", () => {
  const row = (key: string, kind: FollowRow["kind"]) => ({ key, kind, failed: false, pet: "", title: key, meta: "" });
  it("keeps what the provider can do that fits, at most three, never the front desk's", () => {
    const rows = [
      row("text", "failed_text"),
      row("rx", "prescription"),
      row("decide", "followup"),
      row("link", "link"),
      row("link2", "link"),
    ];
    expect(fitGap(rows, 15).map((r) => r.key)).toEqual(["text", "decide", "link"]);
    expect(fitGap(rows, 2).map((r) => r.key)).toEqual(["text", "link"]);
    expect(fitGap(rows, 0)).toEqual([]);
  });
});
