import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router";
import { ToastProvider } from "@blinq-scribe/ui";
import type { Me, User } from "../../api/types";

const api = vi.hoisted(() => ({
  authStatus: vi.fn(),
  updateMyProfile: vi.fn(),
  changePassword: vi.fn(),
  setTwoFactor: vi.fn(),
  connectedAccounts: vi.fn(),
  connectAccount: vi.fn(),
  disconnectAccount: vi.fn(),
  signOutOthers: vi.fn(),
  signOutEverywhere: vi.fn(),
  logout: vi.fn(),
  startAuthenticator: vi.fn(),
  confirmAuthenticator: vi.fn(),
  speechOptions: vi.fn(async () => ({
    available: true,
    default_voice: "af_heart",
    voices: [
      { id: "af_heart", name: "Heart", language: "en-US", gender: "female" },
      { id: "am_michael", name: "Michael", language: "en-US", gender: "male" },
    ],
  })),
}));
vi.mock("../../api", () => ({ api }));

import { useApp } from "../../state/app";
import { AccountScreen } from "./Account";
import { passwordStrength } from "./rules";

const ana: User = {
  id: "u1",
  username: "arivera",
  name: "Dr. Ana Rivera",
  email: "ana@clinic.test",
  provider_id: "prov-1",
  role: "vet",
  active: true,
  has_password: true,
  two_factor: false,
  two_factor_required: false,
  created_at: "2026-10-01T00:00:00Z",
};

function renderAs(me: Me) {
  useApp.setState({ me, doctors: [{ id: "prov-1", name: "Dr. Ana Rivera" }] });
  return render(
    <ToastProvider>
      <MemoryRouter initialEntries={["/account"]}>
        <Routes>
          <Route path="/account" element={<AccountScreen />} />
          <Route path="/sign-in" element={<p>Sign in page</p>} />
        </Routes>
      </MemoryRouter>
    </ToastProvider>,
  );
}
const signedIn = (user: Partial<User> = {}): Me => ({ via: "session", admin: false, user: { ...ana, ...user } });

beforeEach(() => {
  Object.values(api).forEach((f) => f.mockReset());
  api.authStatus.mockResolvedValue({ login_required: true, google: true, microsoft: false, password_reset: true });
  api.connectedAccounts.mockResolvedValue([]);
});

describe("Account: demo", () => {
  it("the open demo shows the note and no forms", () => {
    renderAs({ via: "open", admin: true, user: null });
    expect(
      screen.getByText(/You're in the demo clinic. Account settings apply to invited accounts./),
    ).toBeInTheDocument();
    expect(screen.getByText(/Sign in with your own account to change settings./)).toBeInTheDocument();
    expect(screen.queryByLabelText("Name", { exact: true })).not.toBeInTheDocument();
  });

  it("the demo vet sees every section locked", () => {
    renderAs(signedIn({ username: "demo.vet", email: "" }));
    expect(screen.getByText(/You're in the demo clinic.*The demo account can't be changed\./)).toBeInTheDocument();
    expect(screen.getByLabelText("Name", { exact: true })).toBeDisabled();
    expect(screen.getByLabelText("Email", { exact: true })).toBeDisabled();
    // The demo vet has no password by design: the Password card shows the demo notice only.
    expect(screen.queryByLabelText("New password")).not.toBeInTheDocument();
    expect(screen.queryByText(/You sign in with Google or Microsoft/)).not.toBeInTheDocument();
    expect(screen.getByRole("switch", { name: /Ask for a code/ })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Sign out on all other devices" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Sign out everywhere, this one too" })).toBeDisabled();
  });
});

