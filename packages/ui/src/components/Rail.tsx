import { Fragment, useState, type ReactElement, type ReactNode } from "react";
import { Tooltip } from "radix-ui";
import { cx } from "../cx";
import { Caution, type CautionItem } from "./Caution";
import { Button, IconButton } from "./Button";
import { Icon } from "./Icon";
import { FactsLine } from "./Num";

/** The rail's left inset (20 px), so the times sit under the day's title. */
const INSET = "pl-(--size-rail-inset)";

/**
 * The day at the top of the left rail: "Today, Sun Nov 1" with a line under it ("5 visits · Dr. Ana
 * Rivera"), and the day before and after as two small arrows with a Today button between them, so a
 * provider who browsed to another day gets back in one click. Today is quiet (and does nothing) while
 * today is on screen. Replaces the week strip: providers live in today.
 */
export function DateSwitcher({
  title,
  sub,
  onPrev,
  onNext,
  onToday,
  prevLabel,
  nextLabel,
  todayLabel,
  isToday = false,
  className,
}: {
  title: ReactNode;
  sub?: ReactNode;
  onPrev: () => void;
  onNext: () => void;
  onToday: () => void;
  prevLabel: string;
  nextLabel: string;
  todayLabel: string;
  /** Today is already on screen: the Today button stays in place but grays out. */
  isToday?: boolean;
  className?: string;
}) {
  return (
    <div className={cx("flex items-center justify-between gap-3", className)}>
      <div className="flex min-w-0 flex-col">
        <h2 className="truncate text-rail-title">{title}</h2>
        {sub && <span className="truncate text-rail-meta font-num">{sub}</span>}
      </div>
      <div className="flex flex-none gap-1">
        <IconButton size="sm" className="rounded-tile" icon="chevron_left" aria-label={prevLabel} title={prevLabel} onClick={onPrev} />
        <Button size="sm" className="rounded-tile disabled:border-border disabled:bg-surface" disabled={isToday} onClick={onToday}>
          {todayLabel}
        </Button>
        <IconButton size="sm" className="rounded-tile" icon="chevron_right" aria-label={nextLabel} title={nextLabel} onClick={onNext} />
      </div>
    </div>
  );
}

/** A group's label in the rail (a filter's name, "Needs me"): small, light and in sentence case. */
export function RailGroup({ label, children, className }: { label: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={cx("flex flex-col", className)}>
      <h3 className={cx(INSET, "pt-4 pr-4 pb-1 text-rail-group")}>{label}</h3>
      <div className="flex flex-col">{children}</div>
    </section>
  );
}

export type RailPillTone = "signed" | "draft" | "progress" | "outline";

/**
 * A status pill: Signed (done, the one green), Draft (neutral fill), In progress (ink outline), Not
 * started (gray outline). The visit banner's; the rail's rows say theirs with `RailStatus`.
 */
export function RailPill({ tone, lead, children }: { tone: RailPillTone; lead?: ReactNode; children: ReactNode }) {
  return (
    <span
      className={cx(
        "inline-flex h-5 flex-none items-center gap-1 rounded-pill border px-2 text-rail-tag font-num whitespace-nowrap",
        tone === "signed" && "border-primary-subtle bg-selected text-primary",
        tone === "draft" && "border-border bg-surface-muted text-text",
        tone === "progress" && "border-text-secondary bg-surface text-text",
        tone === "outline" && "border-border bg-surface text-text-quiet",
      )}
    >
      {lead}
      {children}
    </span>
  );
}

export type RailStatusTone = "visit" | "draft" | "signed" | "failed" | "count";

/**
 * A visit's status at the right of a rail row's first line, only when it carries something: In visit
 * (a green dot, pulsing while audio comes in), Draft ready (purple sparkle: it is AI output), Signed
 * (green check), Failed (red, for something broken), or a household's count ("1 of 3 signed", gray).
 * Not started is the default and shows nothing.
 */
