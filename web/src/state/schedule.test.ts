import type { Appointment } from "../api/types";

const api = vi.hoisted(() => ({
  schedule: vi.fn(),
  brief: vi.fn(),
  days: vi.fn(),
  notesToSign: vi.fn(() => Promise.resolve([])),
  waiting: vi.fn(() => Promise.resolve([])),
}));
vi.mock("../api", () => ({ api }));

import { useApp } from "./app";

const appt = (id: string) => ({ id }) as Appointment;

describe("switching whose day", () => {
  beforeEach(() => {
    useApp.getState().reset();
    api.brief.mockResolvedValue(null);
    api.days.mockResolvedValue([]);
  });

  it("hides my rows until the colleague's schedule lands, and ignores an answer for the vet I left", async () => {
    let mine: (l: Appointment[]) => void = () => {};
    let theirs: (l: Appointment[]) => void = () => {};
    api.schedule
      .mockReturnValueOnce(new Promise((r) => (mine = r)))
      .mockReturnValueOnce(new Promise((r) => (theirs = r)));
    useApp.setState({ provider: "prov-1", appts: [appt("old")], apptsFor: `prov-1|${useApp.getState().viewDate}` });
    const first = useApp.getState().loadSchedule();
    // Same vet and day: a refresh keeps the rows on screen.
    expect(useApp.getState().schedulePending).toBe(false);
    useApp.getState().setProvider("prov-2");
    expect(useApp.getState().schedulePending).toBe(true);
    theirs([appt("pepper")]);
    mine([appt("biscuit")]);
    await first;
    await vi.waitFor(() => expect(useApp.getState().appts).toEqual([appt("pepper")]));
    expect(useApp.getState().schedulePending).toBe(false);
  });
});

describe("refreshing the same day", () => {
  beforeEach(() => useApp.getState().reset());

  it("leaves the store alone when nothing changed, so the screens don't re-render", async () => {
    const rows = [appt("biscuit"), appt("pepper")];
    useApp.setState({ appts: rows, apptsFor: `|${useApp.getState().viewDate}` });
    api.schedule.mockResolvedValueOnce([appt("biscuit"), appt("pepper")]);
    const seen = vi.fn();
    const stop = useApp.subscribe(seen);
    await useApp.getState().loadSchedule();
    stop();
    expect(seen).not.toHaveBeenCalled();
    expect(useApp.getState().appts).toBe(rows);
  });

  it("takes the new rows when something did change", async () => {
    useApp.setState({ appts: [appt("biscuit")], apptsFor: `|${useApp.getState().viewDate}` });
    api.schedule.mockResolvedValueOnce([appt("biscuit"), appt("pepper")]);
    await useApp.getState().loadSchedule();
    expect(useApp.getState().appts).toEqual([appt("biscuit"), appt("pepper")]);
  });
});