describe("Account: profile", () => {
  it("saves a new name and shows a toast", async () => {
    api.updateMyProfile.mockResolvedValue({ ...ana, name: "Dr. Ana R. Rivera" });
    renderAs(signedIn());
    expect(screen.getByLabelText("Username")).toHaveAttribute("readonly");
    expect(screen.getByLabelText("Name", { exact: true })).toHaveAttribute("maxlength", "80");
    expect(screen.getByText("Your admin sets your role and provider.")).toBeInTheDocument();
    const name = screen.getByLabelText("Name", { exact: true });
    await userEvent.clear(name);
    await userEvent.type(name, "Dr. Ana R. Rivera");
    await userEvent.click(screen.getByRole("button", { name: "Save profile" }));
    expect(api.updateMyProfile).toHaveBeenCalledWith({ name: "Dr. Ana R. Rivera" });
    expect(await screen.findByText("Profile saved")).toBeInTheDocument();
    expect(useApp.getState().me?.user?.name).toBe("Dr. Ana R. Rivera");
  });

  it("asks for the current password to change the email, and shows the server's refusal", async () => {
    api.updateMyProfile.mockRejectedValue(new Error("That password isn't right."));
    renderAs(signedIn());
    const email = screen.getByLabelText("Email", { exact: true });
    await userEvent.clear(email);
    await userEvent.type(email, "ana@new.test");
    await userEvent.click(screen.getByRole("button", { name: "Save profile" }));
    expect(await screen.findByText("Enter your current password to change your email.")).toBeInTheDocument();
    expect(api.updateMyProfile).not.toHaveBeenCalled();
    await userEvent.type(screen.getByLabelText("Current password", { selector: "#accEmailPassword" }), "wrong one");
    await userEvent.click(screen.getByRole("button", { name: "Save profile" }));
    expect(api.updateMyProfile).toHaveBeenCalledWith({ email: "ana@new.test", current_password: "wrong one" });
    expect(await screen.findByText("That password isn't right.")).toHaveAttribute("role", "alert");
  });
});

