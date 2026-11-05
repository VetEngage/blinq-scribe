import type { PastVisit } from "../api/types";
import { t } from "../i18n";

/** A past visit's type as people say it: the practice's own name, else Sick visit or Wellness; "" when unknown. */
export const visitTypeName = (v: { type: string; kind: PastVisit["kind"] | string }): string =>
  v.type && v.type.toLowerCase() !== "other"
    ? v.type
    : v.kind === "sick"
      ? t("record.typeNames.sick")
      : v.kind === "wellness"
        ? t("record.typeNames.wellness")
        : "";
