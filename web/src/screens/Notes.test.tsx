import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes, useLocation } from "react-router";
import type { NoteToSign } from "../api/types";

const api = vi.hoisted(() => ({
  notesToSign: vi.fn(),
  sign: vi.fn(),
  schedule: vi.fn(),
  brief: vi.fn(),
  waiting: vi.fn(),
  endOfDay: vi.fn(),
  encounter: vi.fn(),
}));
vi.mock("../api", () => ({ api }));

import { useApp } from "../state/app";
import { NotesScreen } from "./Notes";

const note = (id: string, bucket: "ready" | "pending", extra: Partial<NoteToSign> = {}): NoteToSign => ({
  encounter_id: `enc-${id}`,
  appointment_id: `${id}@2026-10-27`,
  patient_id: "p",
  patient_name: id,
  owner_name: "Jordan Lee",
  client_id: "c",
  provider_id: "prov-1",
  provider_name: "Dr. Ana Rivera",
  date: "2026-10-27",
  time: "10:15",
  visit_reason: "Nail trim",
  assessment: "Healthy rabbit.",
  status: "draft_ready",
  bucket,
  to_confirm: 0,
  followups_undecided: 0,
  reason: "",
  waiting_days: 5,
  ...extra,
});

function Where() {
  const l = useLocation();
  return <p data-testid="where">{l.pathname + l.search}</p>;
}

function show(path = "/notes?bucket=ready") {
  vi.clearAllMocks();
  const list = [
    note("Mochi", "ready"),
    note("Hazel", "ready", { date: "2026-10-26", time: "08:30", waiting_days: 6 }),
    note("Luna", "pending", { followups_undecided: 1, reason: "1 follow up to decide" }),
  ];
  api.notesToSign.mockResolvedValue(list);
  api.sign.mockImplementation((id: string) =>
    id === "enc-Hazel" ? Promise.reject(new Error("The PIMS is busy")) : Promise.resolve({}),
  );
  api.schedule.mockResolvedValue([]);
  api.brief.mockResolvedValue({ spoken: "" });
  api.waiting.mockResolvedValue([]);
  api.endOfDay.mockResolvedValue(false);
  useApp.setState({
    notes: list,
    provider: "prov-1",
    today: "2026-11-01",
    viewDate: "2026-11-01",
    doctors: [{ id: "prov-1", name: "Dr. Ana Rivera" }],
    me: { via: "open", admin: true, user: null, role: "", provider_id: "" },
  });
  render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/notes" element={<NotesScreen />} />
        <Route path="*" element={<Where />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe("Notes", () => {
  it("lists Ready to sign with every note picked, and the column says Waiting", () => {
    show();
    expect(screen.getByRole("tab", { name: /Ready to sign/ })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByText("Waiting")).toBeInTheDocument();
    expect(screen.queryByText("Age")).not.toBeInTheDocument();
    expect(screen.getByRole("checkbox", { name: "Select Mochi, Tue Oct 27" })).toBeChecked();
    expect(screen.getByText("2 selected", { selector: "span.text-meta" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Sign 2 notes/ })).toHaveClass("bg-primary");
  });

  it("signs the picked notes one by one after a confirm that lists each by pet and date", async () => {
    show();
    await userEvent.click(screen.getByRole("button", { name: /Sign 2 notes/ }));
    const dialog = screen.getByRole("dialog", { name: "Sign 2 notes" });
    expect(dialog).toHaveTextContent("Mochi");
    expect(dialog).toHaveTextContent("Tue Oct 27, 10:15 AM · Nail trim · Jordan Lee");
    expect(dialog).toHaveTextContent("Hazel");
    expect(dialog).toHaveTextContent("Signed as Dr. Ana Rivera");
    expect(within(dialog).getByRole("radio", { name: "Sign and send to the PIMS" })).toBeChecked();
    await userEvent.click(within(dialog).getByRole("button", { name: "Sign 2 notes" }));
    await waitFor(() => expect(api.sign).toHaveBeenCalledTimes(2));
    expect(api.sign).toHaveBeenNthCalledWith(1, "enc-Mochi", "Dr. Ana Rivera", true);
    expect(api.sign).toHaveBeenNthCalledWith(2, "enc-Hazel", "Dr. Ana Rivera", true);
    // Each note has its own result: the one that failed says why.
    expect(await within(dialog).findByText("The PIMS is busy")).toHaveClass("text-error");
    expect(within(dialog).getByText("1 of 2 didn't sign. The others are signed.")).toBeInTheDocument();
  });

  it("signs only, when asked", async () => {
    show();
    await userEvent.click(screen.getByRole("checkbox", { name: "Select Hazel, Mon Oct 26" }));
    await userEvent.click(screen.getByRole("button", { name: /Sign 1 note/ }));
    const dialog = screen.getByRole("dialog", { name: "Sign 1 note" });
    await userEvent.click(within(dialog).getByRole("radio", { name: "Sign only" }));
    await userEvent.click(within(dialog).getByRole("button", { name: "Sign 1 note" }));
    await waitFor(() => expect(api.sign).toHaveBeenCalledWith("enc-Mochi", "Dr. Ana Rivera", false));
    expect(await within(dialog).findByText("1 note signed.")).toBeInTheDocument();
  });

  it("Pending opens each note and has no bulk action", async () => {
    show("/notes?bucket=pending");
    expect(screen.getByText("1 follow up to decide")).toBeInTheDocument();
    expect(screen.queryByRole("checkbox")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Sign/ })).not.toBeInTheDocument();
  });
});
