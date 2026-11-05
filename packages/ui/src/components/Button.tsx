import type { ComponentProps, ReactNode } from "react";
import { cx } from "../cx";
import { Icon } from "./Icon";
import { Spinner } from "./Spinner";

export type ButtonVariant = "primary" | "secondary" | "ghost" | "link" | "danger" | "danger-outline" | "danger-ghost";
export type ButtonSize = "sm" | "md" | "lg";

const base =
  "inline-flex flex-none cursor-pointer items-center justify-center gap-2 whitespace-nowrap rounded-control border font-sans text-body-strong no-underline " +
  "disabled:cursor-default aria-disabled:cursor-default";

const variants: Record<ButtonVariant, string> = {
  primary:
    "border-primary bg-primary text-on-primary hover:border-primary-hover hover:bg-primary-hover " +
    "disabled:border-divider disabled:bg-divider disabled:text-text-disabled aria-disabled:border-divider aria-disabled:bg-divider aria-disabled:text-text-disabled",
  secondary:
    "border-border bg-surface text-text hover:border-border-strong " +
    "disabled:border-divider disabled:bg-divider disabled:text-text-disabled aria-disabled:border-divider aria-disabled:bg-divider aria-disabled:text-text-disabled",
  ghost: "border-transparent bg-transparent text-text-secondary hover:text-text disabled:text-text-disabled",
  link: "border-transparent bg-transparent text-text underline-offset-2 hover:underline disabled:text-text-disabled",
  danger:
    "border-error bg-error text-on-primary hover:brightness-95 disabled:border-divider disabled:bg-divider disabled:text-text-disabled",
  "danger-outline": "border-error bg-surface text-error",
  /** A quiet destructive action next to the main one (Delete in a footer). */
  "danger-ghost": "border-transparent bg-transparent text-error hover:bg-error-bg disabled:text-text-disabled",
};

const sizes: Record<ButtonSize, string> = {
  sm: "h-(--size-control-sm) px-3",
  md: "h-(--size-control) px-4",
  lg: "h-(--size-control-lg) px-4",
};
const iconOnly: Record<ButtonSize, string> = {
  sm: "size-(--size-control-sm) px-0",
  md: "size-(--size-control) px-0",
  lg: "size-(--size-control-lg) px-0",
};

/** The classes of a button, for something that only looks like one (the face of a file picker). */
export const buttonClasses = (variant: ButtonVariant = "secondary", size: ButtonSize = "md"): string =>
  cx(base, variants[variant], variant === "link" ? "h-7 px-1" : sizes[size]);

export interface ButtonProps extends Omit<ComponentProps<"button">, "children"> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  /** A Material Symbols name shown before the label: what the action does (send, print, sign). */
  icon?: string;
  /** A Material Symbols name shown after the label: where it goes (chevron_right, arrow_forward, expand_more). */
  iconEnd?: string;
  /** Classes for both icons, for a color only; every button icon is the one default size. */
  iconClassName?: string;
  /** Shows a spinner and disables the button while work is on its way. */
  loading?: boolean;
  fullWidth?: boolean;
  children?: ReactNode;
}

export function Button({
  variant = "secondary",
  size = "md",
  icon,
  iconEnd,
  iconClassName,
  loading = false,
  fullWidth = false,
  className,
  type = "button",
  disabled,
  children,
  ...rest
}: ButtonProps) {
  return (
    <button
      type={type}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={cx(buttonClasses(variant, size), fullWidth && "w-full", className)}
      {...rest}
    >
      {loading ? <Spinner /> : icon && <Icon name={icon} className={iconClassName} />}
      {children}
      {iconEnd && <Icon name={iconEnd} className={iconClassName} />}
    </button>
  );
}

export interface IconButtonProps extends Omit<ButtonProps, "children" | "icon" | "iconEnd" | "fullWidth"> {
  icon: string;
  /** Required: an icon alone says nothing to a screen reader. */
  "aria-label": string;
}

/** A button that is only an icon. Its aria-label is required by its types. */
export function IconButton({ variant = "secondary", size = "md", icon, className, ...rest }: IconButtonProps) {
  return <Button variant={variant} size={size} icon={icon} className={cx(iconOnly[size], variant === "link" && "h-auto", className)} {...rest} />;
}

export interface ToolButtonProps extends Omit<ComponentProps<"button">, "children"> {
  icon?: string;
  /** AI tools are tinted, like everything Blinq writes. */
  tone?: "default" | "ai";
  /** A toggle (Dictate, Crop): on shows the selected look. */
  pressed?: boolean;
  /** The pressed look for a tool that's recording (red) rather than selected (green). */
  pressedTone?: "selected" | "recording";
  children: ReactNode;
}

/** A small rounded tool in a toolbar (note editor, photo tools). */
export function ToolButton({ icon, tone = "default", pressed, pressedTone = "selected", className, type = "button", children, ...rest }: ToolButtonProps) {
  return (
    <button
      type={type}
      aria-pressed={pressed}
      className={cx(
        "inline-flex h-8 cursor-pointer items-center gap-1 rounded-pill border px-3 font-sans text-body-strong",
        tone === "ai" ? "border-ai-bg bg-ai-bg text-ai" : "border-border bg-surface text-text",
        pressed && (pressedTone === "recording" ? "border-error text-error" : "border-text bg-surface-muted text-text"),
        className,
      )}
      {...rest}
    >
      {icon && <Icon name={icon} />}
      {children}
    </button>
  );
}

/**
 * A bare button for rows and tiles that look like content (a schedule row, a day, a thumbnail):
 * keyboard and focus ring for free, the look comes from the caller.
 */
export function Pressable({ className, type = "button", ...rest }: ComponentProps<"button">) {
  return (
    <button
      type={type}
      // .pressable lives in the components layer, so the caller's own classes can restyle it fully.
      className={cx("pressable", className)}
      {...rest}
    />
  );
}
