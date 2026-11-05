import { render, screen } from "@testing-library/react";
import { expectAccessible } from "../test/axe";
import { CountTitle, LabelValue, LabelValueGrid, SpeciesTile, speciesKind, speciesLabel } from "../index";

describe("SpeciesTile", () => {
  it("maps practice species words to a kind and a plain label", () => {
    expect(speciesKind("Canine")).toBe("dog");
    expect(speciesKind("Feline")).toBe("cat");
    expect(speciesKind("Avian")).toBe("bird");
    expect(speciesKind("Lagomorph")).toBe("rabbit");
    expect(speciesKind("Ferret")).toBe("other");
    expect(speciesLabel("Canine")).toBe("Dog");
    expect(speciesLabel("Ferret")).toBe("Ferret");
  });

  it("draws a paw, a bird or a rabbit, and is decorative", () => {
    const { container } = render(
      <>
        <SpeciesTile species="Dog" />
        <SpeciesTile species="Bird" />
        <SpeciesTile species="Rabbit" />
      </>,
    );
    const icons = [...container.querySelectorAll("[data-icon]")].map((e) => e.getAttribute("data-icon"));
    expect(icons).toEqual(["pets", "flutter_dash", "cruelty_free"]);
    for (const tile of container.children) expect(tile).toHaveAttribute("aria-hidden", "true");
  });
});

describe("LabelValueGrid and CountTitle", () => {
  it("puts a Meta label over a Body value, skips empty ones and sets ids as a Number", async () => {
    render(
      <LabelValueGrid aria-label="Owner" cols={3}>
        <LabelValue label="Name" value="Jordan Lee" />
        <LabelValue label="Client id" value="cli-1" num />
        <LabelValue label="Email" value="" />
        <LabelValue label="Balance" value="" hideEmpty={false} />
      </LabelValueGrid>,
    );
    expect(screen.getByText("Jordan Lee").tagName).toBe("DD");
    expect(screen.getByText("Jordan Lee")).toHaveClass("text-body");
    expect(screen.getByText("Name")).toHaveClass("text-meta");
    expect(screen.getByText("cli-1")).toHaveClass("font-num");
    // No gray box: the facts sit on the card.
    expect(screen.getByText("Name").closest("dl")).not.toHaveClass("bg-surface-muted");
    expect(screen.queryByText("Email")).not.toBeInTheDocument();
    expect(screen.getByText("Balance")).toBeInTheDocument();
    expect(screen.getByText("None")).toBeInTheDocument();
    await expectAccessible();
  });

  it("puts the count next to the heading", () => {
    render(<CountTitle count={5}>Pets</CountTitle>);
    expect(screen.getByRole("heading", { name: "Pets 5", level: 2 })).toHaveClass("text-title");
    expect(screen.getByText("5")).toHaveClass("text-meta", "font-num");
  });
});
