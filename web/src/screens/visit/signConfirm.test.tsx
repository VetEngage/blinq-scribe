import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router";
import type { Appointment, Encounter, SignPreview } from "../../api/types";

const api = vi.hoisted(() => ({ recordPanel: vi.fn(), signPreview: vi.fn() }));
vi.mock("../../api", () => ({ api }));

import { SignConfirm } from "./SignConfirm";

const appt = {
  id: "a1",
  start: "2026-11-01T09:00:00",
  provider_name: "Dr. Ana Rivera",
  patient: { id: "pat-1", name: "Biscuit", species: "Canine", breed: "Golden Retriever", age: 6, alerts: [] },
  client: { id: "cl-1", first_name: "Jordan", last_name: "Lee", phones: ["+12175550142"], emails: [] },
} as unknown as Appointment;
const e = { id: "enc-1", patient_id: "pat-1" } as unknown as Encounter;
const preview = (extra: Partial<SignPreview> = {}): SignPreview => ({
  pims_name: "AVImark",
  patient: { name: "Biscuit", pims_id: "4471" },
  owner: { name: "Jordan Lee", pims_id: "C-208" },
  appointment: { id: "a1", start: "2026-11-01T09:00:00", patient_name: "Biscuit", owner_name: "Jordan Lee" },
  matches: true,
  mismatch: "",
  note: true,
  photos: 2,
  prescription: ["Cefpodoxime 100 mg"],
  texts: [{ followup_id: "f1", kind: "recheck", reason: "Recheck in 14 days", message: "Hi Jordan, pick a time..." }],
  ...extra,
});

function confirm(mode: "send" | "only", p = preview()) {
  api.signPreview.mockResolvedValue(p);
  const onConfirm = vi.fn();
  render(
    <MemoryRouter>
      <SignConfirm mode={mode} appt={appt} e={e} busy={false} onConfirm={onConfirm} onClose={() => {}} />
    </MemoryRouter>,
  );
  return onConfirm;
}

describe("the confirm panel before signing", () => {
  it("Sign and send: where it goes, what goes, the texts that follow, then confirm", async () => {
    const onConfirm = confirm("send");
    const dialog = await screen.findByRole("dialog", { name: "Sign and send to the PIMS?" });
    expect(await within(dialog).findByText("Biscuit · PIMS ID 4471")).toBeInTheDocument();
    expect(within(dialog).getByText("Jordan Lee · PIMS ID C-208")).toBeInTheDocument();
    expect(within(dialog).getByText("Matches today's appointment at 9:00 AM with Dr. Ana Rivera.")).toBeInTheDocument();
    expect(within(dialog).getByText("2 photos")).toBeInTheDocument();
    expect(
      within(dialog).getByText("Prescription: the front desk enters it in the PIMS (not sent by Blinq yet)."),
    ).toBeInTheDocument();
    expect(within(dialog).getByText("Text to Jordan: Recheck in 14 days")).toBeInTheDocument();
    expect(within(dialog).getByText("Hi Jordan, pick a time...")).toBeInTheDocument();
    expect(dialog).not.toHaveTextContent("AVImark"); // the server names it, the copy never does
    await userEvent.click(within(dialog).getByRole("button", { name: "Sign and send to the PIMS" }));
    expect(onConfirm).toHaveBeenCalled();
  });

  it("Sign only says nothing goes to the PIMS yet", async () => {
    confirm("only", preview({ texts: [] }));
    const dialog = await screen.findByRole("dialog", { name: "Sign only?" });
    expect(
      await within(dialog).findByText(
        "Sign only saves your signature. You can send to the PIMS later from the signed note.",
      ),
    ).toBeInTheDocument();
    expect(within(dialog).getByText("No texts go out.")).toBeInTheDocument();
    expect(within(dialog).getByRole("button", { name: "Sign only" })).toBeEnabled();
  });

  it("shows the server's warning when the note's pet isn't today's appointment", async () => {
    confirm(
      "send",
      preview({ matches: false, mismatch: "This note is for Waffles, but the appointment is for Biscuit." }),
    );
    expect(
      await screen.findByText("This note is for Waffles, but the appointment is for Biscuit."),
    ).toBeInTheDocument();
  });
});