export function RailStatus({ tone, live, children }: { tone: RailStatusTone; live?: boolean; children: ReactNode }) {
  return (
    <span
      data-status={tone}
      className={cx(
        "inline-flex flex-none items-center gap-1 text-rail-tag font-num whitespace-nowrap",
        tone === "visit" && "text-primary",
        tone === "draft" && "text-ai",
        tone === "signed" && "text-success",
        tone === "failed" && "text-error",
        tone === "count" && "text-text-secondary",
      )}
    >
      {tone === "visit" && (
        <span
          aria-hidden="true"
          className={cx(
            "mx-1 size-[7px] flex-none rounded-pill bg-primary shadow-[0_0_0_3px_var(--color-primary-subtle)]",
            live && "animate-pulse-dot",
          )}
        />
      )}
      {tone === "draft" && <Icon name="auto_awesome" size={14} />}
      {tone === "signed" && <Icon name="check" size={14} />}
      {tone === "failed" && <Icon name="error" size={14} />}
      {children}
    </span>
  );
}

/**
 * The grid every rail row shares: the time (60 px, fits "10:30 AM"), the timeline's dot column (12 px)
 * and the rest, 8 px apart, so every name starts at 108 px and the line runs unbroken down the dot
 * column through every kind of row. Baseline aligned, so the time sits on the pet's name line however
 * many lines follow it.
 */
const ROW_COLS = cx("grid w-full grid-cols-[60px_12px_minmax(0,1fr)] gap-x-2", INSET, "pr-4");
const ROW_GRID = cx(ROW_COLS, "items-baseline");
const ROW_LOOK = cx(
  "pressable relative text-left text-text",
  "hover:bg-page focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-primary",
);
/** The visit on screen: a quiet fill and a green bar at the left edge. */
const ROW_HERE = "bg-rail-selected shadow-[inset_3px_0_0_var(--color-primary)] hover:bg-rail-selected";
const TIME = "text-rail-time font-num whitespace-nowrap";
/** Rows are divided by a hairline; a household's pets share its one. */
const DIVIDED = "border-b border-divider";

/** A visit's dot on the rail's line: not started, In visit, Draft ready, Signed, or broken. */
export type RailDot = "todo" | "visit" | "draft" | "signed" | "failed";

/**
 * Where a row sits on the rail's line: its dot (none for the Now line, a free stretch or a fold), and
 * whether the line runs on above and below it, so the line starts at the day's first dot and ends at
 * its last. A free stretch of the day is dashed.
 */
export type RailTrack = { dot?: RailDot; above?: boolean; below?: boolean; dashed?: boolean };

/** The line, 2 px, centered in the dot column (the inset, the time, the 8 px gap, then 6 px in). */
const LINE = "absolute left-[calc(var(--size-rail-inset)+73px)] w-[2px]";
const DOT_LOOK: Record<RailDot, string> = {
  // An empty gray ring: not started, before or after now, says nothing about blame.
  todo: "border-2 border-border-strong bg-surface",
  // Pulsing while the visit is on; still when the device asks for less motion.
  visit: "bg-primary shadow-[0_0_0_3px_var(--color-primary-subtle)] animate-pulse-dot motion-reduce:animate-none",
  // Purple: the draft is AI output, as in its status.
  draft: "bg-ai",
  signed: "bg-success text-on-primary",
  failed: "bg-error",
};

/**
 * A row's piece of the line and its dot, drawn over the row (which is `relative`) so the line stays
 * continuous across rows of any height. `center` is the dot's middle, on the row's name line. Hidden
 * from screen readers: the status says the same in words.
 */
