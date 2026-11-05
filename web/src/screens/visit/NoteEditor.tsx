import { Fragment, useEffect, useLayoutEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { api } from "../../api";
import type { AssistAction, AssistResult, SectionKey, Segment, Template } from "../../api/types";
import { speakerOfLine } from "../../lib/speakers";
import {
  CONFIRM,
  applyEdit,
  foldMarks,
  isValue,
  markWords,
  petChoices,
  toDisplay,
  toValue,
  wholeMarks,
  type MarkRange,
} from "./confirm";
import { useSources } from "./useSources";
import { duration } from "../../lib/format";
import { speechRecognition, type SpeechRecognitionLike } from "../../lib/speech";
import {
  AiLabel,
  Alert,
  Button,
  ConfirmMark,
  Pressable,
  SourceChip,
  Tag,
  TextArea,
  TextField,
  ToolButton,
  TypingDots,
} from "@blinq-scribe/ui";

/**
 * The note text with each [confirm] mark highlighted where it is, in AI purple, its words visible:
 * "Confirm: ear drop product and duration". A mark alone on its own line belongs to the line above it,
 * so it shows on that line. React escapes every piece; nothing is parsed as HTML.
 */
export function RichText({ text }: { text: string }) {
  const { t } = useTranslation();
  const shown = foldMarks(text);
  const out: React.ReactNode[] = [];
  let last = 0;
  for (const m of shown.matchAll(CONFIRM)) {
    const at = m.index ?? 0;
    if (at > last) out.push(shown.slice(last, at));
    out.push(
      <ConfirmMark key={at} tabIndex={-1}>
        {markWords((m[1] ?? "").trim(), t)}
      </ConfirmMark>,
    );
    last = at + m[0].length;
  }
  if (last < shown.length) out.push(shown.slice(last));
  return <>{out}</>;
}

const norm = (s: string): string =>
  s
    .replace(/^[\s\-•*]+/, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();

/** The transcript line one line of the note came from, by its sentences; null when none matched. */
function lineSource(line: string, found: AssistResult | null): number | null {
  if (!found) return null;
  const l = norm(line);
  if (!l) return null;
  for (const x of found.sources) {
    const sent = norm(x.sentence).replace(/[.!?]+$/, "");
    if (sent && (l.includes(sent) || sent.includes(l.replace(/[.!?]+$/, ""))) && x.lines.length)
      return x.lines[0] ?? null;
  }
  return null;
}

/** The time chip at the end of a drafted line: "0:27", or the line number when there's no time. */
export function TimeChip({
  line,
  segments,
  onJump,
}: {
  line: number;
  segments?: Segment[];
  onJump: (line: number) => void;
}) {
  const { t } = useTranslation();
  const seg = segments?.find((x) => x.line === line);
  const time = seg ? duration(seg.offset_seconds) : t("editor.lineRef", { lines: line }).trim();
  const who = speakerOfLine(segments, line);
  return (
    <SourceChip
      label={t("review.sourceChipLabel", { shown: who ? `${time} · ${who}` : time })}
      title={seg?.text}
      onClick={() => onJump(line)}
    >
      {time}
    </SourceChip>
  );
}

/**
 * A line Blinq couldn't place on one pet: "Which pet? Hazel / Mochi" in purple at the line, with the pet
 * it is on now (keeps it there) and Move to each other pet it could be about.
 */
function PetConfirmItem({
  children,
  pets,
  pet,
  onConfirm,
  onMove,
}: {
  children: React.ReactNode;
  pets: string[];
  pet: string;
  onConfirm: () => void;
  onMove: (pet: string) => void;
}) {
  const { t } = useTranslation();
  return (
    <div className="confirm-item" data-pet-confirm="">
      <span className="min-w-0 flex-[1_1_200px]">{children}</span>
      <span className="row nowrap" role="group" aria-label={t("review.whichPetLabel")}>
        <Button size="sm" aria-label={t("review.keepOn", { pet })} onClick={onConfirm}>
          {pet}
        </Button>
        {pets
          .filter((p) => p !== pet)
          .map((p) => (
            <Button key={p} size="sm" onClick={() => onMove(p)}>
              {t("review.moveTo", { pet: p })}
            </Button>
          ))}
      </span>
    </div>
  );
}

/** A thing to confirm, at its field: the line in purple with Confirm and Edit right there. */
function ConfirmItem({
  children,
  what,
  onConfirm,
  onEdit,
}: {
  children: React.ReactNode;
  what: string;
  onConfirm: () => void;
  onEdit: () => void;
}) {
  const { t } = useTranslation();
  return (
    <div className="confirm-item">
      <span className="min-w-0 flex-1">{children}</span>
      <span className="row nowrap">
        <Button size="sm" aria-label={t("review.confirmItLabel", { what })} onClick={onConfirm}>
          {t("review.confirmIt")}
        </Button>
        <Button size="sm" aria-label={t("review.editItLabel", { what })} onClick={onEdit}>
          {t("review.editIt")}
        </Button>
      </span>
    </div>
  );
}

/**
 * A line of the provider's own last plan, ticked to cover today, that the visit didn't talk about: in
 * purple at the Plan, quoted as they wrote it, with Add to Plan and Dismiss. A reminder, never a block.
 */
export function PlanReminderItem({
  text,
  busy,
  onAdd,
  onDismiss,
}: {
  text: string;
  busy?: boolean;
  onAdd: () => void;
  onDismiss: () => void;
}) {
  const { t } = useTranslation();
  return (
    <div className="confirm-item" data-plan-reminder="">
      <span className="min-w-0 flex-[1_1_240px]">
        <span className="text-body-strong text-ai">{t("review.planNotCoveredLead")}</span> {text}
      </span>
      <span className="row nowrap">
        <Button size="sm" disabled={busy} aria-label={t("review.addToPlanLabel", { text })} onClick={onAdd}>
          {t("review.addToPlan")}
        </Button>
        <Button size="sm" disabled={busy} aria-label={t("review.dismissLineLabel", { text })} onClick={onDismiss}>
          {t("review.dismissLine")}
        </Button>
      </span>
    </div>
  );
}

/**
 * One section as read: its heading with Edit, then each line Blinq drafted with a 2 px purple rule on
 * the left and a time chip at its end that goes to where it was said. A line with something to
 * confirm is purple with Confirm and Edit at the line. A line not found in the transcript says so.
 */
export function SectionView({
  k,
  label,
  text,
  onEdit,
  extra,
  notice,
  encounterId,
  segments,
  onJump,
  onConfirm,
  onEditMark,
  pet,
  onMove,
  after,
}: {
  k: SectionKey;
  label: string;
  text: string;
  onEdit: () => void;
  /** After the lines: the Plan's lines from the last plan not covered. */
  after?: React.ReactNode;
  /** Beside Edit: another way into the editor (Spanish, for the owner's section). */
  extra?: React.ReactNode;
  /** Under the heading: "Out of sync with Plan · Update". */
  notice?: React.ReactNode;
  encounterId: string;
  segments?: Segment[];
  onJump: (line: number) => void;
  /** Confirm the nth mark in this section. */
  onConfirm: (n: number) => void;
  /** Open the editor on the nth mark. */
  onEditMark: (n: number) => void;
  /** In a visit with several pets: the pet this note is for. */
  pet?: string;
  /** Move the line with the nth mark (a line Blinq couldn't place) to another pet's note. */
  onMove?: (n: number, pet: string) => void;
}) {
  const { t } = useTranslation();
  const found = useSources(encounterId, k, text);
  const lines = foldMarks(text).split("\n");
  let mark = -1;
  return (
    <section className="note-sec" id={`sec-${k}`}>
      <div className="between">
        <h3 className="sec-title">{label}</h3>
        <span className="row nowrap">
          {extra}
          <Button
            variant="link"
            icon="edit"
            aria-label={t("review.editLabel", { label })}
            data-edit={k}
            onClick={onEdit}
          >
            {t("review.edit")}
          </Button>
        </span>
      </div>
      {notice}
      <div id={`body-${k}`} className="ai-lines">
        {!text.trim() ? (
          <span className="muted">{t("review.empty")}</span>
        ) : (
          lines.map((line, i) => {
            if (!line.trim()) return <span key={i} className="ai-gap" aria-hidden="true" />;
            const shown = line.replace(/^\s*[-•*]\s+/, "");
            const marks = [...shown.matchAll(new RegExp(CONFIRM.source, "gi"))];
            if (marks.length) {
              const first = mark + 1;
              mark += marks.length;
              const what = (marks[0]?.[1] ?? "").trim();
              const plain = shown.replace(new RegExp(CONFIRM.source, "gi"), "").trim();
              const pets = petChoices(what);
              if (pets && pet && onMove)
                return (
                  <PetConfirmItem
                    key={i}
                    pets={pets}
                    pet={pet}
                    onConfirm={() => onConfirm(first)}
                    onMove={(to) => onMove(first, to)}
                  >
                    <RichText text={shown} />
                  </PetConfirmItem>
                );
              // A mark that asks about the line (not a value standing in it, like a dose) reads as a
              // question above the line, so the draft text reads clean and the purple never looks like a
              // link in the sentence. A value mark stays where it stands: taking it out would drop the value.
              const asks = !marks.some((m) => isValue((m[1] ?? "").trim()));
              return (
                <ConfirmItem
                  key={i}
                  what={plain && !isValue(what) ? `${plain}, ${what}` : what}
                  onConfirm={() => onConfirm(first)}
                  onEdit={() => onEditMark(first)}
                >
                  {asks ? (
                    <span className="flex flex-col gap-1">
                      <span className="flex flex-wrap gap-x-3 text-body-strong">
                        {marks.map((m, j) => (
                          <ConfirmMark key={j} className="bg-transparent shadow-none">
                            {t("review.checkLead", { what: (m[1] ?? "").trim() })}
                          </ConfirmMark>
                        ))}
                      </span>
                      {plain && <RichText text={plain} />}
                    </span>
                  ) : (
                    <RichText text={shown} />
                  )}
                </ConfirmItem>
              );
            }
            const src = lineSource(shown, found);
            return (
              <p key={i} className="ai-line">
                <span className="min-w-0 flex-1">{shown}</span>
                {src != null ? (
                  <TimeChip line={src} segments={segments} onJump={onJump} />
                ) : found ? (
                  <span className="no-source" title={t("review.noSourceLabel")}>
                    {t("review.noSource")}
                  </span>
                ) : null}
              </p>
            );
          })
        )}
      </div>
      {after}
    </section>
  );
}

const SpeechRec = speechRecognition();

type Suggestion = { action: AssistAction; result: AssistResult } | { working: true } | { error: string } | null;

/**
 * One section edits in place at a time: Muse quick actions, Ask Blinq to edit, the vet's templates
 * ("/" or the Templates button) and dictation. Nothing the AI suggests changes the note until Use this.
 */
export function SectionEditor({
  k,
  label,
  value,
  onChange,
  onDone,
  encounterId,
  templates,
  staleCheck,
  onNext,
  autoRun,
  autoAsk,
  focusMark,
  segments,
  after,
}: {
  k: SectionKey;
  label: string;
  value: string;
  /** Under the editor: the Plan's lines from the last plan not covered. */
  after?: React.ReactNode;
  onChange: (v: string) => void;
  onDone: () => void;
  encounterId: string;
  templates: Template[];
  staleCheck: () => () => boolean;
  /** Tab: on to the next section. */
  onNext?: () => void;
  /** An edit tool to run as the editor opens (Spanish, from the section's chip). */
  autoRun?: AssistAction;
  /** Ask Blinq this as the editor opens (Update, when the owner's text is out of sync with Plan). */
  autoAsk?: string;
  /** Open with the nth thing to confirm selected, so typing replaces it. */
  focusMark?: number;
  /** Who said each transcript line, for Show sources. */
  segments?: Segment[];
}) {
  const { t } = useTranslation();
  const box = useRef<HTMLTextAreaElement>(null);
  const [ask, setAsk] = useState("");
  const [suggest, setSuggest] = useState<Suggestion>(null);
  const [dictating, setDictating] = useState(false);
  const dictation = useRef<SpeechRecognitionLike | null>(null);
  const [tpl, setTpl] = useState<{ open: boolean; items: Template[]; active: number; slashAt: number | null }>({
    open: false,
    items: [],
    active: 0,
    slashAt: null,
  });
  const valueRef = useRef(value);
  valueRef.current = value;

  // The text as shown: each "[confirm: x]" is its words in a purple chip, never the bracket. Typing over
  // a chip replaces it whole; the note keeps the mark until then.
  const mark = (what: string) => markWords(what, t);
  const [area, setArea] = useState(() => toDisplay(value, mark));
  const emitted = useRef(value);
  const selection = useRef<[number, number]>([0, 0]);
  useEffect(() => {
    if (value === emitted.current) return;
    emitted.current = value;
    setArea(toDisplay(value, mark));
  }, [value]); // eslint-disable-line react-hooks/exhaustive-deps
  /** The shown text changed to `next`: keep the marks right, and tell the note. */
  const change = (next: string, sel: [number, number] = selection.current): number => {
    const out = applyEdit(area.text, next, area.marks, sel);
    setArea({ text: out.text, marks: out.marks });
    const v = toValue(out.text, out.marks);
    emitted.current = v;
    onChange(v);
    if (out.text !== next) {
      // Part of a chip went: put the caret where the typing ended.
      requestAnimationFrame(() => box.current?.setSelectionRange(out.caret, out.caret));
    }
    selection.current = [out.caret, out.caret];
    return out.caret;
  };
  const onSelect = () => {
    const el = box.current;
    if (!el) return;
    const [a, b] = wholeMarks(el.selectionStart, el.selectionEnd, area.marks);
    if (a !== el.selectionStart || b !== el.selectionEnd) el.setSelectionRange(a, b);
    selection.current = [a, b];
  };
  // The box grows with its text, so the chips drawn behind it stay under their words.
  useLayoutEffect(() => {
    const el = box.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight + 2}px`;
  }, [area.text]);

  useEffect(() => {
    const el = box.current;
    if (!el) return;
    el.focus();
    const m: MarkRange | undefined = focusMark != null ? area.marks[focusMark] : undefined;
    if (m) el.setSelectionRange(m.start, m.end);
    else el.setSelectionRange(el.value.length, el.value.length);
    selection.current = [el.selectionStart, el.selectionEnd];
    el.closest(".note-sec")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => () => stopDictation(), []);
  useEffect(() => {
    if (autoRun) void run(autoRun);
    else if (autoAsk) void run("custom", autoAsk);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  function stopDictation() {
    const d = dictation.current;
    dictation.current = null;
    setDictating(false);
    try {
      d?.stop();
    } catch {
      /* already stopped */
    }
  }

  const insertAtCaret = (text: string, from?: number) => {
    const el = box.current;
    if (!el) return;
    const at = from ?? el.selectionStart ?? el.value.length;
    const end = el.selectionEnd ?? at;
    const next = el.value.slice(0, at) + text + el.value.slice(end);
    const caret = change(next, [at, end]);
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(caret, caret);
    });
  };

  const short = (x: Template) => (x.shortcut ? (x.shortcut.startsWith("/") ? x.shortcut : `/${x.shortcut}`) : "");
  const openTpl = (slashAt: number | null, query: string) => {
    const q = query.toLowerCase();
    const items = templates.filter(
      (x) => !q || x.shortcut.replace(/^\//, "").toLowerCase().startsWith(q) || x.name.toLowerCase().includes(q),
    );
    if (slashAt != null && !items.length && q) {
      closeTpl();
      return;
    }
    setTpl({ open: true, items, active: 0, slashAt });
  };
  const closeTpl = () => setTpl({ open: false, items: [], active: 0, slashAt: null });
  const insertTpl = (item: Template | undefined) => {
    const el = box.current;
    if (!item || !el) {
      closeTpl();
      return;
    }
    const from = tpl.slashAt;
    closeTpl();
    if (from != null) el.setSelectionRange(from, el.selectionStart);
    insertAtCaret(item.text, from ?? undefined);
  };

  const onInput = (ev: React.ChangeEvent<HTMLTextAreaElement>) => {
    change(ev.target.value);
    // "/" at the start of a word opens the vet's templates, filtered as they type.
    const caret = ev.target.selectionStart;
    const m = ev.target.value.slice(0, caret).match(/(?:^|\s)\/([\w-]*)$/);
    if (m) openTpl(caret - (m[1]?.length ?? 0) - 1, m[1] ?? "");
    else if (tpl.slashAt != null) closeTpl();
  };
  const onKeyDown = (ev: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (tpl.open) {
      if (ev.key === "ArrowDown" || ev.key === "ArrowUp") {
        ev.preventDefault();
        if (tpl.items.length)
          setTpl({
            ...tpl,
            active: (tpl.active + (ev.key === "ArrowDown" ? 1 : -1) + tpl.items.length) % tpl.items.length,
          });
        return;
      }
      if (ev.key === "Enter" && tpl.items.length) {
        ev.preventDefault();
        insertTpl(tpl.items[tpl.active]);
        return;
      }
      if (ev.key === "Escape") {
        ev.preventDefault();
        closeTpl();
        return;
      }
    }
    if (ev.key === "Escape") {
      ev.preventDefault();
      onDone();
    }
    if (ev.key === "Tab" && !ev.shiftKey && onNext) {
      ev.preventDefault();
      onNext();
    }
  };

  const run = async (action: AssistAction, instruction = "") => {
    setSuggest({ working: true });
    const onStale = staleCheck();
    try {
      const result = await api.assist(encounterId, { section: k, action, text: valueRef.current, instruction });
      if (onStale()) return;
      setSuggest({ action, result });
    } catch (err) {
      if (onStale()) return;
      const status = (err as { status?: number }).status;
      setSuggest({
        error:
          status === 404
            ? t("editor.cantEdit")
            : t("editor.cantEditWhy", { message: err instanceof Error ? err.message : String(err) }),
      });
    }
  };
  const closeSuggest = () => {
    setSuggest(null);
    box.current?.focus();
  };

  const dictate = () => {
    if (!SpeechRec) return;
    if (dictation.current) {
      stopDictation();
      return;
    }
    const rec = new SpeechRec();
    rec.continuous = true;
    rec.interimResults = false;
    rec.lang = "en-US";
    rec.onresult = (ev) => {
      for (let i = ev.resultIndex; i < ev.results.length; i++) {
        const r = ev.results[i];
        if (r?.isFinal) insertAtCaret(r[0].transcript.trim() + " ");
      }
    };
    rec.onend = () => {
      if (dictation.current === rec) {
        dictation.current = null;
        setDictating(false);
      }
    };
    rec.onerror = () => {
      dictation.current = null;
      setDictating(false);
    };
    dictation.current = rec;
    rec.start();
    setDictating(true);
  };

  const owner = k === "client_summary";
  const cur = tpl.items[tpl.active];
  const tools: [AssistAction, string, string][] = [
    ["tighten", "compress", t("editor.tighten")],
    ["bullets", "format_list_bulleted", t("editor.bullets")],
    ["repull", "sync", t("editor.repull")],
    ["sources", "format_quote", t("editor.sources")],
    ...(owner ? [["translate_es", "translate", t("editor.spanish")] as [AssistAction, string, string]] : []),
  ];

  return (
    <section className="note-sec" id={`sec-${k}`}>
      <h3 className="sec-title">
        <label htmlFor={`ed-${k}`}>{label}</label>
      </h3>
      <div className="sec-editor">
        <div className="toolbar" role="toolbar" aria-label={t("editor.toolsFor", { label })}>
          {tools.map(([action, icon, name]) => (
            <ToolButton key={action} tone="ai" icon={icon} onClick={() => void run(action)}>
              {name}
            </ToolButton>
          ))}
          <span className="flex-1" />
          {SpeechRec && (
            <ToolButton icon="mic" pressed={dictating} pressedTone="recording" onClick={dictate}>
              {dictating ? t("editor.stopDictate") : t("editor.dictate")}
            </ToolButton>
          )}
          <ToolButton
            icon="description"
            aria-controls="tplMenu"
            aria-expanded={tpl.open}
            onClick={() => (tpl.open ? closeTpl() : openTpl(null, ""))}
          >
            {t("editor.templates")}
          </ToolButton>
        </div>
        <div className="relative">
          <TextField
            id="askEdit"
            icon="auto_awesome"
            aria-label={t("editor.askLabel")}
            aria-describedby="askHint"
            className="bg-ai-bg pr-16"
            placeholder={t("editor.askPlaceholder")}
            value={ask}
            onChange={(e) => setAsk(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                if (ask.trim()) void run("custom", ask.trim());
              }
              if (e.key === "Escape") box.current?.focus();
            }}
          />
          <kbd id="askHint" className="absolute top-1/2 right-2.5 -translate-y-1/2">
            {t("editor.enter")}
          </kbd>
        </div>
        <div className="confirm-area">
          <div className="confirm-back" aria-hidden="true">
            {area.marks.length
              ? [...area.marks]
                  .sort((a, b) => a.start - b.start)
                  .reduce<{ at: number; out: React.ReactNode[] }>(
                    (acc, m, i, all) => {
                      acc.out.push(area.text.slice(acc.at, m.start));
                      acc.out.push(<ConfirmMark key={i}>{area.text.slice(m.start, m.end)}</ConfirmMark>);
                      acc.at = m.end;
                      if (i === all.length - 1) acc.out.push(area.text.slice(m.end));
                      return acc;
                    },
                    { at: 0, out: [] },
                  )
                  .out.map((x, i) => <Fragment key={i}>{x}</Fragment>)
              : area.text}
            {"\u200b"}
          </div>
          <TextArea
            minHeight={120}
            id={`ed-${k}`}
            ref={box}
            value={area.text}
            className="confirm-input"
            aria-describedby="edHelp"
            onChange={onInput}
            onKeyDown={onKeyDown}
            onSelect={onSelect}
          />
        </div>
        {tpl.open && (
          <div className="tpl-menu" id="tplMenu" role="group" aria-label={t("editor.templates")}>
            <div className="text-meta px-2 py-1">{t("editor.yourTemplates")}</div>
            {tpl.items.length ? (
              tpl.items.map((x, i) => (
                <Pressable
                  key={x.id}
                  className="tpl-opt"
                  aria-current={i === tpl.active}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => insertTpl(x)}
                >
                  <span>{x.name}</span>
                  <span className="font-num muted">{short(x)}</span>
                </Pressable>
              ))
            ) : (
              <p className="text-meta p-2">{t("editor.noTemplates")}</p>
            )}
          </div>
        )}
        {/* Arrow keys stay in the text box, so each move is read out. */}
        <span className="sr" aria-live="polite">
          {tpl.open
            ? cur
              ? t("editor.tplLive", {
                  n: tpl.active + 1,
                  total: tpl.items.length,
                  name: cur.name,
                  shortcut: short(cur),
                })
              : t("editor.tplNone")
            : ""}
        </span>
        <div aria-live="polite">
          {suggest && (
            <SuggestBox
              s={suggest}
              segments={segments}
              onUse={(v) => {
                onChange(v);
                closeSuggest();
              }}
              onClose={closeSuggest}
            />
          )}
        </div>
        <div className="between text-meta">
          <span id="edHelp">{t("editor.help")}</span>
          <Button onClick={onDone}>{t("editor.done")}</Button>
        </div>
      </div>
      {after}
    </section>
  );
}

function SuggestBox({
  s,
  segments,
  onUse,
  onClose,
}: {
  s: NonNullable<Suggestion>;
  segments?: Segment[];
  onUse: (v: string) => void;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  if ("working" in s)
    return (
      <div className="suggest">
        <AiLabel>
          {t("editor.working")}
          <TypingDots />
        </AiLabel>
      </div>
    );
  if ("error" in s)
    return (
      <div className="suggest">
        <span className="text-meta">{s.error}</span>
        <div>
          <Button size="sm" onClick={onClose}>
            {t("editor.close")}
          </Button>
        </div>
      </div>
    );
  const r = s.result;
  const demo = r.mock ? <Tag>{t("editor.mockAi")}</Tag> : null;
  if (r.refused) {
    return (
      <div className="suggest">
        <AiLabel>
          {t("editor.onlyReword")} {demo}
        </AiLabel>
        <span className="body">{r.refused}</span>
        <div>
          <Button size="sm" onClick={onClose}>
            {t("editor.ok")}
          </Button>
        </div>
      </div>
    );
  }
  if (s.action === "sources") {
    return (
      <div className="suggest">
        <AiLabel icon="format_quote">
          {t("editor.sourcesTitle")} {demo}
        </AiLabel>
        {r.sources.length > 0 && (
          <ol className="sources">
            {r.sources.map((x, i) => (
              <li key={i}>
                <b>{x.sentence}</b>
                <br />
                <span className="muted">
                  {x.lines.length
                    ? speakerOfLine(segments, x.lines[0] ?? 0)
                      ? t("editor.lineRefWho", {
                          lines: x.lines.join(", "),
                          who: speakerOfLine(segments, x.lines[0] ?? 0),
                        })
                      : t("editor.lineRef", { lines: x.lines.join(", ") })
                    : ""}
                  "{x.text}"
                </span>
              </li>
            ))}
          </ol>
        )}
        {r.unsourced.length > 0 && <Alert tone="ai">{t("editor.noSource", { items: r.unsourced.join("; ") })}</Alert>}
        {!r.sources.length && !r.unsourced.length && <span className="text-meta">{t("editor.noSources")}</span>}
        <div>
          <Button size="sm" onClick={onClose}>
            {t("editor.close")}
          </Button>
        </div>
      </div>
    );
  }
  return (
    <div className="suggest">
      <AiLabel>
        {t("editor.suggested", { what: t(`editor.suggestLabels.${s.action}`) })} {demo}
      </AiLabel>
      <div className="body">
        <RichText text={r.suggestion || ""} />
      </div>
      <div className="row">
        <Button variant="primary" size="sm" icon="check" onClick={() => onUse(r.suggestion || "")}>
          {t("editor.use")}
        </Button>
        <Button size="sm" onClick={onClose}>
          {t("editor.keepMine")}
        </Button>
      </div>
    </div>
  );
}
