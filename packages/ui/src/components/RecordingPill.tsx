import { useEffect, useRef, type ReactNode } from "react";
import { cx } from "../cx";

const reducedMotion = () => typeof window !== "undefined" && !!window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

/**
 * Small level bars in the current text color. With `level` (0 to 1, read every frame, like a mic)
 * they follow it; without, they move on their own to say "listening". Under reduced motion they hold
 * still. Decorative unless `label` is given.
 */
export function LevelBars({
  level,
  bars = 5,
  size = "sm",
  label,
  className,
}: {
  level?: () => number;
  bars?: number;
  /** "sm" in a pill (14 px), "md" beside a line of text (16 px). */
  size?: "sm" | "md";
  label?: string;
  className?: string;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const live = !!level;
  useEffect(() => {
    if (!level || reducedMotion()) return;
    let raf = 0;
    const tick = () => {
      const v = Math.max(0, Math.min(1, level()));
      const els = ref.current?.children;
      if (els) {
        for (let i = 0; i < els.length; i++) {
          // A little shape across the bars, so a steady voice still reads as movement.
          const shape = 0.55 + 0.45 * Math.sin((i / Math.max(1, els.length - 1)) * Math.PI);
          (els[i] as HTMLElement).style.transform = `scaleY(${Math.max(0.2, v * shape).toFixed(2)})`;
        }
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [level]);
  return (
    <span
      ref={ref}
      role={label ? "img" : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      className={cx("inline-flex flex-none items-center gap-px", size === "sm" ? "h-3.5" : "h-4", className)}
    >
      {Array.from({ length: bars }, (_, i) => (
        <span
          key={i}
          className={cx("block h-full w-[3px] rounded-pill bg-current", live ? "scale-y-50 transition-transform duration-(--duration-fast)" : "animate-level-bar")}
          style={live ? undefined : { animationDelay: `${(i % 5) * 120}ms` }}
        />
      ))}
    </span>
  );
}

/**
 * Recording now: a pulsing red dot, what's recording ("Recording from glasses"), level bars and the
 * time since it started. The time is read out as `elapsedLabel` ("4 minutes 32 seconds" is clearer
 * than "04:32").
 */
export function RecordingPill({
  children,
  elapsed,
  elapsedLabel,
  level,
  bars = true,
  className,
}: {
  children: ReactNode;
  /** mm:ss since it started. */
  elapsed?: string;
  elapsedLabel?: string;
  /** Follows a live level (this computer's mic); without, the bars move on their own. */
  level?: () => number;
  /** Bars at all: off when nothing has arrived yet. */
  bars?: boolean;
  className?: string;
}) {
  return (
    <span
      className={cx(
        "inline-flex h-(--size-control-sm) flex-none items-center gap-2 rounded-pill bg-error-bg px-3 text-body-strong whitespace-nowrap text-error",
        className,
      )}
    >
      <span className="size-2 flex-none animate-pulse-dot rounded-pill bg-current" aria-hidden="true" />
      {children}
      {bars && <LevelBars level={level} />}
      {elapsed && (
        <>
          <span className="font-num text-text" aria-hidden={elapsedLabel ? true : undefined}>
            {elapsed}
          </span>
          {elapsedLabel && <span className="sr-only">{elapsedLabel}</span>}
        </>
      )}
    </span>
  );
}
