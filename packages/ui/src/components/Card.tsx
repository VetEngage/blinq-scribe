import type { ComponentProps, HTMLAttributes, ReactNode, Ref } from "react";
import { cx } from "../cx";

export interface CardProps extends HTMLAttributes<HTMLElement> {
  ref?: Ref<HTMLElement>;
  /** For `as="form"`. */
  noValidate?: boolean;
  /** For `as="details"`. */
  open?: boolean;
  /** "floating" for panels over the page (chat, search): a stronger shadow. */
  variant?: "default" | "floating";
  /**
   * "compact" for cards inside cards (a follow up, a pet), "list" for a title over rows that bring
   * their own spacing, "flush" when rows run edge to edge.
   */
  density?: "default" | "compact" | "list" | "flush";
  /** A thicker green border: this one is the current one (the pet in this visit). */
  highlighted?: boolean;
  as?: "div" | "section" | "article" | "form" | "details";
}

// 16 padding and 16 from the head to the body; a card inside a card is tighter.
const densities = {
  default: "gap-4 rounded-card p-4",
  compact: "gap-2 rounded-tile p-3",
  list: "gap-1 rounded-card p-4",
  flush: "gap-0 overflow-hidden rounded-card p-0",
};

/** Every card has the same surface, border and shadow. */
function CardRoot({ variant = "default", density = "default", highlighted, as: Tag = "div", className, ...rest }: CardProps) {
  // One element type for the compiler; the real tag comes from `as`.
  const El = Tag as unknown as "section";
  return (
    <El
      className={cx(
        "flex min-w-0 flex-col border bg-surface",
        densities[density],
        variant === "floating" ? "shadow-pop" : "shadow-card",
        highlighted ? "border-2 border-primary" : "border-border",
        className,
      )}
      {...rest}
    />
  );
}

function CardHeader({ className, ...rest }: ComponentProps<"div">) {
  return <div className={cx("flex flex-wrap items-center justify-between gap-3", className)} {...rest} />;
}

function CardTitle({ as: Tag = "h2", className, ...rest }: ComponentProps<"h2"> & { as?: "h2" | "h3" | "span" }) {
  const El = Tag as "h2";
  return <El className={cx("text-title", className)} {...rest} />;
}

function CardBody({ className, ...rest }: ComponentProps<"div">) {
  return <div className={cx("flex flex-col gap-3", className)} {...rest} />;
}

/**
 * A titled part of a card body: a Section heading 8 above its content. Sections sit 24 apart; put them
 * in a `Card.Body` with `gap-6`, or any column with that gap.
 */
function CardSection({ title, className, children, ...rest }: Omit<ComponentProps<"section">, "title"> & { title: ReactNode }) {
  return (
    <section className={cx("flex min-w-0 flex-col gap-2", className)} {...rest}>
      <h3 className="text-section">{title}</h3>
      {children}
    </section>
  );
}

function CardFooter({ className, divided, ...rest }: ComponentProps<"div"> & { divided?: boolean }) {
  return <div className={cx("flex flex-wrap items-center gap-2", divided && "border-t border-divider pt-3", className)} {...rest} />;
}

export const Card = Object.assign(CardRoot, { Header: CardHeader, Title: CardTitle, Body: CardBody, Section: CardSection, Footer: CardFooter });

/**
 * A label and a value in a small box (vitals, totals): a Meta label over a Body value as a Number.
 * `ai` marks a value Blinq wants confirmed. A value is never larger than its line.
 */
export function Tile({
  label,
  value,
  tone = "default",
  grow = false,
  className,
}: {
  label: ReactNode;
  value: ReactNode;
  tone?: "default" | "ai";
  /** Grows to share a row. */
  grow?: boolean;
  className?: string;
}) {
  return (
    <div
      className={cx(
        "flex min-w-0 flex-col rounded-tile border px-3 py-2",
        tone === "ai" ? "border-ai-bg bg-ai-bg" : "border-divider bg-page",
        grow && "flex-[1_1_140px]",
        className,
      )}
    >
      <span className="text-meta">{label}</span>
      <span className={cx("text-body font-num", tone === "ai" && "text-ai")}>{value}</span>
    </div>
  );
}

export function TileRow({ className, ...rest }: ComponentProps<"div">) {
  return <div className={cx("flex flex-wrap gap-2", className)} {...rest} />;
}
