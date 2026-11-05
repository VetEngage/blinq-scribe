import type { Photo } from "../api/types";
import {
  FULL,
  clampBox,
  cropOf,
  cropToSave,
  dragBox,
  fromView,
  normalizeRotation,
  nudge,
  outlineOf,
  toView,
  viewAspect,
  visiblePart,
  withOutline,
  type Box,
  type Rotation,
} from "./photoGeometry";

const close = (a: Box, b: Box) => a.forEach((v, i) => expect(v).toBeCloseTo(b[i]!, 6));
const ROTATIONS: Rotation[] = [0, 90, 180, 270];

describe("outline math", () => {
  it("turns boxes clockwise: 90 sends the top left corner to the top right", () => {
    close(toView([0, 0, 0.2, 0.1], FULL, 90), [0.9, 0, 1, 0.2]);
    close(toView([0, 0, 0.2, 0.1], FULL, 180), [0.8, 0.9, 1, 1]);
    close(toView([0, 0, 0.2, 0.1], FULL, 270), [0, 0.8, 0.1, 1]);
  });

  it("measures the outline inside the crop", () => {
    close(toView([0.5, 0.5, 0.75, 0.75], [0.5, 0.5, 1, 1], 0), [0, 0, 0.5, 0.5]);
    close(toView([0.25, 0.25, 0.5, 0.5], [0, 0, 0.5, 1], 0), [0.5, 0.25, 1, 0.5]);
  });

  it.each(ROTATIONS)("fromView undoes toView at %i degrees, with and without a crop", (r) => {
    const box: Box = [0.3, 0.2, 0.55, 0.6];
    for (const crop of [FULL, [0.1, 0.15, 0.8, 0.9] as Box]) close(fromView(toView(box, crop, r), crop, r), box);
  });

  it("keeps boxes ordered, inside 0..1 and never smaller than the minimum", () => {
    expect(clampBox([0.9, 1.4, -0.2, 0.5])).toEqual([0, 0.5, 0.9, 1]);
    const tiny = clampBox([0.5, 0.5, 0.5, 0.5]);
    expect(tiny[2] - tiny[0]).toBeCloseTo(0.03);
    expect(clampBox([0.99, 0, 1, 1])[0]).toBeCloseTo(0.97);
    expect(clampBox(null)).toEqual(FULL);
    expect(clampBox([Number.NaN, 0, 1, 1])[0]).toBe(0);
  });

  it("shows only the part of an outline inside a crop, or nothing", () => {
    expect(visiblePart([-0.2, 0.5, 0.4, 1.3])).toEqual([0, 0.5, 0.4, 1]);
    expect(visiblePart([1.1, 0.2, 1.5, 0.4])).toBeNull();
  });

  it("drags a corner, an edge or the whole box without leaving the photo", () => {
    close(dragBox([0.2, 0.2, 0.6, 0.6], "se", 0.1, 0.1), [0.2, 0.2, 0.7, 0.7]);
    close(dragBox([0.2, 0.2, 0.6, 0.6], "w", 0.5, 0), [0.57, 0.2, 0.6, 0.6]);
    close(dragBox([0.2, 0.2, 0.6, 0.6], "move", 0.9, -0.9), [0.6, 0, 1, 0.4]);
  });

  it("nudges with the arrow keys, further with Shift", () => {
    close(nudge([0.2, 0.2, 0.6, 0.6], "e", "ArrowRight", false)!, [0.2, 0.2, 0.61, 0.6]);
    close(nudge([0.2, 0.2, 0.6, 0.6], "move", "ArrowUp", true)!, [0.2, 0.15, 0.6, 0.55]);
    expect(nudge(FULL, "n", "Enter", false)).toBeNull();
  });

  it("rounds rotations to the nearest quarter turn", () => {
    expect([0, 90, 360, 450, -90, 89].map(normalizeRotation)).toEqual([0, 90, 0, 90, 270, 90]);
    expect(viewAspect(400, 300, FULL, 90)).toBeCloseTo(0.75);
    expect(viewAspect(400, 300, [0, 0, 0.5, 1], 0)).toBeCloseTo(200 / 300);
  });
});

describe("photo metadata", () => {
  const photo = {
    id: "p1",
    label: "Right ear",
    caption: "",
    findings: "",
    segments: [],
    rotation: 90,
    in_note: true,
    show_owner: false,
    outline: [
      { label: "canal", box: [0.2, 0.3, 0.4, 0.5], polygon: [[0.2, 0.3]] },
      { label: "pinna", box: [0.6, 0.1, 0.9, 0.4], polygon: [] },
    ],
    crop: { x: 0.1, y: 0.2, w: 0.5, h: 0.6 },
  } as Photo;

  it("reads the crop and outline the server keeps", () => {
    close(cropOf(photo), [0.1, 0.2, 0.6, 0.8]);
    close(outlineOf(photo)!, [0.2, 0.3, 0.4, 0.5]);
    expect(cropOf({ ...photo, crop: null })).toEqual(FULL);
  });

  it("saves a crop as x, y, w, h and the whole photo as no crop", () => {
    expect(cropToSave([0.1, 0.2, 0.6, 0.8])).toEqual({ x: 0.1, y: 0.2, w: 0.5, h: expect.closeTo(0.6) });
    expect(cropToSave(FULL)).toBeNull();
  });

  it("moves only the first outlined area and drops its old polygon", () => {
    expect(withOutline(photo, [0.25, 0.3, 0.45, 0.5])).toEqual([
      { label: "canal", box: [0.25, 0.3, 0.45, 0.5], polygon: [] },
      photo.outline[1],
    ]);
  });
});