function Track({ track, center = 22 }: { track?: RailTrack; center?: number }) {
  if (!track) return null;
  const { dot, above, below, dashed } = track;
  const seg = dashed ? "border-l-2 border-dashed border-border-strong" : "bg-border-strong";
  if (!dot) return above && below ? <span aria-hidden="true" className={cx(LINE, seg, "inset-y-0")} /> : null;
  return (
    <>
      {above && <span aria-hidden="true" className={cx(LINE, seg, "top-0")} style={{ height: center }} />}
      {below && <span aria-hidden="true" className={cx(LINE, seg, "bottom-0")} style={{ top: center }} />}
      <span
        aria-hidden="true"
        data-dot={dot}
        className={cx(
          "absolute left-[calc(var(--size-rail-inset)+68px)] flex size-3 items-center justify-center rounded-pill",
          DOT_LOOK[dot],
        )}
        style={{ top: center - 6 }}
      >
        {dot === "signed" && (
          <svg viewBox="0 0 12 12" className="size-3">
            <path d="M3.2 6.2 5.1 8.1 8.8 4.2" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        )}
      </span>
    </>
  );
}

/**
 * Who and why, in two lines: the pet's name (15 px) with its species and age ("Cat, 3 years") and the
 * status at the right; the breed small under it; the reason in plain words, wrapping to two lines, never
 * cut to one; and, when the pet has one, the caution's short amber line with its dot ("Watch airway").
 */
function RowBody({
  title,
  facts,
  sub,
  reason,
  cautions,
  cautionLabel,
  status,
}: {
  title: ReactNode;
  facts?: ReactNode;
  sub?: ReactNode;
  reason?: ReactNode;
  cautions?: (string | CautionItem)[];
  cautionLabel: string;
  status?: ReactNode;
}) {
  return (
    <span className="col-start-3 flex min-w-0 flex-col">
      <span className="flex min-w-0 items-baseline gap-2">
        <span className="min-w-0 truncate text-rail-name">{title}</span>
        {/* Species and age give way first, so the name keeps its room. */}
        <span className="min-w-0 flex-1 truncate text-meta">{facts}</span>
        {status && <span className="flex flex-none self-center">{status}</span>}
      </span>
      {sub && <span className="truncate text-rail-sub">{sub}</span>}
      {reason && <span className="mt-1 line-clamp-2 text-rail-reason">{reason}</span>}
      {!!cautions?.length && (
        <Caution items={cautions} compact size="rail" label={cautionLabel} max={2} className="mt-1 max-w-full" />
      )}
    </span>
  );
}

/**
 * A row's quick card: opens to the right of the row with a small pointer after 300 ms of hover, or at
 * once on keyboard focus; Esc or moving away closes it, and it stays open while the pointer is over it.
 * The card is the row's description (`role="tooltip"`, `aria-describedby` while open). Never on touch:
 * a tap opens the visit.
 */
function WithCard({ card, children }: { card?: ReactNode; children: ReactElement }) {
  const [open, setOpen] = useState(false);
  if (!card) return children;
  return (
    <Tooltip.Provider delayDuration={300} skipDelayDuration={300}>
      <Tooltip.Root open={open} onOpenChange={setOpen}>
        <Tooltip.Trigger asChild>{children}</Tooltip.Trigger>
        <Tooltip.Portal>
          <Tooltip.Content
            side="right"
            align="start"
            sideOffset={10}
            alignOffset={-8}
            collisionPadding={8}
            // Pressing in the card keeps focus on the row, so a card opened by focus stays open for the click.
            onMouseDown={(e) => e.preventDefault()}
            // Its one link opens the visit: the card closes behind it.
            onClick={(e) => (e.target as HTMLElement).closest("a") && setOpen(false)}
            className="z-(--layer-menu) w-[340px] max-w-[calc(100vw-16px)] rounded-card border border-border bg-surface p-4 text-left text-text shadow-pop"
          >
            {card}
            <Tooltip.Arrow asChild width={14} height={7}>
              {/* Pointing at the row, over the card's own border so the two read as one edge. */}
              <svg viewBox="0 0 14 7" className="-translate-y-px overflow-visible">
                <path d="M0 0 L7 7 L14 0 Z" className="fill-surface" />
                <path d="M0 0 L7 7 L14 0" className="fill-none stroke-border" />
              </svg>
            </Tooltip.Arrow>
          </Tooltip.Content>
        </Tooltip.Portal>
      </Tooltip.Root>
    </Tooltip.Provider>
  );
}

