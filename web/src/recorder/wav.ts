// Browser recording speaks the same audio as the glasses app: 16 kHz mono 16-bit WAV in 15 second
// chunks, which is what the speech model reads.
export const REC_RATE = 16000;
export const REC_CHUNK_SECONDS = 15;

export function encodeWav(samples: Int16Array, rate = REC_RATE): Blob {
  const buf = new ArrayBuffer(44 + samples.length * 2);
  const v = new DataView(buf);
  const text = (at: number, str: string) => [...str].forEach((c, i) => v.setUint8(at + i, c.charCodeAt(0)));
  text(0, "RIFF");
  v.setUint32(4, 36 + samples.length * 2, true);
  text(8, "WAVE");
  text(12, "fmt ");
  v.setUint32(16, 16, true); // fmt chunk size
  v.setUint16(20, 1, true); // PCM
  v.setUint16(22, 1, true); // mono
  v.setUint32(24, rate, true);
  v.setUint32(28, rate * 2, true); // bytes per second
  v.setUint16(32, 2, true); // block align
  v.setUint16(34, 16, true); // bits per sample
  text(36, "data");
  v.setUint32(40, samples.length * 2, true);
  new Int16Array(buf, 44).set(samples);
  return new Blob([buf], { type: "audio/wav" });
}

/**
 * Takes the mic's own rate (often 44.1 or 48 kHz) in buffers of any size, downsamples to 16 kHz and
 * hands back one WAV per 15 seconds of audio. flush() sends whatever is left (stopping the recording).
 */
export class WavChunker {
  private parts: Int16Array[] = [];
  private count = 0;
  private pos = 0; // where the next output sample falls in the incoming buffer
  private readonly step: number;
  private readonly perChunk: number;

  constructor(
    inputRate: number,
    private readonly onChunk: (wav: Blob, samples: number) => void,
    private readonly rate = REC_RATE,
    seconds = REC_CHUNK_SECONDS,
  ) {
    this.step = inputRate / rate;
    this.perChunk = rate * seconds;
  }

  push(input: Float32Array): void {
    const out: number[] = [];
    for (; this.pos < input.length; this.pos += this.step) {
      // Average the input samples this output sample covers: a simple low-pass, so 48 kHz hiss does not
      // fold back into the speech band. Upsampling (step under 1) just repeats the nearest sample.
      const from = Math.floor(this.pos);
      const to = Math.min(input.length, Math.max(from + 1, Math.floor(this.pos + this.step)));
      let sum = 0;
      for (let k = from; k < to; k++) sum += input[k] ?? 0;
      out.push(Math.max(-1, Math.min(1, sum / (to - from))) * 0x7fff);
    }
    this.pos -= input.length;
    this.parts.push(Int16Array.from(out));
    this.count += out.length;
    if (this.count >= this.perChunk) this.flush();
  }

  flush(): void {
    if (!this.count) return;
    const all = new Int16Array(this.count);
    let at = 0;
    for (const part of this.parts) {
      all.set(part, at);
      at += part.length;
    }
    this.parts = [];
    this.count = 0;
    this.onChunk(encodeWav(all, this.rate), all.length);
  }
}

/** Loudness of one buffer, 0 to 1, for the level meter. */
export function rms(samples: Float32Array): number {
  if (!samples.length) return 0;
  let sum = 0;
  for (const s of samples) sum += s * s;
  return Math.min(1, Math.sqrt(sum / samples.length) * 4);
}
