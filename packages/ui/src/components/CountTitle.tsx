import type { ReactNode } from "react";
import { cx } from "../cx";

/** A Title with a count beside it as a Meta Number (Pets 5). */
export function CountTitle({ children, count, as: Tag = "h2", className }: { children: ReactNode; count?: number; as?: "h2" | "h3"; className?: string }) {
  const El = Tag as "h2";
  return (
    <El className={cx("text-title", className)}>
      {children}
      {count !== undefined && (
        <>
          {" "}
          <span className="text-meta font-num">{count}</span>
        </>
      )}
    </El>
  );
}
