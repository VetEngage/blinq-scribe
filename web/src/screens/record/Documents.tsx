import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { api } from "../../api";
import type { OutsideDoc } from "../../api/types";
import { openBlob } from "../../lib/blobs";
import { fmtDate } from "../../lib/format";
import {
  AiLabel,
  Button,
  FileInput,
  Icon,
  IconTile,
  Pressable,
  StatusText,
  Tag,
  buttonClasses,
} from "@blinq-scribe/ui";
import { Loading, Unavailable } from "../../components/common";
import { SentLetters } from "./SentLetters";
import { useAlive } from "./useCached";

// undefined: not asked yet; null: loading; false: failed
type Load<T> = T | null | false | undefined;

/** Documents: this pet's letters sent from the clinic, then what came in from elsewhere. */
export function Documents({ petId, openDocument = "" }: { petId: string; openDocument?: string }) {
  const { t } = useTranslation();
  return (
    <div className="flex flex-col gap-6">
      <SentLetters key={petId} patientId={petId} />
      <section className="flex flex-col" aria-labelledby={`received-${petId}`}>
        <h3 id={`received-${petId}`} className="text-section">
          {t("letters.receivedTitle")}
        </h3>
        <Received key={petId} patientId={petId} openDocument={openDocument} />
      </section>
    </div>
  );
}

/** Expanding rows in the record lists. */
function useOpenRows() {
  const [open, setOpen] = useState<Set<string>>(new Set());
  const toggle = (key: string) =>
    setOpen((s) => {
      const n = new Set(s);
      if (n.has(key)) n.delete(key);
      else n.add(key);
      return n;
    });
  return { open, toggle, add: (key: string) => setOpen((s) => new Set(s).add(key)) };
}

function Received({ patientId, openDocument = "" }: { patientId: string; openDocument?: string }) {
  const { t } = useTranslation();
  const [docs, setDocs] = useState<Load<OutsideDoc[]>>(undefined);
  const [status, setStatus] = useState("");
  const [fallback, setFallback] = useState("");
  const [over, setOver] = useState(false);
  const rows = useOpenRows();
  const alive = useAlive();
  useEffect(() => {
    setDocs(null);
    const here = alive();
    api
      .documents(patientId)
      .catch(() => false as const)
      .then((d) => {
        if (!here()) return;
        setDocs(Array.isArray(d) ? d : d === false ? false : []);
        if (openDocument && Array.isArray(d) && d.some((x) => x.id === openDocument)) rows.add(`d:${openDocument}`);
      });
    // Loads once per pet (the panel is keyed by it); the document to open only matters on arrival.
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const upload = async (file: File | undefined) => {
    if (!file) return;
    const here = alive();
    setStatus(t("record.reading", { name: file.name }));
    try {
      const d = await api.uploadDocument(patientId, file);
      if (!here()) return;
      setDocs((list) => [d, ...(Array.isArray(list) ? list : [])]);
      rows.add(`d:${d.id}`);
      setStatus("");
    } catch (err) {
      if (here())
        setStatus(
          t("record.couldNotAdd", { name: file.name, message: err instanceof Error ? err.message : String(err) }),
        );
    }
  };
  const openDoc = async (docId: string) => {
    setFallback("");
    try {
      const r = await openBlob(() => api.documentUrl(patientId, docId));
      if (r.fallbackUrl) setFallback(r.fallbackUrl);
    } catch (err) {
      setStatus(t("record.couldNotOpen", { message: err instanceof Error ? err.message : String(err) }));
    }
  };

  return (
    <>
      <FileInput
        className={`dropzone mt-3 ${over ? "over" : ""}`}
        label={t("record.addRecords")}
        accept="application/pdf,image/*"
        onFile={(f) => void upload(f)}
        onDragOver={(e) => {
          e.preventDefault();
          setOver(true);
        }}
        onDragLeave={() => setOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setOver(false);
          void upload(e.dataTransfer.files[0]);
        }}
      >
        <Icon name="upload_file" />
        <span className="flex-[1_1_220px]">{t("record.drop")}</span>
        <span className={buttonClasses()}>
          <Icon name="add" />
          {t("record.upload")}
        </span>
      </FileInput>
      <StatusText>
        {status}
        {fallback && (
          <a href={fallback} target="_blank" rel="noopener">
            {t("record.openTheFile")}
          </a>
        )}
      </StatusText>
      {docs === undefined || docs === null ? (
        <Loading />
      ) : docs === false ? (
        <Unavailable what={t("record.outsideWhat")} />
      ) : docs.length ? (
        docs.map((d) => {
          const key = `d:${d.id}`,
            open = rows.open.has(key);
          const isPdf = String(d.content_type).includes("pdf");
          return (
            <div className="rec-row" key={key}>
              <Pressable className="expand" aria-expanded={open} onClick={() => rows.toggle(key)}>
                <IconTile icon={String(d.content_type).startsWith("image") ? "image" : "picture_as_pdf"} />
                <span className="text">
                  <b>{d.name}</b>
                  <span className="text-meta">
                    {[
                      isPdf ? t("record.pdf") : t("record.image"),
                      d.pages ? t("count.page", { count: d.pages }) : "",
                      d.uploaded_at ? t("record.added", { date: fmtDate(d.uploaded_at) }) : "",
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                  </span>
                </span>
                <Icon name="expand_more" className="chev muted" />
              </Pressable>
              {open && (
                <div className="rec-detail pl-13">
                  <AiLabel>
                    {t("record.summaryBy")}
                    {d.mock && <Tag>{t("record.demo")}</Tag>}
                  </AiLabel>
                  {d.key_points.length ? (
                    <ul className="points">
                      {d.key_points.map((k, i) => (
                        <li key={i}>
                          {k.text}
                          {k.page ? (
                            <>
                              {" "}
                              <span className="font-num">{t("record.page", { page: k.page })}</span>
                            </>
                          ) : null}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <span className="text-meta">{t("record.noKeyPoints")}</span>
                  )}
                  <div>
                    <Button icon="open_in_new" onClick={() => void openDoc(d.id)}>
                      {t("record.openFile")}
                    </Button>
                  </div>
                </div>
              )}
            </div>
          );
        })
      ) : (
        <p className="text-meta px-1 py-3">{t("record.noOutside")}</p>
      )}
    </>
  );
}
