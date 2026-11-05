import { act, renderHook } from "@testing-library/react";
import type { Encounter, FollowUp } from "../../api/types";

const api = vi.hoisted(() => ({ encounter: vi.fn() }));
vi.mock("../../api", () => ({ api }));

import { useQueuedLinks } from "./useQueuedLinks";
import { linkStatusText } from "./linkStatus";

const link = (status: "queued" | "sent") =>
  ({
    id: "f1",
    status: "approved",
    booking_link: {
      status,
      url: "https://book.test/x",
      from: "",
      to: "",
      expires_at: null,
      sent_at: null,
      booked_start: null,
    },
  }) as unknown as FollowUp;
const enc = (status: "queued" | "sent") =>
  ({ id: "enc-1", status: "signed", followups: [link(status)] }) as unknown as Encounter;
const appt = { client: { first_name: "Jordan" } } as never;

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe("booking links still queued after signing", () => {
  it("say they are on their way, not that they go out when you sign", () => {
    expect(linkStatusText(link("queued"), appt, true)).toMatch(/^Sending the booking link to Jordan/);
    expect(linkStatusText(link("queued"), appt, false)).toMatch(/^The booking link goes to Jordan when you sign/);
  });

  it("refetch at 2, 5 and 10 seconds and stop once the link is sent", async () => {
    api.encounter.mockReset().mockResolvedValueOnce(enc("queued")).mockResolvedValueOnce(enc("sent"));
    const setCurrent = vi.fn();
    const { rerender } = renderHook(({ e }) => useQueuedLinks(e, setCurrent), { initialProps: { e: enc("queued") } });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(2000);
    });
    expect(api.encounter).toHaveBeenCalledTimes(1);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(3000);
    });
    expect(api.encounter).toHaveBeenCalledTimes(2);
    rerender({ e: setCurrent.mock.lastCall?.[0] as Encounter });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(10000);
    });
    expect(api.encounter).toHaveBeenCalledTimes(2);
  });

  it("don't poll when nothing is queued", async () => {
    api.encounter.mockReset();
    renderHook(() => useQueuedLinks(enc("sent"), vi.fn()));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(11000);
    });
    expect(api.encounter).not.toHaveBeenCalled();
  });
});
