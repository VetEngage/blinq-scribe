import { act, fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expectAccessible } from "../test/axe";
import { PetInitials, RailCard, RailFree, RailHousehold, RailMore, RailNow, RailPetRow, RailRow, RailStatus } from "../index";

describe("RailHousehold", () => {
  it("folded, shows only the owner and how many pets, with nothing else", async () => {
    const open = vi.fn();
    render(
      <RailHousehold
        time="2:00 PM"
        owner="Jordan Lee"
        count="3 pets"
        pets={["Hazel", "Kiwi", "Mochi"]}
        status={<RailStatus tone="count">1 of 3 signed</RailStatus>}
        onClick={open}
      >
        <RailPetRow title="Hazel" reason="Stiff getting up" onClick={() => undefined} />
      </RailHousehold>,
    );
    const row = screen.getByRole("button", { name: /Jordan Lee/ });
    expect(row).toHaveAttribute("aria-expanded", "false");
    expect(row).toHaveTextContent(/^2:00 PMJordan Lee3 pets$/);
    expect(screen.queryByText("1 of 3 signed")).toBeNull();
    expect(screen.queryByRole("button", { name: /Hazel/ })).toBeNull();
    await userEvent.click(row);
    expect(open).toHaveBeenCalled();
    await expectAccessible();
  });

  it("open, shows the status, the pets' initials and one two-line row per pet", async () => {
    const pick = vi.fn();
    render(
      <RailHousehold
        time="2:00 PM"
        owner="Jordan Lee"
        count="3 pets"
        pets={["Hazel", "Kiwi", "Mochi"]}
        status={<RailStatus tone="count">1 of 3 signed</RailStatus>}
        open
        current
        onClick={() => undefined}
      >
        <RailPetRow
          title="Hazel"
          facts="Dog, 13 years"
          sub="Beagle"
          reason="Stiff getting up"
          status={<RailStatus tone="signed">Signed</RailStatus>}
          onClick={pick}
        />
        <RailPetRow
          title="Kiwi"
          reason="Wellness exam"
          current
          status={<RailStatus tone="draft">Draft ready</RailStatus>}
          onClick={pick}
        />
        <RailPetRow
          title="Mochi"
          reason="Eating less hay"
          last
          cautions={[{ text: "Fearful, use towel wrap", short: "Towel wrap" }]}
          onClick={pick}
        />
      </RailHousehold>,
    );
    expect(screen.getByRole("button", { name: /Jordan Lee/ })).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByText("1 of 3 signed")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Hazel/ })).toHaveTextContent(/^HazelDog, 13 yearsSignedBeagleStiff getting up$/);
    expect(screen.getByRole("button", { name: /Kiwi/ })).toHaveAttribute("aria-current", "true");
    // Not started says nothing; the caution is its own amber line.
    const mochi = screen.getByRole("button", { name: /Mochi/ });
    expect(mochi).not.toHaveTextContent(/Not started/);
    expect(mochi.querySelector("[data-caution]")).toHaveClass("text-warning");
    expect(mochi).toHaveAccessibleName(/Caution: Fearful, use towel wrap/);
    await userEvent.click(screen.getByRole("button", { name: /Hazel/ }));
    expect(pick).toHaveBeenCalledTimes(1);
    await expectAccessible();
  });
});

describe("PetInitials", () => {
  it("shows each pet's first letter, hidden from screen readers", () => {
    const { container } = render(<PetInitials names={["Hazel", "Kiwi", "Mochi"]} />);
    expect(container.firstChild).toHaveAttribute("aria-hidden", "true");
    expect(container).toHaveTextContent("HKM");
  });
});

