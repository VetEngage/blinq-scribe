import type { ComponentProps, ReactNode } from "react";
import { Checkbox as CheckboxPrimitive, RadioGroup, Switch as SwitchPrimitive, ToggleGroup } from "radix-ui";
import { cx } from "../cx";
import { Icon } from "./Icon";

/**
 * An on and off switch. Give it a label: aria-label, aria-labelledby, or a <label htmlFor>. `quiet` is a
 * small one that turns ink, not green, when on: a view filter (Needs me) rather than a setting.
 */
export function Switch({ className, quiet, ...rest }: ComponentProps<typeof SwitchPrimitive.Root> & { quiet?: boolean }) {
  return (
    <SwitchPrimitive.Root
      className={cx(
        "flex flex-none cursor-pointer justify-start rounded-pill border-0 bg-border-strong data-[state=checked]:justify-end",
        quiet ? "h-[15px] w-[26px] p-[2px] data-[state=checked]:bg-text" : "h-8 w-[52px] p-[3px] data-[state=checked]:bg-primary",
        "disabled:cursor-default disabled:opacity-60",
        className,
      )}
      {...rest}
    >
      <SwitchPrimitive.Thumb className={cx("block rounded-pill bg-surface", quiet ? "size-[11px] shadow-[0_1px_2px_rgba(0,0,0,0.15)]" : "size-[26px]")} />
    </SwitchPrimitive.Root>
  );
}

/** A switch with its label and a line of explanation, the whole row in one. */
export function SwitchField({
  id,
  label,
  description,
  className,
  ...rest
}: ComponentProps<typeof SwitchPrimitive.Root> & { id: string; label: ReactNode; description?: ReactNode }) {
  return (
    <div className={cx("flex items-center gap-4", className)}>
      <label className="flex flex-auto cursor-pointer flex-col" htmlFor={id}>
        <span className="text-body-strong">{label}</span>
        {description && <span className="text-meta">{description}</span>}
      </label>
      <Switch id={id} {...rest} />
    </div>
  );
}

export function Checkbox({ className, ...rest }: ComponentProps<typeof CheckboxPrimitive.Root>) {
  return (
    <CheckboxPrimitive.Root
      className={cx(
        "inline-flex size-[18px] flex-none cursor-pointer items-center justify-center rounded-control border border-border-strong bg-surface p-0",
        "data-[state=checked]:border-primary data-[state=checked]:bg-primary data-[state=checked]:text-on-primary disabled:cursor-default disabled:opacity-60",
        className,
      )}
      {...rest}
    >
      {/* A flex box of its own, so the tick sits in the middle of the box, not on the text's baseline. */}
      <CheckboxPrimitive.Indicator className="flex size-full items-center justify-center">
        <Icon name="check" size={14} />
      </CheckboxPrimitive.Indicator>
    </CheckboxPrimitive.Root>
  );
}

/** A checkbox with its label to the right; the label can hold rich content. */
export function CheckboxField({ id, label, className, ...rest }: ComponentProps<typeof CheckboxPrimitive.Root> & { id: string; label: ReactNode }) {
  return (
    <span className={cx("flex items-start gap-2", className)}>
      <Checkbox id={id} className="mt-px" {...rest} />
      <label htmlFor={id} className="cursor-pointer">
        {label}
      </label>
    </span>
  );
}

export interface RadioCardOption {
  value: string;
  icon?: string;
  title: ReactNode;
  description?: ReactNode;
  /** Beside the title, like a Recommended tag. */
  extra?: ReactNode;
}

