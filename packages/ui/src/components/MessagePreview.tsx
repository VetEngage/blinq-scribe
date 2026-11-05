import type { ReactNode } from "react";
import { cx } from "../cx";
import { Icon } from "./Icon";

/**
 * What a message to the owner will say (or said), in a dashed box: a quiet label with its icon, then
 * the text as written. Other content (a letter's To and Subject) goes in as children.
 */
export function MessagePreview({
  icon = "sms",
  label,
  text,
  children,
  role,
  className,
}: {
  icon?: string;
  label?: ReactNode;
  /** The message itself; its line breaks are kept. */
  text?: string;
  children?: ReactNode;
  role?: "status";
  className?: string;
}) {
  return (
    <div role={role} className={cx("flex flex-col gap-1 rounded-tile border border-dashed border-border px-3 py-2 text-body", className)}>
      {label && (
        <span className="inline-flex items-center gap-1 text-meta">
          <Icon name={icon} />
          {label}
        </span>
      )}
      {text !== undefined && <p className="m-0 whitespace-pre-wrap text-text [overflow-wrap:anywhere]">{text}</p>}
      {children}
    </div>
  );
}
