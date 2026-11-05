import { useEffect, useState, type ReactNode } from "react";
import { useForm } from "react-hook-form";
import { Navigate } from "react-router";
import { color, colorDark, radius, shadow, type, weight } from "@blinq-scribe/tokens";
import {
  ActionBar,
  ActionBarStatus,
  BucketTile,
  ConfirmMark,
  SourceChip,
  StepBar,
  DateSwitcher,
  MainAction,
  RailMore,
  RailNow,
  PetInitials,
  RailFree,
  RailHousehold,
  RailPetRow,
  RailCard,
  RailStatus,
  RailRow,
  ConfirmPopover,
  LevelBars,
  RecordingPill,
  SpeakerList,
  SpeakerRow,
  StatusPill,
  AiLabel,
  Alert,
  Avatar,
  Badge,
  Banner,
  Button,
  Card,
  Caution,
  Checkbox,
  CheckboxField,
  Chip,
  Combobox,
  ConfirmDialog,
  CountTitle,
  DemoTag,
  Dialog,
  DropdownMenu,
  EmptyState,
  FileInput,
  FormError,
  FormField,
  Icon,
  IconButton,
  KeyValueList,
  KeyValueRow,
  LabeledValue,
  LabelValue,
  LabelValueGrid,
  ListRow,
  FactsLine,
  Num,
  PageHeader,
  Pill,
  RadioCards,
  RadioChips,
  SectionHeader,
  Segmented,
  Select,
  Skeleton,
  Spinner,
  SpeciesTile,
  StaticChip,
  StatusText,
  Switch,
  SwitchField,
  Tabs,
  Tag,
  TextArea,
  TextField,
  Tile,
  TileRow,
  Toast,
  ToolButton,
  TypingDots,
  Pressable,
  buttonClasses,
  cx,
  useToast,
  type ButtonVariant,
  type Tone,
  formatPhone,
  BrandMark,
  IconTile,
  MessagePreview,
} from "@blinq-scribe/ui";
import { api } from "../api";
import { Loading } from "../components/common";
import { PlanReminderItem } from "./visit/NoteEditor";

// Every library component and variant on one page, for checking a change across all of them.
// Dev builds and the demo clinic only, and nothing in the console links here.

const variants: ButtonVariant[] = ["primary", "secondary", "ghost", "link", "danger", "danger-outline", "danger-ghost"];
const tones: Tone[] = ["neutral", "success", "warning", "error", "ai"];
const noteTypes = [
  { value: "soap", label: "Sick visit (SOAP)" },
  { value: "wellness", label: "Wellness exam" },
  { value: "recheck", label: "Recheck" },
  { value: "dental", label: "Dental (not set up)", disabled: true },
  { value: "long", label: "Post-operative recheck after a dental with extractions" },
];
/** The seven roles, the rail's five and the Number, each with a sample, what it's for and what it's never for. */
const roles: {
  name: string;
  role: keyof typeof type | "num";
  cls: string;
  sample: ReactNode;
  use: string;
  never: string;
}[] = [
  {
    name: "Display",
    role: "display",
    cls: "text-display",
    sample: <p className="text-display">Biscuit</p>,
    use: "The one page subject: the pet in the visit banner, the owner on the record page.",
    never: "Card titles, numbers, a second heading on the same page.",
  },
  {
    name: "Title",
    role: "title",
    cls: "text-title",
    sample: <p className="text-title">Share the visit summary with Jordan</p>,
    use: "Card, dialog and sheet titles; the record header inside a visit.",
    never: "Text inside a card body.",
  },
  {
    name: "Section",
    role: "section",
    cls: "text-section",
    sample: (
      <>
        <p className="text-section">Subjective</p>
        <p className="text-body">Ear scratching and head shaking for about four days.</p>
      </>
    ),
    use: "Subheadings inside a card: Subjective, What's due, Weight.",
    never: "Anything outside a card; bold words in a sentence.",
  },
  {
    name: "Body",
    role: "body",
    cls: "text-body",
    sample: <p className="text-body">Owner reports ear scratching and head shaking. Eating and playing normally.</p>,
    use: "All reading text, values and notes.",
    never: "Secondary details: those are Meta.",
  },
  {
    name: "Body strong",
    role: "bodyStrong",
    cls: "text-body-strong",
    sample: <p className="text-body-strong">Rabies vaccine</p>,
    use: "List row titles, buttons, tabs, chips, links.",
    never: "Headings.",
  },
  {
    name: "Meta",
    role: "meta",
    cls: "text-meta",
    sample: <p className="text-meta">Sick · Dr. Ana Rivera · Aug 31, 2026</p>,
    use: "Anything secondary: dates, who and where, facts lines, the label above a value.",
    never: "Values someone came to read; sentences that explain the UI.",
  },
  {
    name: "Label",
    role: "label",
    cls: "text-label",
    sample: (
      <table className="items">
        <thead>
          <tr>
            <th>Date</th>
            <th>Item</th>
            <th className="num">Amount</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>Aug 31, 2026</td>
            <td>Apoquel 16 mg</td>
            <td className="num">$48.20</td>
          </tr>
        </tbody>
      </table>
    ),
    use: "Column labels and table headers only.",
    never: "Section headings, labels above values, banner columns.",
  },
  {
    name: "Rail title",
    role: "railTitle",
    cls: "text-rail-title",
    sample: <p className="text-rail-title">Today, Sun Nov 1</p>,
    use: "The day at the top of the left rail.",
    never: "Anything outside the rail; card titles are Title.",
  },
  {
    name: "Rail meta",
    role: "railMeta",
    cls: "text-rail-meta",
    sample: <p className="text-rail-meta font-num">20 visits · 24 pets</p>,
    use: "The rail's small gray lines: the day's counts, a caution under a pet's name, a household pet's reason.",
    never: "Anything outside the rail; secondary text elsewhere is Meta.",
  },
  {
    name: "Rail time",
    role: "railTime",
    cls: "text-rail-time",
    sample: <p className="text-rail-time font-num">1:30 PM · +4 more this afternoon</p>,
    use: "The rail's time column (with font-num), the Needs me label and +N more.",
    never: "Times in prose or on a card: those are Numbers at their line's role.",
  },
  {
    name: "Rail group",
    role: "railGroup",
    cls: "text-rail-group",
    sample: <p className="text-rail-group">Up next</p>,
    use: "The rail's group labels, in sentence case.",
    never: "Column labels and table headers: those are Label.",
  },
  {
    name: "Rail tag",
    role: "railTag",
    cls: "text-rail-tag",
    sample: <p className="text-rail-tag text-primary">Now · 1:15 PM</p>,
    use: "The rail's status pills, the pets' initials and the Now line.",
    never: "Tags and chips outside the rail: those are Body strong or Meta.",
  },
  {
    name: "Number",
    role: "num",
    cls: "font-num",
    sample: (
      <>
        <p className="text-body">
          Signed at <Num>5:01 PM</Num> · weight <Num>72 lb</Num> · balance <Num>$86.90</Num> · <Num>pat-1</Num>
        </p>
        <p className="text-meta">
          Started <Num>9:02 AM</Num> · <Num>(217) 555-0142</Num>
        </p>
      </>
    ),
    use: "Times, money, measurements, lab values, IDs, phone numbers, timers. The size and weight of its line.",
    never: "Dates and counts in a sentence; never larger or bolder than its line.",
  },
];
const roleSpec = (r: (typeof roles)[number]["role"]): string => {
  if (r === "num") return "line size · line weight";
  const t = type[r];
  return `${t.size}/${t.line} · ${t.weight}`;
};
const shadowClass: Record<keyof typeof shadow, string> = {
  card: "shadow-card",
  raised: "shadow-raised",
  pop: "shadow-pop",
  modal: "shadow-modal",
};

