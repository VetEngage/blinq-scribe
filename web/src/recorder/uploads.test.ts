import { UploadChain } from "./uploads";

const later = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

describe("UploadChain", () => {
  it("uploads one part at a time, in recording order, even when an earlier one is slower", async () => {
    const order: string[] = [];
    const chain = new UploadChain();
    chain.enqueue(async () => {
      order.push("start 1");
      await later(30);
      order.push("end 1");
    });
    chain.enqueue(async () => {
      order.push("start 2");
      await later(1);
      order.push("end 2");
    });
    chain.enqueue(async () => {
      order.push("start 3");
      order.push("end 3");
    });
    await chain.idle();
    expect(order).toEqual(["start 1", "end 1", "start 2", "end 2", "start 3", "end 3"]);
  });

  it("reports a failed part and carries on with the next", async () => {
    const errors: unknown[] = [];
    const done: number[] = [];
    const chain = new UploadChain();
    chain.enqueue(
      async () => {
        throw new Error("speech model down");
      },
      (e) => errors.push(e),
    );
    chain.enqueue(async () => {
      done.push(2);
    });
    await chain.idle();
    expect(errors).toHaveLength(1);
    expect(done).toEqual([2]);
  });

  it("counts parts still on their way, so the draft can wait for them", async () => {
    const counts: number[] = [];
    const chain = new UploadChain((n) => counts.push(n));
    chain.enqueue(() => later(5));
    chain.enqueue(() => later(5));
    expect(chain.size).toBe(2);
    await chain.idle();
    expect(chain.size).toBe(0);
    expect(counts).toEqual([1, 2, 1, 0]);
  });
});
