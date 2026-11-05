import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { formatPhonesIn } from "../phone";
import { cx, toneClass, type Tone } from "../cx";
import { Icon } from "./Icon";

/** A wide green confirmation at the top of a screen (Signed by ...). */
export function Banner({ icon = "check_circle", children, action, className }: { icon?: string; children: ReactNode; action?: ReactNode; className?: string }) {
  return (
    <div className={cx("flex items-center gap-3 rounded-card bg-selected px-4 py-3 text-body-strong text-primary", className)} role="status">
      <Icon name={icon} fill size={22} />
      <span className="flex-1">{children}</span>
      {action}
    </div>
  );
}

const alertIcons: Record<Tone, string> = { neutral: "info", success: "check_circle", warning: "help", error: "error", ai: "auto_awesome" };

/**
 * A message inside a card: a hint or a quiet result (neutral), a result (success), Blinq unsure (ai)
 * or a problem (error). `role="alert"` only for errors the vet must notice now. `iconClassName`
 * colors the icon alone: a neutral line with a green check for something done.
 */
export function Alert({
  tone = "neutral",
  icon,
  iconClassName,
  action,
  urgent = false,
  className,
  children,
}: {
  tone?: Tone;
  icon?: string | null;
  iconClassName?: string;
  action?: ReactNode;
  urgent?: boolean;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div
      role={urgent ? "alert" : undefined}
      className={cx(
        "flex items-start gap-2 rounded-tile border px-3 py-2 text-body",
        tone === "neutral" ? "border-divider bg-page text-text" : cx("border-transparent", toneClass[tone]),
        className,
      )}
    >
      {icon !== null && <Icon name={icon ?? alertIcons[tone]} fill={tone === "success"} className={cx(tone === "neutral" && "text-text-secondary", iconClassName)} />}
      <span className="min-w-0 flex-1">{children}</span>
      {action}
    </div>
  );
}

interface ToastApi {
  show: (message: string) => void;
}
const ToastContext = createContext<ToastApi>({ show: () => {} });
/** The message on show now, and whether a top bar holds it (a ToastOutlet is mounted). */
const ToastState = createContext<{ message: string; claim: () => () => void }>({ message: "", claim: () => () => {} });

/**
 * Short confirmations ("Profile saved"), read out politely, gone in 2.5 seconds. They sit inside the top
 * bar (a `ToastOutlet` in it), so a toast never covers the page: the transcript, the note or the pinned
 * bar's buttons. A page with no top bar (sign in) shows them just under the top edge.
 */
export function ToastProvider({ children, duration = 2500 }: { children: ReactNode; duration?: number }) {
  const [message, setMessage] = useState("");
  const [n, setN] = useState(0);
  const [outlets, setOutlets] = useState(0);
  useEffect(() => {
    if (!message) return;
    const timer = setTimeout(() => setMessage(""), duration);
    return () => clearTimeout(timer);
  }, [message, n, duration]);
  const show = useCallback((m: string) => {
    setMessage(formatPhonesIn(m));
    setN((x) => x + 1);
  }, []);
  const claim = useCallback(() => {
    setOutlets((x) => x + 1);
    return () => setOutlets((x) => x - 1);
  }, []);
  const api = useMemo(() => ({ show }), [show]);
  const state = useMemo(() => ({ message, claim }), [message, claim]);
  return (
    <ToastContext.Provider value={api}>
      <ToastState.Provider value={state}>
        {children}
        {!outlets && (
          <div className="pointer-events-none fixed top-2 left-1/2 z-(--layer-toast) -translate-x-1/2" role="status" aria-live="polite">
            {message && <Toast>{message}</Toast>}
          </div>
        )}
      </ToastState.Provider>
    </ToastContext.Provider>
  );
}

/** Where the top bar shows toasts: a small pill in the bar itself, never over the page. */
export function ToastOutlet({ className }: { className?: string }) {
  const { message, claim } = useContext(ToastState);
  useEffect(() => claim(), [claim]);
  return (
    <div className={cx("pointer-events-none flex min-w-0 justify-center", className)} role="status" aria-live="polite">
      {message && <Toast>{message}</Toast>}
    </div>
  );
}

export const useToast = (): ToastApi => useContext(ToastContext);

export function Toast({ children, icon = "check_circle" }: { children: ReactNode; icon?: string }) {
  return (
    <div className="inline-flex max-w-full min-w-0 items-center gap-2 rounded-pill bg-inverse px-4 py-2 text-body-strong text-on-primary shadow-pop">
      <Icon name={icon} fill className="text-on-inverse-accent" />
      <span className="min-w-0 truncate">{children}</span>
    </div>
  );
}
