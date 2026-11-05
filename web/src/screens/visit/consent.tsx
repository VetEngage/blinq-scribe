// Recording consent: Start recording asks "Did Jordan agree to recording?" in a small dialog, and only the
// owner's yes starts it. The answer is saved with the visit (POST /consent) before any audio is kept, and
// the server refuses audio until then. One dialog for the app, asked through `askConsent`.
import { useTranslation } from "react-i18next";
import { Button, Dialog } from "@blinq-scribe/ui";
import { answer, useConsent } from "./consentStore";

/** The consent question, mounted once in the app shell. ⌘↵ agrees; Esc and Not yet don't. */
export function ConsentDialog() {
  const { t } = useTranslation();
  const { owner, resolve } = useConsent();
  return (
    <Dialog
      open={!!resolve}
      onOpenChange={(open) => {
        if (!open) answer(false);
      }}
      size="sm"
      title={t("visit.startQuestion", { name: owner || t("visit.theOwner") })}
      closeLabel={t("notes.close")}
    >
      <div
        className="flex flex-col gap-4"
        onKeyDown={(e) => {
          if ((e.metaKey || e.ctrlKey) && !e.altKey && !e.shiftKey && e.key === "Enter") {
            e.preventDefault();
            answer(true);
          }
        }}
      >
        <p className="text-body text-text-secondary">{t("visit.consentWhat")}</p>
        <div className="flex flex-wrap justify-end gap-2">
          <Button size="lg" autoFocus onClick={() => answer(false)}>
            {t("visit.notYet")}
          </Button>
          <Button variant="primary" size="lg" icon="mic" onClick={() => answer(true)}>
            {t("visit.ownerAgreed")}
          </Button>
        </div>
      </div>
    </Dialog>
  );
}