describe("RailRow", () => {
  it("is two lines: time, name, species and age, the breed, then the reason wrapping to two lines", async () => {
    render(
      <RailRow
        time="10:15 AM"
        title="Mochi"
        facts="Cat, 3 years"
        sub="Domestic Shorthair"
        reason="Nail trim, owner says she is eating less this week"
        status={<RailStatus tone="visit">In visit</RailStatus>}
        onClick={() => undefined}
      />,
    );
    const row = screen.getByRole("button", { name: /Mochi/ });
    expect(row).toHaveTextContent(/^10:15 AMMochiCat, 3 yearsIn visitDomestic ShorthairNail trim, owner says/);
    // The reason wraps to at most two lines: never one line cut short.
    const reason = screen.getByText(/^Nail trim/);
    expect(reason).toHaveClass("line-clamp-2");
    expect(reason).not.toHaveClass("truncate");
    expect(screen.getByText("Mochi")).toHaveClass("text-rail-name");
    expect(row.querySelector("[data-caution]")).toBeNull();
    await expectAccessible();
  });

  it("puts the cautions on their own amber line with the dot, in full", () => {
    render(
      <RailRow
        time="3:00 PM"
        title="Luna"
        reason="Red, itchy skin"
        cautions={[{ text: "Brachycephalic, watch airway under sedation", short: "Watch airway" }]}
        cautionLabel="Caution"
        onClick={() => undefined}
      />,
    );
    const row = screen.getByRole("button", { name: /Luna/ });
    const caution = row.querySelector("[data-caution]")!;
    expect(caution).toHaveClass("text-warning");
    expect(caution.querySelector(".bg-caution")).not.toBeNull();
    expect(caution).toHaveTextContent("Brachycephalic, watch airway under sedation");
    expect(row).toHaveAccessibleName(/Caution: Brachycephalic, watch airway under sedation$/);
  });
});

describe("RailStatus", () => {
  it("says only what means something, each in its one color", () => {
    const { container } = render(
      <>
        <RailStatus tone="visit">In visit</RailStatus>
        <RailStatus tone="draft">Draft ready</RailStatus>
        <RailStatus tone="signed">Signed</RailStatus>
        <RailStatus tone="failed">Text didn't send</RailStatus>
      </>,
    );
    // In visit: a green dot, never red; Draft ready: the AI's purple sparkle; Signed: a green check.
    expect(screen.getByText("In visit")).toHaveClass("text-primary");
    expect(container.querySelector('[data-status="visit"] .bg-primary')).not.toBeNull();
    expect(container.querySelector(".bg-error, .rec-dot")).toBeNull();
    expect(screen.getByText("Draft ready")).toHaveClass("text-ai");
    expect(container.querySelector('[data-status="draft"] [data-icon="auto_awesome"]')).not.toBeNull();
    expect(screen.getByText("Signed")).toHaveClass("text-success");
    expect(container.querySelector('[data-status="signed"] [data-icon="check"]')).not.toBeNull();
    // Red is for something broken.
    expect(screen.getByText("Text didn't send")).toHaveClass("text-error");
  });

  it("pulses the green dot only while audio comes in", () => {
    const { container, rerender } = render(<RailStatus tone="visit">In visit</RailStatus>);
    expect(container.querySelector(".animate-pulse-dot")).toBeNull();
    rerender(
      <RailStatus tone="visit" live>
        In visit
      </RailStatus>,
    );
    expect(container.querySelector(".animate-pulse-dot")).toHaveClass("bg-primary");
  });
});

const card = (onOpen = () => undefined) => (
  <RailCard
    name="Mochi"
    facts={["Cat", "Domestic Shorthair", "Female, spayed", "3 years", "9.8 lb"]}
    details={[
      { label: "Owner", value: "Priya Shah · (555) 014-2290" },
      { label: "Last visit", value: "Sep 12 · Ear infection" },
      { label: "Phone", value: "" },
    ]}
    reason={{ label: "Reason", text: "Nail trim" }}
    notes={{ label: "From PIMS", aside: "Synced 8:02 AM", items: ["Fear Free: muzzle and towel for nails"] }}
    alerts={{ label: "Alerts", items: [], none: "No alerts in PIMS" }}
    readOnly="Read only"
    open={{ label: "Open visit", href: "/visit/a1", onClick: onOpen }}
  />
);

