import { useEffect, useState } from "react";
import { useNavigate } from "react-router";
import { useTranslation } from "react-i18next";
import { api } from "../../api";
import type { Letter, LetterKind } from "../../api/types";
import { letterLine, letterTitle, letterPath, newLetterPath } from "./letters";
import { useApp } from "../../state/app";
import { useAlive } from "./useCached";
import { openBlob } from "../../lib/blobs";
import { Button, IconTile, StatusText } from "@blinq-scribe/ui";
import { Loading, Unavailable } from "../../components/common";

const KINDS: [LetterKind, string][] = [
  ["referral", "send"],
  ["records", "drive_folder_upload"],
  ["owner", "mail"],
];

/** Documents, sent from the clinic: start a letter, see where each went, finish a draft. Key it by the pet. */
export function SentLetters({ patientId }: { patientId: string }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const owner = useApp((s) => s.openAppt?.client.first_name) ?? "";
  const [letters, setLetters] = useState<Letter[] | null | false>(null);
  const [status, setStatus] = useState("");
  const alive = useAlive();

  useEffect(() => {
    const here = alive();
    setLetters(null);
    api
      .letters(patientId)
      .catch(() => false as const)
      .then((l) => {
        if (here()) setLetters(l);
      });
    // Keyed by the pet, so this reads once.
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const openPdf = async (l: Letter) => {
    setStatus("");
    try {
      await openBlob(() => api.letterPdfUrl(l.id));
    } catch (err) {
      setStatus(t("letters.couldNotOpen", { message: err instanceof Error ? err.message : String(err) }));
    }
  };

  return (
    <section className="flex flex-col gap-3" aria-labelledby={`sent-${patientId}`}>
      <h3 id={`sent-${patientId}`} className="text-section">
        {t("letters.sentTitle")}
      </h3>
      <div className="flex flex-wrap gap-2">
        {KINDS.map(([kind, icon]) => (
          <Button key={kind} icon={icon} onClick={() => void navigate(newLetterPath(patientId, kind))}>
            {t(`letters.kinds.${kind}`)}
          </Button>
        ))}
      </div>
      {letters === null ? (
        <Loading />
      ) : letters === false ? (
        <Unavailable what={t("letters.what")} />
      ) : (
        letters.map((l) => (
          <div key={l.id} className="rec-row flex flex-wrap items-center gap-3 py-3">
            <IconTile icon={l.status === "draft" ? "edit_document" : "description"} />
            <span className="flex min-w-0 flex-[1_1_260px] flex-col">
              <span className="flex flex-wrap items-center gap-2">
                <b className="text-body-strong">{letterTitle(l, owner)}</b>
                <LetterStatus l={l} />
              </span>
              <span className="text-meta">{letterLine(l)}</span>
            </span>
            {l.status === "draft" ? (
              <Button variant="link" icon="arrow_forward" onClick={() => void navigate(letterPath(l))}>
                {t("letters.finish")}
              </Button>
            ) : (
              <Button variant="link" icon="open_in_new" onClick={() => void openPdf(l)}>
                {t("letters.openPdf")}
              </Button>
            )}
          </div>
        ))
      )}
      <StatusText>{status}</StatusText>
    </section>
  );
}

export function LetterStatus({ l }: { l: Letter }) {
  const { t } = useTranslation();
  // Plain grey status: a draft, sent or opened letter needs nothing from the vet here.
  const key = l.status === "draft" ? "draft" : l.status === "opened" ? "opened" : "sent";
  return <span className="text-meta">{t(`letters.status.${key}`)}</span>;
}
