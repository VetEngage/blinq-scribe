import { render, screen } from "@testing-library/react";
import { expectAccessible } from "../test/axe";
import { BrandMark, IconTile, MessagePreview } from "../index";

describe("BrandMark", () => {
  it("shows the name next to a decorative logo, and lets the caller hide the name", async () => {
    render(
      <header>
        <BrandMark name="Blinq Scribe" nameClassName="brand" />
      </header>,
    );
    const name = screen.getByText("Blinq Scribe");
    expect(name).toHaveClass("brand");
    expect(document.querySelector('[data-icon="graphic_eq"]')).toHaveAttribute("aria-hidden", "true");
    await expectAccessible();
  });
});

describe("IconTile", () => {
  it("is decorative, tinted by its tone", async () => {
    const { container } = render(
      <>
        <IconTile icon="description" />
        <IconTile icon="edit_document" tone="warning" size={40} />
      </>,
    );
    const [ok, draft] = Array.from(container.children);
    expect(ok).toHaveAttribute("aria-hidden", "true");
    // Neutral unless a tone is asked for: the row's words carry the meaning.
    expect(ok).toHaveClass("bg-divider", "text-text-secondary", "size-9");
    expect(draft).toHaveClass("bg-warning-bg", "text-warning", "size-10");
    await expectAccessible();
  });
});

describe("MessagePreview", () => {
  it("labels the message and keeps its line breaks", async () => {
    render(<MessagePreview label="What the owner will get" text={"Hi Jordan,\nBiscuit is ready."} />);
    expect(screen.getByText("What the owner will get")).toBeInTheDocument();
    const body = screen.getByText(/Biscuit is ready/);
    expect(body.tagName).toBe("P");
    expect(body).toHaveClass("whitespace-pre-wrap");
    await expectAccessible();
  });

  it("can announce itself and hold other content", () => {
    render(
      <MessagePreview role="status">
        <b>Email preview</b>
      </MessagePreview>,
    );
    expect(screen.getByRole("status")).toHaveTextContent("Email preview");
  });
});
