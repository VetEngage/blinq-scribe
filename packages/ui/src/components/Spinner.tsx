import { cx } from "../cx";

/** A turning ring for work in progress. Pass `label` when nothing else on screen says what's loading. */
export function Spinner({ label, className }: { label?: string; className?: string }) {
  return (
    <span className={cx("inline-flex items-center", className)} role={label ? "status" : undefined}>
      <span
        className="size-[18px] flex-none animate-spin rounded-pill border-2 border-selected border-t-primary"
        aria-hidden="true"
      />
      {label && <span className="sr-only">{label}</span>}
    </span>
  );
}

/** A grey bar standing in for text that's still on its way. Decorative. */
export function Skeleton({ className }: { className?: string }) {
  return (
    <div
      aria-hidden="true"
      data-skeleton=""
      className={cx(
        "h-3 animate-shimmer rounded-control bg-divider bg-size-[200px_100%] bg-no-repeat",
        "bg-[linear-gradient(90deg,var(--color-divider)_0,#f8f8f8_40px,var(--color-divider)_80px)]",
        className,
      )}
    />
  );
}

/** Three bouncing dots: someone (Blinq) is typing. Decorative. */
export function TypingDots() {
  return (
    <span className="inline-flex h-4 items-center gap-1" aria-hidden="true">
      {[0, 150, 300].map((d) => (
        <i key={d} className="block size-1.5 animate-bounce-dot rounded-pill bg-ai" style={{ animationDelay: `${d}ms` }} />
      ))}
    </span>
  );
}
