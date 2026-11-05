import { renderHook } from "@testing-library/react";
import type { Appointment } from "../api/types";
import { hasOpenVisit, SCHEDULE_REFRESH_MS, useScheduleRefresh } from "./useScheduleRefresh";

const hidden = (value: boolean) => Object.defineProperty(document, "hidden", { configurable: true, get: () => value });

describe("refreshing the schedule while a visit is in progress", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => {
    vi.useRealTimers();
    hidden(false);
  });

  it("refreshes every 15 seconds while a visit is in progress", () => {
    const refresh = vi.fn();
    renderHook(() => useScheduleRefresh(true, refresh));
    vi.advanceTimersByTime(SCHEDULE_REFRESH_MS * 2);
    expect(refresh).toHaveBeenCalledTimes(2);
  });

  it("does nothing when no visit is in progress", () => {
    const refresh = vi.fn();
    renderHook(() => useScheduleRefresh(false, refresh));
    vi.advanceTimersByTime(SCHEDULE_REFRESH_MS * 3);
    expect(refresh).not.toHaveBeenCalled();
  });

  it("stops while the tab is hidden and refreshes when it comes back", () => {
    const refresh = vi.fn();
    renderHook(() => useScheduleRefresh(true, refresh));
    hidden(true);
    vi.advanceTimersByTime(SCHEDULE_REFRESH_MS * 3);
    expect(refresh).not.toHaveBeenCalled();
    hidden(false);
    document.dispatchEvent(new Event("visibilitychange"));
    expect(refresh).toHaveBeenCalledTimes(1);
  });

  it("stops when the screen goes away", () => {
    const refresh = vi.fn();
    const { unmount } = renderHook(() => useScheduleRefresh(true, refresh));
    unmount();
    vi.advanceTimersByTime(SCHEDULE_REFRESH_MS * 2);
    expect(refresh).not.toHaveBeenCalled();
  });
});

describe("when the schedule polls", () => {
  const row = (visit_status: Appointment["visit_status"], audio_live = false) =>
    ({ visit_status, audio_live }) as Appointment;

  it("polls while a visit is started but not signed, even with no audio coming in yet", () => {
    expect(hasOpenVisit([row("not_started"), row("recording")])).toBe(true);
    expect(hasOpenVisit([row("recording", true)])).toBe(true);
    expect(hasOpenVisit([row("draft_ready")])).toBe(true);
  });

  it("stops once every visit is not started or signed", () => {
    expect(hasOpenVisit([row("not_started"), row("signed")])).toBe(false);
    expect(hasOpenVisit([])).toBe(false);
  });
});
