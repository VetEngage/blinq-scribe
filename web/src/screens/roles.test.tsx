import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { Appointment, Me } from "../api/types";
import { useApp } from "../state/app";
import { MemoryRouter } from "react-router";
import { DayMenu, ViewingBanner } from "./Shell";
import { VisitLocked } from "./visit/parts";

const doctors = [
  { id: "prov-1", name: "Dr. Ana Rivera" },
  { id: "prov-2", name: "Dr. Sam Okafor" },
];
const as = (role: string, provider_id = ""): Me => ({
  via: "session",
  admin: role === "admin",
  user: null,
  role,
  provider_id,
});

function show(me: Me, provider: string) {
  useApp.setState({ me, doctors, provider, setProvider: (id: string) => useApp.setState({ provider: id }) });
  return render(
    <MemoryRouter>
      <DayMenu />
      <ViewingBanner />
    </MemoryRouter>,
  );
}

describe("the day menu by role", () => {
  it("a vet opens on their own day by name; colleagues are marked View only, and picking one says so", async () => {
    show(as("vet", "prov-1"), "prov-1");
    const menu = screen.getByRole("button", { name: /Dr\. Ana Rivera's day/ });
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    await userEvent.click(menu);
    const okafor = screen.getByRole("menuitemradio", { name: /Dr\. Sam Okafor's day/ });
    expect(within(okafor).getByText("View only")).toBeInTheDocument();
    expect(screen.queryByRole("menuitemradio", { name: /All providers/ })).not.toBeInTheDocument();
    await userEvent.click(okafor);
    expect(useApp.getState().provider).toBe("prov-2");
    expect(screen.getByRole("button", { name: /Dr\. Okafor's day/ })).toHaveTextContent("View only");
    expect(screen.getByText("You're viewing Dr. Sam Okafor's day.")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Back to my day" }));
    expect(useApp.getState().provider).toBe("prov-1");
  });

  it("front office and admins see All providers and each provider, with no view only banner", async () => {
    for (const role of ["front_office", "admin"]) {
      const { unmount } = show(as(role), "");
      const menu = screen.getByRole("button", { name: /All providers/ });
      await userEvent.click(menu);
      expect(screen.getByRole("menuitemradio", { name: "Dr. Ana Rivera's day" })).toBeInTheDocument();
      expect(screen.queryByText("View only")).not.toBeInTheDocument();
      await userEvent.click(screen.getByRole("menuitemradio", { name: "Dr. Sam Okafor's day" }));
      expect(screen.queryByText(/You're viewing/)).not.toBeInTheDocument();
      unmount();
    }
  });
});

describe("someone else's visit", () => {
  it("says whose it is and that only they can start, record, write or sign", () => {
    useApp.setState({ noteTypes: [{ id: "soap", name: "Sick visit (SOAP)", sections: [] }] });
    const appt = {
      id: "a1",
      provider_name: "Dr. Sam Okafor",
      note_type: "soap",
      patient: { id: "p1", name: "Biscuit" },
      can: { start: false },
    } as unknown as Appointment;
    render(<VisitLocked appt={appt} />);
    expect(screen.getByText("Dr. Sam Okafor's visit")).toBeInTheDocument();
    expect(
      screen.getByText(
        "Sick visit (SOAP) · Biscuit · not started. Only Dr. Sam Okafor can start it, record, draft or sign the note.",
      ),
    ).toBeInTheDocument();
  });
});
