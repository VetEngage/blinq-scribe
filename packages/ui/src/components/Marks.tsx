import { cx, toneClass, type Tone } from "../cx";
import { Icon } from "./Icon";

/**
 * The app's mark: the green logo square and the product's name (top bar, sign in). The name takes
 * `nameClassName`, so a narrow top bar can hide it and keep the square.
 */
export function BrandMark({ name, icon = "graphic_eq", nameClassName }: { name: string; icon?: string; nameClassName?: string }) {
  return (
    <>
      <span className="flex size-8 flex-none items-center justify-center rounded-tile bg-primary text-on-primary">
        <Icon name={icon} size={20} />
      </span>
      <span className={cx("text-title whitespace-nowrap", nameClassName)}>{name}</span>
    </>
  );
}

/**
 * An icon in a small tinted square that says what a row is: a letter, a document, a draft. Decorative:
 * the row's words carry the meaning, so the tone is a second cue only.
 */
export function IconTile({ icon, tone = "neutral", size = 36, className }: { icon: string; tone?: Tone; size?: 32 | 36 | 40; className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={cx("flex flex-none items-center justify-center rounded-tile", size === 32 ? "size-8" : size === 40 ? "size-10" : "size-9", toneClass[tone], className)}
    >
      <Icon name={icon} />
    </span>
  );
}