/** One section of the quick card, under a hairline: a small label (and something at its right), then the content. */
function CardSection({ label, aside, children }: { label?: ReactNode; aside?: ReactNode; children: ReactNode }) {
  return (
    <div className="mt-3 flex flex-col gap-1 border-t border-divider pt-3">
      {label && (
        <div className="flex items-baseline justify-between gap-3">
          <span className="text-label">{label}</span>
          {aside && <span className="text-rail-sub font-num">{aside}</span>}
        </div>
      )}
      {children}
    </div>
  );
}

/** A quiet list: a small gray dot before each line. */
function CardList({ items, className }: { items: ReactNode[]; className?: string }) {
  return (
    <ul className={cx("m-0 flex list-none flex-col gap-1 p-0", className)}>
      {items.map((it, i) => (
        <li key={i} className="flex gap-2 text-rail-reason">
          <span aria-hidden="true" className="mt-2 size-1 flex-none rounded-pill bg-border-strong" />
          <span className="min-w-0">{it}</span>
        </li>
      ))}
    </ul>
  );
}

/**
 * The quick card's content: what a doctor wants before walking in, read only. The pet (its initial,
 * name and facts: species, breed, sex, age and weight), the owner with a phone, the last visit, the
 * reason for today, the practice system's own notes with when they were read, its alerts in amber (or
 * "No alerts in PIMS"), and a footer with "Read only" and one "Open visit" link. No second button, no
 * edit controls, no AI summary. Every word comes in from the screen, so it reads in the app's language.
 */
export function RailCard({
  name,
  facts,
  details,
  reason,
  notes,
  alerts,
  readOnly,
  open,
}: {
  name: string;
  facts: ReactNode[];
  /** Label and value rows: Owner, Last visit. Empty values are left out. */
  details: { label: ReactNode; value: ReactNode }[];
  reason?: { label: ReactNode; text: ReactNode };
  /** The practice system's notes on the pet; left out when it has none. */
  notes?: { label: ReactNode; aside?: ReactNode; items: ReactNode[] };
  alerts: { label: ReactNode; items: string[]; none: ReactNode };
  readOnly: ReactNode;
  open: { label: ReactNode; href?: string; onClick: () => void };
}) {
  const rows = details.filter((d) => d.value !== undefined && d.value !== null && d.value !== "");
  return (
    <div className="flex flex-col">
      <div className="flex items-center gap-3">
        <span
          aria-hidden="true"
          className="flex size-11 flex-none items-center justify-center rounded-pill bg-surface-muted text-title text-text-secondary"
        >
          {name.trim().charAt(0).toUpperCase()}
        </span>
        <span className="flex min-w-0 flex-col">
          <span className="truncate text-title">{name}</span>
          <FactsLine items={facts} />
        </span>
      </div>
      {!!rows.length && (
        <CardSection>
          <dl className="m-0 grid grid-cols-[auto_minmax(0,1fr)] gap-x-4 gap-y-1 text-rail-reason">
            {rows.map((d, i) => (
              <Fragment key={i}>
                <dt className="text-text-secondary">{d.label}</dt>
                <dd className="m-0 min-w-0">{d.value}</dd>
              </Fragment>
            ))}
          </dl>
        </CardSection>
      )}
      {reason && (
        <CardSection label={reason.label}>
          <p className="m-0 text-rail-reason">{reason.text}</p>
        </CardSection>
      )}
      {!!notes?.items.length && (
        <CardSection label={notes.label} aside={notes.aside}>
          <CardList items={notes.items} />
        </CardSection>
      )}
      <CardSection label={alerts.label}>
        {alerts.items.length ? (
          <CardList items={alerts.items} className="text-warning" />
        ) : (
          <p className="m-0 text-rail-reason text-text-secondary">{alerts.none}</p>
        )}
      </CardSection>
      <div className="mt-3 flex items-center justify-between gap-3 border-t border-divider pt-3">
        <span className="text-rail-sub">{readOnly}</span>
        <a
          href={open.href ?? "#"}
          onClick={(e) => {
            if (e.metaKey || e.ctrlKey || e.shiftKey) return;
            e.preventDefault();
            open.onClick();
          }}
          className="inline-flex items-center gap-1 rounded-control text-section text-primary hover:underline focus-visible:outline-2 focus-visible:outline-primary"
        >
          {open.label}
          <Icon name="arrow_forward" size={16} />
        </a>
      </div>
    </div>
  );
}

