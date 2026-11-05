import { useState, type ReactNode } from "react";
import { Popover, Select as Primitive } from "radix-ui";
import { Command } from "cmdk";
import { cx } from "../cx";
import { Icon } from "./Icon";

export interface SelectOption {
  value: string;
  label: ReactNode;
  /** Plain text for search and screen readers when `label` isn't a string. */
  text?: string;
  /** What the closed Combobox shows once this is chosen, when it differs from the list's label. */
  display?: ReactNode;
  disabled?: boolean;
}

export type SelectSize = "sm" | "md" | "lg";

interface ChooserProps {
  value: string;
  onValueChange: (value: string) => void;
  options: SelectOption[];
  placeholder?: ReactNode;
  /** Heights match TextField: sm 32, md 40, lg 48. */
  size?: SelectSize;
  /** Before the value, inside the trigger (an avatar). */
  leading?: ReactNode;
  disabled?: boolean;
  id?: string;
  className?: string;
  "aria-label"?: string;
  "aria-describedby"?: string;
  "aria-invalid"?: boolean;
}

const heights: Record<SelectSize, string> = {
  sm: "h-(--size-control-sm) gap-1 px-3 text-body",
  md: "h-(--size-control) gap-2 px-3 text-body",
  lg: "h-(--size-control-lg) gap-2 px-3 text-body",
};

/** The closed control: value left and truncated, chevron pinned right, both on the text's center line. */
const trigger = (size: SelectSize, className?: string): string =>
  cx(
    "inline-flex w-full min-w-0 cursor-pointer items-center justify-between rounded-control border border-border bg-surface font-sans text-text",
    "data-placeholder:text-text-secondary aria-invalid:border-error disabled:cursor-default disabled:bg-page disabled:text-text-secondary",
    "data-[state=open]:border-primary",
    heights[size],
    className,
  );

const panel =
  "z-(--layer-menu) overflow-hidden rounded-tile border border-border bg-surface p-1 text-body text-text shadow-pop";

const itemBase = "relative flex min-h-9 cursor-pointer items-center gap-2 rounded-control py-2 pr-3 pl-8 outline-none select-none";
// Radix marks state by the attribute being there; cmdk always sets it, to "true" or "false".
const item = cx(itemBase, "data-highlighted:bg-surface-muted data-highlighted:text-text data-disabled:cursor-default data-disabled:text-text-disabled");
const commandItem = cx(
  itemBase,
  "data-[selected=true]:bg-surface-muted data-[selected=true]:text-text data-[disabled=true]:cursor-default data-[disabled=true]:text-text-disabled",
);

const chevron = <Icon name="expand_more" className="flex-none text-text-secondary" />;

// Radix keeps "" for "nothing chosen", so an option whose value is "" (All doctors) travels under this name.
const NONE = "__none__";
const toItem = (v: string): string => (v === "" ? NONE : v);
const fromItem = (v: string): string => (v === NONE ? "" : v);

/**
 * One choice from a short list. Arrow keys, typeahead, Enter and Escape come from Radix, and the
 * chosen item carries a check mark. Label it with FormField or aria-label.
 */
export function Select({
  value,
  onValueChange,
  options,
  placeholder,
  size = "md",
  leading,
  disabled,
  id,
  className,
  name,
  required,
  footer,
  ...aria
}: ChooserProps & {
  name?: string;
  required?: boolean;
  /** A short note under the list (what changing it does). */
  footer?: ReactNode;
}) {
  return (
    <Primitive.Root
      value={value === "" && !options.some((o) => o.value === "") ? undefined : toItem(value)}
      onValueChange={(v) => onValueChange(fromItem(v))}
      disabled={disabled}
      name={name}
      required={required}
    >
      <Primitive.Trigger id={id} className={trigger(size, className)} {...aria}>
        {leading}
        <span className="min-w-0 flex-1 truncate text-left">
          <Primitive.Value placeholder={placeholder} />
        </span>
        <Primitive.Icon asChild>{chevron}</Primitive.Icon>
      </Primitive.Trigger>
      <Primitive.Portal>
        <Primitive.Content
          position="popper"
          sideOffset={4}
          className={cx(panel, "max-h-(--radix-select-content-available-height) min-w-(--radix-select-trigger-width)")}
        >
          <Primitive.Viewport>
            {options.map((o) => (
              <Primitive.Item key={o.value} value={toItem(o.value)} disabled={o.disabled} textValue={o.text} className={item}>
                <Primitive.ItemIndicator className="absolute left-2 inline-flex">
                  <Icon name="check" />
                </Primitive.ItemIndicator>
                <Primitive.ItemText>{o.label}</Primitive.ItemText>
              </Primitive.Item>
            ))}
          </Primitive.Viewport>
          {footer && <p className="mt-1 max-w-[280px] border-t border-divider px-3 py-2 text-meta">{footer}</p>}
        </Primitive.Content>
      </Primitive.Portal>
    </Primitive.Root>
  );
}

const textOf = (o: SelectOption): string => o.text ?? (typeof o.label === "string" ? o.label : o.value);

/**
 * A Select with a search box, for long lists (the doctors, a filter). Typing narrows the list,
 * arrow keys move, Enter picks, Escape closes and gives focus back to the trigger.
 */
export function Combobox({
  value,
  onValueChange,
  options,
  placeholder,
  size = "md",
  leading,
  disabled,
  id,
  className,
  searchPlaceholder,
  emptyText,
  ...aria
}: ChooserProps & { searchPlaceholder: string; emptyText: string }) {
  const [open, setOpen] = useState(false);
  const chosen = options.find((o) => o.value === value);
  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger asChild disabled={disabled}>
        <button
          type="button"
          id={id}
          role="combobox"
          aria-expanded={open}
          data-state={open ? "open" : "closed"}
          data-placeholder={chosen ? undefined : ""}
          className={trigger(size, className)}
          {...aria}
        >
          {leading}
          <span className="min-w-0 flex-1 truncate text-left">{chosen ? (chosen.display ?? chosen.label) : placeholder}</span>
          {chevron}
        </button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          align="start"
          sideOffset={4}
          aria-label={aria["aria-label"]}
          className={cx(panel, "w-(--radix-popover-trigger-width) min-w-[240px] p-0")}
        >
          <Command
            label={aria["aria-label"]}
            filter={(v, search) => ((v.split("\u0000")[0] ?? "").toLowerCase().includes(search.trim().toLowerCase()) ? 1 : 0)}
          >
            <div className="flex items-center gap-2 border-b border-divider px-3">
              <Icon name="search" className="flex-none text-text-secondary" />
              <Command.Input
                placeholder={searchPlaceholder}
                className="h-(--size-control) w-full min-w-0 border-0 bg-transparent font-sans text-body text-text outline-none placeholder:text-text-secondary"
              />
            </div>
            <Command.List className="max-h-72 overflow-y-auto p-1">
              <Command.Empty className="px-3 py-2 text-meta">{emptyText}</Command.Empty>
              {options.map((o) => (
                <Command.Item
                  key={o.value}
                  // cmdk matches on this; the option's own value keeps two same-named rows apart.
                  value={`${textOf(o)}\u0000${o.value}`}
                  disabled={o.disabled}
                  aria-checked={o.value === value}
                  onSelect={() => {
                    onValueChange(o.value);
                    setOpen(false);
                  }}
                  className={commandItem}
                >
                  {o.value === value && (
                    <span className="absolute left-2 inline-flex">
                      <Icon name="check" />
                    </span>
                  )}
                  <span className="min-w-0 truncate">{o.label}</span>
                </Command.Item>
              ))}
            </Command.List>
          </Command>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
