import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expectAccessible } from "../test/axe";
import { ActionBar, ActionBarStatus, Button, ConfirmPopover, LevelBars, RecordingPill, SpeakerList, SpeakerRow, StatusPill } from "../index";

describe("ActionBar", () => {
  it("is a labeled region with its status first and its buttons after", async () => {
    render(
      <ActionBar label="Start the visit">
        <ActionBarStatus title="Biscuit · Sick visit (SOAP) · Exam 1" sub={'Or say "Start visit" to your glasses'} />
        <Button variant="primary" icon="mic">
          Start visit
        </Button>
      </ActionBar>,
    );
    const bar = screen.getByRole("region", { name: "Start the visit" });
    expect(within(bar).getByText("Biscuit · Sick visit (SOAP) · Exam 1")).toBeInTheDocument();
    expect(within(bar).getByRole("button", { name: "Start visit" })).toBeInTheDocument();
    await expectAccessible();
  });

  it("tells the page its height while it is on screen, so toasts sit above it", () => {
    const height = () => document.documentElement.style.getPropertyValue("--action-bar-height");
    const { unmount } = render(
      <ActionBar label="Sign the note">
        <Button>Sign</Button>
      </ActionBar>,
    );
    expect(height()).toMatch(/^\d+px$/);
    unmount();
    expect(height()).toBe("");
  });
});

describe("ConfirmPopover", () => {
  const ask = (onConfirm = vi.fn()) =>
    render(
      <ConfirmPopover
        trigger={<Button>Start visit</Button>}
        title="Did Jordan agree to recording?"
        description="Ask before you start."
        confirmLabel="Owner agreed, start"
        confirmIcon="mic"
        cancelLabel="Not yet"
        footnote={'Or say "Start visit" to your glasses.'}
        footnoteIcon="eyeglasses"
        onConfirm={onConfirm}
      />,
    );

  it("asks as a named dialog, focuses Not yet first, and confirms once", async () => {
    const onConfirm = vi.fn();
    ask(onConfirm);
    await userEvent.click(screen.getByRole("button", { name: "Start visit" }));
    const dialog = await screen.findByRole("dialog", { name: "Did Jordan agree to recording?" });
    expect(dialog).toHaveAccessibleDescription("Ask before you start.");
    expect(within(dialog).getByRole("button", { name: "Not yet" })).toHaveFocus();
    expect(within(dialog).getByText(/to your glasses/)).toBeInTheDocument();
    await expectAccessible(dialog);
    await userEvent.click(within(dialog).getByRole("button", { name: "Owner agreed, start" }));
    expect(onConfirm).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("Not yet and Escape close it without confirming", async () => {
    const onConfirm = vi.fn();
    ask(onConfirm);
    await userEvent.click(screen.getByRole("button", { name: "Start visit" }));
    await userEvent.click(await screen.findByRole("button", { name: "Not yet" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Start visit" }));
    await screen.findByRole("dialog");
    await userEvent.keyboard("{Escape}");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(onConfirm).not.toHaveBeenCalled();
  });
});

describe("SpeakerRow", () => {
  it("shows initials, name · role, the time and the words; someone unnamed gets a dashed avatar and an action", async () => {
    render(
      <SpeakerList label="Transcript">
        <SpeakerRow initials="AR" name="Dr. Ana Rivera" role="Provider" time="0:06">
          Hi Jordan.
        </SpeakerRow>
        <SpeakerRow name="Speaker 3" time="1:02" action={<Button variant="link">Who is this?</Button>} writing>
          He's 74 pounds today.
        </SpeakerRow>
      </SpeakerList>,
    );
    const rows = within(screen.getByRole("list", { name: "Transcript" })).getAllByRole("listitem");
    expect(rows[0]).toHaveTextContent("ARDr. Ana Rivera · Provider0:06Hi Jordan.");
    expect(within(rows[1]!).getByRole("button", { name: "Who is this?" })).toBeInTheDocument();
    expect(rows[1]!.querySelector(".animate-blink")).not.toBeNull();
    await expectAccessible();
  });
});

describe("RecordingPill and LevelBars", () => {
  it("says what is recording and reads the time out in words", async () => {
    render(
      <RecordingPill elapsed="04:32" elapsedLabel="4 minutes 32 seconds">
        Recording from glasses
      </RecordingPill>,
    );
    expect(screen.getByText("Recording from glasses")).toBeInTheDocument();
    expect(screen.getByText("4 minutes 32 seconds")).toHaveClass("sr-only");
    expect(screen.getByText("04:32")).toHaveAttribute("aria-hidden", "true");
    await expectAccessible();
  });

  it("bars are decorative unless labeled", () => {
    const { container } = render(<LevelBars bars={4} />);
    expect(container.firstElementChild).toHaveAttribute("aria-hidden", "true");
    expect(container.firstElementChild!.children).toHaveLength(4);
    render(<LevelBars label="Microphone level" level={() => 0.5} />);
    expect(screen.getByRole("img", { name: "Microphone level" })).toBeInTheDocument();
  });
});

describe("StatusPill", () => {
  it("is neutral with a check when all is well and a flask for a stand-in; red only when it's down", () => {
    const { container, rerender } = render(<StatusPill status="ok">Muse Spark · demo clinic</StatusPill>);
    const pill = () => container.firstElementChild!;
    expect(container.querySelector("[data-icon]")).toHaveAttribute("data-icon", "check_circle");
    expect(pill()).toHaveClass("text-text-secondary");
    rerender(<StatusPill status="demo">Mock AI · demo clinic</StatusPill>);
    expect(container.querySelector("[data-icon]")).toHaveAttribute("data-icon", "science");
    expect(pill()).toHaveClass("text-text-secondary");
    expect(screen.getByText("Mock AI · demo clinic")).toBeInTheDocument();
    rerender(<StatusPill status="error">Server offline</StatusPill>);
    expect(container.querySelector("[data-icon]")).toHaveAttribute("data-icon", "error");
    expect(pill()).toHaveClass("text-error");
  });
});
