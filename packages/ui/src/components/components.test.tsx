import { act, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { expectAccessible } from "../test/axe";
import {
  AiLabel, Alert, Avatar, Badge, Banner, Button, Card, Checkbox, CheckboxField, Chip, ConfirmDialog, DemoTag, Dialog, DropdownMenu,
  EmptyState, FileInput, FormError, FormField, Icon, IconButton, KeyValueList, KeyValueRow, ListRow, PageHeader, Pill, Pressable,
  RadioCards, RadioChips, SectionHeader, Segmented, Select, Combobox, Skeleton, Spinner, StaticChip, StatusText, Switch, SwitchField, Tabs, Tag,
  TextArea, TextField, Tile, TileRow, ToastProvider, ToolButton, TypingDots, useToast,
} from "../index";

describe("Icon", () => {
  it("is decorative and draws its glyph from CSS, never as text", async () => {
    const { container } = render(<Icon name="check" fill size={20} />);
    const el = container.firstElementChild!;
    expect(el).toHaveAttribute("aria-hidden", "true");
    expect(el).toHaveAttribute("data-icon", "check");
    expect(el.textContent).toBe("");
    await expectAccessible();
  });
});

describe("Button and IconButton", () => {
  it("variants and sizes render as real buttons, type button by default", async () => {
    render(
      <>
        <Button variant="primary" icon="check">Save</Button>
        <Button variant="secondary" size="sm">Cancel</Button>
        <Button variant="ghost" size="lg">Later</Button>
        <Button variant="danger">Delete</Button>
        <Button variant="link">More</Button>
        <IconButton icon="close" aria-label="Close" />
      </>,
    );
    for (const name of ["Save", "Cancel", "Later", "Delete", "More", "Close"]) expect(screen.getByRole("button", { name })).toHaveAttribute("type", "button");
    await expectAccessible();
  });

  it("loading disables it, says it's busy and shows a spinner", async () => {
    const click = vi.fn();
    render(<Button loading onClick={click}>Sign</Button>);
    const b = screen.getByRole("button", { name: "Sign" });
    expect(b).toBeDisabled();
    expect(b).toHaveAttribute("aria-busy", "true");
    await userEvent.click(b);
    expect(click).not.toHaveBeenCalled();
  });

  it("ToolButton and Pressable are keyboard buttons too", async () => {
    const press = vi.fn();
    render(
      <>
        <ToolButton icon="mic" pressed pressedTone="recording">Dictate</ToolButton>
        <ToolButton tone="ai">Tighten</ToolButton>
        <Pressable onClick={press}>9:00 Biscuit</Pressable>
      </>,
    );
    expect(screen.getByRole("button", { name: "Dictate" })).toHaveAttribute("aria-pressed", "true");
    screen.getByRole("button", { name: "9:00 Biscuit" }).focus();
    await userEvent.keyboard("{Enter}");
    expect(press).toHaveBeenCalled();
    await expectAccessible();
  });
});

describe("Card, Tile", () => {
  it("one look, with header, title, body and footer; floating and compact variants", async () => {
    render(
      <>
        <Card>
          <Card.Header><Card.Title>Transcript</Card.Title><Button>Save</Button></Card.Header>
          <Card.Body>Text</Card.Body>
          <Card.Footer divided>Footer</Card.Footer>
        </Card>
        <Card variant="floating" density="compact" highlighted>Panel</Card>
        <TileRow><Tile label="Weight" value="74 lb" /><Tile label="Temp" value="[confirm]" tone="ai" grow /></TileRow>
      </>,
    );
    expect(screen.getByRole("heading", { name: "Transcript", level: 2 })).toBeInTheDocument();
    expect(screen.getByText("Panel").className).toContain("shadow-pop");
    // A value Blinq wants confirmed is AI purple, not amber.
    expect(screen.getByText("[confirm]")).toHaveClass("text-ai");
    expect(screen.getByText("Transcript").closest('div[class*="shadow-card"]')).not.toBeNull();
    expect(screen.getByText("Transcript")).toHaveClass("text-title");
    // A value is never larger than its line, whether the tile grows or not.
    expect(screen.getByText("[confirm]")).toHaveClass("text-body", "font-num");
    expect(screen.getByText("74 lb")).toHaveClass("text-body", "font-num");
    await expectAccessible();
  });
});

describe("Tag, Pill, Badge, DemoTag, AiLabel", () => {
  it("status tones read as text", async () => {
    render(
      <>
        <Tag icon="pets">Biscuit</Tag>
        <Tag tone="success" icon="verified" fill>Signed</Tag>
        <Pill tone="error" dot="pulse">Recording</Pill>
        <Pill tone="success" icon="check_circle">Muse Spark ready</Pill>
        <Badge>2</Badge>
        <DemoTag />
        <AiLabel>Drafted by Blinq</AiLabel>
      </>,
    );
    for (const text of ["Biscuit", "Signed", "Recording", "2", "Demo", "Drafted by Blinq"]) expect(screen.getByText(text)).toBeInTheDocument();
    // The count is neutral: the rows under it say what needs attention.
    expect(screen.getByText("2")).toHaveClass("text-meta", "font-num");
    // Chrome is Meta; the tone's color comes after it, so it wins.
    expect(screen.getByText("Signed").closest("span")).toHaveClass("text-meta", "text-primary");
    await expectAccessible();
  });
});

describe("Banner, Alert, Toast", () => {
  it("banner is a status; an urgent alert is an alert", async () => {
    render(
      <>
        <Banner>Signed by Dr. Rivera.</Banner>
        <Alert>Hint</Alert>
        <Alert tone="warning">Check each line</Alert>
        <Alert tone="success" action={<Button size="sm">Undo</Button>}>Approved.</Alert>
        <Alert tone="error" urgent>Not sent</Alert>
      </>,
    );
    expect(screen.getByRole("status")).toHaveTextContent("Signed by Dr. Rivera.");
    expect(screen.getByRole("alert")).toHaveTextContent("Not sent");
    await expectAccessible();
  });

  it("a toast is read out politely and goes away by itself", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    function Saver() {
      const toast = useToast();
      return <Button onClick={() => toast.show("Profile saved")}>Save</Button>;
    }
    render(<ToastProvider duration={1000}><Saver /></ToastProvider>);
    await userEvent.click(screen.getByRole("button", { name: "Save" }));
    const live = screen.getByText("Profile saved").closest("[aria-live]");
    expect(live).toHaveAttribute("role", "status");
    await expectAccessible();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1100);
    });
    expect(screen.queryByText("Profile saved")).not.toBeInTheDocument();
    vi.useRealTimers();
  });
});

