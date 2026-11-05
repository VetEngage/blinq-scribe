import { useTranslation } from "react-i18next";
import type { Appointment, DraftStep, Encounter } from "../../api/types";
import { VisitPanel } from "./visitTabs";
import { VisitHeader, VisitState } from "./parts";
import { AiLabel, Card, Icon, Skeleton, Spinner } from "@blinq-scribe/ui";

export const DRAFT_STEPS = ["transcript", "photos", "soap", "followups", "confirm"] as const;
type StepKey = (typeof DRAFT_STEPS)[number];

/**
 * Drafting the note: each step as the server reports it (draft_progress), with a skeleton of the note.
 * Until the first report arrives the first step shows as working.
 */
export function Drafting({ appt, current, steps }: { appt: Appointment; current: Encounter; steps: DraftStep[] }) {
  const { t } = useTranslation();
  const byKey = new Map(steps.map((s) => [s.step, s]));
  const firstOpen = DRAFT_STEPS.findIndex((k) => byKey.get(k)?.state !== "done");
  const stateOf = (k: StepKey, i: number): DraftStep["state"] => {
    const s = byKey.get(k);
    if (s) return s.state;
    return i === firstOpen ? "running" : i < firstOpen ? "done" : "pending";
  };
  const label = (k: StepKey) => {
    const s = byKey.get(k);
    return s?.label || t(`drafting.steps.${k}`);
  };
  return (
    <>
      <VisitHeader appt={appt} current={current} state={<VisitState e={current} />} step="draft" />
      <VisitPanel>
        <Card aria-busy="true">
          <AiLabel>{t("drafting.title")}</AiLabel>
          <ol className="steps" aria-live="polite">
            {DRAFT_STEPS.map((k, i) => {
              const st = stateOf(k, i);
              return (
                <li key={k} data-state={st}>
                  {st === "done" ? (
                    <Icon name="check_circle" fill className="tone-success" />
                  ) : st === "failed" ? (
                    <Icon name="error" className="tone-error" />
                  ) : st === "running" ? (
                    <Spinner />
                  ) : (
                    <Icon name="radio_button_unchecked" className="muted" />
                  )}
                  <span>
                    {label(k)}
                    {byKey.get(k)?.detail ? <span className="text-meta"> · {byKey.get(k)?.detail}</span> : null}
                  </span>
                  <span className="sr">
                    {st === "done" ? ", done" : st === "running" ? ", working" : st === "failed" ? ", failed" : ""}
                  </span>
                </li>
              );
            })}
          </ol>
        </Card>
        <Card aria-hidden="true">
          <span className="text-meta">{t("drafting.skeleton")}</span>
          {[0, 1, 2, 3].map((s) => (
            <div key={s} className="flex flex-col gap-2 py-1">
              <Skeleton className="w-28" />
              <Skeleton className="w-full" />
              <Skeleton className="w-11/12" />
              <Skeleton className="w-2/3" />
            </div>
          ))}
        </Card>
      </VisitPanel>
    </>
  );
}
