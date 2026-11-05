import { useEffect, useLayoutEffect, useRef, type ReactNode } from "react";
import { cx } from "../cx";
import { Button, type ButtonProps } from "./Button";
import { Icon } from "./Icon";

/** The pinned bar's height, for anything else pinned to the bottom. */
export const ACTION_BAR_HEIGHT = "--action-bar-height";

/**
 * The next step, pinned to the bottom of the page: one bar across the main column with the page's one
 * green action on the right (`MainAction`). A labeled region, so a screen reader can jump to it. It is
 * the last thing on the page, so the page always scrolls clear of it, and with little on the page it
 * still sits at the bottom. The page sets `--page-gutter` and `--page-bottom` (its side and bottom
 * padding) so the bar reaches both edges and the bottom.
 *
 * The first child is the status and shrinks; every other child keeps its label on one line. Under
 * 720 px wide everything stacks.
 */
export function ActionBar({ label, className, children }: { label: string; className?: string; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const root = document.documentElement;
    const measure = () => root.style.setProperty(ACTION_BAR_HEIGHT, `${el.offsetHeight}px`);
    measure();
    const observer = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(measure);
    observer?.observe(el);
    return () => {
      observer?.disconnect();
      root.style.removeProperty(ACTION_BAR_HEIGHT);
    };
  }, []);
  return (
    <div
      ref={ref}
      className={cx(
        "sticky bottom-[calc(-1*var(--page-bottom,0px))] z-(--layer-sticky) mt-auto -mx-[var(--page-gutter,0px)] -mb-[var(--page-bottom,0px)] border-t border-border bg-surface px-[var(--page-gutter,16px)] py-3",
      )}
    >
      <div
        role="region"
        aria-label={label}
        className={cx(
          "flex min-h-(--size-control-lg) flex-wrap items-center gap-3",
          "*:first:min-w-40 *:not-first:flex-none *:not-first:whitespace-nowrap",
          "max-[720px]:flex-col max-[720px]:items-stretch max-[720px]:*:not-first:whitespace-normal",
          className,
        )}
      >
        {children}
      </div>
    </div>
  );
}

/**
 * The status side of an action bar: a Body strong line and a Meta line under it, with an optional
 * mark before them (a recording dot, a status icon).
 */
export function ActionBarStatus({ lead, title, sub }: { lead?: ReactNode; title: ReactNode; sub?: ReactNode }) {
  return (
    <span className="flex min-w-0 flex-[1_1_0] items-center gap-3">
      {lead}
      <span className="flex min-w-0 flex-col">
        <span className="truncate text-body-strong">{title}</span>
        {sub && <span className="truncate text-meta">{sub}</span>}
      </span>
    </span>
  );
}

const isMac = (): boolean =>
  typeof navigator !== "undefined" && /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent);

/** The keys that press the page's main action, as the hint shows them. */
export const mainActionKeys = (): string => (isMac() ? "⌘↵" : "Ctrl ↵");

// The main actions on screen, newest last: ⌘↵ presses the newest, so a dialog's own never fights the page's.
const mounted: HTMLButtonElement[] = [];

/**
 * The page's one green action, with a small ⌘↵ hint inside it (drawn as icons, like its leading icon). ⌘↵ (Ctrl+Enter) presses it from
 * anywhere on the page, except inside a dialog, which has its own buttons. Label it with exactly what it
 * does: "Open Biscuit's visit", "Review and sign 3 notes".
 */
export function MainAction({ children, className, ...rest }: Omit<ButtonProps, "variant">) {
  const ref = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    mounted.push(el);
    const onKey = (e: KeyboardEvent) => {
      if (!(e.metaKey || e.ctrlKey) || e.altKey || e.shiftKey || e.key !== "Enter") return;
      if (mounted[mounted.length - 1] !== el || el.disabled) return;
      const target = e.target instanceof Element ? e.target : null;
      if (target?.closest('[role="dialog"], [role="alertdialog"]')) return;
      e.preventDefault();
      el.click();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      mounted.splice(mounted.indexOf(el), 1);
    };
  }, []);
  return (
    <Button ref={ref} variant="primary" size="lg" aria-keyshortcuts="Meta+Enter Control+Enter" className={className} {...rest}>
      {children}
      {/* The keys are icons from the same font as the button's own icon, at its size and weight, so ⌘ and ↵
          match the arrow; only "Ctrl" is text, in the label's own type. No border: a tint is enough. */}
      <kbd aria-hidden="true" className="inline-flex h-5 items-center rounded-control border-0 bg-on-primary/15 px-1 font-sans text-body-strong text-on-primary">
        {isMac() ? <Icon name="keyboard_command_key" /> : <span className="pe-1">Ctrl</span>}
        <Icon name="keyboard_return" />
      </kbd>
    </Button>
  );
}
