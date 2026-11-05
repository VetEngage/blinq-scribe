import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router";

const api = vi.hoisted(() => ({ team: vi.fn(), addUser: vi.fn() }));
vi.mock("../api", () => ({ api }));

import { useApp } from "../state/app";
import { TeamScreen } from "./Team";

beforeEach(() => {
  api.team.mockResolvedValue({ users: [], providers: [{ id: "prov-1", name: "Dr. Ana Rivera", linked_to: "" }] });
  api.addUser.mockReset().mockResolvedValue({ user: { name: "Sam", role: "vet" }, invite_url: "http://x/#invite=t" });
  useApp.setState({ me: { via: "session", admin: true, user: null } });
});

async function fill(email: string) {
  render(
    <MemoryRouter>
      <TeamScreen />
    </MemoryRouter>,
  );
  // Wait for the providers to load before picking one.
  await waitFor(() => expect(api.team).toHaveBeenCalled());
  await userEvent.type(screen.getByLabelText("Name"), "Dr. Sam Okafor");
  await userEvent.type(screen.getByLabelText("Username"), "sokafor");
  if (email) await userEvent.type(screen.getByLabelText("Email (optional)"), email);
  await userEvent.click(screen.getByRole("combobox", { name: "Provider in the PIMS" }));
  await userEvent.click(await screen.findByRole("option", { name: "Dr. Ana Rivera" }));
  await userEvent.click(screen.getByRole("button", { name: "Create invite link" }));
}

describe("Team invite email", () => {
  it("spaces alone count as no email", async () => {
    await fill("   ");
    await waitFor(() => expect(api.addUser).toHaveBeenCalledWith(expect.objectContaining({ email: "" })));
  });

  it("a real email is trimmed; a broken one is refused before sending", async () => {
    await fill("ana@");
    expect(await screen.findByText("Enter a valid email.")).toBeInTheDocument();
    expect(api.addUser).not.toHaveBeenCalled();
    await userEvent.clear(screen.getByLabelText("Email (optional)"));
    await userEvent.type(screen.getByLabelText("Email (optional)"), " sam@clinic.test ");
    await userEvent.click(screen.getByRole("button", { name: "Create invite link" }));
    await waitFor(() =>
      expect(api.addUser).toHaveBeenCalledWith(expect.objectContaining({ email: "sam@clinic.test" })),
    );
  });
});
