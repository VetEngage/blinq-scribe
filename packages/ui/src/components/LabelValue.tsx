import type { ReactNode } from "react";
import { cx } from "../cx";

/**
 * Facts as label/value rows: a Meta label above a Body value, two or three to a row, 12 between rows
 * and 16 between columns. The one way to show a fact (a pet's Patient ID, the owner's phone and email).
 */
export function LabelValueGrid({ cols = 2, className, children, ...rest }: { cols?: 2 | 3; className?: string; children: ReactNode; "aria-label"?: string; "aria-labelledby"?: string }) {
  return (
    <dl className={cx("m-0 grid grid-cols-2 gap-x-4 gap-y-3", cols === 3 && "md:grid-cols-3", className)} {...rest}>
      {children}
    </dl>
  );
}

/**
 * One fact. `num` sets a numeral value (an ID, a phone number, money) as a Number. Facts a record may
 * not have leave `hideEmpty` on and are skipped; the rest show "None". `span` takes the whole row.
 */
export function LabelValue({ label, value, num, hideEmpty = true, span }: { label: ReactNode; value?: ReactNode; num?: boolean; hideEmpty?: boolean; span?: boolean }) {
  const empty = value === undefined || value === null || value === "";
  if (empty && hideEmpty) return null;
  return (
    <div className={cx("flex min-w-0 flex-col", span && "col-span-full")}>
      <dt className="text-meta">{label}</dt>
      <dd className={cx("m-0 min-w-0 text-body [overflow-wrap:anywhere]", num && !empty && "font-num")}>{empty ? "None" : value}</dd>
    </div>
  );
}
