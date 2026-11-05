import type { ComponentProps, ReactNode } from "react";
import { cx } from "../cx";
import { Icon } from "./Icon";

/** The top of a screen: a Meta line over the page's one Display heading, and a Meta line under it. */
export function PageHeader({ eyebrow, title, sub, actions, children }: { eyebrow?: ReactNode; title: ReactNode; sub?: ReactNode; actions?: ReactNode; children?: ReactNode }) {
  const head = (
    <div className="flex min-w-0 flex-col gap-1">
      {eyebrow && <span className="text-meta">{eyebrow}</span>}
      <h1 className="text-display">{title}</h1>
      {sub && <span className="text-meta">{sub}</span>}
      {children}
    </div>
  );
  if (!actions) return head;
  return (
    <div className="flex flex-wrap items-end justify-between gap-3">
      {head}
      <div className="flex flex-wrap items-center gap-2">{actions}</div>
    </div>
  );
}

/** A heading inside a card with its actions on the right. */
export function SectionHeader({ title, sub, actions, as: Tag = "h2", id }: { title: ReactNode; sub?: ReactNode; actions?: ReactNode; as?: "h2" | "h3" | "span"; id?: string }) {
  const El = Tag as "h2";
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div className="flex min-w-0 flex-col">
        <El id={id} className="text-title">
          {title}
        </El>
        {sub && <span className="text-meta">{sub}</span>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

/** Nothing to show yet: an icon and one plain sentence. */
export function EmptyState({ icon = "pets", size = "md", children }: { icon?: string; size?: "sm" | "md"; children: ReactNode }) {
  return (
    <div className={cx("flex flex-col items-center justify-center gap-2 text-center text-text-secondary", size === "sm" ? "p-4" : "px-4 py-16")}>
      <Icon name={icon} size={32} className="text-text-disabled" />
      <span>{children}</span>
    </div>
  );
}

/** Label and value pairs in two columns. `align="right"` puts values on the right edge. */
export function KeyValueList({ align = "left", className, ...rest }: ComponentProps<"div"> & { align?: "left" | "right" }) {
  return <div className={cx("grid grid-cols-[minmax(96px,140px)_minmax(0,1fr)]", align === "right" && "[&>.kv-v]:text-right", className)} {...rest} />;
}

/** One row of a KeyValueList. `num` sets a numeral value as a Number. Rows a record may not have use `hideEmpty`; the rest show `emptyText`. */
export function KeyValueRow({ label, value, num, hideEmpty, emptyText = "None" }: { label: ReactNode; value?: ReactNode; num?: boolean; hideEmpty?: boolean; emptyText?: string }) {
  const empty = value === undefined || value === null || value === "";
  if (empty && hideEmpty) return null;
  return (
    <>
      <span className="border-t border-divider py-2 text-meta">{label}</span>
      <span className={cx("kv-v border-t border-divider py-2 pl-3 text-body", num && "font-num")}>{empty ? emptyText : value}</span>
    </>
  );
}

/**
 * A row in a list (to do, schedule, what's due, follow ups, search results): an optional lead, a Body
 * strong title, a Meta line, any extra lines, then an action or a chevron. Rows are 12 apart with a
 * divider. `lead` is an icon name, or `{ time }` for a time of day as a Number. With `onClick` the
 * whole row is one button (it opens something), with a hover and a chevron; it then takes no `action`.
 */
export function ListRow({
  lead,
  leadClassName,
  fill,
  title,
  meta,
  children,
  action,
  chevron,
  tone,
  onClick,
  current,
  hint,
  className,
  ...aria
}: {
  lead?: string | { time: ReactNode };
  leadClassName?: string;
  /** Filled icon: for status icons. */
  fill?: boolean;
  title: ReactNode;
  meta?: ReactNode;
  /** Extra lines under the Meta line. */
  children?: ReactNode;
  action?: ReactNode;
  /** The row opens something. On by default for a row with `onClick`. */
  chevron?: boolean;
  /** "error": the lead and title turn red (a failed item). */
  tone?: "error";
  /** The whole row is a button. */
  onClick?: () => void;
  /** A pressable row that is the one open now (the visit on screen): a quiet fill and a bar. */
  current?: boolean;
  /** The whole sentence on hover, for a pressable row whose title is cut short. */
  hint?: string;
  className?: string;
  "aria-label"?: string;
}) {
  const err = tone === "error";
  const body = (
    <>
      {typeof lead === "string" ? (
        <Icon name={lead} size={20} fill={fill} className={cx("text-text-secondary", err && "text-error", leadClassName)} />
      ) : (
        lead && <span className={cx("w-18 flex-none text-right text-body font-num whitespace-nowrap", leadClassName)}>{lead.time}</span>
      )}
      <span className="flex min-w-0 flex-auto flex-col">
        <span className={cx("line-clamp-2 text-body-strong [overflow-wrap:anywhere]", err && "text-error")}>{title}</span>
        {meta && <span className="line-clamp-3 text-meta [overflow-wrap:anywhere]">{meta}</span>}
        {children}
      </span>
      {!onClick && action && <span className="flex flex-none items-center self-center">{action}</span>}
      {(chevron ?? !!onClick) && <Icon name="chevron_right" size={20} className="self-center text-text-tertiary" />}
    </>
  );
  const row = "flex items-start gap-3 border-t border-divider py-3";
  if (!onClick) return <div className={cx(row, className)}>{body}</div>;
  return (
    <button
      type="button"
      onClick={onClick}
      title={hint}
      aria-current={current ? "true" : undefined}
      className={cx(
        "pressable w-full text-text hover:bg-page focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-primary",
        row,
        current && "bg-surface-muted shadow-[inset_3px_0_0_var(--color-text-secondary)] hover:bg-surface-muted",
        className,
      )}
      {...aria}
    >
      {body}
    </button>
  );
}

/** Initials, or an icon, in a round green disc. */
export function Avatar({ initials, icon, size = 30, label }: { initials?: string; icon?: string; size?: number; label?: string }) {
  return (
    <span
      className="flex flex-none items-center justify-center rounded-pill bg-surface-muted text-meta"
      style={{ width: size, height: size }}
      role={label ? "img" : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
    >
      {icon ? <Icon name={icon} /> : initials}
    </span>
  );
}

/** A small label over a value that isn't a form control (Last time you said, Medications). */
export function LabeledValue({ label, aside, children, id, className }: { label: ReactNode; aside?: ReactNode; children: ReactNode; id?: string; className?: string }) {
  return (
    <div className={cx("flex min-w-0 flex-col gap-1", className)}>
      <div className="flex items-center justify-between gap-3">
        <span id={id} className="text-meta">
          {label}
        </span>
        {aside}
      </div>
      {children}
    </div>
  );
}