const doctors = [
  { value: "", label: "All providers" },
  { value: "d1", label: "Dr. Ana Rivera" },
  { value: "d2", label: "Dr. Sam Okafor" },
  { value: "d3", label: "Dr. Priya Raman-Castellanos" },
];

type Theme = "light" | "dark";

/**
 * One gallery section. Given a render function, it draws the components twice, side by side: in the
 * light theme, then the dark one, whatever the page's own theme is.
 */
function Section({
  id,
  title,
  note,
  children,
}: {
  id: string;
  title: string;
  note?: string;
  children: ReactNode | ((theme: Theme) => ReactNode);
}) {
  return (
    <Card as="section" aria-labelledby={id}>
      <SectionHeader id={id} title={title} sub={note} />
      {typeof children === "function" ? (
        <div className="grid gap-3 2xl:grid-cols-2">
          {(["light", "dark"] as const).map((theme) => (
            <div
              key={theme}
              className={cx(
                theme === "light" ? "theme-light" : "theme-dark",
                "flex min-w-0 flex-col gap-3 rounded-card border border-border bg-page p-3 text-text",
              )}
            >
              <span className="text-meta">{theme === "light" ? "Light" : "Dark"}</span>
              {children(theme)}
            </div>
          ))}
        </div>
      ) : (
        children
      )}
    </Card>
  );
}

/** A form wired to React Hook Form, one per theme panel. */
function SaveForm() {
  const toast = useToast();
  const form = useForm<{ name: string }>({ defaultValues: { name: "" } });
  return (
    <form noValidate className="flex flex-col gap-2" onSubmit={form.handleSubmit(() => toast.show("Saved"))}>
      <FormField label="Wired to React Hook Form" error={form.formState.errors.name?.message}>
        <TextField {...form.register("name", { required: "Enter a name." })} />
      </FormField>
      <Row>
        <Button type="submit" variant="primary">
          Save
        </Button>
        <FormError>{form.formState.isSubmitted && !form.formState.isValid ? "Check the field above." : ""}</FormError>
      </Row>
    </form>
  );
}

function Row({ children }: { children: ReactNode }) {
  return <div className="flex flex-wrap items-center gap-2">{children}</div>;
}

/** The quick card the rail rows open, as the gallery shows it. Example data only. */
const galleryCard = (
  <RailCard
    name="Miso"
    facts={["Cat", "Domestic Shorthair", "Female, spayed", "14 years", "8.9 lb"]}
    details={[
      { label: "Owner", value: "Priya Shah · (555) 014-2290" },
      { label: "Last visit", value: "Oct 23 · Increased thirst and urination" },
    ]}
    reason={{ label: "Reason", text: "Kidney recheck, drinking more water this month" }}
    notes={{
      label: "From PIMS",
      aside: "Synced 8:02 AM",
      items: ["Fear Free: towel wrap and a quiet room", "Gabapentin 100 mg given at home 2 hours before visits"],
    }}
    alerts={{
      label: "Alerts",
      items: ["Fractious, use towel wrap", "Kidney values trending up"],
      none: "No alerts in PIMS",
    }}
    readOnly="Read only"
    open={{ label: "Open visit", onClick: () => {} }}
  />
);

export function GalleryScreen() {
  const [allowed, setAllowed] = useState<boolean | null>(import.meta.env.DEV ? true : null);
  useEffect(() => {
    if (allowed !== null) return;
    api
      .health()
      .then((h) => setAllowed(h.practice === "mock"))
      .catch(() => setAllowed(false));
  }, [allowed]);
  if (allowed === null) return <Loading />;
  if (!allowed) return <Navigate to="/" replace />;
  return <Gallery />;
}

