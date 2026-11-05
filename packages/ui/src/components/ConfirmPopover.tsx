import { useId, useRef, useState, type ReactNode } from "react";
import { Popover } from "radix-ui";
import { Button } from "./Button";
import { Icon } from "./Icon";

export interface ConfirmPopoverProps {
  /** The button that opens it. */
  trigger: ReactNode;
  /** The question ("Did Jordan agree to recording?"). Names the dialog. */
  title: ReactNode;
  description?: ReactNode;
  confirmLabel: string;
  confirmIcon?: string;
  cancelLabel: string;
  onConfirm: () => void;
  /** A quiet line under the buttons, with its icon (another way to do the same thing). */
  footnote?: ReactNode;
  footnoteIcon?: string;
  side?: "top" | "bottom";
  align?: "start" | "center" | "end";
}

/**
 * One question right where the action is, before it happens: a small dialog anchored to its button.
 * Focus moves in and stays inside until it closes, and lands on the cancel button first, so an answer
 * is always a choice. Escape, a click outside and the cancel button close it without confirming.
 */
export function ConfirmPopover({
  trigger,
  title,
  description,
  confirmLabel,
  confirmIcon,
  cancelLabel,
  onConfirm,
  footnote,
  footnoteIcon,
  side = "bottom",
  align = "center",
}: ConfirmPopoverProps) {
  const [open, setOpen] = useState(false);
  const titleId = useId();
  const descId = useId();
  const cancel = useRef<HTMLButtonElement>(null);
  return (
    <Popover.Root open={open} onOpenChange={setOpen} modal>
      <Popover.Trigger asChild>{trigger}</Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          side={side}
          align={align}
          sideOffset={6}
          collisionPadding={16}
          aria-labelledby={titleId}
          aria-describedby={description ? descId : undefined}
          onOpenAutoFocus={(ev) => {
            ev.preventDefault();
            cancel.current?.focus();
          }}
          className="z-(--layer-menu) flex w-[min(var(--size-popover),calc(100vw-32px))] flex-col gap-3 rounded-card border border-border bg-surface p-4 shadow-pop"
        >
          <p id={titleId} className="m-0 text-title">
            {title}
          </p>
          {description && (
            <p id={descId} className="m-0 text-body">
              {description}
            </p>
          )}
          <div className="flex flex-wrap gap-2">
            <Button
              variant="primary"
              icon={confirmIcon}
              onClick={() => {
                setOpen(false);
                onConfirm();
              }}
            >
              {confirmLabel}
            </Button>
            <Popover.Close asChild>
              <Button ref={cancel}>{cancelLabel}</Button>
            </Popover.Close>
          </div>
          {footnote && (
            <p className="m-0 flex items-center gap-1 text-meta">
              {footnoteIcon && <Icon name={footnoteIcon} />}
              {footnote}
            </p>
          )}
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
