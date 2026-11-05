import { Fragment, type ReactNode } from "react";
import { Icon, cx, formatPhonesIn } from "@blinq-scribe/ui";
import { byOwner, type FollowRow } from "../lib/followups";

const ICONS: Record<FollowRow["kind"], string> = {
  failed_text: "sms_failed",
  link: "event_busy",
  followup: "event_available",
  prescription: "medication",
  not_sent: "cloud_upload",
  pims_failed: "cloud_off",
  queued: "schedule_send",
};

/**
 * Rows with one action each, one owner's rows together under their name when they have several (a
 * household's pets). `action` gives each row its action.
 */
export function FollowRowList({ rows, action }: { rows: FollowRow[]; action: (r: FollowRow) => ReactNode }) {
  return (
    <ul className="m-0 list-none p-0">
      {byOwner(rows).map(({ row, head }) => (
        <Fragment key={row.key}>
          {head && <li className="border-t border-divider px-4 pt-3 pb-1 text-label">{head}</li>}
          <FollowRowView
            row={row}
            action={action(row)}
            owner={row.owner && rows.filter((r) => r.owner === row.owner).length > 1 ? row.owner : ""}
          />
        </Fragment>
      ))}
    </ul>
  );
}

/** One follow up: an icon, the pet's thing in Body strong (red when it failed), a Meta line, its one action. */
export function FollowRowView({ row, action, owner }: { row: FollowRow; action: ReactNode; owner?: string }) {
  return (
    <li className={cx("flex items-center gap-3 px-4 py-3", owner ? "ps-8" : "border-t border-divider")}>
      <Icon name={ICONS[row.kind]} size={20} className={row.failed ? "text-error" : "text-text-secondary"} />
      <span className="flex min-w-0 flex-1 flex-col">
        {/* Model text is clamped, so a row never hides its action. */}
        <span className={cx("line-clamp-2 text-body-strong [overflow-wrap:anywhere]", row.failed && "text-error")}>
          {formatPhonesIn(row.title)}
        </span>
        {row.meta && <span className="line-clamp-2 text-meta [overflow-wrap:anywhere]">{row.meta}</span>}
      </span>
      {action && <span className="flex flex-none items-center">{action}</span>}
    </li>
  );
}
