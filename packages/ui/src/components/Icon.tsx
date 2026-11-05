import { cx } from "../cx";

export interface IconProps {
  /** A Material Symbols name, like "check" or "auto_awesome". */
  name: string;
  /** Filled glyph: status icons only. */
  fill?: boolean;
  /** Pixel size; 18 by default. */
  size?: number;
  className?: string;
}

/** A decorative icon. The words next to it (or an aria-label on its button) carry the meaning. */
export function Icon({ name, fill = false, size, className }: IconProps) {
  return (
    <span
      className={cx("ms", fill && "fill", className)}
      data-icon={name}
      aria-hidden="true"
      // The glyph's size, not type: an icon font is sized by font-size.
      // eslint-disable-next-line blinq/type-roles
      style={size ? { fontSize: size } : undefined}
    />
  );
}
