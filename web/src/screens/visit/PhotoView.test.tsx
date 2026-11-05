import { render, waitFor } from "@testing-library/react";
import { PhotoCanvas } from "./PhotoView";

// A phone photo stored landscape (4000x3000) with EXIF orientation 6: the browser shows it upright,
// 3000 wide and 4000 tall, and reports that as its natural size. Crop and outline are measured on it.
const drawn: unknown[][] = [];
beforeEach(() => {
  drawn.length = 0;
  class UprightImage {
    onload: (() => void) | null = null;
    naturalWidth = 3000;
    naturalHeight = 4000;
    set src(_v: string) {
      queueMicrotask(() => this.onload?.());
    }
  }
  vi.stubGlobal("Image", UprightImage);
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockImplementation(
    () =>
      ({
        setTransform: () => {},
        clearRect: () => {},
        drawImage: (...args: unknown[]) => drawn.push(args),
      }) as unknown as CanvasRenderingContext2D,
  );
});
afterEach(() => vi.unstubAllGlobals());

describe("photos drawn as the browser displays them", () => {
  it("crops on the upright (EXIF applied) size and keeps its portrait shape", async () => {
    const { container } = render(
      <PhotoCanvas src="blob:p" alt="Ear" crop={[0, 0.5, 1, 1]} outlines={[[0.1, 0.6, 0.3, 0.8]]} />,
    );
    await waitFor(() => expect(drawn).toHaveLength(1));
    // Source rectangle: the bottom half of the upright 3000x4000 photo.
    expect(drawn[0]!.slice(1, 5)).toEqual([0, 2000, 3000, 2000]);
    const canvas = container.querySelector("canvas")!;
    expect([canvas.width, canvas.height]).toEqual([1600, Math.round((2000 * 1600) / 3000)]);
    expect((container.firstChild as HTMLElement).style.aspectRatio).toBe("1.5");
    // The outline sits in the crop: x 10% to 30%, y (0.6 - 0.5) / 0.5 = 20% to (0.8 - 0.5) / 0.5 = 60%.
    const outline = container.querySelector<HTMLElement>(".outline")!;
    expect([outline.style.left, outline.style.top, outline.style.width, outline.style.height]).toEqual([
      "10%",
      "20%",
      "20%",
      "40%",
    ]);
  });

  it("turns the upright photo a quarter clockwise on top of EXIF", async () => {
    const { container } = render(<PhotoCanvas src="blob:p" alt="Ear" rotation={90} />);
    await waitFor(() => expect(drawn).toHaveLength(1));
    const canvas = container.querySelector("canvas")!;
    expect(canvas.width).toBeGreaterThan(canvas.height); // portrait upright, landscape once turned
    expect((container.firstChild as HTMLElement).style.aspectRatio).toBe(String(4000 / 3000));
  });
});
