import { Trans, useTranslation } from "react-i18next";
import type { Weight } from "../api/types";
import { monthDay } from "../lib/format";
import { EmptyState, formatPhone, Num, phoneHref, Skeleton, StatusText } from "@blinq-scribe/ui";

// The console's own wording on two library pieces, used on many screens.

export function Loading() {
  const { t } = useTranslation();
  return <StatusText className="py-3">{t("app.loading")}</StatusText>;
}

/** Rows still loading, shaped like the list they become: a time, a name and a line under it. */
export function SkeletonRows({ rows = 4, time = false }: { rows?: number; time?: boolean }) {
  const { t } = useTranslation();
  return (
    <div role="status" aria-label={t("app.loading")} className="flex flex-col">
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="flex items-start gap-3 border-t border-divider px-4 py-3 first:border-t-0">
          {time && <Skeleton className="mt-1 w-12" />}
          <div className="flex flex-1 flex-col gap-2">
            <Skeleton className="w-2/5" />
            <Skeleton className="w-3/5" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function Unavailable({ what }: { what: string }) {
  const { t } = useTranslation();
  return (
    <EmptyState icon="cloud_off" size="sm">
      {t("record.unavailable", { what })}
    </EmptyState>
  );
}

/** A contact's phone, formatted, as a Number and a tel: link when it can be called. */
export function Phone({ value }: { value: string | null | undefined }) {
  const text = formatPhone(value);
  const href = phoneHref(value);
  // Underlined so it reads as a link inside a line of text, not by its color alone.
  return href ? (
    <a href={href} className="font-num whitespace-nowrap underline underline-offset-2">
      {text}
    </a>
  ) : (
    <Num>{text}</Num>
  );
}

/**
 * The pet's weight as a fact: "72 lb, Jul 4", or once this visit recorded a new one, with the change:
 * "74 lb, up 2 lb since Jul 4". The same words in the banner and the record.
 */
export function WeightFact({ latest, previous }: { latest: Weight; previous?: Weight | null }) {
  const { t } = useTranslation();
  const n = { n: <Num /> };
  const was = previous && previous.unit === latest.unit ? previous : null;
  if (!was)
    return <Trans i18nKey="visitHead.weight" values={{ ...latest, date: monthDay(latest.date) }} components={n} />;
  const diff = Math.round((Number(latest.value) - Number(was.value)) * 10) / 10;
  const amount = Math.abs(diff);
  const change =
    diff > 0
      ? t("visitHead.weightUp", { amount, unit: latest.unit })
      : diff < 0
        ? t("visitHead.weightDown", { amount, unit: latest.unit })
        : t("visitHead.weightSame");
  return (
    <Trans
      i18nKey="visitHead.weightChanged"
      values={{ value: latest.value, unit: latest.unit, change, date: monthDay(was.date) }}
      components={n}
    />
  );
}
