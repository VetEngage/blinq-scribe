import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { useLocation } from "react-router";
import { useTranslation } from "react-i18next";
import { useShallow } from "zustand/react/shallow";
import { Button, cx, Icon, IconButton, LevelBars, Pressable } from "@blinq-scribe/ui";
import { useApp } from "../state/app";
import { ask, briefParts } from "../state/ask";
import { useChat } from "../state/chat";
import { finishTalking, startTalking, stopTalking, useVoice } from "../state/voice";
import { KEYS, nextQuestions, useReading } from "./ask/go";
import { BlinqSays, BriefSentence, Composer, HearMore, Spoken, Suggestions, Thread } from "./ask/parts";
import { useVoiceWatch } from "./ask/useVoiceWatch";

const WIDE = "(min-width: 1281px)";

function useWide(): boolean {
  const query = () => typeof window !== "undefined" && !!window.matchMedia?.(WIDE).matches;
  const [wide, setWide] = useState(query);
  useEffect(() => {
    const mq = window.matchMedia?.(WIDE);
    if (!mq) return;
    const on = () => setWide(mq.matches);
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, []);
  return wide;
}

/** Questions to start with: about the open visit's pet, else today's from the brief. */
function useStarters(onVisit: boolean, pet: string): string[] {
  const { t } = useTranslation();
  const brief = useApp((s) => s.brief);
  const openAppt = useApp((s) => s.openAppt);
  if (!onVisit || !pet || !openAppt) return brief?.suggestions ?? [];
  const replied = (brief?.new_since_yesterday ?? []).some(
    (u) => u.kind === "reply" && u.patient_id === openAppt.patient.id,
  );
  const owner = openAppt.client.first_name;
  return [
    t("ask.suggest.lastVisit", { pet }),
    ...(replied && owner ? [t("ask.suggest.draftReply", { name: owner })] : []),
  ];
}

/**
 * The one way in to Ask Blinq, in the top bar: "✦ Ask Blinq" opens the panel (⌘J), and the mic beside
 * it is press to talk (⌥ Space), so a question can be asked hands free from any screen.
 */
export function AskBlinqPill() {
  const { t } = useTranslation();
  const phase = useVoice((s) => s.phase);
  const level = useVoice((s) => s.level);
  const open = useChat((s) => s.open);
  const listening = phase === "listening";
  return (
    <div className="ask-pill">
      <Pressable
        id="askBlinqOpen"
        className="ask-pill-open"
        aria-expanded={open}
        aria-controls={open ? "chatPanel" : undefined}
        aria-keyshortcuts="Meta+J Control+J"
        title={t("ask.withKeys", { label: t("chat.open"), keys: KEYS.open })}
        onClick={() => useChat.getState().setOpen(!open)}
      >
        <Icon name="auto_awesome" />
        <span>{t("chat.open")}</span>
        <kbd className="ask-pill-keys">{KEYS.open}</kbd>
      </Pressable>
      <span className="ask-pill-rule" aria-hidden="true" />
      <Pressable
        className="ask-pill-mic"
        aria-label={listening ? t("ask.voice.done") : t("ask.talkTo")}
        aria-pressed={listening}
        title={listening ? t("ask.voice.done") : t("ask.withKeys", { label: t("ask.talkTo"), keys: KEYS.talk })}
        onClick={() => (listening ? void finishTalking() : startTalking())}
      >
        {listening ? <LevelBars level={level} /> : <Icon name="mic" />}
      </Pressable>
    </div>
  );
}

/**
 * Ask Blinq by voice, at the left of a visit's pinned bar: the same press to talk as the top bar's mic,
 * where the hands already are during a visit.
 */
export function AskByVoice() {
  const { t } = useTranslation();
  const phase = useVoice((s) => s.phase);
  const level = useVoice((s) => s.level);
  const listening = phase === "listening";
  return (
    <Button
      className="ask-voice size-(--size-control-lg) flex-none rounded-pill px-0 text-ai"
      aria-label={listening ? t("ask.voice.done") : t("ask.byVoice")}
      aria-pressed={listening}
      title={listening ? t("ask.voice.done") : t("ask.withKeys", { label: t("ask.byVoice"), keys: KEYS.talk })}
      onClick={() => (listening ? void finishTalking() : startTalking())}
    >
      {listening ? <LevelBars level={level} /> : <Icon name="mic" />}
    </Button>
  );
}

/**
 * Ask Blinq: one thread across screens. The top bar's pill opens a panel under it on the right, or a
 * full height panel docked on the right that pushes the page over. ⌘J opens, Esc closes, ⌥ Space is
 * press to talk.
 */
export function AskBlinq() {
  const { t } = useTranslation();
  const location = useLocation();
  const { open, docked, history, busy, checking } = useChat(
    useShallow((s) => ({
      open: s.open,
      docked: s.docked,
      history: s.history,
      busy: s.busy,
      checking: s.checking,
    })),
  );
  const phase = useVoice((s) => s.phase);
  const { brief, openAppt, current } = useApp(
    useShallow((s) => ({ brief: s.brief, openAppt: s.openAppt, current: s.current })),
  );
  const wide = useWide();
  useVoiceWatch();

  const onVisit = location.pathname.startsWith("/visit/");
  const pet = onVisit ? current?.patient_name || openAppt?.patient.name || "" : "";
  const starters = useStarters(onVisit, pet);
  const showPanel = open;
  const isDocked = showPanel && wide && (docked ?? onVisit);

  const input = useRef<HTMLInputElement>(null);
  const log = useRef<HTMLDivElement>(null);
  const wasOpen = useRef(false);

  // Docked, the page makes room on the right.
  useEffect(() => {
    document.documentElement.classList.toggle("ask-docked", isDocked);
    return () => document.documentElement.classList.remove("ask-docked");
  }, [isDocked]);

  // Opening puts the cursor in the field; closing puts focus back on the top bar's pill.
  useEffect(() => {
    if (showPanel && !wasOpen.current && useVoice.getState().phase === "idle") input.current?.focus();
    if (!showPanel && wasOpen.current) document.getElementById("askBlinqOpen")?.focus();
    wasOpen.current = showPanel;
  }, [showPanel]);

  // The thread reads from the top: the newest question at the top of the view, never cut off.
  useLayoutEffect(() => {
    const el = log.current;
    if (!el) return;
    const asked = el.querySelectorAll<HTMLElement>('[data-turn="user"]');
    const last = asked[asked.length - 1];
    el.scrollTop = last ? Math.max(0, last.offsetTop - 12) : 0;
  }, [history.length, showPanel]);

  // Shortcuts, anywhere in the console.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const chat = useChat.getState();
      if ((e.metaKey || e.ctrlKey) && !e.altKey && !e.shiftKey && e.key.toLowerCase() === "j") {
        e.preventDefault();
        if (chat.open) input.current?.focus();
        else chat.setOpen(true);
        return;
      }
      if (e.altKey && e.code === "Space" && !e.metaKey && !e.ctrlKey) {
        e.preventDefault();
        if (useVoice.getState().phase === "listening") return void finishTalking();
        startTalking();
        return;
      }
      if (e.key === "Escape" && useVoice.getState().phase !== "idle") {
        e.preventDefault();
        stopTalking();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // A question asked from the launcher's mic: the panel opens with the answer.
  const lastPhase = useRef(phase);
  useEffect(() => {
    if (lastPhase.current === "listening" && phase === "thinking") useChat.getState().setOpen(true);
    lastPhase.current = phase;
  }, [phase]);
  const readingBrief = useReading("brief");

  const close = () => {
    if (useVoice.getState().phase !== "idle") stopTalking();
    useChat.getState().setOpen(false);
  };
  const parts = briefParts(brief);
  const next = nextQuestions(history, starters);
  const scope = pet ? t("ask.scopeVisit", { pet }) : t("ask.scopeDay");

  return (
    <>
      {showPanel && (
        <section
          id="chatPanel"
          role={isDocked ? "complementary" : "dialog"}
          aria-labelledby="askTitle"
          className={cx(
            "z-(--layer-chat) flex flex-col bg-surface",
            isDocked
              ? "fixed top-(--size-topbar) right-0 bottom-0 w-[420px] border-l border-border"
              : "ask-panel fixed top-[calc(var(--size-topbar)+var(--space-2))] right-6 h-[min(600px,calc(100vh-var(--size-topbar)-var(--space-8)))] w-(--size-chat) overflow-hidden rounded-card border border-border shadow-pop",
          )}
          onKeyDown={(e) => {
            if (e.key !== "Escape") return;
            e.stopPropagation();
            const p = useVoice.getState().phase;
            if (p !== "idle") stopTalking();
            else close();
          }}
        >
          <div className="flex flex-none flex-col gap-1 border-b border-divider py-3 pr-3 pl-4">
            <div className="flex items-center gap-2">
              <Icon name="auto_awesome" className="text-ai" />
              <h2 id="askTitle" className="flex-1 text-title">
                {t("chat.title")}
              </h2>
              {phase === "speaking" && (
                <Button
                  size="sm"
                  icon="stop"
                  title={t("ask.withKeys", { label: t("ask.voice.stop"), keys: KEYS.esc })}
                  onClick={stopTalking}
                >
                  {t("ask.voice.stop")}
                </Button>
              )}
              {wide && (
                <IconButton
                  variant="ghost"
                  size="sm"
                  icon={isDocked ? "close_fullscreen" : "open_in_full"}
                  className="text-text"
                  aria-label={isDocked ? t("ask.collapse") : t("ask.expand")}
                  title={isDocked ? t("ask.collapse") : t("ask.expand")}
                  onClick={() => useChat.getState().setDocked(!isDocked)}
                />
              )}
              <IconButton
                variant="ghost"
                size="sm"
                icon="close"
                className="text-text"
                aria-label={t("chat.close")}
                title={t("ask.withKeys", { label: t("ask.close"), keys: KEYS.esc })}
                onClick={close}
              />
            </div>
            <div className="flex items-center justify-between gap-2">
              <span className="text-meta">{scope}</span>
              <Pressable
                className="text-meta underline decoration-border-strong underline-offset-2 hover:text-text"
                onClick={() => {
                  if (useVoice.getState().phase !== "idle") stopTalking();
                  useChat.getState().clear();
                  input.current?.focus();
                }}
              >
                {t("ask.newConversation")}
              </Pressable>
            </div>
          </div>
          {/* Focusable so the conversation scrolls from the keyboard too. */}
          <div
            ref={log}
            role="log"
            aria-label={t("ask.conversation")}
            tabIndex={0}
            className="relative flex min-h-0 flex-1 flex-col gap-3 overflow-auto bg-page px-4 py-3"
          >
            {parts.length ? (
              <>
                <p className="flex items-center gap-2 text-meta after:h-px after:flex-1 after:bg-border">
                  {t("ask.todaysBrief")}
                </p>
                <BlinqSays>
                  <Spoken on={readingBrief}>
                    <p className="text-ai">
                      <BriefSentence parts={parts} ai /> <HearMore />
                    </p>
                  </Spoken>
                </BlinqSays>
              </>
            ) : (
              !history.length && <p className="mt-auto text-meta">{t("ask.hint")}</p>
            )}
            <Thread messages={history} busy={busy} checking={checking} />
          </div>
          <div className="flex flex-none flex-col gap-2 border-t border-divider bg-surface px-4 py-3">
            {/* The same in every state: the questions to ask next, then the one field. */}
            <Suggestions
              items={next}
              label={history.length ? t("ask.followups") : t("ask.suggestions")}
              disabled={busy}
              onPick={(q) => void ask(q)}
            />
            <Composer
              id="ask"
              inputRef={input}
              label={pet ? t("ask.labelPet", { pet }) : t("ask.labelDay")}
              placeholder={pet ? t("ask.placeholderPet", { pet }) : t("ask.placeholderDay")}
              onSend={(q) => void ask(q)}
            />
          </div>
        </section>
      )}
    </>
  );
}
