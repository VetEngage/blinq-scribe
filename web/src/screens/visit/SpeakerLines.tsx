import { useState } from "react";
import { useTranslation } from "react-i18next";
import { api } from "../../api";
import type { Encounter, Segment } from "../../api/types";
import { onScreen } from "../../state/nav";
import { andList, duration, initials } from "../../lib/format";
import { useCan } from "../../state/can";
import { lineId } from "../../lib/speakers";
import { Button, Chip, SpeakerList, SpeakerRow, StatusText } from "@blinq-scribe/ui";

/** Who is this?: one tap names every line from that voice. */
type Pick = "tech" | "owner" | "other";
const PICKS: Pick[] = ["tech", "owner", "other"];
/** Roles a provider named (older visits may say Family member or Another provider). */
const NAMED = ["tech", "owner", "other", "family", "other_vet"];

/**
 * The transcript, one row per line with who said it. Blinq names the provider and the owner; anyone
 * else is "Speaker N" until the provider taps who it is (Tech, Owner, Other) right in the row, which
 * then names every line from that voice. A line Blinq isn't sure about has no name.
 */
export function SpeakerLines({
  e,
  setCurrent,
  live,
  pet,
}: {
  e: Encounter;
  setCurrent?: (e: Encounter) => void;
  /** Recording now: the last line is still being written. */
  live: boolean;
  /**
   * One recording for several pets: only this pet's lines (and the ones Blinq couldn't place that could
   * be about it), then how many lines about the other pets are hidden.
   */
  pet?: string;
}) {
  const { t } = useTranslation();
  // A named speaker whose choices are open again (Change).
  const [changing, setChanging] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const all = e.segments ?? [];
  const segments = pet ? all.filter((s) => !s.pets?.length || s.pets.includes(pet)) : all;
  const hidden = all.length - segments.length;
  const others = [...new Set(all.flatMap((s) => (s.pets ?? []).filter((p) => p !== pet)))];
  const mayEdit = useCan("note.edit");
  const canName = !!setCurrent && mayEdit && e.status !== "signed" && e.can?.edit !== false;

  const name = async (seg: Segment, role: Pick) => {
    if (!setCurrent) return;
    const here = onScreen();
    setBusy(true);
    setError("");
    try {
      const updated = await api.nameSpeaker(e.id, seg.speaker_id, role, "");
      if (!here()) return;
      setCurrent(updated);
      setChanging("");
    } catch (err) {
      if (here()) setError(err instanceof Error ? err.message : String(err));
    } finally {
      if (here()) setBusy(false);
    }
  };

  return (
    <>
      <SpeakerList label={t("visit.transcript")} live={live}>
        {segments.map((s, i) => {
          const unknown = s.role === "unknown" && !!s.speaker_id;
          const named = NAMED.includes(s.role) && s.speaker_id.startsWith("speaker-");
          const roleText = s.role === "unknown" ? "" : t(`speakers.roles.${s.role}`);
          const role = named ? t("visit.namedByYou") : s.speaker_name && roleText !== s.speaker_name ? roleText : "";
          // The choices sit on each speaker's first line only, so a long transcript isn't full of them.
          const first =
            s.speaker_id.startsWith("speaker-") &&
            all.findIndex((x) => x.speaker_id === s.speaker_id) === all.indexOf(s);
          const asking = canName && first && (unknown || changing === s.speaker_id);
          const action = asking ? (
            <span
              className="inline-flex flex-wrap items-center gap-2"
              role="group"
              aria-label={t("visit.whoIs", { speaker: s.speaker_name })}
            >
              <span>{t("speakers.whoIsThis")}</span>
              {PICKS.map((r) => (
                <Chip key={r} pressed={s.role === r} disabled={busy} onClick={() => void name(s, r)}>
                  {t(`speakers.roles.${r}`)}
                </Chip>
              ))}
            </span>
          ) : canName && first && named ? (
            <Button
              variant="link"
              size="sm"
              className="h-auto px-0 text-meta"
              onClick={() => setChanging(s.speaker_id)}
            >
              {t("visit.changeSpeaker")}
            </Button>
          ) : s.pet_sure === false && (s.pets?.length ?? 0) > 1 ? (
            // A line Blinq couldn't place on one pet: said here too, in its purple.
            <span className="text-meta text-ai">{t("review.whichPet", { pets: (s.pets ?? []).join(" / ") })}</span>
          ) : undefined;
          return (
            <SpeakerRow
              key={s.id}
              id={lineId(s.line)}
              initials={s.speaker_id && !unknown ? initials(s.speaker_name || roleText) : undefined}
              name={s.speaker_name || roleText}
              role={role}
              time={duration(s.offset_seconds)}
              action={action}
              writing={live && i === segments.length - 1}
            >
              {s.text}
            </SpeakerRow>
          );
        })}
      </SpeakerList>
      {pet && hidden > 0 && (
        <p className="pt-2 text-meta">
          {t("review.linesHidden", {
            count: hidden,
            pets: andList(others),
          })}
        </p>
      )}
      <StatusText>{error}</StatusText>
    </>
  );
}
