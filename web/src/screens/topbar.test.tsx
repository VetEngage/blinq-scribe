import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router";
import type { Health, Me } from "../api/types";
import { myProviderId, useApp } from "../state/app";
import { DayMenu, Topbar } from "./Shell";

const doctors = [
  { id: "prov-1", name: "Dr. Ana Rivera" },
  { id: "prov-2", name: "Dr. Sam Okafor" },
];
const health = (ai: string): Health => ({ ok: true, ai, practice: "mock", stt: "", sam: "", sms: "preview" });
const open: Me = { via: "open", admin: true, user: null, role: "", provider_id: "" };

function topbar(h: Health | null) {
  useApp.setState({ me: open, doctors, provider: "prov-1", health: h });
  return render(
    <MemoryRouter>
      <Topbar />
    </MemoryRouter>,
  );
}

describe("the top bar's status pill", () => {
  it("has a check when the AI is live", () => {
    topbar(health("muse"));
    const pill = screen.getByText("Muse Spark · demo clinic");
    expect(pill.querySelector("[data-icon]")).toHaveAttribute("data-icon", "check_circle");
  });

  it("has a neutral flask for mock AI, not a warning", () => {
    topbar(health("mock"));
    const pill = screen.getByText("Mock AI · demo clinic");
    expect(pill.querySelector("[data-icon]")).toHaveAttribute("data-icon", "science");
    expect(pill).not.toHaveClass("text-warning");
  });

  it("is red only when the server isn't ok", () => {
    topbar({ ...health("muse"), ok: false });
    const pill = screen.getByText("Muse Spark · demo clinic");
    expect(pill.querySelector("[data-icon]")).toHaveAttribute("data-icon", "error");
    expect(pill).toHaveClass("text-error");
  });
});

describe("the top bar", () => {
  it("is the name, search, the Ask Blinq pill, the clinic, whose day and the account: no Morning brief or End of day buttons", () => {
    topbar(health("mock"));
    expect(screen.getByRole("button", { name: /Search pets, owners or phone/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^Ask Blinq/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Talk to Blinq" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Dr\. Ana Rivera's day/ })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Morning brief" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "End of day" })).not.toBeInTheDocument();
    expect(screen.queryByText("My day")).not.toBeInTheDocument();
  });
});

describe("the open demo's day menu", () => {
  it("names the provider's day, lists the others and All providers, and holds Today and End of day", async () => {
    expect(myProviderId(open, doctors)).toBe("prov-1");
    useApp.setState({
      me: open,
      doctors,
      provider: "prov-1",
      setProvider: (id: string) => useApp.setState({ provider: id }),
    });
    render(
      <MemoryRouter>
        <DayMenu />
      </MemoryRouter>,
    );
    const menu = screen.getByRole("button", { name: /Dr\. Ana Rivera's day/ });
    await userEvent.click(menu);
    expect(screen.getByRole("menuitemradio", { name: "Dr. Ana Rivera's day" })).toHaveAttribute("aria-checked", "true");
    // The open demo may work on every visit, so nobody is marked View only.
    expect(screen.getByRole("menuitemradio", { name: "Dr. Sam Okafor's day" })).toBeInTheDocument();
    expect(screen.queryByText("View only")).not.toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: "Today" })).toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: "End of day" })).toBeInTheDocument();
    await userEvent.click(screen.getByRole("menuitemradio", { name: "All providers" }));
    expect(useApp.getState().provider).toBe("");
    expect(screen.getByRole("button", { name: /All providers/ })).toBeInTheDocument();
  });
});
