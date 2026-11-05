import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  FULL,
  dragBox,
  nudge,
  toView,
  viewAspect,
  visiblePart,
  type Box,
  type Handle,
  type Rotation,
} from "../../lib/photoGeometry";
import { Pressable } from "@blinq-scribe/ui";

const pct = (v: number) => `${(v * 100).toFixed(3)}%`;
const boxStyle = (b: Box) => ({ left: pct(b[0]), top: pct(b[1]), width: pct(b[2] - b[0]), height: pct(b[3] - b[1]) });

/**
 * The original image drawn with its crop and rotation (the file itself never changes), with the
 * outline on top in the same place. `fill` sizes it to its parent's height (thumbnails) instead of width.
 */
export function PhotoCanvas({
  src,
  crop = FULL,
  rotation = 0,
  outlines = [],
  drawing = false,
  alt,
  fill = false,
  children,
}: {
  src: string;
  crop?: Box;
  rotation?: Rotation;
  outlines?: Box[];
  drawing?: boolean;
  alt: string;
  fill?: boolean;
  children?: React.ReactNode;
}) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const [size, setSize] = useState<{ w: number; h: number } | null>(null);
  const [img, setImg] = useState<HTMLImageElement | null>(null);

  useEffect(() => {
    if (!src) return;
    let live = true;
    // An <img> is drawn as the browser displays it: EXIF orientation applied (image-orientation:
    // from-image), and naturalWidth/naturalHeight are that upright size. Every crop and outline
    // fraction is measured on it, the same order the server's PDF and owner page use.
    const image = new Image();
    image.onload = () => {
      if (!live) return;
      setImg(image);
      setSize({ w: image.naturalWidth, h: image.naturalHeight });
    };
    image.src = src;
    return () => {
      live = false;
    };
  }, [src]);

  useEffect(() => {
    const c = canvas.current;
    if (!c || !img || !size) return;
    const sx = crop[0] * size.w,
      sy = crop[1] * size.h;
    const sw = Math.max(1, (crop[2] - crop[0]) * size.w),
      sh = Math.max(1, (crop[3] - crop[1]) * size.h);
    // Draw at most 1600 px on the long side: plenty for the screen, quick to redraw while editing.
    const scale = Math.min(1, 1600 / Math.max(sw, sh));
    const dw = Math.round(sw * scale),
      dh = Math.round(sh * scale);
    const turned = rotation === 90 || rotation === 270;
    c.width = turned ? dh : dw;
    c.height = turned ? dw : dh;
    const ctx = c.getContext("2d");
    if (!ctx) return;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, c.width, c.height);
    // Clockwise, matching toView: 90 sends the top left corner to the top right.
    if (rotation === 90) ctx.setTransform(0, 1, -1, 0, c.width, 0);
    else if (rotation === 180) ctx.setTransform(-1, 0, 0, -1, c.width, c.height);
    else if (rotation === 270) ctx.setTransform(0, -1, 1, 0, 0, c.height);
    ctx.drawImage(img, sx, sy, sw, sh, 0, 0, dw, dh);
  }, [img, size, crop, rotation]);

  const aspect = size ? viewAspect(size.w, size.h, crop, rotation) : 4 / 3;
  const shown = outlines.map((o) => visiblePart(toView(o, crop, rotation))).filter((b): b is Box => !!b);
  return (
    <div
      className={`photo-view ${fill ? "fill" : ""}`}
      style={{ aspectRatio: String(aspect), ["--aspect" as string]: String(aspect) }}
    >
      <canvas ref={canvas} role="img" aria-label={alt} />
      {!drawing && shown.map((b, i) => <div key={i} className="outline" style={boxStyle(b)} aria-hidden="true" />)}
      {drawing && (
        <svg className="outline-drawing" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
          <rect x="20" y="20" width="60" height="60" rx="3" pathLength="100" />
        </svg>
      )}
      {children}
    </div>
  );
}

const HANDLES = ["nw", "n", "ne", "e", "se", "s", "sw", "w"] as const;

/**
 * A box the vet can drag by its corners and edges, or move whole. Every handle is a button that
 * arrow keys nudge (1%, Shift for 5%), so it works without a mouse.
 */
export function BoxEditor({ box, onChange, name }: { box: Box; onChange: (b: Box) => void; name: string }) {
  const { t } = useTranslation();
  const frame = useRef<HTMLDivElement>(null);
  const drag = useRef<{ handle: Handle; x: number; y: number; start: Box } | null>(null);

  const down = (handle: Handle) => (ev: React.PointerEvent) => {
    ev.preventDefault();
    (ev.currentTarget as HTMLElement).setPointerCapture?.(ev.pointerId);
    drag.current = { handle, x: ev.clientX, y: ev.clientY, start: box };
  };
  const move = (ev: React.PointerEvent) => {
    const d = drag.current,
      el = frame.current;
    if (!d || !el) return;
    const r = el.getBoundingClientRect();
    onChange(dragBox(d.start, d.handle, (ev.clientX - d.x) / r.width, (ev.clientY - d.y) / r.height));
  };
  const up = () => {
    drag.current = null;
  };
  const key = (handle: Handle) => (ev: React.KeyboardEvent) => {
    const next = nudge(box, handle, ev.key, ev.shiftKey);
    if (next) {
      ev.preventDefault();
      onChange(next);
    }
  };

  return (
    <div className="box-editor" ref={frame} onPointerMove={move} onPointerUp={up} onPointerCancel={up}>
      <div className="box" style={boxStyle(box)}>
        <Pressable
          className="box-body"
          aria-label={t("photo.moveBox", { name })}
          onPointerDown={down("move")}
          onKeyDown={key("move")}
        />
        {HANDLES.map((h) => (
          <Pressable
            key={h}
            className={`box-handle h-${h}`}
            aria-label={t(`photo.handles.${h}`, { name })}
            onPointerDown={down(h)}
            onKeyDown={key(h)}
          />
        ))}
      </div>
    </div>
  );
}
