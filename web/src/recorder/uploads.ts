/**
 * One upload at a time, in the order the parts were recorded, so the transcript reads in the order it
 * was said. A failed part is reported and the chain moves on. idle() resolves once every queued part
 * has landed (the draft and the signature wait on it).
 */
export class UploadChain {
  private tail: Promise<void> = Promise.resolve();
  private pending = 0;

  constructor(private readonly onPending: (n: number) => void = () => {}) {}

  enqueue(task: () => Promise<void>, onError: (err: unknown) => void = () => {}): void {
    this.pending++;
    this.onPending(this.pending);
    this.tail = this.tail
      .then(task)
      .catch(onError)
      .finally(() => {
        this.pending--;
        this.onPending(this.pending);
      });
  }

  get size(): number {
    return this.pending;
  }

  idle(): Promise<void> {
    return this.tail;
  }
}
