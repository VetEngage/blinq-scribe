import type { ReactNode } from "react";
import type { Tone } from "../cx";
import { Pill } from "./Badge";

export type Status = "ok" | "demo" | "error" | "pending";

const look: Record<Status, { tone: Tone; icon: string }> = {
  ok: { tone: "neutral", icon: "check_circle" },
  demo: { tone: "neutral", icon: "science" },
  error: { tone: "error", icon: "error" },
  pending: { tone: "neutral", icon: "progress_activity" },
};

/**
 * What something runs on, in one pill with its icon: a check when all is well, a flask for a demo
 * stand-in (mock AI), both neutral, and red only when it's down. The words say which; the icon is a
 * second cue.
 */
export function StatusPill({ status, className, children }: { status: Status; className?: string; children: ReactNode }) {
  const { tone, icon } = look[status];
  return (
    <Pill tone={tone} icon={icon} className={className}>
      {children}
    </Pill>
  );
}
