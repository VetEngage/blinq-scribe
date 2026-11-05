import { t } from "../i18n";
import type { Segment } from "../api/types";

/** "Dr. Ana Rivera · Provider", "Speaker 3", "Tech"; "" when Blinq isn't sure who said it. */
export function speakerLabel(s: Pick<Segment, "speaker_name" | "role">): string {
  const role = s.role === "unknown" ? "" : t(`speakers.roles.${s.role}`);
  return [s.speaker_name, s.speaker_name && s.speaker_name !== role ? role : ""].filter(Boolean).join(" · ") || role;
}

/** Who said a transcript line (from 1), from the visit's labels. */
export function speakerOfLine(segments: Segment[] | undefined, line: number): string {
  const s = segments?.find((x) => x.line === line);
  return s ? speakerLabel(s) : "";
}

/** A transcript row's id, for a source link to scroll to: `line-6`. */
export const lineId = (line: number): string => `line-${line}`;
