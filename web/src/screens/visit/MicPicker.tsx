import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Button, DropdownMenu } from "@blinq-scribe/ui";
import { readMic, saveMic } from "../../recorder/micChoice";

interface Mic {
  id: string;
  label: string;
}

async function listMics(): Promise<MediaDeviceInfo[]> {
  const md = typeof navigator !== "undefined" ? navigator.mediaDevices : undefined;
  if (!md?.enumerateDevices) return [];
  try {
    return (await md.enumerateDevices()).filter((d) => d.kind === "audioinput" && d.deviceId && d.deviceId !== "default");
  } catch {
    return [];
  }
}

/** Which microphone this computer records from; the choice is remembered for the next visit. */
export function MicPicker() {
  const { t } = useTranslation();
  const [mics, setMics] = useState<Mic[]>([]);
  const [chosen, setChosen] = useState(readMic);

  const refresh = useCallback(async () => {
    const found = await listMics();
    setMics(found.map((d, i) => ({ id: d.deviceId, label: d.label || t("visit.micNumbered", { n: i + 1 }) })));
  }, [t]);

  useEffect(() => {
    void refresh();
    const md = typeof navigator !== "undefined" ? navigator.mediaDevices : undefined;
    md?.addEventListener?.("devicechange", refresh);
    return () => md?.removeEventListener?.("devicechange", refresh);
  }, [refresh]);

  const current = mics.find((m) => m.id === chosen)?.label ?? t("visit.micDefault");
  const pick = (id: string) => {
    saveMic(id);
    setChosen(id);
  };

  return (
    <DropdownMenu.Root onOpenChange={(open) => open && void refresh()}>
      <DropdownMenu.Trigger asChild>
        <Button variant="ghost" icon="settings_voice" iconEnd="expand_more" aria-label={t("visit.micLabel", { name: current })} />
      </DropdownMenu.Trigger>
      <DropdownMenu.Content>
        <DropdownMenu.Label>{t("visit.micMenu")}</DropdownMenu.Label>
        <DropdownMenu.RadioGroup value={chosen || "default"} onValueChange={(v) => pick(v === "default" ? "" : v)}>
          <DropdownMenu.RadioItem value="default">{t("visit.micDefault")}</DropdownMenu.RadioItem>
          {mics.map((m) => (
            <DropdownMenu.RadioItem key={m.id} value={m.id}>
              {m.label}
            </DropdownMenu.RadioItem>
          ))}
        </DropdownMenu.RadioGroup>
      </DropdownMenu.Content>
    </DropdownMenu.Root>
  );
}