/**
 * One visit in the rail, in two lines (about 72 to 96 px): the time (a Number), then the pet's name,
 * species and age with the status at the right, the breed under it, the reason wrapping to two lines,
 * and a caution's amber line. The whole row is one button; hover or focus opens its quick card (`card`).
 * `track` puts it on the rail's line with its dot.
 */
export function RailRow({
  time,
  title,
  facts,
  sub,
  reason,
  cautions,
  cautionLabel = "Caution",
  status,
  card,
  current,
  track,
  onClick,
  className,
}: {
  time: ReactNode;
  title: ReactNode;
  /** Species and age: "Cat, 3 years". */
  facts?: ReactNode;
  /** The breed. */
  sub?: ReactNode;
  /** The reason for the visit, in plain words. */
  reason?: ReactNode;
  cautions?: (string | CautionItem)[];
  /** The word screen readers hear before the caution line. */
  cautionLabel?: string;
  status?: ReactNode;
  /** The quick card's content (`RailCard`), shown on hover and focus. */
  card?: ReactNode;
  /** The visit on screen now: a quiet fill and a green bar. */
  current?: boolean;
  /** Its place on the rail's line, with its dot. */
  track?: RailTrack;
  onClick: () => void;
  className?: string;
}) {
  return (
    <WithCard card={card}>
      <button
        type="button"
        onClick={onClick}
        aria-current={current ? "true" : undefined}
        className={cx(ROW_GRID, ROW_LOOK, DIVIDED, "py-3", current && ROW_HERE, className)}
      >
        <Track track={track} />
        <span className={TIME}>{time}</span>
        <RowBody
          title={title}
          facts={facts}
          sub={sub}
          reason={reason}
          cautions={cautions}
          cautionLabel={cautionLabel}
          status={status}
        />
      </button>
    </WithCard>
  );
}

/**
 * A household's pets as small stacked initials (B W K), each circle over the edge of the last. Decoration
 * beside the words that say it ("3 pets"), so hidden from screen readers.
 */
export function PetInitials({ names, className }: { names: string[]; className?: string }) {
  return (
    <span aria-hidden="true" className={cx("flex flex-none -space-x-1", className)}>
      {names.map((n, i) => (
        <span
          key={`${n}-${i}`}
          className="inline-flex size-[18px] items-center justify-center rounded-pill border-[1.5px] border-surface bg-surface-muted text-rail-tag text-text-secondary"
        >
          {n.trim().charAt(0)}
        </span>
      ))}
    </span>
  );
}

/** The thin gray guide line that joins a household's pets, in the gap after the dot column. */
const GUIDE = "absolute left-[calc(var(--size-rail-inset)+82px)] w-[1.5px] bg-border";

/**
 * A household visit in the rail: several of one owner's pets booked as one visit, owner-led. Folded, it
 * is one quiet row: the time, the owner and "3 pets", nothing else. Open (the household on screen, or in
 * the room): the owner with its status ("1 of 3 signed"), the pets' initials stacked with "3 pets" under
 * it, then one `RailPetRow` per pet, joined to it by a thin guide line. On the rail's line it is one dot:
 * the line runs on past its pets.
 */
