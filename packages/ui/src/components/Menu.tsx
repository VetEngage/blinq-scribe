import type { ComponentProps, ReactNode } from "react";
import { DropdownMenu as Primitive } from "radix-ui";
import { cx } from "../cx";
import { Icon } from "./Icon";

function Content({ className, ...rest }: ComponentProps<typeof Primitive.Content>) {
  return (
    <Primitive.Portal>
      <Primitive.Content
        align="end"
        sideOffset={6}
        className={cx("z-(--layer-menu) min-w-[200px] rounded-tile border border-border bg-surface p-1 shadow-pop", className)}
        {...rest}
      />
    </Primitive.Portal>
  );
}

function Item({ icon, children, className, ...rest }: ComponentProps<typeof Primitive.Item> & { icon?: string; children: ReactNode }) {
  return (
    <Primitive.Item
      className={cx(
        "flex cursor-pointer items-center gap-2 rounded-control px-3 py-2 text-body outline-none data-highlighted:bg-surface-muted data-highlighted:text-text",
        className,
      )}
      {...rest}
    >
      {icon && <Icon name={icon} />}
      {children}
    </Primitive.Item>
  );
}

/** One choice out of a few, in a RadioGroup: the picked one shows a check. */
function RadioItem({ icon, children, className, ...rest }: ComponentProps<typeof Primitive.RadioItem> & { icon?: string; children: ReactNode }) {
  return (
    <Primitive.RadioItem
      className={cx(
        "flex cursor-pointer items-center gap-2 rounded-control px-3 py-2 text-body outline-none data-highlighted:bg-surface-muted data-highlighted:text-text",
        className,
      )}
      {...rest}
    >
      {icon && <Icon name={icon} />}
      <span className="flex-1">{children}</span>
      <Primitive.ItemIndicator>
        <Icon name="check" />
      </Primitive.ItemIndicator>
    </Primitive.RadioItem>
  );
}

function Label({ className, ...rest }: ComponentProps<typeof Primitive.Label>) {
  return <Primitive.Label className={cx("px-3 py-1 text-meta", className)} {...rest} />;
}

function Separator({ className, ...rest }: ComponentProps<typeof Primitive.Separator>) {
  return <Primitive.Separator className={cx("-mx-1 my-1 h-px bg-divider", className)} {...rest} />;
}

/** A menu behind a button: arrow keys move, Enter picks, Escape closes. */
export const DropdownMenu = { Root: Primitive.Root, Trigger: Primitive.Trigger, Content, Item, RadioGroup: Primitive.RadioGroup, RadioItem, Label, Separator };
