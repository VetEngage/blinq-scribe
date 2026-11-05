import { cx } from "../cx";

/** The caution dot: amber with a thin ring, the same everywhere a caution shows. */
export const CAUTION_DOT =
  "size-2.5 flex-none rounded-pill bg-caution shadow-[inset_0_0_0_1px_var(--color-caution-ring)]";

/** One clinical caution: its full text, and a short label for tight rows ("Towel wrap"). */
export interface CautionItem {
  text: string;
  short?: string;
}

/** "Kidney values trending up" mid-sentence is "kidney values trending up"; "ALT high" stays. */
const midSentence = (text: string): string =>
  /^[A-Z][a-z]/.test(text) ? text.charAt(0).toLowerCase() + text.slice(1) : text;

/** "a", "a and b", "a, b and c". */
const joined = (words: string[]): string =>
  words.length < 2 ? (words[0] ?? "") : `${words.slice(0, -1).join(", ")} and ${words[words.length - 1]}`;

/**
 * A pet's clinical cautions (fractious, kidney values trending up): one small amber dot and one line of
 * plain text that says them all, "Fractious, use towel wrap and kidney values trending up", never a
 * filled chip, a warning triangle or a dot per caution. Amber means this and nothing else.
 *
 * It takes the role of the line it sits in (`size`): Meta in a schedule row, Body in a pet's Overview,
 * in ink either way. In the rail it is its own amber line under the reason, wrapping to at most two
 * lines. `labeled` says the word first ("Caution: Fractious, use towel wrap and ..."), so a dot is never
 * left to decode. Off the rail the line truncates, with the whole of it in the tooltip.
 * `max` and `compact` are kept for callers and no longer shorten it: every caution is said in full.
 */
export function Caution({
  items,
  labeled,
  size = "meta",
  label = "Caution",
  dotless,
  className,
}: {
  items: (string | CautionItem)[];
  /** No longer used: every caution is said. */
  max?: number;
  /** No longer used: the full wording is said. */
  compact?: boolean;
  /** Say what it is first: "Caution: Fractious, use towel wrap". */
  labeled?: boolean;
  /** The role of the line it sits in. */
  size?: "meta" | "body" | "rail";
  /** What screen readers hear first, and the word `labeled` shows. */
  label?: string;
  /** The row draws the amber dot in its own column (the rail): the words only. */
  dotless?: boolean;
  className?: string;
}) {
  const list = items.map((i) => (typeof i === "string" ? { text: i } : i)).filter((i) => i.text);
  if (!list.length) return null;
  const rail = size === "rail";
  const line = joined(list.map((i, k) => (k ? midSentence(i.text) : i.text)));
  return (
    <span
      data-caution=""
      title={rail ? undefined : line}
      className={cx(
        "inline-flex min-w-0 items-baseline gap-2",
        rail ? "text-rail-caution text-warning" : cx(size === "meta" ? "text-meta" : "text-body", "text-text"),
        className,
      )}
    >
      <span className="sr-only">{`${label}: ${line}`}</span>
      {!dotless && <span aria-hidden="true" className={cx(CAUTION_DOT, "self-center")} />}
      <span aria-hidden="true" className={cx("min-w-0", rail ? "line-clamp-2" : "truncate")}>
        {labeled ? `${label}: ` : ""}
        {line}
      </span>
    </span>
  );
}
