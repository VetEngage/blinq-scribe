import type { Crop, OutlineRegion, Photo } from "../api/types";

// Photo edits are metadata on the original image: a crop box, a rotation and the outline box, all as
// 0..1 fractions of the original. What the vet sees is the crop, turned by the rotation. These
// functions move boxes between the original and that view.

/** [x0, y0, x1, y1], fractions 0..1, x0 < x1 and y0 < y1. */
export type Box = [number, number, number, number];
export type Rotation = 0 | 90 | 180 | 270;

export const FULL: Box = [0, 0, 1, 1];
/** The smallest box a vet can drag to, so a handle never collapses onto another. */
export const MIN_SIZE = 0.03;

const clamp01 = (v: number) => Math.min(1, Math.max(0, Number.isFinite(v) ? v : 0));

export const normalizeRotation = (deg: number | null | undefined): Rotation =>
  ((((Math.round((deg ?? 0) / 90) * 90) % 360) + 360) % 360) as Rotation;

/** Order the corners, keep them inside 0..1 and at least MIN_SIZE apart. */
export function clampBox(b: readonly number[] | null | undefined, min = MIN_SIZE): Box {
  if (!b || b.length < 4) return [...FULL];
  let [x0, y0, x1, y1] = b.map(clamp01) as Box;
  if (x0 > x1) [x0, x1] = [x1, x0];
  if (y0 > y1) [y0, y1] = [y1, y0];
  if (x1 - x0 < min) {
    x1 = Math.min(1, x0 + min);
    x0 = x1 - min;
  }
  if (y1 - y0 < min) {
    y1 = Math.min(1, y0 + min);
    y0 = y1 - min;
  }
  return [x0, y0, x1, y1];
}

/** A point turned clockwise by the rotation, inside the unit square. */
function rotatePoint(x: number, y: number, r: Rotation): [number, number] {
  if (r === 90) return [1 - y, x];
  if (r === 180) return [1 - x, 1 - y];
  if (r === 270) return [y, 1 - x];
  return [x, y];
}

function boxThrough(b: Box, f: (x: number, y: number) => [number, number]): Box {
  const [ax, ay] = f(b[0], b[1]);
  const [bx, by] = f(b[2], b[3]);
  return [Math.min(ax, bx), Math.min(ay, by), Math.max(ax, bx), Math.max(ay, by)];
}

/** A box on the original image, as fractions of the cropped and rotated view. */
export function toView(box: Box, crop: Box = FULL, rotation: Rotation = 0): Box {
  const [cx0, cy0, cx1, cy1] = crop;
  const w = cx1 - cx0,
    h = cy1 - cy0;
  const inCrop = boxThrough(box, (x, y) => [(x - cx0) / w, (y - cy0) / h]);
  return boxThrough(inCrop, (x, y) => rotatePoint(x, y, rotation));
}

/** A box drawn on the view, back as fractions of the original image. */
export function fromView(box: Box, crop: Box = FULL, rotation: Rotation = 0): Box {
  const back = ((360 - rotation) % 360) as Rotation;
  const inCrop = boxThrough(box, (x, y) => rotatePoint(x, y, back));
  const [cx0, cy0, cx1, cy1] = crop;
  const w = cx1 - cx0,
    h = cy1 - cy0;
  return boxThrough(inCrop, (x, y) => [cx0 + x * w, cy0 + y * h]);
}

/** Only the part of a box that is inside the view, or null when none of it is. */
export function visiblePart(view: Box): Box | null {
  const [x0, y0, x1, y1] = [clamp01(view[0]), clamp01(view[1]), clamp01(view[2]), clamp01(view[3])];
  return x1 - x0 > 0 && y1 - y0 > 0 ? [x0, y0, x1, y1] : null;
}

/** Width over height of the view, from the original's pixel size. */
export function viewAspect(width: number, height: number, crop: Box = FULL, rotation: Rotation = 0): number {
  const w = width * (crop[2] - crop[0]);
  const h = height * (crop[3] - crop[1]);
  if (!w || !h) return 4 / 3;
  return rotation === 90 || rotation === 270 ? h / w : w / h;
}

export type Handle = "move" | "n" | "s" | "e" | "w" | "ne" | "nw" | "se" | "sw";

/** Move a whole box or one of its edges by (dx, dy), staying inside 0..1 and at least MIN_SIZE. */
export function dragBox(b: Box, handle: Handle, dx: number, dy: number): Box {
  let [x0, y0, x1, y1] = b;
  if (handle === "move") {
    const mx = Math.min(Math.max(dx, -x0), 1 - x1);
    const my = Math.min(Math.max(dy, -y0), 1 - y1);
    return [x0 + mx, y0 + my, x1 + mx, y1 + my];
  }
  if (handle.includes("w")) x0 = Math.min(Math.max(0, x0 + dx), x1 - MIN_SIZE);
  if (handle.includes("e")) x1 = Math.max(Math.min(1, x1 + dx), x0 + MIN_SIZE);
  if (handle.includes("n")) y0 = Math.min(Math.max(0, y0 + dy), y1 - MIN_SIZE);
  if (handle.includes("s")) y1 = Math.max(Math.min(1, y1 + dy), y0 + MIN_SIZE);
  return [x0, y0, x1, y1];
}

/** Arrow keys on a handle: 1% per press, 5% with Shift. Null for any other key. */
export function nudge(b: Box, handle: Handle, key: string, shift: boolean): Box | null {
  const step = shift ? 0.05 : 0.01;
  const d: Record<string, [number, number]> = {
    ArrowLeft: [-step, 0],
    ArrowRight: [step, 0],
    ArrowUp: [0, -step],
    ArrowDown: [0, step],
  };
  const move = d[key];
  return move ? dragBox(b, handle, move[0], move[1]) : null;
}

export const sameBox = (a: readonly number[] | null | undefined, b: readonly number[] | null | undefined): boolean =>
  !!a && !!b && a.length === b.length && a.every((v, i) => Math.abs(v - (b[i] ?? NaN)) < 1e-6);

/** Every outlined area on a photo, as boxes on the original. */
export const outlinesOf = (p: Photo): Box[] =>
  (p.outline ?? []).filter((r) => r.box?.length === 4).map((r) => clampBox(r.box));
/** The outline the vet adjusts: the first area. */
export const outlineOf = (p: Photo): Box | null => outlinesOf(p)[0] ?? null;

export const cropOf = (p: Photo): Box =>
  p.crop ? clampBox([p.crop.x, p.crop.y, p.crop.x + p.crop.w, p.crop.y + p.crop.h]) : FULL;
/** A crop box as the server keeps it; the whole photo is no crop at all. */
export const cropToSave = (b: Box): Crop | null =>
  sameBox(b, FULL) ? null : { x: b[0], y: b[1], w: b[2] - b[0], h: b[3] - b[1] };
export const rotationOf = (p: Photo): Rotation => normalizeRotation(p.rotation);

/** The photo's outline with its first area moved to `box` (a new area when it had none). */
export function withOutline(p: Photo, box: Box): OutlineRegion[] {
  const [first, ...rest] = p.outline ?? [];
  // The box moved, so a polygon traced for the old place no longer fits.
  return [{ label: first?.label ?? p.label ?? "", box, polygon: [] }, ...rest];
}
