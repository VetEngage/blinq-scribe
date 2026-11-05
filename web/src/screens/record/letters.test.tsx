import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router";
import type { Letter } from "../../api/types";

const api = vi.hoisted(() => ({
  letters: vi.fn(),
  letter: vi.fn(),
  contacts: vi.fn(),
  createLetter: vi.fn(),
  draftLetter: vi.fn(),
  updateLetter: vi.fn(),
  sendLetter: vi.fn(),
  deleteLetter: vi.fn(),
  letterPdfUrl: vi.fn(),
  patientProfile: vi.fn(),
  documents: vi.fn(),
  previousNotes: vi.fn(),
  invoices: vi.fn(),
  letterhead: vi.fn(),
  encounter: vi.fn(),
}));
vi.mock("../../api", () => ({ api }));

import { useApp } from "../../state/app";
import { SentLetters } from "./SentLetters";
import { LetterScreen } from "./LetterScreen";

const base: Letter = {
  id: "let-1",
  patient_id: "pat-1",
  patient_name: "Biscuit",
  encounter_id: "",
  kind: "referral",
  recipient: { name: "Dr. Priya Shah", clinic: "Lakeside Veterinary Dermatology", email: "referrals@lakeside.example" },
  reason: "Second ear infection this year.",
  urgency: "routine",
  attachments: { note_encounter_ids: [], photos: [], document_ids: [], invoice_ids: [] },
  body: "Dear Dr. Shah,\n\nThank you for seeing Biscuit.",
  status: "draft",
  drafted: "mock",
  owner_consent: false,
  created_at: "2026-10-30T09:00:00",
  updated_at: "2026-10-30T09:00:00",
  signed_by: "",
  signer_title: "",
  signed_at: null,
  sent_to: [],
  opened_at: null,
  sent: [],
  pdf_url: "",
};

