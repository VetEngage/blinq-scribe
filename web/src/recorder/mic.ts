import { WavChunker, rms } from "./wav";
import { openMic } from "./micChoice";

export interface MicRecorder {
  /** stop(true) sends what was recorded since the last chunk; stop(false) drops it (signing out). */
  stop(keep?: boolean): void;
  /** The latest loudness, 0 to 1, for the level meter. */
  level(): number;
}

/**
 * Must be called inside the click, before any await, so Safari lets the audio context run. It runs at
 * the mic's own rate and the chunker downsamples to 16 kHz, which every browser supports.
 */
export async function startMic(onChunk: (wav: Blob) => void): Promise<MicRecorder> {
  const ctx = new AudioContext();
  const resumed = ctx.resume();
  let stream: MediaStream;
  try {
    stream = await openMic();
  } catch (err) {
    void ctx.close();
    throw err;
  }
  try {
    await resumed;
    const source = ctx.createMediaStreamSource(stream);
    const node = ctx.createScriptProcessor(4096, 1, 1);
    const chunker = new WavChunker(ctx.sampleRate, (wav) => onChunk(wav));
    let last = 0;
    node.onaudioprocess = (ev) => {
      const input = ev.inputBuffer.getChannelData(0);
      last = rms(input);
      chunker.push(input);
    };
    source.connect(node);
    node.connect(ctx.destination);
    return {
      stop(keep = true) {
        node.onaudioprocess = null;
        node.disconnect();
        source.disconnect();
        stream.getTracks().forEach((tr) => tr.stop());
        if (keep) chunker.flush();
        void ctx.close();
      },
      level: () => last,
    };
  } catch (err) {
    stream.getTracks().forEach((tr) => tr.stop());
    void ctx.close();
    throw err;
  }
}
