import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router";
import type { Me } from "../api/types";
import { useApp } from "../state/app";
import { THEME_KEY, startTheme, useTheme } from "../state/theme";
import { Topbar } from "./Shell";

const me = {
  via: "session",
  admin: false,
  user: { id: "u1", username: "arivera", name: "Dr. Ana Rivera", email: "ana@clinic.test", provider_id: "prov-1" },
  role: "vet",
  provider_id: "prov-1",
} as unknown as Me;

let dark = false;
let onChange: (() => void) | undefined;

beforeEach(() => {
  localStorage.clear();
  delete document.documentElement.dataset.theme;
  dark = false;
  onChange = undefined;
  vi.stubGlobal("matchMedia", (query: string) => ({
    get matches() {
      return query.includes("prefers-color-scheme") ? dark : false;
    },
    media: query,
    addEventListener: (_: string, fn: () => void) => (onChange = fn),
    removeEventListener: () => {},
  }));
  useTheme.setState({ choice: "system" });
  useApp.setState({ me, doctors: [{ id: "prov-1", name: "Dr. Ana Rivera" }], provider: "prov-1" });
});
afterEach(() => vi.unstubAllGlobals());

async function openMenu() {
  render(
    <MemoryRouter>
      <Topbar />
    </MemoryRouter>,
  );
  await userEvent.click(screen.getByRole("button", { name: /Your account/ }));
}

describe("the theme choice in the account menu", () => {
  it("offers Light, Dark and System, with System picked by default", async () => {
    await openMenu();
    expect(screen.getByRole("menuitemradio", { name: "Light" })).toHaveAttribute("aria-checked", "false");
    expect(screen.getByRole("menuitemradio", { name: "Dark" })).toHaveAttribute("aria-checked", "false");
    expect(screen.getByRole("menuitemradio", { name: "System" })).toHaveAttribute("aria-checked", "true");
  });

  it("choosing Dark sets data-theme on the page and remembers it", async () => {
    await openMenu();
    await userEvent.click(screen.getByRole("menuitemradio", { name: "Dark" }));
    expect(document.documentElement.dataset.theme).toBe("dark");
    expect(localStorage.getItem(THEME_KEY)).toBe("dark");

    await userEvent.click(screen.getByRole("button", { name: /Your account/ }));
    expect(screen.getByRole("menuitemradio", { name: "Dark" })).toHaveAttribute("aria-checked", "true");
    await userEvent.click(screen.getByRole("menuitemradio", { name: "Light" }));
    expect(document.documentElement.dataset.theme).toBe("light");
    expect(localStorage.getItem(THEME_KEY)).toBe("light");
  });
});

describe("the theme at start", () => {
  it("System follows the device, including when it switches", () => {
    dark = true;
    startTheme();
    expect(document.documentElement.dataset.theme).toBe("dark");
    dark = false;
    onChange?.();
    expect(document.documentElement.dataset.theme).toBe("light");
  });

  it("a saved Light wins over a dark device", () => {
    dark = true;
    useTheme.getState().setChoice("light");
    startTheme();
    expect(document.documentElement.dataset.theme).toBe("light");
    dark = false;
    onChange?.();
    expect(document.documentElement.dataset.theme).toBe("light");
  });
});
