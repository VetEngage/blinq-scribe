import { create } from "zustand";

/** What the vet picked. "system" follows the device and is the default. */
export type ThemeChoice = "light" | "dark" | "system";

/** Also read, by hand, in public/theme-init.js, which sets the theme before first paint. */
export const THEME_KEY = "blinq.theme";

/** The device's dark setting. */
const DARK_QUERY = "(prefers-color-scheme: dark)";

const isChoice = (v: unknown): v is ThemeChoice => v === "light" || v === "dark" || v === "system";

function stored(): ThemeChoice {
  try {
    const raw = localStorage.getItem(THEME_KEY);
    return isChoice(raw) ? raw : "system";
  } catch {
    return "system";
  }
}

const prefersDark = (): boolean => window.matchMedia?.(DARK_QUERY).matches ?? false;

/** Puts the choice on <html data-theme>, as "light" or "dark" (System resolves to the device's). */
export function applyTheme(choice: ThemeChoice): void {
  const dark = choice === "dark" || (choice === "system" && prefersDark());
  document.documentElement.dataset.theme = dark ? "dark" : "light";
}

interface ThemeState {
  choice: ThemeChoice;
  setChoice: (choice: ThemeChoice) => void;
}

export const useTheme = create<ThemeState>((set) => ({
  choice: stored(),
  setChoice: (choice) => {
    try {
      localStorage.setItem(THEME_KEY, choice);
    } catch {
      // Storage is blocked (private mode): the choice still holds for this tab.
    }
    applyTheme(choice);
    set({ choice });
  },
}));

/** Applies the saved choice and, under System, follows the device when it switches. Call once at start. */
export function startTheme(): void {
  applyTheme(useTheme.getState().choice);
  window.matchMedia?.(DARK_QUERY).addEventListener("change", () => {
    if (useTheme.getState().choice === "system") applyTheme("system");
  });
}
