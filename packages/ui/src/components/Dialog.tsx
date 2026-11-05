import { useState, type ReactNode } from "react";
import { AlertDialog, Dialog as Primitive } from "radix-ui";
import { cx } from "../cx";
import { Button, IconButton, type ButtonVariant } from "./Button";

const overlay = "fixed inset-0 z-(--layer-dialog) bg-scrim";
const panel =
  "fixed top-1/2 left-1/2 z-(--layer-dialog) max-h-[calc(100vh-32px)] -translate-x-1/2 -translate-y-1/2 overflow-auto rounded-card bg-surface p-6 shadow-modal";
const widths = { sm: "w-[min(420px,calc(100vw-32px))]", md: "w-[min(720px,calc(100vw-32px))]" };

export interface DialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Read out when it opens. Shown as the heading unless `hideTitle`. */
  title: ReactNode;
  hideTitle?: boolean;
  /** The close button's label ("Close"). */
  closeLabel: string;
  size?: "sm" | "md";
  /**
   * "top": a panel near the top, edge to edge inside (search). It brings its own close button.
   * "side": a sheet down the right edge, full height (the patient record beside a visit).
   */
  placement?: "center" | "top" | "side";
  className?: string;
  children: ReactNode;
}

/** The close button for a dialog that draws its own (placement "top"). */
export function DialogClose({ label, className }: { label: string; className?: string }) {
  return (
    <Primitive.Close asChild>
      <IconButton variant="link" size="sm" icon="close" aria-label={label} className={cx("text-text-secondary", className)} />
    </Primitive.Close>
  );
}

/**
 * A modal panel: focus stays inside, Escape and the close button close it. Escape inside an element
 * marked `data-keeps-escape` (a text being edited in place) is left to that element.
 */
export function Dialog({ open, onOpenChange, title, hideTitle, closeLabel, size = "md", placement = "center", className, children }: DialogProps) {
  const top = placement === "top";
  return (
    <Primitive.Root open={open} onOpenChange={onOpenChange}>
      <Primitive.Portal>
        <Primitive.Overlay className={top ? "fixed inset-0 z-(--layer-search) bg-overlay" : overlay} />
        <Primitive.Content
          className={cx(
            top
              ? "fixed top-2 left-1/2 z-(--layer-search) flex w-[min(560px,calc(100vw-32px))] -translate-x-1/2 flex-col overflow-hidden rounded-card border border-border bg-surface shadow-pop"
              : placement === "side"
                ? "fixed inset-y-0 right-0 z-(--layer-dialog) flex w-[min(480px,100vw)] flex-col gap-3 overflow-auto border-l border-border bg-surface p-6 shadow-modal"
                : cx(panel, widths[size], "flex flex-col gap-3"),
            className,
          )}
          aria-describedby={undefined}
          onEscapeKeyDown={(ev) => {
            if (ev.target instanceof Element && ev.target.closest("[data-keeps-escape]")) ev.preventDefault();
          }}
        >
          <Primitive.Title className={hideTitle || top ? "sr-only" : "pr-6 text-title"}>{title}</Primitive.Title>
          {children}
          {!top && (
            <Primitive.Close asChild>
              <IconButton variant="link" size="sm" icon="close" aria-label={closeLabel} className="absolute top-3 right-3 text-text-secondary" />
            </Primitive.Close>
          )}
        </Primitive.Content>
      </Primitive.Portal>
    </Primitive.Root>
  );
}

export interface ConfirmDialogProps {
  /** The button that opens it. */
  trigger: ReactNode;
  title: ReactNode;
  description: ReactNode;
  confirmLabel: string;
  cancelLabel: string;
  tone?: Extract<ButtonVariant, "primary" | "danger">;
  /** Extra content between the words and the buttons (a password field). */
  children?: ReactNode;
  confirmDisabled?: boolean;
  onConfirm: () => void;
  /** Called when it closes without confirming. */
  onCancel?: () => void;
}

/** Asks before something that can't be undone easily. Cancel is focused first. */
export function ConfirmDialog({
  trigger,
  title,
  description,
  confirmLabel,
  cancelLabel,
  tone = "primary",
  children,
  confirmDisabled,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const [open, setOpen] = useState(false);
  return (
    <AlertDialog.Root
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (!o) onCancel?.();
      }}
    >
      <AlertDialog.Trigger asChild>{trigger}</AlertDialog.Trigger>
      <AlertDialog.Portal>
        <AlertDialog.Overlay className={overlay} />
        <AlertDialog.Content className={cx(panel, widths.sm, "flex flex-col gap-3")}>
          <AlertDialog.Title className="text-title">{title}</AlertDialog.Title>
          <AlertDialog.Description className="text-body">{description}</AlertDialog.Description>
          {children}
          <div className="flex flex-wrap justify-end gap-2">
            <AlertDialog.Cancel asChild>
              <Button>{cancelLabel}</Button>
            </AlertDialog.Cancel>
            <Button
              variant={tone}
              disabled={confirmDisabled}
              onClick={() => {
                setOpen(false);
                onConfirm();
              }}
            >
              {confirmLabel}
            </Button>
          </div>
        </AlertDialog.Content>
      </AlertDialog.Portal>
    </AlertDialog.Root>
  );
}
