import { cloneElement, isValidElement, useId, type ComponentProps, type ReactElement, type ReactNode } from "react";
import { cx } from "../cx";
import { Icon } from "./Icon";

const box =
  "w-full rounded-control border border-border bg-surface text-text aria-invalid:border-error disabled:bg-page disabled:text-text-secondary";
const control = cx(box, "font-sans text-body");

export interface TextFieldProps extends Omit<ComponentProps<"input">, "size"> {
  size?: "md" | "lg";
  /** No box of its own: it sits inside a box the screen draws (the search box). */
  bare?: boolean;
  /** A Number: a code or a link to copy, in tabular figures at the size of the line. */
  num?: boolean;
  /** A leading icon inside the box (search). */
  icon?: string;
}

/** A one-line text box. Pass the label with FormField, or aria-label. Works with RHF's register. */
export function TextField({ size = "md", icon, bare, num, className, type = "text", ...rest }: TextFieldProps) {
  const input = (
    <input
      type={type}
      className={cx(
        bare ? "h-11 w-full min-w-0 flex-1 border-0 bg-transparent p-0 font-sans text-body text-text focus:outline-none" : cx(control, num && "font-num", "px-3", size === "lg" ? "h-(--size-control-lg)" : "h-(--size-control)"),
        icon && "pl-[34px]",
        className,
      )}
      {...rest}
    />
  );
  if (!icon) return input;
  return (
    <span className="relative block min-w-0 flex-1">
      <Icon name={icon} className="absolute top-[11px] left-2.5 text-text-secondary" />
      {input}
    </span>
  );
}

/** A multi-line text box. `minHeight` in px for the bigger ones (a transcript, a note section). */
export function TextArea({ className, minHeight = 72, style, ...rest }: ComponentProps<"textarea"> & { minHeight?: number }) {
  return <textarea className={cx(control, "resize-y px-3 py-2", className)} style={{ minHeight, ...style }} {...rest} />;
}

/**
 * A file picker that looks like whatever you put inside it (a dropzone, a button). The real input
 * stays reachable by keyboard and screen readers.
 */
export function FileInput({
  label,
  accept,
  onFile,
  className,
  children,
  ...rest
}: Omit<ComponentProps<"label">, "onChange"> & { label: string; accept: string; onFile: (file: File | undefined) => void; children: ReactNode }) {
  return (
    <label className={cx("cursor-pointer focus-within:outline-2 focus-within:outline-offset-1 focus-within:outline-primary", className)} {...rest}>
      {children}
      <input
        type="file"
        accept={accept}
        aria-label={label}
        className="sr-only"
        onChange={(e) => {
          onFile(e.target.files?.[0]);
          e.target.value = "";
        }}
      />
    </label>
  );
}

interface FieldA11y {
  id: string;
  "aria-describedby"?: string;
  "aria-invalid"?: boolean;
}

export interface FormFieldProps {
  label: ReactNode;
  /** Shown under the control while there's no error. */
  hint?: ReactNode;
  /** The message to show; also marks the control invalid. Pass RHF's message, translated. */
  error?: string;
  /** Use your own id (otherwise one is made). */
  id?: string;
  /** Hide the label visually; it is still read out. */
  hideLabel?: boolean;
  className?: string;
  /** The control. An element gets id and aria wiring added; a function receives them. */
  children: ReactElement<FieldA11y> | ((a11y: FieldA11y) => ReactNode);
}

/** A label, a control, a hint and an error, wired together for screen readers. */
export function FormField({ label, hint, error, id, hideLabel, className, children }: FormFieldProps) {
  const auto = useId();
  const fieldId = id ?? `f${auto.replace(/:/g, "")}`;
  const hintId = hint ? `${fieldId}-hint` : undefined;
  const errorId = error ? `${fieldId}-error` : undefined;
  const a11y: FieldA11y = {
    id: fieldId,
    "aria-describedby": [errorId, hintId].filter(Boolean).join(" ") || undefined,
    "aria-invalid": error ? true : undefined,
  };
  return (
    <div className={cx("flex flex-col gap-1", className)}>
      <label htmlFor={fieldId} className={hideLabel ? "sr-only" : "text-meta"}>
        {label}
      </label>
      {typeof children === "function" ? children(a11y) : isValidElement(children) ? cloneElement(children, a11y) : children}
      {hint && (
        <p id={hintId} className="text-meta">
          {hint}
        </p>
      )}
      {error && (
        <p id={errorId} className="text-meta text-error">
          {error}
        </p>
      )}
    </div>
  );
}

/** A form-level message: the server's answer to the whole form. Announced when it changes. */
export function FormError({ children }: { children?: ReactNode }) {
  return (
    <p role="alert" className="text-body text-error empty:hidden">
      {children}
    </p>
  );
}

/** A quiet line that says what just happened (Saving, Saved, Reading the photo). */
export function StatusText({ children, className, id }: { children?: ReactNode; className?: string; id?: string }) {
  return (
    <p role="status" id={id} className={cx("text-meta empty:hidden", className)}>
      {children}
    </p>
  );
}
