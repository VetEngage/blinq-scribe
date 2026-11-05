import { render, screen, within } from "@testing-library/react";
import { expectAccessible } from "../test/axe";
import { Button, Card, Caution, ConfirmDialog, FactsLine, IconButton, ListRow, Num, Tabs } from "../index";

describe("Card.Section", () => {
  it("is a Section heading 8 above its content, inside a card with 16 padding and 16 from head to body", async () => {
    const { container } = render(
      <Card>
        <Card.Title>Before the visit</Card.Title>
        <Card.Body className="gap-6">
          <Card.Section title="What's due">
            <p>Rabies vaccine</p>
          </Card.Section>
        </Card.Body>
      </Card>,
    );
    expect(container.firstElementChild).toHaveClass("p-4", "gap-4");
    const heading = screen.getByRole("heading", { name: "What's due", level: 3 });
    expect(heading).toHaveClass("text-section");
    expect(heading.parentElement).toHaveClass("gap-2");
    await expectAccessible();
  });
});

describe("ListRow", () => {
  it("is a Body strong title over a Meta line, with an icon lead, extra lines and a chevron", async () => {
    render(
      <ListRow lead="event" title="Recheck booked" meta="Nov 14" chevron>
        <span>Extra line</span>
      </ListRow>,
    );
    expect(screen.getByText("Recheck booked")).toHaveClass("text-body-strong");
    expect(screen.getByText("Nov 14")).toHaveClass("text-meta");
    expect(screen.getByText("Extra line")).toBeInTheDocument();
    expect(document.querySelector('[data-icon="event"]')).not.toBeNull();
    expect(document.querySelector('[data-icon="chevron_right"]')).not.toBeNull();
    await expectAccessible();
  });

  it("leads with a time as a Number that never wraps, and turns red for a failed item", () => {
    render(
      <>
        <ListRow lead={{ time: "10:00 AM" }} title="Biscuit" meta="Ear scratching" />
        <ListRow lead="error" tone="error" title="Text failed" action={<Button>Retry</Button>} />
      </>,
    );
    expect(screen.getByText("10:00 AM")).toHaveClass("font-num", "whitespace-nowrap", "text-body");
    expect(screen.getByText("Text failed")).toHaveClass("text-error");
    expect(screen.getByRole("button", { name: "Retry" })).toBeInTheDocument();
  });

  it("is one button with a chevron when it opens something, and marks the one open now", async () => {
    const open = vi.fn();
    render(
      <>
        <ListRow lead={{ time: "9:00 AM" }} title="Biscuit" meta="Ear scratching" onClick={open} current hint="Biscuit, ear scratching" />
        <ListRow lead={{ time: "9:30 AM" }} title="Miso" meta="Kidney recheck" onClick={open} />
      </>,
    );
    const row = screen.getByRole("button", { name: /^9:00 AM\s*Biscuit\s*Ear scratching/ });
    expect(row).toHaveAttribute("aria-current", "true");
    expect(row).toHaveAttribute("title", "Biscuit, ear scratching");
    expect(screen.getByRole("button", { name: /^9:30 AM\s*Miso/ })).not.toHaveAttribute("aria-current");
    expect(row.querySelector('[data-icon="chevron_right"]')).not.toBeNull();
    row.click();
    expect(open).toHaveBeenCalledTimes(1);
    await expectAccessible();
  });
});

describe("FactsLine and Num", () => {
  it("joins the facts on one Meta line, skipping empty ones, with the weight as a Number", () => {
    const { container } = render(<FactsLine items={["Golden Retriever", "", "6 years", <Num key="w">72 lb</Num>]} />);
    const line = container.firstElementChild!;
    expect(line).toHaveClass("text-meta");
    expect(line).toHaveTextContent("Golden Retriever · 6 years · 72 lb");
    expect(within(line as HTMLElement).getByText("72 lb")).toHaveClass("font-num", "whitespace-nowrap");
  });

  it("draws nothing without facts", () => {
    const { container } = render(<FactsLine items={[undefined, ""]} />);
    expect(container).toBeEmptyDOMElement();
  });
});

describe("Caution", () => {
  it("takes the role of its line, in ink", () => {
    render(
      <>
        <Caution items={["Fractious"]} />
        <Caution items={["Back problems"]} size="body" />
      </>,
    );
    const [meta, body] = document.querySelectorAll("[data-caution]");
    expect(meta).toHaveClass("text-meta", "text-text");
    expect(body).toHaveClass("text-body", "text-text");
  });
});

describe("one control type", () => {
  it("tabs, buttons and dialog titles use their roles", async () => {
    render(
      <>
        <Tabs.Root defaultValue="a">
          <Tabs.List aria-label="Record">
            <Tabs.Trigger value="a">Overview</Tabs.Trigger>
          </Tabs.List>
          <Tabs.Content value="a">A</Tabs.Content>
        </Tabs.Root>
        <Button variant="primary">Sign note</Button>
        <Button size="sm">Edit</Button>
        <IconButton icon="close" aria-label="Close" />
        <ConfirmDialog trigger={<Button>Delete</Button>} title="Delete?" description="It goes." confirmLabel="Delete" cancelLabel="Cancel" onConfirm={() => {}} />
      </>,
    );
    expect(screen.getByRole("tab", { name: "Overview" })).toHaveClass("text-body-strong");
    // Primary is 500 like every other control: the role is its only type, with no weight class of its own.
    for (const name of ["Sign note", "Edit"]) {
      const b = screen.getByRole("button", { name });
      expect(b).toHaveClass("text-body-strong");
      expect([...b.classList].filter((c) => /^font-(?!sans$)/.test(c))).toEqual([]);
    }
    await expectAccessible();
  });
});
