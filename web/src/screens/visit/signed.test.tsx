import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Button, ToastProvider } from "@blinq-scribe/ui";
import type { Encounter, SoapNote } from "../../api/types";

const api = vi.hoisted(() => ({ sendToPims: vi.fn() }));
vi.mock("../../api", () => ({ api }));

import { useApp } from "../../state/app";
import { PimsItems, PimsLine } from "./PimsStatus";
import { usePims } from "./usePims";
import { NoteSections, SignedNote } from "./NoteView";

const enc = (write_back: Encounter["write_back"], can = { sign: true }, extra: Partial<Encounter> = {}) =>
  ({
    id: "enc-1",
    status: "signed",
    write_back,
    can,
    photos: [],
    note: { medications: [] },
    ...extra,
  }) as unknown as Encounter;

/** The banner's line, the item list and the bar's send, as the Signed page wires them. */
function Pims({ e, setCurrent }: { e: Encounter; setCurrent: (e: Encounter) => void }) {
  const pims = usePims(e, setCurrent);
  return (
    <>
      <PimsLine pims={pims} open onToggle={() => {}} />
      <PimsItems e={e} pims={pims} />
      {pims.canSend && (
        <Button onClick={() => void pims.send()}>{pims.overall === "failed" ? "Try again" : "Send to the PIMS"}</Button>
      )}
    </>
  );
}

const show = (e: Encounter, setCurrent = vi.fn()) =>
  render(
    <ToastProvider>
      <Pims e={e} setCurrent={setCurrent} />
    </ToastProvider>,
  );

describe("PIMS status on a signed note, item by item", () => {
  it("saved: one gray line, each item saved, and the prescription is for the front desk", () => {
    const at = "2026-11-01T09:52:00";
    show(
      enc({ ok: true, status: "written", detail: "", pims_id: "4471", at }, { sign: true }, {
        note: { medications: ["Cefpodoxime 100 mg, once a day, 7 days"] },
        pims_items: [
          { kind: "note", id: "note", label: "Note", status: "synced", synced_at: at, pims_id: "4471", detail: "" },
          {
            kind: "photo",
            id: "p1",
            label: "Photo: Left ear",
            status: "synced",
            synced_at: at,
            pims_id: "4472",
            detail: "",
          },
          {
            kind: "prescription",
            id: "prescription",
            label: "Prescription",
            status: "not_sent",
            pims_id: "",
            detail: "Prescriptions aren't sent to the PIMS yet",
          },
        ],
      } as unknown as Partial<Encounter>),
    );
    expect(screen.getByRole("button", { name: "Saved to the PIMS" })).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByText("Photo: Left ear")).toBeInTheDocument();
    expect(screen.getAllByText("Saved 9:52 AM")).toHaveLength(2);
    expect(screen.getByText("#4472")).toBeInTheDocument();
    // Blinq never sends a prescription (PRD 65): gray, no Send, and it doesn't hold the visit back.
    expect(screen.getByText("Front desk enters it")).toHaveClass("text-meta");
    expect(screen.getByText("Cefpodoxime 100 mg, once a day, 7 days")).toBeInTheDocument();
    expect(screen.queryByText(/aren't sent to the PIMS yet/)).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Send to|Try again/ })).not.toBeInTheDocument();
  });

  it("couldn't save: red, with the retry line, and Try again lands it", async () => {
    const setCurrent = vi.fn();
    api.sendToPims.mockResolvedValue(enc({ ok: true, status: "written", detail: "", pims_id: "4471" }));
    show(enc({ ok: false, status: "failed", detail: "The practice system refused the note." }), setCurrent);
    expect(screen.getByRole("button", { name: "Couldn't save to the PIMS" })).toHaveClass("tone-error");
    expect(screen.getByText("Retrying every 5 minutes · The practice system refused the note.")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(api.sendToPims).toHaveBeenCalledWith("enc-1");
    expect(setCurrent).toHaveBeenCalled();
    expect(await screen.findByText("Sent to the PIMS")).toBeInTheDocument();
  });

  it("not sent yet: says so in ink, not red, and a refused send says why", async () => {
    api.sendToPims.mockRejectedValue(new Error("The PIMS is offline"));
    show(
      enc({ ok: false, status: "queued_for_staff", detail: "Couldn't reach the practice system. Waiting for staff." }),
    );
    expect(screen.getByRole("button", { name: "Not sent to the PIMS yet" })).not.toHaveClass("tone-error");
    expect(screen.getByText("Couldn't reach the practice system. Waiting for staff.")).toBeInTheDocument();
    expect(screen.getByText("Not sent")).not.toHaveClass("tone-error");
    await userEvent.click(screen.getByRole("button", { name: "Send to the PIMS" }));
    expect(await screen.findByText("Couldn't send it: The PIMS is offline")).toBeInTheDocument();
  });

  it("only the signing vet can send", () => {
    show(enc({ ok: false, status: "queued_for_staff", detail: "" }, { sign: false }));
    expect(screen.queryByRole("button", { name: "Send to the PIMS" })).not.toBeInTheDocument();
  });
});

describe("a note read only", () => {
  it("shows each section under its heading, or the text as written", () => {
    const { rerender } = render(
      <NoteSections
        sections={[
          { label: "Subjective", text: "Scratching the right ear." },
          { label: "Plan", text: "Recheck in 14 days." },
        ]}
        raw="ignored"
      />,
    );
    expect(screen.getByRole("heading", { name: "Subjective" })).toBeInTheDocument();
    expect(screen.getByText("Recheck in 14 days.")).toBeInTheDocument();
    rerender(<NoteSections sections={null} raw={"Subjective: old note\nPlan: as written"} />);
    expect(screen.queryByRole("heading")).not.toBeInTheDocument();
    expect(screen.getByText(/old note/)).toBeInTheDocument();
  });

  it("reads an old confirm mark as not confirmed, in AI purple, never the raw bracket", () => {
    render(<NoteSections raw="Ear recheck. [confirm: weight] Cone for 7 days." />);
    expect(screen.queryByText(/\[confirm/)).not.toBeInTheDocument();
    expect(screen.getByText("weight, not confirmed")).toHaveClass("text-ai");
  });

  it("a signed note in its note type's sections, with vitals and medications", () => {
    useApp.setState({
      noteTypes: [
        {
          id: "soap",
          name: "Sick visit (SOAP)",
          sections: [
            { key: "subjective", label: "Subjective" },
            { key: "objective", label: "Objective" },
            { key: "assessment", label: "Assessment" },
            { key: "plan", label: "Plan" },
            { key: "client_summary", label: "For the owner" },
          ],
        },
      ],
    });
    const note = {
      subjective: "Scratching the right ear.",
      objective: "Right canal red.",
      assessment: "Otitis externa.",
      plan: "Recheck in 14 days.",
      client_summary: "Give one pill a day.",
      vitals: { weight: "74 lb" },
      medications: ["Cefpodoxime 100 mg"],
    } as unknown as SoapNote;
    render(<SignedNote note={note} noteType="soap" />);
    for (const h of ["Vitals", "Subjective", "Objective", "Assessment", "Plan", "Medications", "For the owner"])
      expect(screen.getByRole("heading", { name: h })).toBeInTheDocument();
    expect(screen.getByText("Cefpodoxime 100 mg")).toBeInTheDocument();
  });
});