export function RailHousehold({
  time,
  owner,
  count,
  pets,
  status,
  open,
  current,
  track,
  onClick,
  children,
  className,
}: {
  time: ReactNode;
  /** The owner's name: the household is owner-led. */
  owner: ReactNode;
  /** "3 pets". */
  count: ReactNode;
  /** The pets' names, for their initials when open. */
  pets: string[];
  /** "1 of 3 signed", shown only when open. */
  status?: ReactNode;
  open?: boolean;
  current?: boolean;
  /** Its place on the rail's line: one dot for the household. */
  track?: RailTrack;
  onClick: () => void;
  /** The pets' rows, shown only when open. */
  children?: ReactNode;
  className?: string;
}) {
  const guide = open && !!children;
  return (
    <div className={cx("relative flex flex-col", DIVIDED, className)}>
      <button
        type="button"
        onClick={onClick}
        aria-current={current ? "true" : undefined}
        aria-expanded={!!open}
        className={cx(ROW_GRID, ROW_LOOK, open ? "pt-3 pb-2" : "py-3", current && ROW_HERE)}
      >
        <span className={TIME}>{time}</span>
        {open ? (
          <>
            <span className="col-start-3 flex min-w-0 items-baseline gap-2">
              <span className="min-w-0 flex-1 truncate text-rail-name">{owner}</span>
              {status && <span className="flex flex-none self-center">{status}</span>}
            </span>
            {guide && <span aria-hidden="true" className={cx(GUIDE, "top-[58px] bottom-0")} />}
            <span className="col-start-3 mt-1 flex min-w-0 items-center gap-1">
              <PetInitials names={pets} />
              <span className="text-rail-sub font-num whitespace-nowrap">{count}</span>
            </span>
          </>
        ) : (
          <span className="col-start-3 flex min-w-0 items-baseline gap-2">
            <span className="min-w-0 truncate text-rail-name">{owner}</span>
            <span className="min-w-0 flex-1 truncate text-meta font-num">{count}</span>
          </span>
        )}
      </button>
      {guide && <div className="flex flex-col pb-1">{children}</div>}
      {/* Last, so the line paints over the selected fill of the rows above it. */}
      <Track track={track} />
    </div>
  );
}

/**
 * One pet of an open household in the rail, in the same two lines as every row (name, species and age,
 * the status at the right; the breed; the reason; a caution's amber line), in the name column under the
 * owner's name, no extra indent. The household's guide line runs down the gap after the dot column,
 * with a short tick into the row. The pet on screen gets the green tint. Hover or focus opens its card.
 */
export function RailPetRow({
  title,
  facts,
  sub,
  reason,
  cautions,
  cautionLabel = "Caution",
  status,
  card,
  current,
  last,
  onClick,
}: {
  title: ReactNode;
  facts?: ReactNode;
  sub?: ReactNode;
  reason?: ReactNode;
  cautions?: (string | CautionItem)[];
  cautionLabel?: string;
  status?: ReactNode;
  card?: ReactNode;
  current?: boolean;
  /** The household's last pet: the guide line ends at its tick. */
  last?: boolean;
  onClick: () => void;
}) {
  return (
    <WithCard card={card}>
      <button
        type="button"
        onClick={onClick}
        aria-current={current ? "true" : undefined}
        className={cx(ROW_GRID, ROW_LOOK, "py-2", current && "bg-selected hover:bg-selected")}
      >
        <span aria-hidden="true">
          {/* The tick sits at the pet's name line, 18 px down; the last pet's guide ends at it. */}
          <span className={cx(GUIDE, "top-0", last ? "h-[18px]" : "bottom-0")} />
          <span className={cx(GUIDE, "top-[17px] h-[1.5px] w-[6px]")} />
        </span>
        <RowBody
          title={title}
          facts={facts}
          sub={sub}
          reason={reason}
          cautions={cautions}
          cautionLabel={cautionLabel}
          status={status}
        />
      </button>
    </WithCard>
  );
}

/**
 * Where the day stands now, on the rail's line between the visits gone by and the visits to come: a thin
 * green line across the rail with "Now 1:15 PM" in the time column. Green is the day moving forward, not
 * an action. A separator, heard as `name` ("Now, 1:15 PM").
 */
