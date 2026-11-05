import { render, screen } from "@testing-library/react";
import { expectAccessible } from "../test/axe";
import { Caution } from "../index";

describe("Caution", () => {
  it("says every caution in one line after one amber dot, never a warning triangle", async () => {
    const { container } = render(<Caution items={["Fractious, use towel wrap", "Kidney values trending up"]} />);
    expect(screen.getByText("Fractious, use towel wrap and kidney values trending up")).toBeInTheDocument();
    expect(container.querySelectorAll(".bg-caution")).toHaveLength(1);
    expect(container.querySelector("[data-icon]")).toBeNull();
    // Not filled: the text is the normal text color.
    expect(container.firstElementChild).toHaveClass("text-text");
    expect(container.firstElementChild).not.toHaveClass("bg-warning-bg");
    await expectAccessible();
  });

  it("says them all in full, even when asked for fewer or short labels, with the line in the tooltip", async () => {
    const { container } = render(
      <button type="button">
        Miso
        <Caution
          compact
          max={1}
          labeled
          label="Caution"
          items={[
            { text: "Fractious, use towel wrap", short: "Towel wrap" },
            { text: "Kidney values trending up", short: "Kidney values" },
            { text: "ALT high", short: "ALT" },
          ]}
        />
      </button>,
    );
    const line = "Fractious, use towel wrap, kidney values trending up and ALT high";
    // The words on screen (the screen reader's copy is its own span).
    expect(container.querySelector("[data-caution] > [aria-hidden]:last-child")).toHaveTextContent(`Caution: ${line}`);
    expect(screen.queryByText("+1")).not.toBeInTheDocument();
    expect(container.querySelector("[data-caution]")).toHaveAttribute("title", line);
    expect(screen.getByRole("button")).toHaveAccessibleName(new RegExp(`^Miso\\s*Caution: ${line}$`));
    await expectAccessible();
  });

  it("in the rail, is its own amber line with the dot, and screen readers hear the word first", async () => {
    const { container } = render(
      <button type="button">
        Luna
        <Caution
          compact
          size="rail"
          max={2}
          label="Caution"
          items={[{ text: "Brachycephalic, watch airway under sedation", short: "Watch airway" }]}
        />
      </button>,
    );
    const caution = container.querySelector("[data-caution]")!;
    expect(caution).toHaveClass("text-warning");
    expect(caution).not.toHaveAttribute("title");
    expect(caution.querySelector(".bg-caution")).not.toBeNull();
    expect(screen.getByText("Brachycephalic, watch airway under sedation")).toBeInTheDocument();
    expect(screen.getByRole("button")).toHaveAccessibleName(
      /^Luna\s*Caution: Brachycephalic, watch airway under sedation$/,
    );
    await expectAccessible();
  });

  it("renders nothing without cautions", () => {
    const { container } = render(<Caution items={[]} />);
    expect(container).toBeEmptyDOMElement();
  });
});
