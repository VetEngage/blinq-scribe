import { useState } from "react";
import { useTranslation } from "react-i18next";
import { api } from "../../api";
import type { Household, Invoices as InvoiceList } from "../../api/types";
import { fmtDate, money } from "../../lib/format";
import { DataTable, formatDateTime, Switch, Tile, TileRow } from "@blinq-scribe/ui";
import { Loading, Unavailable } from "../../components/common";
import { useCached } from "./useCached";
import { aboutPet, type HouseholdPet } from "./record";

type Invoice = InvoiceList["invoices"][number];

/** "All pets": Invoices and Texts are the household's, shown for the selected pet until this is on. */
function AllPets({ id, on, onChange }: { id: string; on: boolean; onChange: (on: boolean) => void }) {
  const { t } = useTranslation();
  return (
    <label className="ml-auto flex cursor-pointer items-center gap-3 text-body-strong" htmlFor={id}>
      <Switch id={id} checked={on} onCheckedChange={onChange} className="data-[state=checked]:bg-text" />
      {t("record.allPets")}
    </label>
  );
}

/** Invoices: the household's account, then a table of invoices for this pet (or all pets), each with its line items. */
export function Invoices({ clientId, pet }: { clientId: string; pet: HouseholdPet }) {
  const { t } = useTranslation();
  const [inv] = useCached(clientId, api.invoices);
  const [all, setAll] = useState(false);
  if (inv === null) return <Loading />;
  if (!inv) return <Unavailable what={t("record.invoicesWhat")} />;
  const lp = inv.last_payment;
  const lastPay = lp
    ? lp.amount != null && lp.date
      ? t("record.paidOn", { amount: money(lp.amount), date: fmtDate(lp.date) })
      : money(lp.amount) || fmtDate(lp.date)
    : t("record.notAvailable");
  const list = all ? inv.invoices : inv.invoices.filter((i) => i.patient_id === pet.id);
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-3">
        <TileRow>
          <Tile
            label={t("record.balance")}
            value={inv.balance == null ? t("record.notAvailable") : money(inv.balance)}
          />
          <Tile label={t("record.household12")} value={money(inv.last_12_months) || t("record.notAvailable")} />
          <Tile label={t("record.lastPayment")} value={lastPay} />
        </TileRow>
        <AllPets id={`invoicesAll-${pet.id}`} on={all} onChange={setAll} />
      </div>
      {list.length ? (
        <DataTable
          aria-label={t("record.invoicesWhat")}
          rows={list}
          rowKey={(i) => i.id}
          columns={[
            { key: "date", header: t("record.date"), nowrap: true, cell: (i) => fmtDate(i.date) },
            ...(all ? [{ key: "pet", header: t("record.pet"), cell: (i: Invoice) => i.patient_name }] : []),
            { key: "visit", header: t("record.visit"), cell: (i) => i.visit || t("record.visit") },
            { key: "provider", header: t("record.provider"), className: "max-md:hidden", cell: (i) => i.provider_name },
            { key: "qty", header: <span className="sr-only">{t("record.qty")}</span>, num: true, cell: () => null },
            { key: "total", header: t("record.total"), num: true, cell: (i) => money(i.total) },
            {
              key: "status",
              header: t("record.status"),
              nowrap: true,
              cell: (i) => (
                <span className={i.status === "open" ? "text-body-strong" : "text-text-secondary"}>
                  {i.status === "open" ? t("record.open") : t("record.paid")}
                </span>
              ),
            },
          ]}
          expand={{
            column: "visit",
            children: (i) =>
              i.items.map((x, n) => ({ key: String(n), cells: { visit: x.name, qty: `× ${x.qty}`, total: money(x.price) } })),
            note: (i) => (
              <>
                {!i.items.length && <span className="block">{t("record.noLineItems")}</span>}
                {i.paid_by && <span className="block">{t("record.paidBy", { who: i.paid_by })}</span>}
              </>
            ),
          }}
        />
      ) : (
        <p className="text-meta">{all ? t("record.noInvoices") : t("record.noInvoicesFor", { name: pet.name })}</p>
      )}
    </div>
  );
}

/** Texts with the owner, newest first: the ones that name this pet, or all of them. */
export function Texts({ house, pet }: { house: Household; pet: HouseholdPet }) {
  const { t } = useTranslation();
  const [all, setAll] = useState(false);
  const first = house.client.first_name || house.client.name || t("record.owner");
  const list = [...house.messages]
    .sort((a, b) => String(b.at).localeCompare(String(a.at)))
    .filter((m) => all || aboutPet(m.text, pet.name));
  return (
    <div className="flex flex-col gap-3">
      <AllPets id={`textsAll-${pet.id}`} on={all} onChange={setAll} />
      {list.length ? (
        <ul className="m-0 flex list-none flex-col p-0">
          {list.map((m, i) => (
            <li key={`${m.at}:${i}`} className="flex flex-col border-t border-divider py-3 first:border-t-0">
              <span className="text-meta">
                {m.direction === "out" ? t("record.clinic") : first} · {m.at ? formatDateTime(m.at) : ""}
              </span>
              <span className="text-body">{m.text}</span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-meta">{all ? t("record.noTexts") : t("record.noTextsFor", { name: pet.name })}</p>
      )}
    </div>
  );
}
