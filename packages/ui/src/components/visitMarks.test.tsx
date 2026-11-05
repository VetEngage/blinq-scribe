import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expectAccessible } from "../test/axe";
import { ConfirmMark, SourceChip, StepBar } from "../index";

describe("StepBar", () => {
  it("checks the done steps, marks the current one and shows the recorded length", async () => {
    render(
      <StepBar
        label="Where this visit is"
        steps={[
          { key: "record", label: "Record", state: "done", meta: "0:42" },
          { key: "draft", label: "Draft", state: "current" },
          { key: "sign", label: "Sign", state: "todo" },
          { key: "share", label: "Share", state: "todo" },
          { key: "follow", label: "Follow up", state: "todo" },
        ]}
      />,
    );
    const list = screen.getByRole("list", { name: "Where this visit is" });
    expect(list).toHaveTextContent("Record0:42, done");
    expect(screen.getByText("Draft").closest("li")).toHaveAttribute("aria-current", "step");
    expect(screen.getByText("Sign").closest("li")).not.toHaveAttribute("aria-current");
    await expectAccessible();
  });
});

describe("SourceChip", () => {
  it("is a small button that says where it goes", async () => {
    const go = vi.fn();
    render(
      <p>
        Right ear red and swollen.{" "}
        <SourceChip label="0:27, Dr. Ana Rivera, go to this line in the transcript" onClick={go}>
          0:27
        </SourceChip>
      </p>,
    );
    await userEvent.click(screen.getByRole("button", { name: /^0:27, Dr\. Ana Rivera/ }));
    expect(go).toHaveBeenCalledOnce();
    await expectAccessible();
  });
});

describe("ConfirmMark", () => {
  it("shows what to confirm in words, never the bracket", () => {
    render(<ConfirmMark>Confirm: name and dose</ConfirmMark>);
    const mark = screen.getByText("Confirm: name and dose");
    expect(mark.tagName).toBe("MARK");
    expect(mark).toHaveAttribute("data-confirm");
    expect(document.body.textContent).not.toContain("[");
  });
});
