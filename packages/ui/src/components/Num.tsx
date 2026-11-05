import { Fragment, type ReactNode } from "react";
import { cx } from "../cx";

/**
 * A Number: a time of day, money, a measurement, a lab value, an ID, a phone number, a timer. Poppins
 * with tabular figures, at the size and weight of its line, and it never breaks across lines ("10:00 AM"
 * stays whole). The rail's time column too: nothing is mono.
 */
export function Num({ children, className }: { children?: ReactNode; className?: string }) {
  return <span className={cx("font-num whitespace-nowrap", className)}>{children}</span>;
}

/**
 * One Meta line of facts joined with " · " (Golden Retriever · male, neutered · 6 years · 72 lb).
 * Empty parts are skipped; a part can be a `Num`. Each fact stays whole: the line breaks only between them.
 */
export function FactsLine({ items, className }: { items: ReactNode[]; className?: string }) {
  const parts = items.filter((i) => i !== undefined && i !== null && i !== false && i !== "");
  if (!parts.length) return null;
  return (
    <p className={cx("m-0 text-meta", className)}>
      {parts.map((p, i) => (
        <Fragment key={i}>
          {i > 0 && " · "}
          <span className="whitespace-nowrap">{p}</span>
        </Fragment>
      ))}
    </p>
  );
}
