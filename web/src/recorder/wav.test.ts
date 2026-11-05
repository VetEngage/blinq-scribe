import { REC_CHUNK_SECONDS, REC_RATE, WavChunker, encodeWav, rms } from "./wav";

// jsdom's Blob has no arrayBuffer(), so read it the old way.
const bytes = (blob: Blob) =>
  new Promise<ArrayBuffer>((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result as ArrayBuffer);
    r.onerror = () => reject(r.error);
    r.readAsArrayBuffer(blob);
  });

async function header(blob: Blob) {
  const v = new DataView(await bytes(blob));
  const text = (at: number, n: number) =>
    String.fromCharCode(...Array.from({ length: n }, (_, i) => v.getUint8(at + i)));
  return {
    riff: text(0, 4),
    wave: text(8, 4),
    fmt: text(12, 4),
    data: text(36, 4),
    format: v.getUint16(20, true),
    channels: v.getUint16(22, true),
    rate: v.getUint32(24, true),
    byteRate: v.getUint32(28, true),
    bits: v.getUint16(34, true),
    dataBytes: v.getUint32(40, true),
    size: blob.size,
  };
}

describe("encodeWav", () => {
  it("writes a 16 kHz mono 16-bit PCM WAV header around the samples", async () => {
    const h = await header(encodeWav(new Int16Array([0, 1, -1, 32767])));
    expect(h).toMatchObject({
      riff: "RIFF",
      wave: "WAVE",
      fmt: "fmt ",
      data: "data",
      format: 1,
      channels: 1,
      rate: 16000,
      byteRate: 32000,
      bits: 16,
      dataBytes: 8,
      size: 52,
    });
  });
});

describe("WavChunker", () => {
  const second = (rate: number, value = 0.5) => new Float32Array(rate).fill(value);

  it("downsamples 48 kHz to 16 kHz and sends one chunk per 15 seconds", async () => {
    const chunks: { wav: Blob; samples: number }[] = [];
    const c = new WavChunker(48000, (wav, samples) => chunks.push({ wav, samples }));
    for (let s = 0; s < REC_CHUNK_SECONDS * 2 + 3; s++) c.push(second(48000));
    expect(chunks.map((x) => x.samples)).toEqual([REC_RATE * REC_CHUNK_SECONDS, REC_RATE * REC_CHUNK_SECONDS]);
    c.flush(); // stopping sends what is left
    expect(chunks).toHaveLength(3);
    expect(chunks[2]?.samples).toBe(REC_RATE * 3);
    expect((await header(chunks[0]!.wav)).rate).toBe(16000);
  });

  it("keeps the sample count right across buffer edges at 44.1 kHz", () => {
    let total = 0;
    const c = new WavChunker(44100, (_w, n) => {
      total += n;
    });
    // 4096 sample buffers, like the browser hands them over, for 10 seconds
    const buf = new Float32Array(4096).fill(0.1);
    for (let i = 0; i < Math.ceil((44100 * 10) / 4096); i++) c.push(buf);
    c.flush();
    const seconds = (Math.ceil((44100 * 10) / 4096) * 4096) / 44100;
    expect(Math.abs(total - seconds * 16000)).toBeLessThanOrEqual(1);
  });

  it("averages the input samples, clamps, and scales to 16 bits", async () => {
    const out: Blob[] = [];
    const c = new WavChunker(32000, (w) => out.push(w));
    c.push(new Float32Array([1, 1, 0.5, -0.5, -2, -2]));
    c.flush();
    const samples = new Int16Array(await bytes(out[0]!), 44);
    expect(Array.from(samples)).toEqual([0x7fff, 0, -0x7fff]);
  });

  it("sends nothing when nothing was recorded", () => {
    const onChunk = vi.fn();
    new WavChunker(48000, onChunk).flush();
    expect(onChunk).not.toHaveBeenCalled();
  });
});

describe("rms", () => {
  it("is 0 for silence and stays within 0 to 1", () => {
    expect(rms(new Float32Array(10))).toBe(0);
    expect(rms(new Float32Array(10).fill(1))).toBe(1);
  });
});