beforeEach(() => {
  for (const f of Object.values(api)) f.mockReset();
  useApp.setState({ me: { via: "session", admin: false, user: null, permissions: ["letter.write", "letter.send"] } });
  api.patientProfile.mockResolvedValue({
    patient: { id: "pat-1", name: "Biscuit", species: "Canine", breed: "Golden Retriever", age: 6, alerts: [] },
    client: { id: "cl-1", first_name: "Jordan", last_name: "Lee", phones: ["+12175550142"], emails: [] },
    other_pets: [],
  });
  api.documents.mockResolvedValue([]);
  api.contacts.mockResolvedValue([base.recipient]);
  api.previousNotes.mockResolvedValue([]);
  api.invoices.mockResolvedValue({ invoices: [{ id: "inv-1", patient_id: "pat-1" }] });
  api.letterhead.mockResolvedValue({
    name: "Maple Street Animal Hospital",
    address: "120 Maple Street, Austin, TX",
    phone: "+12175550100",
    logo_url: "",
  });
});

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/patient/:patientId/letters/:letterId" element={<LetterScreen />} />
        <Route path="/patient/:patientId" element={<SentLetters patientId="pat-1" />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe("Documents, sent from the clinic", () => {
  it("lists each letter with where it went, Opened, and Finish for a draft", async () => {
    api.letters.mockResolvedValue([
      {
        ...base,
        id: "let-2",
        status: "opened",
        signed_by: "Dr. Ana Rivera",
        signer_title: "Dr. Ana Rivera, DVM",
        sent_to: ["emailed Oct 30 to r•••@lakeside.example"],
        attachments: { ...base.attachments, note_encounter_ids: ["enc-1"], document_ids: ["d1", "d2"] },
      },
      { ...base, recipient: { name: "", clinic: "", email: "" }, kind: "records" },
    ]);
    renderAt("/patient/pat-1");
    expect(await screen.findByText("Referral to Lakeside Veterinary Dermatology")).toBeInTheDocument();
    expect(screen.getByText("Opened")).toBeInTheDocument();
    expect(
      screen.getByText("Signed by Dr. Ana Rivera, DVM · emailed Oct 30 to r•••@lakeside.example · 3 attachments"),
    ).toBeInTheDocument();
    expect(screen.getByText("Records for another clinic", { selector: "b" })).toBeInTheDocument();
    expect(screen.getByText("Draft")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Finish" })).toBeInTheDocument();
    for (const name of ["Referral to a specialist", "Records for another clinic", "Letter for the owner"])
      expect(screen.getByRole("button", { name })).toBeInTheDocument();
  });
});

describe("Create a letter", () => {
  it("fills the recipient from a saved contact, drafts with Blinq, then signs and sends with the owner's copy", async () => {
    const drafted = { ...base, body: "Dear Dr. Shah,\n\nRight ear [confirm: start date] since Oct 23." };
    api.createLetter.mockResolvedValue(drafted);
    api.updateLetter.mockImplementation(async (_id: string, input: Partial<Letter>) => ({ ...drafted, ...input }));
    api.sendLetter.mockResolvedValue({
      letter: { ...drafted, status: "sent" },
      results: [
        {
          channel: "email",
          status: "preview",
          detail: "",
          to: "referrals@lakeside.example",
          subject: "Referral for Biscuit",
          body: "Dear Dr. Shah",
          text: "",
          url: "",
          pdf_url: "",
          expires_at: null,
        },
      ],
    });
    renderAt("/patient/pat-1/letters/new?kind=referral");
    expect(await screen.findByRole("heading", { name: "Create a letter" })).toBeInTheDocument();
    await userEvent.click(await screen.findByRole("button", { name: /Dr. Priya Shah · Lakeside/ }));
    expect(screen.getByLabelText("Specialist")).toHaveValue("Dr. Priya Shah");
    expect(screen.getByLabelText("Their email")).toHaveValue("referrals@lakeside.example");
    await userEvent.type(screen.getByLabelText("Reason for referral, in your words"), "Second ear infection.");
    // Invoices are listed but never attached unless checked.
    expect(await screen.findByRole("checkbox", { name: /Invoice/ })).not.toBeChecked();

    await userEvent.click(screen.getByRole("button", { name: "Draft with Blinq" }));
    await waitFor(() => expect(api.createLetter).toHaveBeenCalled());
    const [from, input, withDraft] = api.createLetter.mock.calls[0]!;
    expect(from).toEqual({ patient: "pat-1" });
    expect(withDraft).toBe(true);
    expect(input).toMatchObject({
      kind: "referral",
      reason: "Second ear infection.",
      owner_consent: false,
      attachments: { invoice_ids: [] },
    });
    // The draft shows on the letter with the gap marked to confirm, and Sign and send waits for it.
    const page = await screen.findByRole("article", { name: "The letter" });
    expect(within(page).getByText("Confirm: start date")).toBeInTheDocument();
    expect(screen.getByText("1 thing to confirm first")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Sign and send" })).toBeDisabled();

    await userEvent.click(screen.getByRole("button", { name: "Edit" }));
    const box = screen.getByRole("textbox", { name: "The letter" });
    await userEvent.clear(box);
    await userEvent.type(box, "Dear Dr. Shah, right ear since Oct 23.");
    await userEvent.click(screen.getByRole("button", { name: "Done" }));
    // Records go to another clinic only with the owner's consent.
    expect(screen.getByRole("button", { name: "Sign and send" })).toBeDisabled();
    await userEvent.click(screen.getByRole("checkbox", { name: /Jordan agreed to share these records/ }));
    await userEvent.click(screen.getByRole("button", { name: "Sign and send" }));

    await waitFor(() =>
      expect(api.sendLetter).toHaveBeenCalledWith("let-1", ["email"], "referrals@lakeside.example", true),
    );
    expect(api.updateLetter).toHaveBeenCalledWith(
      "let-1",
      expect.objectContaining({ owner_consent: true, body: "Dear Dr. Shah, right ear since Oct 23." }),
    );
    expect(await screen.findByText("Demo mode: the email that would go out")).toBeInTheDocument();
    expect(screen.getByText("Referral for Biscuit")).toBeInTheDocument();
  });

  it("a sent letter opens read only", async () => {
    api.letter.mockResolvedValue({ ...base, status: "sent", signed_by: "Dr. Ana Rivera" });
    renderAt("/patient/pat-1/letters/let-1");
    expect(await screen.findByText(/Signed by Dr. Ana Rivera. A signed letter can't be changed./)).toBeInTheDocument();
    expect(screen.getByLabelText("Specialist")).toBeDisabled();
    expect(screen.queryByRole("button", { name: "Sign and send" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Edit" })).not.toBeInTheDocument();
  });

  it("someone who can't write letters sees no Draft or Send", async () => {
    useApp.setState({ me: { via: "session", admin: false, user: null, permissions: ["letter.send"] } });
    renderAt("/patient/pat-1/letters/new?kind=records");
    expect(await screen.findByText("You can read this letter but not change it.")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Draft with Blinq" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Sign and send" })).not.toBeInTheDocument();
  });
});
