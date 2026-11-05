import type { ReactNode } from "react";
import { cx, toneClass, type Tone } from "../cx";
import { Icon } from "./Icon";

interface StatusProps {
  tone?: Tone;
  icon?: string;
  /** Filled icon: for status icons. */
  fill?: boolean;
  className?: string;
  /** The full text on hover, when the label is shortened. */
  title?: string;
  children: ReactNode;
}

/**
 * A small rectangular label on a row: a status, an alert, a count of something. `variant="fact"` is a
 * plain fact (Canine, 6 years, 72 lb): grey fill, thin border, dark text, so colored tags stay for status.
 */
export function Tag({ tone = "neutral", variant = "status", icon, fill, className, title, children }: StatusProps & { variant?: "status" | "fact" }) {
  if (variant === "fact")
    return (
      <span title={title} className={cx("inline-flex min-h-7 items-center gap-1 rounded-control border border-border bg-surface-muted px-2 text-meta text-text", className)}>
        {icon && <Icon name={icon} size={14} />}
        {children}
      </span>
    );
  return (
    <span title={title} className={cx("inline-flex min-h-6 items-center gap-1 rounded-control px-2 text-meta", toneClass[tone], className)}>
      {icon && <Icon name={icon} fill={fill} size={14} />}
      {children}
    </span>
  );
}

/** A rounded status in a header or the top bar (Recording, Signed, Mock AI). `dot` for a live dot. */
export function Pill({ tone = "neutral", icon, fill, dot, className, children }: StatusProps & { dot?: "static" | "pulse" }) {
  return (
    <span className={cx("inline-flex h-7 flex-none items-center gap-1 rounded-pill px-3 text-meta whitespace-nowrap", toneClass[tone], className)}>
      {dot && <span className={cx("size-2 rounded-pill bg-current", dot === "pulse" && "animate-pulse-dot")} aria-hidden="true" />}
      {icon && <Icon name={icon} fill={fill} size={16} />}
      {children}
    </span>
  );
}

/** A count beside a title (To do 5), as a Meta Number. Neutral: the rows under it say what needs attention. */
export function Badge({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <span className={cx("inline-flex h-6 min-w-6 items-center justify-center rounded-control bg-divider px-2 text-meta font-num", className)}>
      {children}
    </span>
  );
}

/** Marks simulated data in demo mode ("Demo", "Mock AI", "Demo data"). */
export function DemoTag({ children = "Demo" }: { children?: ReactNode }) {
  return <Tag>{children}</Tag>;
}

/** The violet label on anything Blinq wrote: a Meta line in purple. */
export function AiLabel({
  children,
  icon = "auto_awesome",
  size = "md",
  className,
}: {
  children: ReactNode;
  icon?: string;
  /** "sm" in tight places (a chat bubble, under a photo): a smaller icon. */
  size?: "sm" | "md";
  className?: string;
}) {
  return (
    <div className={cx("flex items-center gap-1 text-meta text-ai", className)}>
      <Icon name={icon} size={size === "sm" ? 16 : undefined} />
      {children}
    </div>
  );
}