describe("Dialog and ConfirmDialog", () => {
  it("a dialog has its title as its name and a labelled close button", async () => {
    function Open() {
      const [open, setOpen] = useState(true);
      return <Dialog open={open} onOpenChange={setOpen} title="Add a photo" closeLabel="Close"><p>Body</p></Dialog>;
    }
    render(<Open />);
    const dialog = screen.getByRole("dialog", { name: "Add a photo" });
    await expectAccessible();
    await userEvent.click(within(dialog).getByRole("button", { name: "Close" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("confirm asks first: Cancel does nothing, Confirm runs once", async () => {
    const ok = vi.fn();
    render(<ConfirmDialog trigger={<Button>Delete</Button>} title="Delete this photo?" description="It leaves the visit." confirmLabel="Delete photo" cancelLabel="Keep it" tone="danger" onConfirm={ok} />);
    await userEvent.click(screen.getByRole("button", { name: "Delete" }));
    expect(screen.getByRole("alertdialog", { name: "Delete this photo?" })).toBeInTheDocument();
    await expectAccessible();
    await userEvent.click(screen.getByRole("button", { name: "Keep it" }));
    expect(ok).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole("button", { name: "Delete" }));
    await userEvent.click(screen.getByRole("button", { name: "Delete photo" }));
    expect(ok).toHaveBeenCalledTimes(1);
  });
});

describe("DropdownMenu", () => {
  it("opens from its button and items are menu items", async () => {
    const pick = vi.fn();
    render(
      <DropdownMenu.Root>
        <DropdownMenu.Trigger asChild><Button>Your account</Button></DropdownMenu.Trigger>
        <DropdownMenu.Content>
          <DropdownMenu.Label>Dr. Ana Rivera</DropdownMenu.Label>
          <DropdownMenu.Item icon="manage_accounts" onSelect={pick}>Account</DropdownMenu.Item>
        </DropdownMenu.Content>
      </DropdownMenu.Root>,
    );
    await userEvent.click(screen.getByRole("button", { name: "Your account" }));
    await userEvent.click(screen.getByRole("menuitem", { name: "Account" }));
    expect(pick).toHaveBeenCalled();
  });

  it("radio items show the picked one and report a change", async () => {
    const change = vi.fn();
    render(
      <DropdownMenu.Root>
        <DropdownMenu.Trigger asChild><Button>Your account</Button></DropdownMenu.Trigger>
        <DropdownMenu.Content>
          <DropdownMenu.Separator />
          <DropdownMenu.RadioGroup value="system" onValueChange={change}>
            <DropdownMenu.RadioItem value="light" icon="light_mode">Light</DropdownMenu.RadioItem>
            <DropdownMenu.RadioItem value="system" icon="contrast">System</DropdownMenu.RadioItem>
          </DropdownMenu.RadioGroup>
        </DropdownMenu.Content>
      </DropdownMenu.Root>,
    );
    await userEvent.click(screen.getByRole("button", { name: "Your account" }));
    expect(screen.getByRole("menuitemradio", { name: "System" })).toHaveAttribute("aria-checked", "true");
    await userEvent.click(screen.getByRole("menuitemradio", { name: "Light" }));
    expect(change).toHaveBeenCalledWith("light");
  });
});

describe("Tabs", () => {
  it("arrow keys move between tabs", async () => {
    render(
      <Tabs.Root defaultValue="a">
        <Tabs.List aria-label="Record"><Tabs.Trigger value="a">Past visits</Tabs.Trigger><Tabs.Trigger value="b">Invoices</Tabs.Trigger></Tabs.List>
        <Tabs.Content value="a">A</Tabs.Content>
        <Tabs.Content value="b">B</Tabs.Content>
      </Tabs.Root>,
    );
    screen.getByRole("tab", { name: "Past visits" }).focus();
    await userEvent.keyboard("{ArrowRight}");
    expect(screen.getByRole("tab", { name: "Invoices" })).toHaveAttribute("aria-selected", "true");
    await expectAccessible();
  });
});

describe("Switch, Checkbox, RadioCards, RadioChips, Chip, Segmented", () => {
  it("each is a labelled control that the keyboard can change", async () => {
    const onSeg = vi.fn();
    render(
      <>
        <SwitchField id="sw" label="Add to the note" description="Saved with the note." defaultChecked />
        <Switch aria-label="Bare switch" />
        <CheckboxField id="cb" label="Remember me" />
        <Checkbox aria-label="Bare checkbox" />
        <RadioCards aria-label="How to share" defaultValue="text" options={[{ value: "text", icon: "sms", title: "Text a link", description: "***1234" }, { value: "email", title: "Email a PDF" }]} />
        <RadioChips aria-label="Recheck time" defaultValue="9" options={[{ value: "9", label: "9:00" }, { value: "10", label: "10:00" }]} />
        <Chip pressed>Sick</Chip>
        <Chip dashed icon="add">Waffles</Chip>
        <StaticChip icon="check">Biscuit</StaticChip>
        <Segmented aria-label="Language" value="en" onValueChange={onSeg} options={[{ value: "en", label: "English" }, { value: "es", label: "Spanish" }]} />
      </>,
    );
    expect(screen.getByRole("switch", { name: /Add to the note/ })).toBeChecked();
    await userEvent.click(screen.getByLabelText("Remember me"));
    expect(screen.getByRole("checkbox", { name: "Remember me" })).toBeChecked();
    await userEvent.click(screen.getByRole("radio", { name: /Email a PDF/ }));
    expect(screen.getByRole("radio", { name: /Email a PDF/ })).toBeChecked();
    expect(screen.getByRole("radio", { name: "9:00" })).toBeChecked();
    expect(screen.getByRole("button", { name: "Sick" })).toHaveAttribute("aria-pressed", "true");
    await userEvent.click(screen.getByRole("radio", { name: "Spanish" }));
    expect(onSeg).toHaveBeenCalledWith("es");
    await expectAccessible();
  });
});

describe("FormField, TextField, TextArea, FileInput, FormError, StatusText", () => {
  it("wires the label, hint and error to the control", async () => {
    render(
      <>
        <FormField label="Email" hint="Codes go here." error="Enter a valid email.">
          <TextField type="email" />
        </FormField>
        <FormField label="Notes">{(a) => <TextArea {...a} />}</FormField>
        <TextField aria-label="Search" icon="search" />
        <FileInput label="Choose a photo" accept="image/png" onFile={() => {}}><span>Add records</span></FileInput>
        <FormError>Wrong password</FormError>
        <StatusText>Saved</StatusText>
      </>,
    );
    const email = screen.getByLabelText("Email");
    expect(email).toHaveAttribute("aria-invalid", "true");
    expect(email).toHaveAccessibleDescription("Enter a valid email. Codes go here.");
    expect(screen.getByLabelText("Notes").tagName).toBe("TEXTAREA");
    expect(screen.getByLabelText("Choose a photo")).toHaveAttribute("type", "file");
    expect(screen.getByRole("alert")).toHaveTextContent("Wrong password");
    await expectAccessible();
  });
});

describe("PageHeader, SectionHeader, EmptyState, KeyValue, ListRow, Avatar, Spinner, Skeleton, TypingDots", () => {
  it("read in order with the right headings", async () => {
    render(
      <main>
        <PageHeader eyebrow="Settings" title="Account" sub="Dr. Ana Rivera" actions={<Button>Open household</Button>} />
        <SectionHeader title="Profile" actions={<Button>Edit</Button>} />
        <EmptyState icon="pets">Pick a visit.</EmptyState>
        <KeyValueList align="right">
          <KeyValueRow label="Phone" value="555 0100" num />
          <KeyValueRow label="Alerts" value="" />
          <KeyValueRow label="Microchip" value="" hideEmpty />
        </KeyValueList>
        <ListRow lead="event" title="Recheck booked" meta="Nov 14" action={<Button size="sm">Open</Button>} />
        <Avatar initials="AR" />
        <Avatar icon="person" label="Owner" />
        <Spinner label="Loading" />
        <Skeleton className="w-20" />
        <TypingDots />
      </main>,
    );
    expect(screen.getByRole("heading", { level: 1, name: "Account" })).toHaveClass("text-display");
    expect(screen.getByRole("heading", { level: 2, name: "Profile" })).toBeInTheDocument();
    expect(screen.getByText("None")).toBeInTheDocument();
    expect(screen.queryByText("Microchip")).not.toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent("Loading");
    await expectAccessible();
  });
});

describe("cx", () => {
  it("keeps a token text size next to a text color, and lets a later class win", async () => {
    const { cx } = await import("../cx");
    expect(cx("text-meta text-text-secondary")).toBe("text-meta text-text-secondary");
    expect(cx("text-meta text-ai")).toBe("text-meta text-ai");
    expect(cx("rounded-tile shadow-card", "rounded-card")).toBe("shadow-card rounded-card");
    expect(cx("text-body", "text-body-strong")).toBe("text-body-strong");
    expect(cx("font-sans", "font-num")).toBe("font-num");
    expect(cx("h-8 px-3", false, undefined, "h-10")).toBe("px-3 h-10");
  });
});

const roles = [
  { value: "vet", label: "Provider" },
  { value: "front_office", label: "Front office" },
  { value: "admin", label: "Admin", disabled: true },
];

describe("Select", () => {
  it("is labelled by FormField, opens with the keyboard, checks the chosen item and reports the pick", async () => {
    const picked: string[] = [];
    function Demo() {
      const [v, setV] = useState("vet");
      return (
        <FormField label="Role" error="Pick a role.">
          <Select value={v} onValueChange={(x) => { setV(x); picked.push(x); }} options={roles} />
        </FormField>
      );
    }
    render(<Demo />);
    const box = screen.getByRole("combobox", { name: "Role" });
    expect(box).toHaveTextContent("Provider");
    expect(box).toHaveAttribute("aria-invalid", "true");
    expect(box).toHaveAccessibleDescription("Pick a role.");
    await expectAccessible();
    box.focus();
    await userEvent.keyboard("{Enter}");
    const list = await screen.findByRole("listbox");
    expect(within(list).getByRole("option", { name: "Provider" })).toHaveAttribute("aria-selected", "true");
    expect(within(list).getByRole("option", { name: "Admin" })).toHaveAttribute("aria-disabled", "true");
    await userEvent.click(within(list).getByRole("option", { name: "Front office" }));
    expect(picked).toEqual(["front_office"]);
    expect(screen.getByRole("combobox", { name: "Role" })).toHaveTextContent("Front office");
  });

  it("keeps an option whose value is empty (All doctors)", async () => {
    const picked: string[] = [];
    render(
      <Select
        aria-label="Whose day"
        value=""
        onValueChange={(x) => picked.push(x)}
        options={[{ value: "", label: "All doctors" }, { value: "d1", label: "Dr. Ana Rivera" }]}
      />,
    );
    expect(screen.getByRole("combobox", { name: "Whose day" })).toHaveTextContent("All doctors");
    await userEvent.click(screen.getByRole("combobox", { name: "Whose day" }));
    await userEvent.click(await screen.findByRole("option", { name: "Dr. Ana Rivera" }));
    expect(picked).toEqual(["d1"]);
  });

  it("shows the placeholder until something is chosen, and can be disabled", () => {
    render(<Select aria-label="Note type" value="" placeholder="Choose a note type" onValueChange={() => {}} options={roles} disabled size="sm" />);
    const box = screen.getByRole("combobox", { name: "Note type" });
    expect(box).toHaveTextContent("Choose a note type");
    expect(box).toBeDisabled();
  });
});

describe("Combobox", () => {
  it("filters as you type, picks with Enter, and gives focus back", async () => {
    const picked: string[] = [];
    function Demo() {
      const [v, setV] = useState("");
      return (
        <Combobox
          aria-label="Whose day"
          value={v}
          onValueChange={(x) => { setV(x); picked.push(x); }}
          searchPlaceholder="Find a doctor"
          emptyText="No doctor by that name"
          options={[
            { value: "", label: "All doctors" },
            { value: "d1", label: "Dr. Ana Rivera" },
            { value: "d2", label: "Dr. Sam Okafor" },
          ]}
        />
      );
    }
    render(<Demo />);
    const box = screen.getByRole("combobox", { name: "Whose day" });
    expect(box).toHaveTextContent("All doctors");
    await userEvent.click(box);
    expect(box).toHaveAttribute("aria-expanded", "true");
    await userEvent.keyboard("oka");
    expect(screen.queryByRole("option", { name: "Dr. Ana Rivera" })).not.toBeInTheDocument();
    expect(screen.getByRole("option", { name: "Dr. Sam Okafor" })).toBeInTheDocument();
    await expectAccessible();
    await userEvent.keyboard("{Enter}");
    expect(picked).toEqual(["d2"]);
    expect(screen.getByRole("combobox", { name: "Whose day" })).toHaveTextContent("Dr. Sam Okafor");
    await userEvent.click(screen.getByRole("combobox", { name: "Whose day" }));
    await userEvent.keyboard("zzz");
    expect(screen.getByText("No doctor by that name")).toBeInTheDocument();
  });
});
