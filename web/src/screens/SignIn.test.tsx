import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router";

const api = vi.hoisted(() => ({
  authStatus: vi.fn(),
  health: vi.fn(),
  signIn: vi.fn(),
  verifyCode: vi.fn(),
  resendCode: vi.fn(),
  demoSignIn: vi.fn(),
  forgotPassword: vi.fn(),
  startOAuth: vi.fn(),
  finishOAuth: vi.fn(),
}));
vi.mock("../api", () => ({ api }));

import { useSession } from "../api/session";
import { SignIn } from "./SignIn";

function renderSignIn() {
  return render(
    <MemoryRouter initialEntries={["/sign-in"]}>
      <Routes>
        <Route path="/sign-in" element={<SignIn />} />
        <Route path="/" element={<p>Console home</p>} />
      </Routes>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  Object.values(api).forEach((f) => f.mockReset());
  api.health.mockResolvedValue({ practice: "mock" });
  useSession.getState().clear();
});

describe("Sign in", () => {
  it("shows Google and Microsoft only when the server has them, and the demo clinic in demo mode", async () => {
    api.authStatus.mockResolvedValue({ login_required: true, google: true, microsoft: false, demo: true });
    renderSignIn();
    expect(await screen.findByRole("button", { name: "Continue with Google" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Continue with Microsoft" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Try the demo clinic" })).toBeInTheDocument();
  });

  it("shows Forgot password only when the server can email a reset link", async () => {
    api.authStatus.mockResolvedValue({ login_required: true, password_reset: false });
    const { unmount } = renderSignIn();
    expect(await screen.findByRole("button", { name: "Sign in" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Forgot password?" })).not.toBeInTheDocument();
    unmount();
    api.authStatus.mockResolvedValue({ login_required: true, password_reset: true });
    renderSignIn();
    await userEvent.click(await screen.findByRole("button", { name: "Forgot password?" }));
    api.forgotPassword.mockResolvedValue(true);
    await userEvent.type(screen.getByLabelText("Email"), "ana@clinic.test");
    await userEvent.click(screen.getByRole("button", { name: "Email me a link" }));
    expect(await screen.findByText("If that email has an account, we sent a link.")).toBeInTheDocument();
  });

  it("shows why Google or Microsoft sign in was turned down", async () => {
    window.history.replaceState(null, "", "/sign-in#oauth_error=Sign%20in%20with%20your%20password%20first.");
    api.authStatus.mockResolvedValue({ login_required: true });
    renderSignIn();
    expect(await screen.findByText("Sign in with your password first.")).toHaveAttribute("role", "alert");
    expect(window.location.hash).toBe("");
  });

  it("checks the fields before sending anything", async () => {
    api.authStatus.mockResolvedValue({ login_required: true });
    renderSignIn();
    await userEvent.click(await screen.findByRole("button", { name: "Sign in" }));
    expect(await screen.findByText("Enter your email.")).toBeInTheDocument();
    expect(screen.getByText("Enter your password.")).toBeInTheDocument();
    expect(api.signIn).not.toHaveBeenCalled();
  });

  it("asks for the 6 digit code when 2FA is on, then signs in with Remember me", async () => {
    api.authStatus.mockResolvedValue({ login_required: true });
    api.signIn.mockResolvedValue({ kind: "code_needed", challenge: "ticket-1", sent_to: "a***@clinic.test" });
    api.verifyCode.mockResolvedValue("sess-9");
    renderSignIn();
    await userEvent.type(await screen.findByLabelText("Email or username"), "ana@clinic.test");
    await userEvent.type(screen.getByLabelText("Password"), "correct horse");
    await userEvent.click(screen.getByRole("checkbox", { name: "Remember me" }));
    await userEvent.click(screen.getByRole("button", { name: "Sign in" }));
    expect(api.signIn).toHaveBeenCalledWith("ana@clinic.test", "correct horse", true);

    expect(await screen.findByText(/We sent a 6 digit code to a\*\*\*@clinic.test/)).toBeInTheDocument();
    expect(screen.queryByText(/printed in the server terminal/)).not.toBeInTheDocument();
    await userEvent.type(screen.getByLabelText("6 digit code"), "12ab");
    await userEvent.click(screen.getByRole("button", { name: "Verify and sign in" }));
    expect(await screen.findByText("Enter the 6 digits from the email.")).toBeInTheDocument();

    await userEvent.clear(screen.getByLabelText("6 digit code"));
    await userEvent.type(screen.getByLabelText("6 digit code"), "123456");
    await userEvent.click(screen.getByRole("button", { name: "Verify and sign in" }));
    expect(await screen.findByText("Console home")).toBeInTheDocument();
    expect(api.verifyCode).toHaveBeenCalledWith("ticket-1", "123456");
    expect(useSession.getState().token).toBe("sess-9");
    expect(localStorage.getItem("blinq_scribe_session")).toBe("sess-9");
  });

  it("shows the server's message when sign in fails", async () => {
    api.authStatus.mockResolvedValue({ login_required: true });
    api.signIn.mockRejectedValue(new Error("Wrong email or password"));
    renderSignIn();
    await userEvent.type(await screen.findByLabelText("Email or username"), "ana");
    await userEvent.type(screen.getByLabelText("Password"), "nope");
    await userEvent.click(screen.getByRole("button", { name: "Sign in" }));
    expect(await screen.findByText("Wrong email or password")).toHaveAttribute("role", "alert");
  });
});
