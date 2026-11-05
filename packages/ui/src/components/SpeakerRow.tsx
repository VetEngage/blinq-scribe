import type { ReactNode } from "react";
import { cx } from "../cx";
import { Icon } from "./Icon";
import { Avatar } from "./Layout";

/** A transcript, one SpeakerRow per line. `live`: new lines are announced as they arrive. */
export function SpeakerList({ label, live, className, children }: { label: string; live?: boolean; className?: string; children: ReactNode }) {
  return (
    <ol aria-label={label} aria-live={live ? "polite" : undefined} className={cx("m-0 flex list-none flex-col gap-3 p-0", className)}>
      {children}
    </ol>
  );
}

/**
 * One line of a transcript with who said it: their initials (a dashed outline while nobody knows who
 * it is), then a Meta line: name · role, the time into the visit as a Number, and an optional action
 * (Who is this?, Change).
 * `writing`: the line is still coming in, so it ends in a blinking caret.
 */
export function SpeakerRow({
  id,
  initials,
  name,
  role,
  time,
  action,
  writing,
  after,
  children,
}: {
  /** The row's id, so a source link can scroll to its line. */
  id?: string;
  /** Leave out for someone not yet named: the avatar shows a dashed outline. */
  initials?: string;
  name?: ReactNode;
  role?: ReactNode;
  /** Time into the visit, "1:02". */
  time?: string;
  action?: ReactNode;
  writing?: boolean;
  /** Under the words: the choices for Who is this?, for one. */
  after?: ReactNode;
  children: ReactNode;
}) {
  return (
    <li id={id} tabIndex={id ? -1 : undefined} className="flex scroll-mt-24 items-start gap-3 rounded-control outline-none">
      {initials ? (
        <Avatar initials={initials} size={28} />
      ) : (
        <span className="flex size-7 flex-none items-center justify-center rounded-pill border border-dashed border-border-strong text-text-secondary" aria-hidden="true">
          <Icon name="person" />
        </span>
      )}
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <div className="flex flex-wrap items-baseline gap-x-2 text-meta">
          {name && (
            <span>
              <span className="text-text">{name}</span>
              {role && <> · {role}</>}
            </span>
          )}
          {time && <span className="font-num">{time}</span>}
          {action}
        </div>
        <div className="[overflow-wrap:anywhere]">
          {children}
          {writing && <span className="ml-px inline-block h-[1.1em] w-0.5 animate-blink bg-text align-text-bottom" aria-hidden="true" />}
        </div>
        {after}
      </div>
    </li>
  );
}