function Gallery() {
  const toast = useToast();
  const [dialog, setDialog] = useState(false);
  const [lang, setLang] = useState("en");
  const [noteType, setNoteType] = useState("soap");
  const [doctor, setDoctor] = useState("");
  const [share, setShare] = useState("text");
  const [slot, setSlot] = useState("9");
  const [chip, setChip] = useState(true);
  const [file, setFile] = useState("");
  const [confirmed, setConfirmed] = useState("");

  return (
    <main className="flex flex-col gap-4 p-4">
      <PageHeader
        eyebrow="Demo only"
        title="Component library"
        sub="Every component in @blinq-scribe/ui and each of its variants."
      />

      <Section id="g-colors" title="Color tokens">
        <p className="text-meta">
          Light and dark values side by side. The theme choice in the account menu flips the whole page.
        </p>
        <div className="grid grid-cols-[repeat(auto-fill,minmax(260px,1fr))] gap-2">
          {Object.entries(color).map(([name, value]) => (
            <div key={name} className="flex items-center gap-2 text-meta">
              <span className="size-6 flex-none rounded-control border border-border" style={{ background: value }} />
              <span
                className="size-6 flex-none rounded-control border border-border"
                style={{ background: colorDark[name as keyof typeof color] }}
              />
              <span className="min-w-0">
                <b className="block text-body-strong">{name}</b>
                <span className="font-num text-text-secondary">
                  {value} / {colorDark[name as keyof typeof color]}
                </span>
              </span>
            </div>
          ))}
        </div>
      </Section>

      <Section
        id="g-type"
        title="Type roles"
        note="Seven roles, the left rail's own five, and three weights: every piece of text has exactly one role. Color comes from meaning, not the role."
      >
        <div className="flex flex-col">
          {roles.map((r) => (
            <div
              key={r.name}
              className="grid gap-4 border-t border-divider py-4 first:border-t-0 md:grid-cols-[12rem_minmax(0,1fr)]"
            >
              <div className="flex flex-col">
                <span className="text-section">{r.name}</span>
                <span className="text-meta">{roleSpec(r.role)}</span>
                <span className="text-meta font-num">{r.cls}</span>
              </div>
              <div className="flex min-w-0 flex-col gap-3">
                <div className="flex flex-col gap-1">{r.sample}</div>
                <LabelValueGrid>
                  <LabelValue label="Use for" value={r.use} />
                  <LabelValue label="Never for" value={r.never} />
                </LabelValueGrid>
              </div>
            </div>
          ))}
          <div className="grid gap-4 border-t border-divider pt-4 md:grid-cols-3">
            {Object.entries(weight).map(([name, w]) => (
              <div key={name} className="flex flex-col">
                <span className={w === 400 ? "text-body" : w === 500 ? "text-body-strong" : "text-section"}>
                  {name} <Num>{w}</Num>
                </span>
                <span className="text-meta">
                  {w === 400 ? "Body, Meta" : w === 500 ? "Body strong, Label" : "Display, Title, Section"}
                </span>
              </div>
            ))}
          </div>
        </div>
      </Section>

      <Section
        id="g-shape"
        title="Radius and elevation"
        note="Shadows read their token, so they follow the dark theme."
      >
        {() => (
          <>
            <Row>
              {Object.entries(radius).map(([name, r]) => (
                <span
                  key={name}
                  className="flex size-20 items-end border border-border-strong bg-surface p-2 text-meta"
                  style={{ borderRadius: Math.min(r, 40) }}
                >
                  {name} {r}
                </span>
              ))}
            </Row>
            <Row>
              {Object.keys(shadow).map((name) => (
                <span
                  key={name}
                  className={cx(
                    "flex h-16 w-32 items-end rounded-tile bg-surface p-2 text-meta",
                    shadowClass[name as keyof typeof shadow],
                  )}
                >
                  shadow-{name}
                </span>
              ))}
            </Row>
          </>
        )}
      </Section>

      <Section id="g-buttons" title="Button">
        {() => (
          <>
            {(["sm", "md", "lg"] as const).map((size) => (
              <Row key={size}>
                {variants.map((v) => (
                  <Button key={v} variant={v} size={size}>
                    {v} {size}
                  </Button>
                ))}
              </Row>
            ))}
            <Row>
              <Button variant="primary" icon="mic">
                With icon
              </Button>
              <Button variant="primary" loading>
                Loading
              </Button>
              <Button variant="secondary" disabled>
                Disabled
              </Button>
              <a href="#g-buttons" className={buttonClasses("secondary", "sm")}>
                Link styled as a button
              </a>
            </Row>
            <Button variant="secondary" fullWidth>
              Full width
            </Button>
          </>
        )}
      </Section>

      <Section id="g-icon-buttons" title="IconButton and ToolButton">
        {() => (
          <>
            <Row>
              {variants.map((v) => (
                <IconButton key={v} variant={v} icon="settings" aria-label={`Settings, ${v}`} />
              ))}
              <IconButton size="sm" icon="close" aria-label="Close, small" />
              <IconButton size="lg" icon="add" aria-label="Add, large" />
            </Row>
            <Row>
              <ToolButton icon="format_bold">Bold</ToolButton>
              <ToolButton icon="auto_awesome" tone="ai">
                Rewrite
              </ToolButton>
              <ToolButton icon="description" pressed>
                Pressed
              </ToolButton>
              <ToolButton icon="mic" pressed pressedTone="recording">
                Recording
              </ToolButton>
            </Row>
          </>
        )}
      </Section>

      <Section id="g-icons" title="Icon">
        {() => (
          <>
            <Row>
              <Icon name="pets" />
              <Icon name="pets" fill />
              <Icon name="favorite" size={24} className="text-error" />
              <Icon name="auto_awesome" size={32} className="text-ai" />
            </Row>
          </>
        )}
      </Section>

      <Section id="g-cards" title="Card and Tile">
        {() => (
          <>
            <div className="grid gap-3 sm:grid-cols-2">
              <Card>
                <Card.Header>
                  <Card.Title as="h3">Default card</Card.Title>
                  <Tag tone="success">Signed</Tag>
                </Card.Header>
                <Card.Body>Body text sits here.</Card.Body>
                <Card.Footer>
                  <Button size="sm">Action</Button>
                </Card.Footer>
              </Card>
              <Card variant="floating">
                <Card.Title as="h3">Floating card</Card.Title>
                <Card.Body>For panels over the page.</Card.Body>
              </Card>
              <Card density="compact" highlighted>
                <Card.Title as="h3">Compact, highlighted</Card.Title>
              </Card>
              <Card density="list">
                <Card.Title as="h3">List density</Card.Title>
                <Card.Body>Tighter rows.</Card.Body>
              </Card>
            </div>
            <TileRow>
              <Tile label="Visits" value="6" />
              <Tile label="Temp" value="[confirm]" tone="ai" />
              <Tile label="Growing tile" value="14 days" grow />
            </TileRow>
          </>
        )}
      </Section>

      <Section id="g-badges" title="Tag, Pill, Badge, DemoTag, AiLabel">
        {() => (
          <>
            <Row>
              {tones.map((t) => (
                <Tag key={t} tone={t}>
                  {t}
                </Tag>
              ))}
              <Tag icon="pets">With icon</Tag>
              <Tag variant="fact">Golden Retriever</Tag>
              <Tag variant="fact">72 lb, Jun 24</Tag>
            </Row>
            <Row>
              {tones.map((t) => (
                <Pill key={t} tone={t}>
                  {t}
                </Pill>
              ))}
              <Pill tone="error" dot="pulse">
                Recording
              </Pill>
              <Pill tone="success" dot="static">
                Live
              </Pill>
            </Row>
            <Row>
              <Badge>2</Badge>
              <DemoTag />
              <AiLabel>Before you walk in</AiLabel>
              <AiLabel size="sm">Suggested</AiLabel>
            </Row>
          </>
        )}
      </Section>

      <Section id="g-caution" title="Caution">
        {() => (
          <>
            <span className="text-meta">In full, where the provider reads them (the visit banner)</span>
            <Caution items={["Fractious, use towel wrap", "Kidney values trending up"]} />
            <span className="text-meta">Compact, one shown and +N, the rest on hover (a schedule row)</span>
            <Caution
              compact
              max={1}
              items={[
                { text: "Fractious, use towel wrap", short: "Towel wrap" },
                { text: "Kidney values trending up", short: "Kidney values" },
              ]}
            />
            <Caution
              compact
              max={1}
              items={[{ text: "Brachycephalic, watch airway under sedation", short: "Watch airway" }]}
            />
            <span className="text-meta">Labeled, so the dot is never left to decode (the rail, Up next)</span>
            <Caution compact labeled items={[{ text: "Fractious, use towel wrap", short: "Towel wrap" }]} />
          </>
        )}
      </Section>

      <Section id="g-banners" title="Banner, Alert and Toast">
        {() => (
          <>
            <Banner action={<Button size="sm">Undo</Button>}>Saved. The note is signed.</Banner>
            {tones.map((t) => (
              <Alert key={t} tone={t}>
                A {t} alert.
              </Alert>
            ))}
            <Alert tone="error" urgent>
              An urgent alert is announced right away.
            </Alert>
            <Alert tone="neutral" icon={null}>
              An alert without an icon.
            </Alert>
            <Row>
              <Toast>A toast, as it looks</Toast>
              <Button onClick={() => toast.show("Copied to the clipboard")}>Show a toast</Button>
            </Row>
          </>
        )}
      </Section>

      <Dialog open={dialog} onOpenChange={setDialog} title="A dialog" closeLabel="Close" size="sm">
        <p>Focus stays inside until it closes. Escape closes it.</p>
        <Button variant="primary" onClick={() => setDialog(false)}>
          Done
        </Button>
      </Dialog>
      <Section
        id="g-dialogs"
        title="Dialog, ConfirmDialog and DropdownMenu"
        note="Dialogs and menus open over the page, so they follow the page's theme."
      >
        {() => (
          <>
            <Row>
              <Button onClick={() => setDialog(true)}>Open dialog</Button>
              <ConfirmDialog
                trigger={<Button variant="danger-outline">Delete photo</Button>}
                title="Delete this photo?"
                description="It is removed from the visit."
                confirmLabel="Delete"
                cancelLabel="Keep it"
                tone="danger"
                onConfirm={() => setConfirmed("Deleted")}
                onCancel={() => setConfirmed("Kept")}
              />
              <DropdownMenu.Root>
                <DropdownMenu.Trigger asChild>
                  <Button icon="expand_more">Menu</Button>
                </DropdownMenu.Trigger>
                <DropdownMenu.Content>
                  <DropdownMenu.Label>Signed in as Dr. Rivera</DropdownMenu.Label>
                  <DropdownMenu.Item icon="person">Account</DropdownMenu.Item>
                  <DropdownMenu.Item icon="logout">Sign out</DropdownMenu.Item>
                </DropdownMenu.Content>
              </DropdownMenu.Root>
              <StatusText>{confirmed}</StatusText>
            </Row>
          </>
        )}
      </Section>

      <Section id="g-tabs" title="Tabs">
        {() => (
          <>
            <Tabs.Root defaultValue="overview">
              <Tabs.List aria-label="Record">
                <Tabs.Trigger value="overview">Overview</Tabs.Trigger>
                <Tabs.Trigger value="visits">Past visits</Tabs.Trigger>
                <Tabs.Trigger value="documents">Documents</Tabs.Trigger>
                <Tabs.Trigger value="invoices">Invoices</Tabs.Trigger>
                <Tabs.Trigger value="texts">Texts</Tabs.Trigger>
              </Tabs.List>
              <Tabs.Content value="overview" className="pt-3">
                Overview
              </Tabs.Content>
              <Tabs.Content value="visits" className="pt-3">
                Past visits
              </Tabs.Content>
              <Tabs.Content value="documents" className="pt-3">
                Documents
              </Tabs.Content>
              <Tabs.Content value="invoices" className="pt-3">
                Invoices
              </Tabs.Content>
              <Tabs.Content value="texts" className="pt-3">
                Texts
              </Tabs.Content>
            </Tabs.Root>
          </>
        )}
      </Section>

      <Section id="g-choices" title="Switch, Checkbox, RadioCards, chips, Segmented">
        {(theme) => (
          <>
            <Row>
              <Switch aria-label="Plain switch" defaultChecked />
              <Checkbox aria-label="Plain checkbox" defaultChecked />
            </Row>
            <SwitchField
              id={`g-consent-${theme}`}
              label="Owner agreed to recording"
              description="Ask before you start."
            />
            <CheckboxField id={`g-remember-${theme}`} label="Remember this device" />
            <RadioCards
              aria-label="Share by"
              value={share}
              onValueChange={setShare}
              options={[
                {
                  value: "text",
                  icon: "sms",
                  title: "Text a link",
                  description: formatPhone("***0142"),
                  extra: <AiLabel size="sm">Recommended</AiLabel>,
                },
                { value: "email", icon: "mail", title: "Email a PDF", description: "No email on file" },
                { value: "print", icon: "print", title: "Print", description: "Branded PDF for checkout" },
              ]}
            />
            <Row>
              <Chip pressed={chip} onClick={() => setChip(!chip)}>
                Toggle chip
              </Chip>
              <Chip selected>Selected</Chip>
              <Chip dashed icon="add">
                Add a pet
              </Chip>
              <StaticChip icon="check">Miso</StaticChip>
            </Row>
            <RadioChips
              aria-label="Time"
              value={slot}
              onValueChange={setSlot}
              options={[
                { value: "9", label: "9:00" },
                { value: "10", label: "10:00" },
                { value: "11", label: "11:00" },
              ]}
            />
            <Segmented
              aria-label="Language"
              value={lang}
              onValueChange={setLang}
              options={[
                { value: "en", label: "English" },
                { value: "es", label: "Spanish" },
              ]}
            />
          </>
        )}
      </Section>

      <Section id="g-select" title="Select and Combobox">
        {() => (
          <>
            <StatusText>Click one to open it. Tab to one to see the focus ring.</StatusText>
            {(["sm", "md", "lg"] as const).map((size) => (
              <div key={size} className="grid gap-3 sm:grid-cols-2">
                <FormField label={`Select, ${size}`}>
                  <Select size={size} value={noteType} onValueChange={setNoteType} options={noteTypes} />
                </FormField>
                <FormField label={`Combobox, ${size}`}>
                  <Combobox
                    size={size}
                    value={doctor}
                    onValueChange={setDoctor}
                    options={doctors}
                    searchPlaceholder="Find a provider"
                    emptyText="No provider by that name"
                  />
                </FormField>
              </div>
            ))}
            <div className="grid gap-3 sm:grid-cols-2">
              <FormField label="Placeholder">
                <Select value="" placeholder="Choose a note type" onValueChange={setNoteType} options={noteTypes} />
              </FormField>
              <FormField label="Disabled">
                <Select value="soap" onValueChange={setNoteType} options={noteTypes} disabled />
              </FormField>
              <FormField label="Error" error="Pick their provider in the PIMS.">
                <Select value="" placeholder="Not a provider" onValueChange={() => {}} options={doctors.slice(1)} />
              </FormField>
              <FormField label="Long text is cut with an ellipsis">
                <Select value="long" onValueChange={setNoteType} options={noteTypes} className="max-w-[220px]" />
              </FormField>
              <FormField label="With a leading avatar">
                <Combobox
                  value={doctor}
                  onValueChange={setDoctor}
                  options={doctors}
                  leading={<Avatar initials={doctor ? "AR" : "All"} />}
                  className="pl-1"
                  searchPlaceholder="Find a provider"
                  emptyText="No provider by that name"
                />
              </FormField>
              <FormField label="Combobox, disabled">
                <Combobox
                  value=""
                  onValueChange={setDoctor}
                  options={doctors}
                  disabled
                  searchPlaceholder="Find a provider"
                  emptyText="No provider by that name"
                />
              </FormField>
            </div>
          </>
        )}
      </Section>

      <Section id="g-fields" title="TextField, TextArea, FileInput, FormField">
        {() => (
          <>
            <div className="grid gap-3 sm:grid-cols-2">
              <FormField label="Text field">
                <TextField placeholder="Type here" />
              </FormField>
              <FormField label="Large with icon">
                <TextField size="lg" icon="search" placeholder="Search" />
              </FormField>
              <FormField label="Number" hint="For codes.">
                <TextField num defaultValue="482 913" />
              </FormField>
              <FormField label="Disabled">
                <TextField disabled defaultValue="Read only" />
              </FormField>
            </div>
            <FormField label="Text area">
              <TextArea placeholder="Notes" minHeight={96} />
            </FormField>
            <SaveForm />
            <FileInput label="Add a photo" accept="image/jpeg,image/png" onFile={(f) => setFile(f?.name ?? "")}>
              <span className={buttonClasses("secondary")}>
                <Icon name="upload" /> Add a photo
              </span>
            </FileInput>
            <StatusText>{file}</StatusText>
          </>
        )}
      </Section>

      <Section id="g-layout" title="Layout pieces">
        {() => (
          <>
            <SectionHeader
              as="h3"
              title="Section header"
              sub="With a sub line"
              actions={<Button size="sm">Action</Button>}
            />
            <KeyValueList>
              <KeyValueRow label="Species" value="Feline" />
              <KeyValueRow label="Chip" value="985 112 004" num />
              <KeyValueRow label="Allergies" />
            </KeyValueList>
            <div>
              <ListRow lead="edit_note" title="Sign Luna's note" meta="From yesterday" chevron className="border-t-0" />
              <ListRow lead={{ time: "10:00 AM" }} title="Biscuit" meta="Ear scratching · Dr. Ana Rivera">
                <Caution compact items={[{ text: "Fractious, use towel wrap", short: "Towel wrap" }]} />
              </ListRow>
              <ListRow
                lead="error"
                tone="error"
                title="Text to Jordan failed"
                meta="Number not reachable"
                action={<Button size="sm">Retry</Button>}
              />
            </div>
            <LabeledValue label="Labeled value" aside={<Tag>Aside</Tag>}>
              Value text
            </LabeledValue>
            <Row>
              <Avatar initials="AR" label="Dr. Ana Rivera" />
              <Avatar initials="SO" size={40} label="Dr. Sam Okafor" />
              <Avatar icon="pets" label="Pet" />
            </Row>
            <Pressable className="rounded-tile p-2 hover:bg-surface-muted" onClick={() => {}}>
              Pressable: a bare button the caller styles
            </Pressable>
            <EmptyState>Nothing here yet.</EmptyState>
            <EmptyState icon="cloud_off" size="sm">
              Small empty state.
            </EmptyState>
          </>
        )}
      </Section>

      <Section
        id="g-blocks"
        title="Shared blocks"
        note="Label/value rows are the one way to show a fact; list rows are the one way to list things."
      >
        {(theme) => (
          <Card>
            <Card.Title>Biscuit</Card.Title>
            <Card.Body className="gap-6">
              <FactsLine items={["Golden Retriever", "male, neutered", "6 years", <Num key="w">72 lb</Num>]} />
              <Card.Section title="Cautions">
                <Caution size="body" items={["Back problems, lift with support"]} />
              </Card.Section>
              <Card.Section title="What's due">
                <div>
                  <ListRow lead="vaccines" title="Rabies vaccine" meta="Due Nov 21, 2026" className="border-t-0 pt-1" />
                  <ListRow lead="history" title="Itchy face" meta="Aug 31, 2026 · Sick · Dr. Ana Rivera" />
                </div>
              </Card.Section>
              <Card.Section title="Details">
                <LabelValueGrid cols={3} aria-label={`Owner (${theme})`}>
                  <LabelValue label="Phone" value="(217) 555-0142" num />
                  <LabelValue label="Email" value="jordan@example.com" />
                  <LabelValue label="Client ID" value="cli-1" num />
                  <LabelValue label="Client since" value="Apr 12, 2019" />
                  <LabelValue label="Balance" value="$0.00" num />
                  <LabelValue label="Microchip" value="" hideEmpty={false} />
                </LabelValueGrid>
              </Card.Section>
            </Card.Body>
          </Card>
        )}
      </Section>

      <Section id="g-pets" title="SpeciesTile, CountTitle, pressable ListRow">
        {() => (
          <>
            <CountTitle count={5}>Pets</CountTitle>
            <Row>
              <SpeciesTile species="Dog" />
              <SpeciesTile species="Cat" />
              <SpeciesTile species="Bird" />
              <SpeciesTile species="Rabbit" />
              <SpeciesTile species="Ferret" />
            </Row>
            <span className="text-meta">A row that opens something: one button, a hover and a chevron</span>
            <div>
              <ListRow
                lead={{ time: "9:00 AM" }}
                title="Biscuit"
                meta="In visit · Ear scratching"
                onClick={() => {}}
                current
              />
              <ListRow lead={{ time: "9:30 AM" }} title="Miso" meta="Kidney recheck" onClick={() => {}} />
              <ListRow lead="event" title="Limping, back legs" meta="Visit today at 1:30 PM" onClick={() => {}} />
            </div>
          </>
        )}
      </Section>

      <Section
        id="g-rail"
        title="DateSwitcher, RailRow, RailStatus, RailNow, RailFree, RailMore"
        note="The left rail, 360 px, two lines a visit (about 72 to 96 px): the time (a Number, 60 px), the pet's name (15 px) with species and age and the status at the right; the breed small under it; the reason in plain words wrapping to two lines; a caution's own short amber line with its dot. A status shows only when it means something: In visit (green dot), Draft ready (purple, it is AI output), Signed (green check), red only for something broken. Not started shows nothing. The visit on screen has a quiet fill and a green bar. The rail is a timeline: a line through the dot column joins the day's visits in clock order, one dot each (a gray ring not started, green pulsing In visit, purple Draft ready, green with a check Signed, red only for something broken); the thin green Now line sits at the clinic's time, and a break of an hour or more is a dashed stretch with Free until. On a heavy day Done folds at the top of the line. Hover a row (300 ms) or focus it for its quick card."
      >
        {() => (
          <div className="flex w-[360px] max-w-full flex-col rounded-card border border-border bg-surface">
            <DateSwitcher
              className="px-(--size-rail-inset) pt-4 pb-3"
              title="Today, Sun Nov 1"
              sub="5 visits · Dr. Ana Rivera"
              prevLabel="Day before"
              nextLabel="Day after"
              todayLabel="Today"
              isToday
              onPrev={() => {}}
              onToday={() => {}}
              onNext={() => {}}
            />
            <RailMore open={false} onClick={() => {}} track={{ dot: "signed", below: true }}>
              Done · 2
            </RailMore>
            <RailRow
              time="9:00 AM"
              title="Biscuit"
              facts="Dog, 6 years"
              sub="Golden Retriever"
              reason="Ear scratching, head shaking"
              status={
                <RailStatus tone="visit" live>
                  In visit
                </RailStatus>
              }
              current
              track={{ dot: "visit", above: true, below: true }}
              onClick={() => {}}
            />
            <RailNow label="Now 9:10 AM" name="Now, 9:10 AM" track={{ above: true, below: true }} />
            <RailRow
              time="9:30 AM"
              title="Miso"
              facts="Cat, 14 years"
              sub="Domestic Shorthair"
              reason="Kidney recheck, drinking more water this month"
              cautions={[{ text: "Fractious, use towel wrap", short: "Towel wrap" }]}
              card={galleryCard}
              track={{ dot: "todo", above: true, below: true }}
              onClick={() => {}}
            />
            <RailFree label="Free until 1:30 PM" track={{ above: true, below: true }} />
            <RailRow
              time="1:30 PM"
              title="Luna"
              facts="Dog, 2 years"
              sub="French Bulldog"
              reason="Annual wellness"
              status={<RailStatus tone="failed">Text didn't send</RailStatus>}
              track={{ dot: "failed", above: true, below: true }}
              onClick={() => {}}
            />
            <RailRow
              time="3:30 PM"
              title="Max"
              facts="Dog, 5 years"
              sub="German Shepherd"
              reason="TPLO recheck, left back leg, six weeks after surgery, walking better but still stiff in the mornings"
              cautions={[{ text: "Muzzle for exams", short: "Muzzle" }]}
              status={<RailStatus tone="draft">Draft ready</RailStatus>}
              track={{ dot: "draft", above: true }}
              onClick={() => {}}
            />
            <RailMore link onClick={() => {}}>
              +4 more this afternoon
            </RailMore>
            <div className="flex flex-wrap gap-4 p-4">
              <RailStatus tone="visit">In visit</RailStatus>
              <RailStatus tone="draft">Draft ready</RailStatus>
              <RailStatus tone="signed">Signed</RailStatus>
              <RailStatus tone="failed">Text didn't send</RailStatus>
              <RailStatus tone="count">1 of 3 signed</RailStatus>
            </div>
            <div className="flex items-center gap-2 px-4 pb-4">
              <Switch quiet aria-label="Needs me" />
              <span className="text-rail-time font-num text-text-secondary">Needs me · 3</span>
            </div>
          </div>
        )}
      </Section>

      <Section
        id="g-rail-card"
        title="RailCard"
        note="A rail row's quick card, read only: on hover after about 300 ms or on keyboard focus, to the right of the row with a small pointer; Esc or moving away closes it, and it stays open while the pointer is on it. The pet with species, breed, sex, age and weight; the owner and phone; the last visit; the reason for today; the PIMS's own notes with when the schedule was read; its alerts in amber, or No alerts in PIMS; Read only and one Open visit link. No second button, no edit controls, no AI summary. Never on touch: a tap opens the visit."
      >
        {() => (
          <div className="w-[340px] max-w-full rounded-card border border-border bg-surface p-4 shadow-pop">
            {galleryCard}
          </div>
        )}
      </Section>

      <Section
        id="g-household"
        title="RailHousehold, RailPetRow, PetInitials"
        note="A household visit in the rail: several of one owner's pets booked as one visit, owner-led. Folded, only the owner and how many pets. Open (on screen or in the room), the status, the pets' initials, and a two-line row per pet in the name column, joined by a thin guide line; each pet's status follows the same rules (no Not started), and the pet on screen gets the green tint."
      >
        {() => (
          <div className="flex w-[360px] max-w-full flex-col rounded-card border border-border bg-surface">
            <div className="flex flex-col">
              <RailHousehold
                time="2:00 PM"
                owner="Jordan Lee"
                count="3 pets"
                pets={["Hazel", "Kiwi", "Mochi"]}
                status={<RailStatus tone="count">1 of 3 signed</RailStatus>}
                open
                current
                track={{ dot: "draft", below: true }}
                onClick={() => {}}
              >
                <RailPetRow
                  title="Hazel"
                  facts="Dog, 13 years"
                  sub="Beagle"
                  reason="Stiff getting up"
                  status={<RailStatus tone="signed">Signed</RailStatus>}
                  onClick={() => {}}
                />
                <RailPetRow
                  title="Kiwi"
                  facts="Bird, 8 years"
                  sub="Cockatiel"
                  reason="Wellness exam"
                  current
                  status={<RailStatus tone="draft">Draft ready</RailStatus>}
                  onClick={() => {}}
                />
                <RailPetRow
                  title="Mochi"
                  facts="Rabbit, 2 years"
                  sub="Holland Lop"
                  reason="Eating less hay"
                  last
                  cautions={[{ text: "Fearful, use towel wrap", short: "Towel wrap" }]}
                  onClick={() => {}}
                />
              </RailHousehold>
              <RailHousehold
                time="3:15 PM"
                owner="Ana Garcia"
                count="3 pets"
                pets={["Coco", "Pancho", "Lola"]}
                track={{ dot: "todo", above: true }}
                onClick={() => {}}
              />
            </div>
            <div className="flex items-center gap-2 p-4">
              <PetInitials names={["Biscuit", "Waffles", "Kiwi"]} />
              <span className="text-meta">3 pets</span>
            </div>
          </div>
        )}
      </Section>

      <Section
        id="g-buckets"
        title="BucketTile, MainAction"
        note="Neutral tiles that open a list of notes, and the page's one green action with its ⌘↵ hint, pinned in the ActionBar."
      >
        {(theme) => (
          <>
            <div className="grid grid-cols-2 gap-3 max-[520px]:grid-cols-1">
              <BucketTile icon="edit_note" title="Ready to sign" count={2} meta="Oldest 6 days" onClick={() => {}} />
              <BucketTile
                icon="pending_actions"
                title="Pending"
                count={1}
                meta="1 follow up to decide"
                onClick={() => {}}
              />
            </div>
            <ActionBar label={`Up next (${theme})`}>
              <ActionBarStatus
                lead={<Icon name="schedule" className="text-text-secondary" />}
                title="Up next: Biscuit at 9:00 AM · Exam 1"
              />
              <Button variant="link" className="underline">
                Skip to Miso
              </Button>
              <MainAction icon="arrow_forward" onClick={() => {}}>
                Open Biscuit's visit
              </MainAction>
            </ActionBar>
          </>
        )}
      </Section>

      <Section
        id="g-visit-marks"
        title="StepBar, SourceChip, ConfirmMark, PlanReminderItem"
        note="Where a visit stands, a time chip at the end of each drafted line that goes to where it was said, a thing to confirm in words, never the bracket, and a line of the provider's own last plan, ticked to cover today, that the visit didn't: quoted, with Add to Plan and Dismiss, a reminder that never blocks signing."
      >
        {() => (
          <>
            <StepBar
              label="Where this visit is"
              steps={[
                { key: "record", label: "Record", state: "done", meta: "0:42" },
                { key: "draft", label: "Draft", state: "current" },
                { key: "sign", label: "Sign", state: "todo" },
                { key: "share", label: "Share", state: "todo" },
                { key: "follow", label: "Follow up", state: "todo" },
              ]}
            />
            <p className="flex items-baseline gap-3 border-l-2 border-ai pl-3">
              <span className="flex-1">Right ear: canal red and swollen with brown discharge, eardrum intact.</span>
              <SourceChip label="0:27, Dr. Ana Rivera, go to this line in the transcript" onClick={() => {}}>
                0:27
              </SourceChip>
            </p>
            <p>
              Ear drops in the right ear twice a day <ConfirmMark>Confirm: name and dose</ConfirmMark>
            </p>
            <PlanReminderItem
              text="Apoquel 16 mg by mouth twice a day for 14 days, then once a day"
              onAdd={() => {}}
              onDismiss={() => {}}
            />
          </>
        )}
      </Section>

      <Section id="g-visit" title="ActionBar, ConfirmPopover, SpeakerRow, RecordingPill, StatusPill">
        {(theme) => (
          <>
            <VisitPieces theme={theme} />
          </>
        )}
      </Section>

      <Section id="g-marks" title="BrandMark, IconTile, MessagePreview">
        {() => (
          <>
            <Row>
              <BrandMark name="Blinq Scribe" />
            </Row>
            <Row>
              {tones.map((tone) => (
                <IconTile key={tone} icon="description" tone={tone} />
              ))}
              <IconTile icon="edit_document" size={32} />
              <IconTile icon="picture_as_pdf" tone="error" size={40} />
            </Row>
            <MessagePreview
              label="Demo clinic: this text was not sent"
              text={"Hi Jordan, Biscuit's ear recheck is due Nov 14.\nReply YES to book."}
            />
            <MessagePreview icon="mail" label="Email preview">
              <b>To: jordan@example.com</b>
            </MessagePreview>
          </>
        )}
      </Section>

      <Section id="g-loading" title="Spinner, Skeleton, TypingDots">
        {() => (
          <>
            <Row>
              <Spinner label="Loading" />
              <TypingDots />
            </Row>
            <Skeleton className="h-4 w-2/3" />
            <Skeleton className="h-4 w-1/2" />
          </>
        )}
      </Section>
    </main>
  );
}

/** The visit screen's design system pieces, every main state, for one theme. */
function VisitPieces({ theme }: { theme: "light" | "dark" }) {
  const start = (
    <ConfirmPopover
      trigger={
        <Button variant="primary" icon="mic">
          Start visit
        </Button>
      }
      title="Did Jordan agree to recording?"
      description="Ask before you start. Their answer is saved with the visit."
      confirmLabel="Owner agreed, start"
      confirmIcon="mic"
      cancelLabel="Not yet"
      footnote={'Or say "Start visit" to your glasses.'}
      footnoteIcon="eyeglasses"
      onConfirm={() => {}}
      side="top"
      align="end"
    />
  );
  return (
    <>
      <span className="text-meta">StatusPill</span>
      <Row>
        <StatusPill status="ok">Muse Spark · demo clinic</StatusPill>
        <StatusPill status="demo">Mock AI · demo clinic</StatusPill>
        <StatusPill status="error">Practice system offline</StatusPill>
        <StatusPill status="pending">Connecting</StatusPill>
      </Row>
      <span className="text-meta">RecordingPill and LevelBars</span>
      <Row>
        <RecordingPill elapsed="04:32" elapsedLabel="Recording for 04:32">
          Recording from glasses
        </RecordingPill>
        <RecordingPill elapsed="00:48" elapsedLabel="Recording for 00:48" level={() => 0.6}>
          Recording on this computer
        </RecordingPill>
        <RecordingPill bars={false}>Recording from glasses</RecordingPill>
        <span className="text-meta inline-flex items-center gap-2">
          <LevelBars bars={4} className="text-primary" />
          Listening. New words show up every few seconds.
        </span>
      </Row>
      <span className="text-meta">SpeakerList and SpeakerRow</span>
      <div className="rounded-control border border-border bg-surface p-3">
        <SpeakerList label={`Transcript, ${theme}`}>
          <SpeakerRow initials="AR" name="Dr. Ana Rivera" role="Provider" time="0:06">
            Hi Jordan, what's going on with Biscuit today?
          </SpeakerRow>
          <SpeakerRow initials="JL" name="Jordan Lee" role="Owner" time="0:11">
            He's been shaking his head and scratching his right ear for about a week.
          </SpeakerRow>
          <SpeakerRow
            name="Speaker 3"
            time="1:02"
            action={
              <Button variant="link" size="sm" className="h-auto px-0 text-meta" aria-expanded>
                Who is this?
              </Button>
            }
            after={
              <div className="flex flex-wrap gap-2 pt-2" role="group" aria-label={`Who is Speaker 3? (${theme})`}>
                <Chip>Tech</Chip>
                <Chip>Family member</Chip>
                <Chip>Another provider</Chip>
              </div>
            }
          >
            He's 74 pounds today. Temp is 101.8, heart rate 96.
          </SpeakerRow>
          <SpeakerRow
            initials="T"
            name="Tech"
            role="named by you"
            time="1:02"
            action={
              <Button variant="link" size="sm" className="h-auto px-0 text-meta">
                Change
              </Button>
            }
          >
            He's 74 pounds today.
          </SpeakerRow>
          <SpeakerRow time="2:40">A line Blinq isn't sure about has no name.</SpeakerRow>
          <SpeakerRow initials="JL" name="Jordan Lee" role="Owner" time="4:28" writing>
            He's still eating fine, just
          </SpeakerRow>
        </SpeakerList>
      </div>
      <span className="text-meta">ActionBar: start, recording, not recording, sign</span>
      <ActionBar label={`Start the visit (${theme})`}>
        <ActionBarStatus title="Biscuit · Sick visit (SOAP) · Exam 1" sub={'Or say "Start visit" to your glasses'} />
        {start}
      </ActionBar>
      <ActionBar label={`Visit in progress (${theme})`}>
        <ActionBarStatus
          lead={<span className="size-2 flex-none animate-pulse-dot rounded-pill bg-error" aria-hidden="true" />}
          title={
            <>
              Recording from glasses <span className="font-num">04:32</span>
            </>
          }
          sub="Sending part 19 · Biscuit · Exam 1"
        />
        <Button variant="primary" icon="auto_awesome">
          Draft note
        </Button>
      </ActionBar>
      <ActionBar label={`Not recording (${theme})`}>
        <ActionBarStatus
          lead={<Icon name="mic_off" className="muted" />}
          title="Not recording"
          sub="Record on this computer, or start on the glasses · Biscuit · Exam 1"
        />
        <Button variant="primary" icon="auto_awesome">
          Draft note
        </Button>
      </ActionBar>
      <ActionBar label={`Sign the note (${theme})`}>
        <span className="row min-w-0 flex-1">
          <Icon name="check_circle" className="tone-success" />
          <span>Nothing to confirm</span>
        </span>
        <Button>Sign only</Button>
        <Button variant="primary" icon="send">
          Sign and send to the PIMS
        </Button>
      </ActionBar>
    </>
  );
}
