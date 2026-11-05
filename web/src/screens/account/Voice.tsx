import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { api } from "../../api";
import type { SpeechOptions } from "../../api/types";
import { useApp } from "../../state/app";
import { onScreen } from "../../state/nav";
import { browserVoices, loadVoiceChoice, saveVoiceChoice, setVoiceChoice, type VoiceChoice } from "../../lib/speak";
import { ReadAloud } from "../../components/ReadAloud";
import { Card, FormField, LabeledValue, Segmented, Select } from "@blinq-scribe/ui";

const SPEEDS = [
  ["0.85", "slower"],
  ["1", "normal"],
  ["1.2", "faster"],
] as const;

/** Account > Voice: which voice reads aloud and how fast. Kept in this browser, per person. */
export function VoiceSection() {
  const { t } = useTranslation();
  const userId = useApp((s) => s.me?.user?.id) ?? "";
  const [choice, setChoice] = useState<VoiceChoice>(() => loadVoiceChoice(userId));
  const [server, setServer] = useState<SpeechOptions | null>(null);
  const [local, setLocal] = useState<SpeechSynthesisVoice[]>(() => browserVoices());

  useEffect(() => {
    const here = onScreen();
    api
      .speechOptions()
      .then((o) => here() && setServer(o))
      .catch(() => here() && setServer({ available: false, default_voice: "", voices: [] }));
  }, []);
  // Browsers list their voices a moment after the page loads.
  useEffect(() => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
    const update = () => setLocal(browserVoices());
    window.speechSynthesis.addEventListener("voiceschanged", update);
    return () => window.speechSynthesis.removeEventListener("voiceschanged", update);
  }, []);

  const pick = (next: VoiceChoice) => {
    setChoice(next);
    setVoiceChoice(next);
    saveVoiceChoice(userId, next);
  };

  const onServer = !!server?.available;
  const options = onServer
    ? server.voices.map((v) => ({
        value: `server:${v.id}`,
        label: v.id === server.default_voice ? t("voice.defaultName", { name: v.name }) : v.name,
      }))
    : local
        .filter((v) => /^en\b/i.test(v.lang))
        .map((v) => ({ value: `browser:${v.name}`, label: `${v.name} (${v.lang})` }));
  // A choice from the other kind of voice (the server changed) falls back to the default.
  const value = options.some((o) => o.value === choice.voice)
    ? choice.voice
    : onServer
      ? `server:${server.default_voice}`
      : (options[0]?.value ?? "");

  return (
    <Card as="section" aria-labelledby="voiceTitle">
      <Card.Title id="voiceTitle">{t("voice.title")}</Card.Title>
      <p className="text-meta">{onServer ? t("voice.helpServer") : t("voice.helpBrowser")}</p>
      <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto]">
        <FormField id="voicePick" label={t("voice.voice")}>
          <Select
            value={value}
            placeholder={t("voice.none")}
            disabled={!options.length}
            onValueChange={(v) => pick({ ...choice, voice: v })}
            options={options}
          />
        </FormField>
        <LabeledValue id="voiceSpeed" label={t("voice.speed")}>
          <Segmented
            aria-label={t("voice.speed")}
            value={String(choice.speed)}
            onValueChange={(v) => pick({ ...choice, speed: Number(v) })}
            options={SPEEDS.map(([v, k]) => ({ value: v, label: t(`voice.speeds.${k}`) }))}
          />
        </LabeledValue>
      </div>
      <div>
        <ReadAloud id="voicePreview" text={t("voice.sample")} />
      </div>
    </Card>
  );
}
