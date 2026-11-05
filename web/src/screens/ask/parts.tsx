// The pieces the Morning brief card and the Ask Blinq panel share: the brief's sentence, the thread,
// the suggestion chips and the one composer (a rounded field with the mic and Send inside it).
import { Fragment, useState, type ReactNode, type Ref } from "react";
import { useTranslation } from "react-i18next";
import {
  Button,
  Chip,
  cx,
  formatPhonesIn,
  Icon,
  IconButton,
  LevelBars,
  Pressable,
  TextField,
  TypingDots,
} from "@blinq-scribe/ui";
import type { BriefPart } from "../../api/types";
import { plainAnswer } from "../../lib/plainWords";
import { ask } from "../../state/ask";
import type { AskMessage } from "../../state/chat";
import { finishTalking, startTalking, useVoice } from "../../state/voice";
import { KEYS, useGo, useReading } from "./go";

/**
 * The brief's sentence with what needs attention in bold and what failed in bold red. `ai` colors the
 * whole line purple (the panel's first message); on the Morning card it reads in ink.
 */
export function BriefSentence({ parts, ai }: { parts: BriefPart[]; ai?: boolean }) {
  return (
    <>
      {/* What failed is bold like the other counts: red is for the row where it can be fixed. */}
      {parts.map((p, i) =>
        p.emphasis === "failed" || p.emphasis === "bold" ? (
          <b key={i} className={cx("text-body-strong", ai ? "text-ai" : "text-text")}>
            {p.text}
          </b>
        ) : (
          <Fragment key={i}>{p.text}</Fragment>
        ),
      )}
    </>
  );
}

/** Blinq's purple mark beside what it says. */
function Mark() {
  const { t } = useTranslation();
  return (
    <span
      role="img"
      aria-label={t("ask.blinq")}
      className="flex size-6 flex-none items-center justify-center rounded-pill bg-ai-bg text-ai"
    >
      <Icon name="auto_awesome" size={15} />
    </span>
  );
}

/** One thing Blinq says: its mark, then the words. */
export function BlinqSays({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cx("flex items-start gap-3", className)}>
      <Mark />
      <div className="flex min-w-0 flex-1 flex-col gap-2 pt-px">{children}</div>
    </div>
  );
}

/**
 * What Blinq is reading aloud right now, marked where it already is on screen: a purple bar on its left
 * and the speaking bars. Nothing is shown twice.
 */
export function Spoken({ on, children }: { on: boolean; children: ReactNode }) {
  const { t } = useTranslation();
  if (!on) return <>{children}</>;
  return (
    <div className="flex flex-col gap-1 border-l-2 border-ai pl-3">
      {children}
      <span className="flex items-center gap-1 text-meta text-ai" role="status">
        <LevelBars size="sm" />
        {t("ask.voice.speaking")}
      </span>
    </div>
  );
}

function Answer({ m, index }: { m: AskMessage; index: number }) {
  const { t } = useTranslation();
  const go = useGo();
  const reading = useReading(`msg:${index}`);
  return (
    <BlinqSays>
      <Spoken on={reading}>
        {/* Plain spoken sentences, also for answers already in the thread. */}
        <p className="[overflow-wrap:anywhere]">{formatPhonesIn(plainAnswer(m.content))}</p>
      </Spoken>
      {!!m.sources?.length && (
        <p className="text-meta">
          <span className="sr-only">{t("ask.sources")}: </span>
          {m.sources.map((s, i) => (
            <Fragment key={`${s.label}-${i}`}>
              {i > 0 && " · "}
              <Pressable
                className="underline decoration-border-strong underline-offset-2 hover:text-text"
                onClick={() => go(s)}
              >
                {s.label}
              </Pressable>
            </Fragment>
          ))}
        </p>
      )}
      {!!m.links?.length && (
        <div className="flex flex-wrap gap-2">
          {m.links.map((l, i) => (
            <Button key={`${l.label}-${i}`} size="sm" iconEnd="arrow_forward" onClick={() => go(l)}>
              {l.label}
            </Button>
          ))}
        </div>
      )}
    </BlinqSays>
  );
}

