import { useState } from "react";
import { useTranslation } from "react-i18next";
import { api } from "../../api";
import type { PastVisit } from "../../api/types";
import { fmtDate, monthDay } from "../../lib/format";
import { visitTypeName } from "../../lib/visits";
import { plainWords } from "../../lib/plainWords";
import { Chip, Icon, Pressable, Switch, Tag, TextField } from "@blinq-scribe/ui";
import { Loading, Unavailable } from "../../components/common";
import { NoteSections } from "../visit/NoteView";
import { useCached } from "./useCached";
import { pastVisits, type RecordVisit, type ShownVisit } from "./record";

/**
 * Past visits for one pet: collapsed rows (date, title, a one line summary, the type and provider),
 * the note related to today's reason open, and an open note in two columns under its headings.
 * Filters: search, visit type and Related to today. The pet tabs pick the pet.
 */
export function PastVisits({ petId, relatedTo, visit }: { petId: string; relatedTo: string; visit?: RecordVisit }) {
  const { t } = useTranslation();
  const [rows] = useCached(`${petId}|${relatedTo}`, () => api.patientVisits(petId, relatedTo));
  const [kind, setKind] = useState<"all" | "sick" | "wellness">("all");
  const [text, setText] = useState("");
  const [onlyRelated, setOnlyRelated] = useState(false);
  // Rows the provider opened or closed, by key; the rest follow "the related note opens".
  const [toggled, setToggled] = useState<Record<string, boolean>>({});

  // Sick or Wellness, as the chips say it; else the practice's own name for the visit.
  const kindName = (v: PastVisit): string =>
    v.kind === "sick" ? t("record.kinds.sick") : v.kind === "wellness" ? t("record.kinds.wellness") : visitTypeName(v);
  const all = Array.isArray(rows) ? pastVisits(rows, visit) : [];
  const firstRelated = all.find((v) => v.related)?.id ?? "";
  const q = text.trim().toLowerCase();
  const list = all
    .filter((v) => kind === "all" || v.kind === kind)
    .filter((v) => !onlyRelated || v.related)
    .filter(
      (v) =>
        !q ||
        [v.reason, v.type, v.summary, v.note, v.provider_name, ...(v.medications || [])]
          .join(" ")
          .toLowerCase()
          .includes(q),
    );
  const isOpen = (v: ShownVisit) => toggled[`${petId}:${v.id}`] ?? v.id === firstRelated;
  const toggle = (v: ShownVisit) => setToggled((o) => ({ ...o, [`${petId}:${v.id}`]: !isOpen(v) }));

  return (
    <div className="flex flex-col">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-3 pb-3">
        <div className="min-w-0 flex-[0_1_264px]">
          <TextField
            id={`visitQ-${petId}`}
            type="search"
            icon="search"
            aria-label={t("record.searchVisits")}
            placeholder={t("record.searchVisits")}
            value={text}
            onChange={(e) => setText(e.target.value)}
          />
        </div>
        <div className="flex flex-wrap gap-2" role="group" aria-label={t("record.visitType")}>
          {(["all", "sick", "wellness"] as const).map((k) => (
            <Chip key={k} pressed={kind === k} onClick={() => setKind(k)}>
              {t(`record.kinds.${k}`)}
            </Chip>
          ))}
        </div>
        {relatedTo && (
          <label
            className="ml-auto flex cursor-pointer items-center gap-3 text-body-strong"
            htmlFor={`related-${petId}`}
          >
            <Switch
              id={`related-${petId}`}
              checked={onlyRelated}
              onCheckedChange={setOnlyRelated}
              // A filter, not a main action: on is ink, never green.
              className="data-[state=checked]:bg-text"
            />
            {t("record.relatedToday")}
          </label>
        )}
      </div>
      {rows === null ? (
        <Loading />
      ) : rows === false ? (
        <Unavailable what={t("record.visitHistory")} />
      ) : !list.length ? (
        <p className="border-t border-divider py-3 text-meta">
          {all.length ? t("record.noMatch") : t("record.noVisits")}
        </p>
      ) : (
        list.map((v) => {
          const open = isOpen(v);
          const detailId = `pv-${petId}-${v.id}`;
          return (
            <div className="rec-row past-note" key={v.id}>
              <Pressable
                className="expand"
                aria-expanded={open}
                aria-controls={open ? detailId : undefined}
                onClick={() => toggle(v)}
              >
                <span className="date">{fmtDate(v.date)}</span>
                <span className="text">
                  <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
                    <b>{v.reason || visitTypeName(v) || t("record.visit")}</b>
                    {v.related && (
                      <Tag tone="ai" icon="auto_awesome">
                        {t("record.relatedTag")}
                      </Tag>
                    )}
                  </span>
                  {!open && v.summary && <span className="line-clamp-1 text-body">{v.summary}</span>}
                  <span className="text-meta">{[kindName(v), v.provider_name].filter(Boolean).join(" · ")}</span>
                  {v.same.length > 0 && (
                    <span className="flex items-center gap-1 text-meta">
                      <Icon name="content_copy" size={16} />
                      {t("record.sameNote", { dates: v.same.map(monthDay).join(", ") })}
                    </span>
                  )}
                </span>
                <Icon name="expand_more" className="chev muted" />
              </Pressable>
              {open && (
                <div className="rec-detail" id={detailId}>
                  {v.note || v.sections?.length ? (
                    <NoteSections
                      sections={v.sections}
                      raw={v.note}
                      className="grid grid-cols-1 gap-x-8 gap-y-4 md:grid-cols-2"
                    />
                  ) : (
                    <span className="text-meta">{t("record.noSignedNote")}</span>
                  )}
                  {(v.medications.length > 0 || v.photos.length > 0) && (
                    <div className="flex flex-wrap gap-2">
                      {v.medications.map((m) => (
                        <Tag key={m} variant="fact" icon="medication" title={m}>
                          {plainWords(m)}
                        </Tag>
                      ))}
                      {v.photos.length > 0 && (
                        <Tag variant="fact" icon="photo_camera">
                          {t("count.photo", { count: v.photos.length })}
                        </Tag>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })
      )}
    </div>
  );
}
