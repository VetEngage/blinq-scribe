import { Fragment, useId, useState, type ReactNode } from "react";
import { cx } from "../cx";
import { Pressable } from "./Button";
import { Icon } from "./Icon";

/** One column. `num` right-aligns it with tabular figures (money, counts); `className` goes on its header and cells (`max-md:hidden`). */
export type TableColumn<R> = {
  key: string;
  header: ReactNode;
  cell: (row: R) => ReactNode;
  num?: boolean;
  nowrap?: boolean;
  className?: string;
};

/** A child row under an expanded row: its cells by column key, so they sit in the same columns. */
export type TableChild = { key: string; cells: Partial<Record<string, ReactNode>> };

export type DataTableProps<R> = {
  columns: TableColumn<R>[];
  rows: R[];
  rowKey: (row: R) => string;
  /** Rows that open: `column` holds the toggle; `children` sit in the same columns; `note` is a quiet line under them, from that column on. */
  expand?: { column: string; children: (row: R) => TableChild[]; note?: (row: R) => ReactNode };
  "aria-label"?: string;
  className?: string;
};

/**
 * The one table: a Label header, compact zebra rows, numbers right-aligned and tabular, and rows that
 * open into child rows in the same columns (an invoice's line items under its total). Scrolls sideways
 * inside its own box on a phone, never the page.
 */
export function DataTable<R>({ columns, rows, rowKey, expand, className, ...rest }: DataTableProps<R>) {
  const uid = useId();
  const [open, setOpen] = useState<Set<string>>(new Set());
  const toggle = (k: string) =>
    setOpen((s) => {
      const n = new Set(s);
      if (n.has(k)) n.delete(k);
      else n.add(k);
      return n;
    });
  const cellClass = (c: TableColumn<R>) => cx("px-3", c.num && "text-right font-num", (c.num || c.nowrap) && "whitespace-nowrap", c.className);
  const at = expand ? Math.max(0, columns.findIndex((c) => c.key === expand.column)) : 0;
  return (
    <div className={cx("min-w-0 max-w-full overflow-x-auto", className)}>
      <table className="w-full border-collapse text-body" {...rest}>
        <thead>
          <tr className="border-b border-border">
            {columns.map((c) => (
              <th key={c.key} scope="col" className={cx("py-2 text-left align-bottom text-label", cellClass(c))}>
                {c.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => {
            const k = rowKey(row);
            const shown = !!expand && open.has(k);
            const kids = shown ? expand.children(row) : [];
            const note = shown && expand.note ? expand.note(row) : null;
            const ids = [...kids.map((x) => `${uid}-${k}-${x.key}`), ...(note ? [`${uid}-${k}-note`] : [])];
            const stripe = i % 2 === 1 && "bg-surface-muted";
            return (
              <Fragment key={k}>
                <tr className={cx(stripe)}>
                  {columns.map((c) => (
                    <td key={c.key} className={cx("py-2 align-top", cellClass(c))}>
                      {expand && c.key === expand.column ? (
                        <Pressable
                          className="inline-flex items-center gap-1 text-left"
                          aria-expanded={shown}
                          aria-controls={shown && ids.length ? ids.join(" ") : undefined}
                          onClick={() => toggle(k)}
                        >
                          {c.cell(row)}
                          <Icon name={shown ? "expand_less" : "expand_more"} size={18} className="text-text-secondary" />
                        </Pressable>
                      ) : (
                        c.cell(row)
                      )}
                    </td>
                  ))}
                </tr>
                {kids.map((x) => (
                  <tr key={x.key} id={`${uid}-${k}-${x.key}`} className={cx("text-meta", stripe)}>
                    {columns.map((c) => (
                      <td key={c.key} className={cx("py-1 align-top", cellClass(c))}>
                        {x.cells[c.key]}
                      </td>
                    ))}
                  </tr>
                ))}
                {note ? (
                  <tr id={`${uid}-${k}-note`} className={cx("text-meta", stripe)}>
                    {columns.slice(0, at).map((c) => (
                      <td key={c.key} className={cellClass(c)} />
                    ))}
                    <td colSpan={columns.length - at} className="px-3 pb-2 pt-1">
                      {note}
                    </td>
                  </tr>
                ) : null}
              </Fragment>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