describe("Account: password", () => {
  it("checks length and match before sending, with a strength hint", async () => {
    api.changePassword.mockResolvedValue(true);
    renderAs(signedIn());
    await userEvent.type(screen.getByLabelText("Current password", { selector: "#pwCurrent" }), "old password 1");
    await userEvent.type(screen.getByLabelText("New password"), "short");
    expect(screen.getByText(/Too short/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Change password" }));
    expect(api.changePassword).not.toHaveBeenCalled();
    await userEvent.clear(screen.getByLabelText("New password"));
    await userEvent.type(screen.getByLabelText("New password"), "Correct-Horse-42");
    await userEvent.type(screen.getByLabelText("Type it again"), "Correct-Horse-42");
    await userEvent.click(screen.getByRole("button", { name: "Change password" }));
    expect(api.changePassword).toHaveBeenCalledWith("old password 1", "Correct-Horse-42");
    expect(await screen.findByText("Password changed")).toBeInTheDocument();
  });

  it("an account without a password can set one without a current password", async () => {
    api.changePassword.mockResolvedValue(true);
    renderAs(signedIn({ has_password: false }));
    expect(screen.getByText(/there's no password yet/)).toBeInTheDocument();
    expect(screen.queryByLabelText("Current password", { selector: "#pwCurrent" })).not.toBeInTheDocument();
    await userEvent.type(screen.getByLabelText("New password"), "Correct-Horse-42");
    await userEvent.type(screen.getByLabelText("Type it again"), "Correct-Horse-42");
    await userEvent.click(screen.getByRole("button", { name: "Set password" }));
    expect(api.changePassword).toHaveBeenCalledWith("", "Correct-Horse-42");
  });

  it("rates passwords roughly", () => {
    expect([
      passwordStrength(""),
      passwordStrength("abc"),
      passwordStrength("abcdefghijk"),
      passwordStrength("Abcdefgh12!x"),
    ]).toEqual(["", "short", "fair", "strong"]);
  });
});

describe("Account: two-step sign in", () => {
  it("turns codes on and says where they go", async () => {
    api.setTwoFactor.mockResolvedValue({ ...ana, two_factor: true });
    renderAs(signedIn());
    expect(screen.getByText(/we email a 6 digit code to ana@clinic.test/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole("switch", { name: /Ask for a code/ }));
    expect(api.setTwoFactor).toHaveBeenCalledWith(true);
    expect(await screen.findByText("Two-step sign in is on")).toBeInTheDocument();
  });

  it("is locked on when the admin requires it", () => {
    renderAs(signedIn({ two_factor: true, two_factor_required: true }));
    const sw = screen.getByRole("switch", { name: /Ask for a code/ });
    expect(sw).toBeChecked();
    expect(sw).toBeDisabled();
    expect(screen.getByText(/Your admin requires this/)).toBeInTheDocument();
  });

  it("flips back and shows why when the server refuses", async () => {
    api.setTwoFactor.mockRejectedValue(new Error("Email isn't set up here, so codes can't be sent."));
    renderAs(signedIn());
    const sw = screen.getByRole("switch", { name: /Ask for a code/ });
    await userEvent.click(sw);
    expect(await screen.findByText("Email isn't set up here, so codes can't be sent.")).toBeInTheDocument();
    expect(sw).not.toBeChecked();
  });
});

describe("Account: connected accounts and sessions", () => {
  it("Connect asks for the password first, then goes to the provider in this tab", async () => {
    const assign = vi.fn();
    vi.stubGlobal("location", { ...window.location, assign });
    api.connectAccount.mockResolvedValue("https://accounts.google.test/auth?x=1");
    renderAs(signedIn());
    expect(await screen.findByText("Google")).toBeInTheDocument();
    expect(screen.queryByText("Microsoft")).not.toBeInTheDocument();
    await userEvent.click(await screen.findByRole("button", { name: "Connect" }));
    const dialog = screen.getByRole("alertdialog", { name: "Connect Google?" });
    const go = screen.getAllByRole("button", { name: "Connect" }).at(-1)!;
    expect(go).toBeDisabled();
    await userEvent.type(screen.getByLabelText("Current password", { selector: "#confirmPassword" }), "my password");
    await userEvent.click(go);
    expect(dialog).not.toBeInTheDocument();
    expect(api.connectAccount).toHaveBeenCalledWith("google", "my password");
    expect(assign).toHaveBeenCalledWith("https://accounts.google.test/auth?x=1");
    vi.unstubAllGlobals();
  });

  it("an account without a password connects straight away; the server checks the sign in", async () => {
    vi.stubGlobal("location", { ...window.location, assign: vi.fn() });
    api.connectAccount.mockRejectedValue(
      new Error("Sign out and sign in again, then make this change within 10 minutes."),
    );
    renderAs(signedIn({ has_password: false }));
    await userEvent.click(await screen.findByRole("button", { name: "Connect" }));
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
    expect(await screen.findByText(/Sign out and sign in again/)).toHaveAttribute("role", "alert");
    vi.unstubAllGlobals();
  });

  it("Disconnect asks first and shows the server's refusal", async () => {
    api.connectedAccounts.mockResolvedValue([{ provider: "google", email: "ana@gmail.test", connected_at: null }]);
    api.disconnectAccount.mockRejectedValue(new Error("Set a password first: Google is your only way to sign in."));
    renderAs(signedIn());
    expect(await screen.findByText("Connected as ana@gmail.test")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Disconnect" }));
    expect(screen.getByRole("alertdialog", { name: "Disconnect Google?" })).toBeInTheDocument();
    await userEvent.type(screen.getByLabelText("Current password", { selector: "#confirmPassword" }), "my password");
    await userEvent.click(screen.getAllByRole("button", { name: "Disconnect" }).at(-1)!);
    expect(await screen.findByText("Set a password first: Google is your only way to sign in.")).toBeInTheDocument();
    expect(api.disconnectAccount).toHaveBeenCalledWith("google", "my password");
  });

  it("Sign out on all other devices asks first and keeps this session", async () => {
    api.signOutOthers.mockResolvedValue(true);
    renderAs(signedIn());
    await userEvent.click(screen.getByRole("button", { name: "Sign out on all other devices" }));
    await userEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(api.signOutOthers).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole("button", { name: "Sign out on all other devices" }));
    await userEvent.click(screen.getAllByRole("button", { name: "Sign out on all other devices" }).at(-1)!);
    expect(await screen.findByText("Signed out on your other devices")).toBeInTheDocument();
    expect(api.signOutOthers).toHaveBeenCalledTimes(1);
    expect(screen.queryByText("Sign in page")).not.toBeInTheDocument();
  });

  it("Sign out everywhere, this one too, ends this session as well", async () => {
    api.signOutEverywhere.mockResolvedValue(true);
    renderAs(signedIn());
    await userEvent.click(screen.getByRole("button", { name: "Sign out everywhere, this one too" }));
    await userEvent.click(screen.getAllByRole("button", { name: "Sign out everywhere, this one too" }).at(-1)!);
    expect(await screen.findByText("Sign in page")).toBeInTheDocument();
  });
});

describe("Voice", () => {
  it("picks a server voice and a speed, kept in this browser for this person", async () => {
    useApp.setState({ me: { via: "session", admin: false, user: ana } });
    api.authStatus.mockResolvedValue({ login_required: true });
    api.connectedAccounts.mockResolvedValue([]);
    render(
      <ToastProvider>
        <MemoryRouter>
          <AccountScreen />
        </MemoryRouter>
      </ToastProvider>,
    );
    const pick = await screen.findByRole("combobox", { name: "Voice" });
    await waitFor(() => expect(pick).toHaveTextContent("Heart (default)"));
    await userEvent.click(pick);
    await userEvent.click(await screen.findByRole("option", { name: "Michael" }));
    await userEvent.click(screen.getByRole("radio", { name: "Faster" }));
    expect(JSON.parse(localStorage.getItem("blinq.voice.u1") ?? "{}")).toEqual({
      voice: "server:am_michael",
      speed: 1.2,
    });
    expect(screen.getByRole("button", { name: "Read aloud" })).toBeInTheDocument();
  });
});

describe("Two-step sign in with an authenticator app", () => {
  it("asks for the password, shows the key, and turns on only after a code from the app", async () => {
    useApp.setState({ me: { via: "session", admin: false, user: { ...ana, has_password: true } } });
    api.authStatus.mockResolvedValue({ login_required: true });
    api.connectedAccounts.mockResolvedValue([]);
    api.startAuthenticator.mockResolvedValue({
      secret: "JBSWY3DPEHPK3PXP",
      otpauth_uri: "otpauth://totp/Blinq:arivera?secret=JBSWY3DPEHPK3PXP",
    });
    api.confirmAuthenticator.mockResolvedValue({ ...ana, two_factor: true, authenticator: true });
    render(
      <ToastProvider>
        <MemoryRouter>
          <AccountScreen />
        </MemoryRouter>
      </ToastProvider>,
    );
    await userEvent.click(await screen.findByRole("button", { name: "Set up" }));
    const dialog = await screen.findByRole("dialog", { name: "Set up an authenticator app" });
    await userEvent.type(within(dialog).getByLabelText("Current password"), "Correct-Horse-42");
    await userEvent.click(within(dialog).getByRole("button", { name: "Continue" }));
    expect(api.startAuthenticator).toHaveBeenCalledWith("Correct-Horse-42");
    expect(await within(dialog).findByText("JBSW Y3DP EHPK 3PXP")).toBeInTheDocument();
    expect(within(dialog).getByRole("img", { name: /QR code/ })).toBeInTheDocument();
    expect(within(dialog).getByRole("link", { name: "Open in your authenticator app" })).toHaveAttribute(
      "href",
      "otpauth://totp/Blinq:arivera?secret=JBSWY3DPEHPK3PXP",
    );
    const turnOn = within(dialog).getByRole("button", { name: "Turn it on" });
    expect(turnOn).toBeDisabled();
    await userEvent.type(within(dialog).getByLabelText("Code from the app"), "123 456");
    await userEvent.click(turnOn);
    expect(api.confirmAuthenticator).toHaveBeenCalledWith("123456");
    expect(await screen.findByText("Authenticator app is on")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Set up again" })).toBeInTheDocument();
  });
});