describe("RailCard", () => {
  it("is read only: the pet, owner, last visit, reason, the PIMS's notes and alerts, and one link", async () => {
    const onOpen = vi.fn();
    render(card(onOpen));
    expect(screen.getByText("Mochi")).toBeInTheDocument();
    expect(screen.getByText("Priya Shah · (555) 014-2290")).toBeInTheDocument();
    expect(screen.queryByText("Phone")).toBeNull();
    expect(screen.getByText("Synced 8:02 AM")).toBeInTheDocument();
    expect(screen.getByText("No alerts in PIMS")).toBeInTheDocument();
    expect(screen.queryAllByRole("button")).toHaveLength(0);
    expect(screen.queryByRole("textbox")).toBeNull();
    await userEvent.click(screen.getByRole("link", { name: "Open visit" }));
    expect(onOpen).toHaveBeenCalled();
    await expectAccessible();
  });

  it("lists alerts in amber", () => {
    render(
      <RailCard
        name="Luna"
        facts={[]}
        details={[]}
        alerts={{ label: "Alerts", items: ["Watch airway under sedation"], none: "No alerts in PIMS" }}
        readOnly="Read only"
        open={{ label: "Open visit", onClick: () => undefined }}
      />,
    );
    expect(screen.getByText("Watch airway under sedation").closest("ul")).toHaveClass("text-warning");
    expect(screen.queryByText("No alerts in PIMS")).toBeNull();
    expect(screen.queryByText("From PIMS")).toBeNull();
  });
});

describe("the quick card on a rail row", () => {
  afterEach(() => vi.useRealTimers());

  it("opens on keyboard focus as the row's tooltip, and closes on Esc", async () => {
    render(<RailRow time="10:15 AM" title="Mochi" reason="Nail trim" card={card()} onClick={() => undefined} />);
    const row = screen.getByRole("button", { name: /Mochi/ });
    expect(screen.queryByRole("tooltip")).toBeNull();
    await userEvent.tab();
    expect(row).toHaveFocus();
    const tip = await screen.findByRole("tooltip");
    expect(tip).toHaveTextContent("From PIMS");
    expect(row.getAttribute("aria-describedby")).toBe(tip.id);
    await userEvent.keyboard("{Escape}");
    expect(screen.queryByRole("tooltip")).toBeNull();
    expect(row).not.toHaveAttribute("aria-describedby");
  });

  it("opens on hover after about 300 ms, never at once", () => {
    vi.useFakeTimers();
    render(<RailRow time="10:15 AM" title="Mochi" reason="Nail trim" card={card()} onClick={() => undefined} />);
    const row = screen.getByRole("button", { name: /Mochi/ });
    fireEvent.pointerMove(row, { pointerType: "mouse" });
    act(() => void vi.advanceTimersByTime(200));
    expect(screen.queryByRole("tooltip")).toBeNull();
    act(() => void vi.advanceTimersByTime(150));
    expect(screen.getByRole("tooltip")).toHaveTextContent("Open visit");
  });

  it("never opens on touch: a tap opens the visit", () => {
    vi.useFakeTimers();
    const open = vi.fn();
    render(<RailRow time="10:15 AM" title="Mochi" reason="Nail trim" card={card()} onClick={open} />);
    const row = screen.getByRole("button", { name: /Mochi/ });
    fireEvent.pointerMove(row, { pointerType: "touch" });
    act(() => void vi.advanceTimersByTime(600));
    expect(screen.queryByRole("tooltip")).toBeNull();
    fireEvent.click(row);
    expect(open).toHaveBeenCalled();
  });

  it("the card's Open visit link opens the visit and closes the card, also when focus opened it", async () => {
    const onOpen = vi.fn();
    render(<RailRow time="10:15 AM" title="Mochi" reason="Nail trim" card={card(onOpen)} onClick={() => undefined} />);
    await userEvent.tab();
    const tip = await screen.findByRole("tooltip");
    // A real press: pointer down moves focus first, which must not close the card before the click.
    await userEvent.click(within(tip).getByRole("link", { name: "Open visit" }));
    expect(onOpen).toHaveBeenCalled();
    expect(screen.queryByRole("tooltip")).toBeNull();
  });
});