/** A choice between a few options shown as cards (How to share, How to book). */
export function RadioCards({
  options,
  className,
  ...rest
}: Omit<ComponentProps<typeof RadioGroup.Root>, "children"> & { options: RadioCardOption[]; "aria-label": string }) {
  return (
    <RadioGroup.Root className={cx("grid grid-cols-[repeat(auto-fit,minmax(200px,1fr))] gap-2", className)} {...rest}>
      {options.map((o) => (
        <RadioGroup.Item
          key={o.value}
          value={o.value}
          className={cx(
            "flex cursor-pointer items-start gap-3 rounded-tile border border-border bg-surface px-3 py-2 text-left font-sans text-body text-text shadow-card",
            "data-[state=checked]:border-2 data-[state=checked]:border-text data-[state=checked]:bg-surface-muted data-[state=checked]:px-[11px] data-[state=checked]:py-[7px]",
          // Blinq's purple reads too light on the selected fill: its deeper shade there.
          "data-[state=checked]:[&_.text-ai]:text-ai-strong",
            "disabled:cursor-default disabled:opacity-60",
          )}
        >
          {o.icon && <Icon name={o.icon} size={20} className="text-text-secondary" />}
          <span className="flex min-w-0 flex-col">
            <span className="flex flex-wrap items-center gap-2">
              <b className="text-body-strong">{o.title}</b>
              {o.extra}
            </span>
            {o.description && <span className="text-meta">{o.description}</span>}
          </span>
        </RadioGroup.Item>
      ))}
    </RadioGroup.Root>
  );
}

const chip =
  "relative inline-flex h-8 cursor-pointer items-center gap-1 rounded-pill border bg-surface px-3 font-sans text-body-strong whitespace-nowrap text-text";
// Selected is neutral: green is only for the main action and for done.
const chipOn = "border-text bg-surface-muted text-text";

/** A rounded toggle: a filter, a quick question, a pet to add. `pressed` makes it a toggle button. */
export function Chip({
  pressed,
  selected,
  dashed,
  icon,
  className,
  type = "button",
  children,
  ...rest
}: ComponentProps<"button"> & { pressed?: boolean; selected?: boolean; dashed?: boolean; icon?: string }) {
  return (
    <button
      type={type}
      aria-pressed={pressed}
      className={cx(chip, pressed || selected ? chipOn : "border-border", dashed && "border-dashed", className)}
      {...rest}
    >
      {icon && <Icon name={icon} size={16} />}
      {children}
    </button>
  );
}

/** A chip that isn't a control: something already chosen. */
export function StaticChip({ icon, children }: { icon?: string; children: ReactNode }) {
  return (
    <span className={cx(chip, chipOn, "cursor-default")}>
      {icon && <Icon name={icon} size={16} />}
      {children}
    </span>
  );
}

/** One choice out of a few short ones, shown as chips (a time slot). */
export function RadioChips({
  options,
  className,
  ...rest
}: Omit<ComponentProps<typeof RadioGroup.Root>, "children"> & { options: { value: string; label: ReactNode }[]; "aria-label": string }) {
  return (
    <RadioGroup.Root className={cx("flex flex-wrap items-center gap-2", className)} {...rest}>
      {options.map((o) => (
        <RadioGroup.Item key={o.value} value={o.value} className={cx(chip, "border-border data-[state=checked]:border-text data-[state=checked]:bg-surface-muted data-[state=checked]:text-text")}>
          {o.label}
        </RadioGroup.Item>
      ))}
    </RadioGroup.Root>
  );
}

/** Two or three mutually exclusive options side by side (English, Spanish). */
export function Segmented({
  value,
  onValueChange,
  options,
  ...rest
}: {
  value: string;
  onValueChange: (v: string) => void;
  options: { value: string; label: ReactNode }[];
  "aria-label": string;
}) {
  return (
    <ToggleGroup.Root
      type="single"
      value={value}
      onValueChange={(v) => v && onValueChange(v)}
      className="inline-flex flex-none overflow-hidden rounded-control border border-border"
      {...rest}
    >
      {options.map((o) => (
        <ToggleGroup.Item
          key={o.value}
          value={o.value}
          className="h-8 cursor-pointer border-0 bg-surface px-3 font-sans text-body-strong text-text-secondary data-[state=on]:bg-surface-muted data-[state=on]:text-text"
        >
          {o.label}
        </ToggleGroup.Item>
      ))}
    </ToggleGroup.Root>
  );
}
