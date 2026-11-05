import { useTranslation } from "react-i18next";
import { Button, IconButton } from "@blinq-scribe/ui";
import { useSpeech } from "../lib/speak";

/** Read aloud, then Stop while it reads. One voice at a time across the app; `id` names this control. */
export function ReadAloud({ id, text, iconOnly }: { id: string; text: string; iconOnly?: boolean }) {
  const { t } = useTranslation();
  const s = useSpeech(id);
  const on = s.speaking || s.loading;
  const label = s.loading ? t("speech.preparing") : on ? t("speech.stop") : t("speech.readAloud");
  const props = {
    icon: on ? "stop_circle" : "volume_up",
    "aria-pressed": on,
    disabled: !text,
    onClick: () => s.toggle(text),
  };
  return iconOnly ? (
    <IconButton {...props} aria-label={label} loading={s.loading} />
  ) : (
    <Button {...props} loading={s.loading}>
      {label}
    </Button>
  );
}