export function RailNow({ label, name, track }: { label: ReactNode; name?: string; track?: RailTrack }) {
  return (
    <div
      role="separator"
      aria-label={name ?? (typeof label === "string" ? label : undefined)}
      className={cx(ROW_COLS, "relative h-5 items-center")}
    >
      <Track track={track} />
      {/* A later time ("Now 10:30 AM") runs past the time column: its own fill keeps it over the line. */}
      <span className="relative z-[1] bg-surface pr-1 text-rail-tag font-num whitespace-nowrap text-primary">{label}</span>
      <span aria-hidden="true" className="col-span-2 h-px bg-primary" />
    </div>
  );
}

/**
 * A free stretch of the day, an hour or more between one visit's end and the next one's start: a dashed
 * stretch of the line and a quiet label in the name column ("Free until 1:30 PM").
 */
export function RailFree({ label, track }: { label: ReactNode; track?: RailTrack }) {
  return (
    <div className={cx(ROW_COLS, "relative h-8 items-center", DIVIDED)}>
      <Track track={track && { ...track, dashed: true }} />
      <span className="col-start-3 truncate text-rail-sub font-num">{label}</span>
    </div>
  );
}

/**
 * The rail's quiet folds. `link`: "+4 more this afternoon", plain text in the name column that opens the
 * rest. Otherwise the Done row ("Done · 8"), 40 px, in the name column with a chevron when it opens; on
 * the rail's line (`track`) it is one dot for every visit it holds.
 */
export function RailMore({
  children,
  onClick,
  open,
  link,
  track,
}: {
  children: ReactNode;
  onClick?: () => void;
  open?: boolean;
  link?: boolean;
  track?: RailTrack;
}) {
  if (link) {
    const look = cx(ROW_COLS, "h-9 items-center text-rail-time font-num");
    const body = <span className="col-start-3 text-left">{children}</span>;
    if (!onClick) return <div className={look}>{body}</div>;
    return (
      <button
        type="button"
        aria-expanded={open}
        onClick={onClick}
        className={cx(
          look,
          "pressable hover:text-text-secondary focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-primary",
        )}
      >
        {body}
      </button>
    );
  }
  const body = (
    <>
      <Track track={track} center={20} />
      <span className="col-start-3 flex min-w-0 items-center gap-2">
        <span className="flex-1 text-left">{children}</span>
        {onClick && <Icon name="expand_more" size={20} className={cx("text-text-secondary transition-transform", open && "rotate-180")} />}
      </span>
    </>
  );
  const look = cx(ROW_COLS, "relative h-10 items-center text-section font-num text-text-secondary", DIVIDED);
  if (!onClick) return <div className={look}>{body}</div>;
  return (
    <button
      type="button"
      aria-expanded={open}
      onClick={onClick}
      className={cx(
        "pressable hover:bg-page focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-primary",
        look,
      )}
    >
      {body}
    </button>
  );
}

/**
 * A neutral tile that opens a list: Ready to sign 2 · Oldest 6 days. The count is a Number at its
 * line's size; the tile is never colored, since the rows it opens say what needs attention.
 */
export function BucketTile({
  icon,
  title,
  count,
  meta,
  onClick,
  className,
}: {
  icon: string;
  title: ReactNode;
  count: number;
  meta?: ReactNode;
  onClick: () => void;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cx(
        "pressable flex min-w-0 items-center gap-3 rounded-tile border border-border bg-surface px-3 py-3 text-left text-text",
        "hover:border-border-strong focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-primary",
        className,
      )}
    >
      <Icon name={icon} size={20} className="text-text-secondary" />
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="truncate text-body-strong">{title}</span>
        {meta && <span className="truncate text-meta">{meta}</span>}
      </span>
      <span className="text-body-strong font-num">{count}</span>
      <Icon name="chevron_right" size={20} className="text-text-tertiary" />
    </button>
  );
}
