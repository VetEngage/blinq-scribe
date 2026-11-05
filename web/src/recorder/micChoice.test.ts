import { micConstraints, openMic, readMic, saveMic } from "./micChoice";

const stream = {} as MediaStream;

function mockGetUserMedia(impl: (c: MediaStreamConstraints) => Promise<MediaStream>) {
  const getUserMedia = vi.fn(impl);
  Object.defineProperty(navigator, "mediaDevices", { value: { getUserMedia }, configurable: true });
  return getUserMedia;
}

describe("micChoice", () => {
  beforeEach(() => localStorage.clear());

  it("stores and reads the chosen mic; empty clears it", () => {
    expect(readMic()).toBe("");
    saveMic("usb-1");
    expect(readMic()).toBe("usb-1");
    expect(micConstraints()).toEqual({ channelCount: 1, deviceId: { exact: "usb-1" } });
    saveMic("");
    expect(readMic()).toBe("");
    expect(micConstraints()).toEqual({ channelCount: 1 });
  });

  it("opens the chosen mic", async () => {
    saveMic("usb-1");
    const gum = mockGetUserMedia(async () => stream);
    await expect(openMic()).resolves.toBe(stream);
    expect(gum).toHaveBeenCalledWith({ audio: { channelCount: 1, deviceId: { exact: "usb-1" } } });
  });

  it("falls back to the default mic and forgets a mic that's gone", async () => {
    saveMic("gone");
    const gum = mockGetUserMedia(async (c) => {
      if ((c.audio as MediaTrackConstraints).deviceId) throw Object.assign(new Error("gone"), { name: "OverconstrainedError" });
      return stream;
    });
    await expect(openMic()).resolves.toBe(stream);
    expect(gum).toHaveBeenLastCalledWith({ audio: { channelCount: 1 } });
    expect(readMic()).toBe("");
  });

  it("does not hide a permission error", async () => {
    saveMic("usb-1");
    mockGetUserMedia(async () => {
      throw Object.assign(new Error("no"), { name: "NotAllowedError" });
    });
    await expect(openMic()).rejects.toThrow("no");
    expect(readMic()).toBe("usb-1");
  });
});