describe("RailNow", () => {
  it("is a separator at the clinic's time, heard as Now, then the time", async () => {
    render(<RailNow label="Now 5:49 PM" name="Now, 5:49 PM" track={{ above: true, below: true }} />);
    const now = screen.getByRole("separator", { name: "Now, 5:49 PM" });
    expect(now).toHaveTextContent("Now 5:49 PM");
    await expectAccessible();
  });
});

describe("the rail's line", () => {
  it("gives each row one dot for its status, hidden from screen readers", () => {
    const tones = ["todo", "visit", "draft", "signed", "failed"] as const;
    render(
      <>
        {tones.map((dot) => (
          <RailRow key={dot} time="9:00 AM" title={dot} track={{ dot, above: true, below: true }} onClick={() => undefined} />
        ))}
      </>,
    );
    const rows = screen.getAllByRole("button");
    for (const [i, dot] of tones.entries()) {
      const row = rows[i]!;
      const mark = row.querySelector("[data-dot]")!;
      expect(mark).toHaveAttribute("data-dot", dot);
      expect(mark).toHaveAttribute("aria-hidden", "true");
      // The dot never says anything: the row's text is only what it was.
      expect(row).toHaveTextContent(new RegExp(`^9:00 AM${dot}$`));
    }
    expect(rows[0]!.querySelector("[data-dot]")).toHaveClass("border-border-strong", "bg-surface");
    // In visit pulses, and stops when the device asks for less motion.
    expect(rows[1]!.querySelector("[data-dot]")).toHaveClass("bg-primary", "animate-pulse-dot", "motion-reduce:animate-none");
    expect(rows[2]!.querySelector("[data-dot]")).toHaveClass("bg-ai");
    expect(rows[3]!.querySelector("[data-dot] svg")).not.toBeNull();
    expect(rows[4]!.querySelector("[data-dot]")).toHaveClass("bg-error");
  });

  it("starts at the first dot and ends at the last", () => {
    render(
      <>
        <RailRow time="9:00 AM" title="First" track={{ dot: "todo", below: true }} onClick={() => undefined} />
        <RailRow time="10:00 AM" title="Last" track={{ dot: "todo", above: true }} onClick={() => undefined} />
      </>,
    );
    const first = screen.getByRole("button", { name: /First/ });
    const last = screen.getByRole("button", { name: /Last/ });
    // A dot and the line's half below it; a dot and the half above it.
    expect(first.querySelectorAll("[aria-hidden=true].bg-border-strong")).toHaveLength(1);
    expect(first.querySelector("[aria-hidden=true].bg-border-strong")).toHaveClass("bottom-0");
    expect(last.querySelector("[aria-hidden=true].bg-border-strong")).toHaveClass("top-0");
  });

  it("shows a free stretch as a dashed line with a quiet label, and a household as one dot", () => {
    const { container } = render(
      <>
        <RailFree label="Free until 1:30 PM" track={{ above: true, below: true }} />
        <RailHousehold
          time="2:00 PM"
          owner="Jordan Lee"
          count="3 pets"
          pets={["Hazel", "Kiwi", "Mochi"]}
          open
          track={{ dot: "draft", above: true }}
          onClick={() => undefined}
        >
          <RailPetRow title="Hazel" status={<RailStatus tone="signed">Signed</RailStatus>} onClick={() => undefined} />
          <RailPetRow title="Kiwi" last onClick={() => undefined} />
        </RailHousehold>
      </>,
    );
    expect(screen.getByText("Free until 1:30 PM")).toHaveClass("text-rail-sub");
    expect(container.querySelector(".border-dashed")).toHaveAttribute("aria-hidden", "true");
    expect(container.querySelectorAll("[data-dot]")).toHaveLength(1);
  });

  it("puts the Done row on the line with its dot", () => {
    render(
      <RailMore open={false} onClick={() => undefined} track={{ dot: "signed", below: true }}>
        Done · 9
      </RailMore>,
    );
    const done = screen.getByRole("button", { name: "Done · 9" });
    expect(done.querySelector("[data-dot]")).toHaveAttribute("data-dot", "signed");
  });
});
