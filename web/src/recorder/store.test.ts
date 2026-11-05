import type { Encounter } from "../api/types";

// The mic and the server are stand-ins: each test pushes chunks by hand and watches where they go.
const mic = vi.hoisted(() => ({ onChunk: null as ((wav: Blob) => void) | null, stop: vi.fn() }));
vi.mock("./mic", () => ({
  startMic: vi.fn(async (onChunk: (wav: Blob) => void) => {
    mic.onChunk = onChunk;
    return { stop: mic.stop, level: () => 0.3 };
  }),
}));
const uploads = vi.hoisted(() => [] as { id: string; index: number }[]);
vi.mock("../api", () => ({
  api: {
    uploadAudio: vi.fn(async (id: string, _wav: Blob, index: number) => {
      uploads.push({ id, index });
      return { id, transcript: `part ${index}` } as Encounter;
    }),
  },
}));

import { endRecordingSession, onTranscribed, resumeRecordingSession, useRecorder, waitForUploads } from "./store";

const wav = () => new Blob([new Uint8Array(44)], { type: "audio/wav" });

beforeEach(() => {
  uploads.length = 0;
  mic.stop.mockClear();
  useRecorder.getState().stop(false);
});

describe("recorder", () => {
  it("a session timeout keeps the recording for the same person, never for the next one", async () => {
    await useRecorder.getState().start("enc-7");
    mic.onChunk?.(wav());
    endRecordingSession("ana");
    // The mic stops with its last part, and the part on its way still lands.
    expect(mic.stop).toHaveBeenLastCalledWith(true);
    await waitForUploads();
    expect(uploads.filter((u) => u.id === "enc-7")).toHaveLength(1);
    resumeRecordingSession("ana");

    await useRecorder.getState().start("enc-8");
    mic.onChunk?.(wav());
    endRecordingSession("ana");
    // Someone else signs in here: what was on its way is dropped.
    resumeRecordingSession("sam");
    await waitForUploads();
    expect(uploads.filter((u) => u.id === "enc-8")).toEqual([]);
  });

  it("sends every part to the visit it was recorded in, in order", async () => {
    const seen: Encounter[] = [];
    onTranscribed((e) => seen.push(e));
    await useRecorder.getState().start("enc-1");
    expect(useRecorder.getState().encounterId).toBe("enc-1");
    mic.onChunk?.(wav());
    mic.onChunk?.(wav());
    // The vet stops and opens another visit before the uploads land: they still go to enc-1.
    useRecorder.getState().stop();
    await useRecorder.getState().start("enc-2");
    mic.onChunk?.(wav());
    await waitForUploads();
    expect(uploads.map((u) => u.id)).toEqual(["enc-1", "enc-1", "enc-2"]);
    expect(uploads.map((u) => u.index)).toEqual([...uploads.map((u) => u.index)].sort((a, b) => a - b));
    expect(seen.map((e) => e.id)).toEqual(["enc-1", "enc-1", "enc-2"]);
    expect(useRecorder.getState().parts).toBe(1);
  });

  it("stop keeps the last part; signing out drops it and anything still on its way", async () => {
    await useRecorder.getState().start("enc-3");
    useRecorder.getState().stop();
    expect(mic.stop).toHaveBeenCalledWith(true);

    await useRecorder.getState().start("enc-4");
    mic.onChunk?.(wav());
    endRecordingSession();
    expect(mic.stop).toHaveBeenLastCalledWith(false);
    await waitForUploads();
    expect(uploads.filter((u) => u.id === "enc-4")).toEqual([]);
    expect(useRecorder.getState().encounterId).toBe("");
  });
});