/** The conversation: your words in a light gray bubble, Blinq's in ink beside its mark. */
export function Thread({ messages, busy, checking }: { messages: AskMessage[]; busy: boolean; checking: string }) {
  const { t } = useTranslation();
  return (
    <>
      {messages.map((m, i) =>
        m.role === "user" ? (
          <div
            key={i}
            data-turn="user"
            className="max-w-[85%] self-end rounded-card bg-surface-muted px-3 py-2 whitespace-pre-line text-text [overflow-wrap:anywhere]"
          >
            <span className="sr-only">{t("ask.you")} </span>
            {m.content}
          </div>
        ) : (
          <Answer key={i} m={m} index={i} />
        ),
      )}
      {busy && (
        <BlinqSays>
          <span className="flex items-center gap-2" role="status">
            <TypingDots />
            <span className="text-meta">{checking || t("chat.checkingDefault")}</span>
            <span className="sr-only">{t("chat.thinking")}</span>
          </span>
        </BlinqSays>
      )}
    </>
  );
}

/** "Want to hear more?" at the end of the brief: pressing it is saying yes. */
export function HearMore() {
  const { t } = useTranslation();
  return (
    <Pressable
      className="text-ai underline-offset-2 hover:underline"
      title={t("ask.tellMeMore")}
      onClick={() => void ask(t("ask.tellMeMore"))}
    >
      {t("ask.hearMore")}
    </Pressable>
  );
}

/** Two or three small quiet chips: questions to ask next. */
export function Suggestions({
  items,
  label,
  onPick,
  disabled,
}: {
  items: string[];
  label: string;
  onPick: (q: string) => void;
  disabled?: boolean;
}) {
  if (!items.length) return null;
  return (
    <div role="group" aria-label={label} className="flex flex-wrap gap-2">
      {items.map((q) => (
        <Chip key={q} disabled={disabled} onClick={() => onPick(q)}>
          {q}
        </Chip>
      ))}
    </div>
  );
}

/** The one composer: a rounded field with the mic and Send inside it. */
export function Composer({
  id,
  label,
  placeholder,
  inputRef,
  onSend,
  onTalk,
}: {
  id: string;
  label: string;
  placeholder: string;
  inputRef?: Ref<HTMLInputElement>;
  onSend: (text: string) => void;
  /** Before listening starts (the panel opens, say). */
  onTalk?: () => void;
}) {
  const { t } = useTranslation();
  const [text, setText] = useState("");
  const error = useVoice((s) => (s.phase === "idle" ? s.error : ""));
  const listening = useVoice((s) => s.phase === "listening");
  const caption = useVoice((s) => s.caption);
  const level = useVoice((s) => s.level);
  const pill = "flex h-11 w-full items-center gap-1 rounded-pill border bg-surface pr-2 pl-4";
  // Listening: the field itself becomes the voice bar, in place.
  if (listening)
    return (
      <div className={cx(pill, "gap-3 border-ai")}>
        <span className="flex-none text-ai">
          <LevelBars level={level} bars={12} size="md" />
        </span>
        <span aria-live="polite" className="min-w-0 flex-1 truncate">
          <span className="sr-only">{t("ask.voice.youreSaying")} </span>
          {caption || <span className="text-text-tertiary">{t("ask.voice.listening")}</span>}
        </span>
        <Button size="sm" className="rounded-pill" onClick={() => void finishTalking()}>
          {t("ask.voice.done")}
        </Button>
      </div>
    );
  const send = () => {
    const q = text.trim();
    if (!q) return;
    setText("");
    onSend(q);
  };
  return (
    <div className="flex flex-col gap-2">
      <form
        className={cx(
          pill,
          "border-border transition-colors duration-(--duration-normal) focus-within:border-text-secondary hover:border-border-strong",
        )}
        onSubmit={(e) => {
          e.preventDefault();
          send();
        }}
      >
        <label htmlFor={id} className="sr-only">
          {label}
        </label>
        <TextField
          bare
          id={id}
          ref={inputRef}
          autoComplete="off"
          className="placeholder:text-text-tertiary"
          placeholder={placeholder}
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            if (error) useVoice.setState({ error: "" });
          }}
        />
        <IconButton
          variant="ghost"
          size="sm"
          icon="mic"
          className="rounded-pill text-text"
          aria-label={t("ask.talkTo")}
          title={t("ask.withKeys", { label: t("ask.talkTo"), keys: KEYS.talk })}
          onClick={() => {
            onTalk?.();
            startTalking();
          }}
        />
        <IconButton
          type="submit"
          variant="ghost"
          size="sm"
          icon="send"
          className="rounded-pill text-text"
          aria-label={t("ask.send")}
          title={t("ask.send")}
        />
      </form>
      {error && (
        <p role="status" className="px-4 text-meta">
          {error}
        </p>
      )}
    </div>
  );
}
