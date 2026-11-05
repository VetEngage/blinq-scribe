import { Fragment, type ReactNode } from "react";
import { cx } from "../cx";
import { Icon } from "./Icon";

export interface Step {
  key: string;
  label: string;
  /** Done (checked), the current one (emphasized) or still to come. */
  state: "done" | "current" | "todo";
  /** A short fact after the label: the recorded length on Record ("0:42"). */
  meta?: ReactNode;
}

/**
 * Where a visit stands: Record > Draft > Sign > Share > Follow up, one thin line. Done steps are
 * checked, the current one is in ink and bold, the rest are gray. A list, so a screen reader hears
 * "step 2 of 5, current".
 */
export function StepBar({ steps, label, className }: { steps: Step[]; label: string; className?: string }) {
  return (
    <ol aria-label={label} className={cx("m-0 flex min-w-0 list-none flex-wrap items-center gap-x-4 gap-y-2 p-0", className)}>
      {steps.map((s, i) => (
        <Fragment key={s.key}>
          {i > 0 && (
            <li aria-hidden="true" className={cx("h-0.5 min-w-6 flex-1 rounded-pill", s.state === "todo" ? "bg-border" : "bg-primary")} />
          )}
          <li
            aria-current={s.state === "current" ? "step" : undefined}
            className={cx(
              "flex flex-none items-center gap-2 whitespace-nowrap",
              s.state === "current" ? "text-body-strong text-text" : s.state === "done" ? "text-meta text-text" : "text-meta text-text-secondary",
            )}
          >
            {s.state === "done" ? (
              <Icon name="check_circle" fill size={18} className="text-primary" />
            ) : (
              <span
                aria-hidden="true"
                className={cx(
                  "inline-flex size-5 items-center justify-center rounded-pill border text-label font-num",
                  s.state === "current" ? "border-text text-text" : "border-border text-text-secondary",
                )}
              >
                {i + 1}
              </span>
            )}
            <span>{s.label}</span>
            {s.meta && <span className="font-num text-text-secondary">{s.meta}</span>}
            <span className="sr-only">{s.state === "done" ? ", done" : s.state === "current" ? ", current" : ""}</span>
          </li>
        </Fragment>
      ))}
    </ol>
  );
}

/**
 * Where a drafted line came from: a small time chip at the end of the line ("0:27"). Pressing it goes
 * to that moment in the transcript. Purple, since it belongs to what Blinq wrote. It carries the
 * `source-chip` class, so a page can keep the chips out of sight until the provider points at a line.
 */
export function SourceChip({
  children,
  label,
  title,
  onClick,
  className,
}: {
  /** The time in the recording, "0:27", or a line number when there is no time. */
  children: ReactNode;
  /** What a screen reader hears: "0:27, Dr. Ana Rivera, go to this line in the transcript". */
  label: string;
  /** The transcript line itself, on hover. */
  title?: string;
  onClick: () => void;
  className?: string;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={title}
      onClick={onClick}
      className={cx(
        "source-chip inline-flex h-6 flex-none cursor-pointer items-center rounded-control bg-ai-bg px-2 align-middle text-meta font-num text-ai hover:text-ai-strong focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ai",
        className,
      )}
    >
      {children}
    </button>
  );
}

/**
 * Something Blinq wants confirmed, where it is in the note: "Confirm: name and dose", in purple on a
 * light purple ground, never the raw "[confirm: ...]" text. The same chip in the read view and in the
 * editor, where it takes no extra space, so text around it never moves.
 */
export function ConfirmMark({ children, className, ...rest }: { children: ReactNode; className?: string } & React.HTMLAttributes<HTMLElement>) {
  return (
    <mark
      data-confirm=""
      className={cx("rounded-control bg-ai-bg text-ai shadow-[0_0_0_2px_var(--color-ai-bg)] outline-ai focus:outline-2 focus:outline-offset-2", className)}
      {...rest}
    >
      {children}
    </mark>
  );
}
