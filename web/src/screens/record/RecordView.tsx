import { useState } from "react";
import { Trans, useTranslation } from "react-i18next";
import { api } from "../../api";
import { fmtYear, money, smsHref, webUrl } from "../../lib/format";
import { buttonClasses, Card, CAUTION_DOT, cx, FactsLine, Icon, Num, SpeciesTile, StatusText, Tabs } from "@blinq-scribe/ui";
import { Loading, Phone, Unavailable } from "../../components/common";
import { useCached } from "./useCached";
import { useApp } from "../../state/app";
import { isRecordTab, RECORD_TABS, type HouseholdPet, type RecordTab, type RecordVisit } from "./record";
import { Overview } from "./Overview";
import { PastVisits } from "./PastVisits";
import { Documents } from "./Documents";
import { Invoices, Texts } from "./HouseholdPanels";

/**
 * The record: the owner once, a tab per pet, then Overview, Past visits, Documents, Invoices and
 * Texts. Inside a visit (`placement="visit"`) the pet in the banner is the page's Display, so the
 * owner is a Title; on its own page the owner is the Display. Read only, from the PIMS.
 */
export function RecordView({
  clientId,
  petId,
  onPet,
  tab,
  onTab,
  placement,
  visit,
  openDocument = "",
}: {
  clientId: string;
  /** The pet to show; empty, or a pet that isn't this owner's, shows the first. */
  petId: string;
  onPet: (id: string) => void;
  tab: RecordTab;
  onTab: (tab: RecordTab) => void;
  placement: "visit" | "page";
  visit?: RecordVisit;
  /** A received document to open on arrival (Documents). */
  openDocument?: string;
}) {
  const { t } = useTranslation();
  const [house, updateHouse] = useCached(clientId, api.household);
  // A panel loads the first time it opens and keeps what it loaded while the provider switches tabs.
  const [seen, setSeen] = useState<Set<RecordTab>>(() => new Set([tab]));
  const [added, setAdded] = useState("");
  if (!seen.has(tab)) setSeen(new Set(seen).add(tab));

  if (house === null)
    return (
      <Card>
        <Loading />
      </Card>
    );
  if (!house)
    return (
      <Card>
        <Unavailable what={t("record.what")} />
      </Card>
    );

  const pets = house.pets;
  const pet = pets.find((p) => p.id === petId) ?? pets[0];
  const c = house.client;
  const name = c.name || [c.first_name, c.last_name].filter(Boolean).join(" ");
  const Heading = placement === "page" ? "h1" : "h2";
  const prefers =
    c.prefers === "text"
      ? t("visitHead.prefersTexts")
      : c.prefers === "email"
        ? t("visitHead.prefersEmail")
        : c.prefers === "phone"
          ? t("record.prefersCalls")
          : "";
  const text = smsHref(c.phones?.[0]);
  const book = webUrl(house.book_url);
  const thisVisit = (p: HouseholdPet) => !!visit && visit.petIds.includes(p.id);
  // Overdue care brings the pet into today's visit: picked before it starts, added to it once started.
  const addToVisit = async (v: RecordVisit, p: HouseholdPet) => {
    const host = { id: v.appt.patient.id, name: v.appt.patient.name };
    const started = v.encounterIds.find(Boolean);
    try {
      if (started) await api.addPetToVisit(started, p.id);
      else useApp.getState().addPetToVisit(v.appt.id, { id: p.id, name: p.name }, host);
      setAdded(t("record.addedToVisit", { pet: p.name }));
    } catch (err) {
      setAdded(err instanceof Error ? err.message : String(err));
    }
  };
  // On the record page a pet with a visit today is matched to that visit's reason.
  const relatedTo = visit ? visit.appt.id : (pet?.today?.appointment_id ?? "");

  return (
    <Card as="section" aria-labelledby="recordOwner" className="record">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 flex-col">
          <Heading id="recordOwner" className={placement === "page" ? "text-display" : "text-title"}>
            {name}
          </Heading>
          <FactsLine
            items={[
              c.phones?.[0] ? <Phone key="phone" value={c.phones[0]} /> : "",
              prefers,
              c.client_since ? t("record.clientSince", { year: fmtYear(c.client_since) }) : "",
            ]}
          />
        </div>
        <div className="flex flex-wrap gap-1">
          {text && (
            <a href={text} className={buttonClasses("ghost")}>
              <Icon name="sms" />
              {t("record.text")}
            </a>
          )}
          {book && (
            <a href={book} target="_blank" rel="noopener noreferrer" className={buttonClasses("ghost")}>
              <Icon name="edit_calendar" />
              {t("record.book")}
            </a>
          )}
        </div>
      </div>

      {/* The account balance, quiet and on its own: providers rarely need it. */}
      {house.balance != null && (
        <p className="text-meta">
          <Trans i18nKey="record.balanceRow" values={{ amount: money(house.balance) }} components={{ n: <Num /> }} />
        </p>
      )}
      <StatusText>{added}</StatusText>
      {!pet ? (
        <p className="text-meta">{t("record.noPets")}</p>
      ) : (
        <Tabs.Root value={pet.id} onValueChange={onPet} className="flex min-w-0 flex-col gap-4">
          <Tabs.List
            aria-label={t("record.pets")}
            className="grid auto-cols-[minmax(10rem,1fr)] grid-flow-col gap-2 border-b-0 p-px"
          >
            {pets.map((p) => (
              <Tabs.Trigger
                key={p.id}
                value={p.id}
                className={cx(
                  "flex min-w-0 items-center gap-3 rounded-tile border border-border bg-surface px-3 py-2 text-left",
                  "hover:border-border-strong data-[state=active]:border-border data-[state=active]:bg-page",
                  // Selected like every tab: a green line along the bottom, no heavy outline.
                  "data-[state=active]:shadow-[inset_0_-2px_0_var(--color-primary)]",
                )}
              >
                <SpeciesTile species={p.species} className="rounded-pill" />
                <span className="flex min-w-0 flex-col">
                  <span className="flex min-w-0 items-center gap-2 text-body-strong text-text">
                    <span className="truncate">{p.name}</span>
                    {p.alerts.length > 0 && (
                      <>
                        <span className={CAUTION_DOT} aria-hidden="true" />
                        <span className="sr-only">, {t("visitHead.caution")}</span>
                      </>
                    )}
                  </span>
                  <span className="truncate text-meta">
                    {thisVisit(p) ? t("record.thisVisit") : p.breed || p.species}
                  </span>
                </span>
              </Tabs.Trigger>
            ))}
          </Tabs.List>
          <Tabs.Content value={pet.id} className="flex min-w-0 flex-col">
            <Tabs.Root value={tab} onValueChange={(v) => isRecordTab(v) && onTab(v)} className="flex min-w-0 flex-col">
              <div className="flex flex-wrap items-center justify-between gap-x-6 border-b border-border">
                <Tabs.List aria-label={t("record.sections", { name: pet.name })} className="min-w-0 border-b-0">
                  {RECORD_TABS.map((k) => (
                    <Tabs.Trigger key={k} value={k}>
                      {t(`record.tabs.${k}`)}
                    </Tabs.Trigger>
                  ))}
                </Tabs.List>
                <span className="py-3 text-meta">{t("record.fromPims")}</span>
              </div>
              {RECORD_TABS.filter((k) => seen.has(k)).map((k) => (
                <Tabs.Content key={k} value={k} forceMount hidden={tab !== k} className="pt-4">
                  {k === "overview" && (
                    <Overview
                      pet={pet}
                      clientId={clientId}
                      remember={house.remember}
                      visitApptId={visit?.appt.id}
                      bookUrl={book}
                      onAddToVisit={
                        visit && !visit.petIds.includes(pet.id) ? () => void addToVisit(visit, pet) : undefined
                      }
                      onForgot={(id) => updateHouse((h) => ({ ...h, remember: h.remember.filter((r) => r.id !== id) }))}
                    />
                  )}
                  {k === "visits" && <PastVisits petId={pet.id} relatedTo={relatedTo} visit={visit} />}
                  {k === "documents" && <Documents petId={pet.id} openDocument={openDocument} />}
                  {k === "invoices" && <Invoices clientId={clientId} pet={pet} />}
                  {k === "texts" && <Texts house={house} pet={pet} />}
                </Tabs.Content>
              ))}
            </Tabs.Root>
          </Tabs.Content>
        </Tabs.Root>
      )}
    </Card>
  );
}
