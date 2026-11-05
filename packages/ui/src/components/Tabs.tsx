import type { ComponentProps } from "react";
import { Tabs as Primitive } from "radix-ui";
import { cx } from "../cx";

function List({ className, ...rest }: ComponentProps<typeof Primitive.List>) {
  return <Primitive.List className={cx("flex gap-6 overflow-x-auto border-b border-border", className)} {...rest} />;
}

function Trigger({ className, ...rest }: ComponentProps<typeof Primitive.Trigger>) {
  return (
    <Primitive.Trigger
      className={cx(
        "cursor-pointer border-0 border-b-2 border-transparent bg-transparent px-0 py-3 font-sans text-body-strong whitespace-nowrap text-text-secondary hover:text-text",
        "data-[state=active]:border-primary data-[state=active]:text-text",
        // Inside the tab, so the scrolling tab row never clips it to a stray line.
        "focus-visible:rounded-sm focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-primary",
        className,
      )}
      {...rest}
    />
  );
}

/** Tabs with arrow key movement between them. One style everywhere: Body strong, gray, ink with a 2px green underline when selected. */
export const Tabs = { Root: Primitive.Root, List, Trigger, Content: Primitive.Content };
