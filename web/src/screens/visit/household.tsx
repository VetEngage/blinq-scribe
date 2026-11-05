import { useNavigate } from "react-router";
import { useTranslation } from "react-i18next";
import type { Appointment, Encounter } from "../../api/types";
import { visitPath } from "../../state/open";
import { possessive } from "../../lib/format";
import { petNoteStatus } from "./householdSteps";
import { Avatar, DropdownMenu, Icon, Pressable, Segmented, cx } from "@blinq-scribe/ui";

/**
 * A visit with several pets: one tab per pet at the top of the content card, each with where its note
 * stands (Signed, Draft, Not started). The one on screen is marked; the others open that pet's note.
 */
export function PetTabs({
  appt,
  current,
  group,
  others = [],
  onAdd,
}: {
  appt: Appointment;
  current: Encounter;
  group: Encounter[];
  /** The owner's other pets, not in the visit: "+ Add a pet (N)" adds one (`onAdd`). */
  others?: { id: string; name: string }[];
  onAdd?: (pet: { id: string; name: string }) => void;
}) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  if (group.length < 2) return null;
  return (
    <nav className="pet-tabs" aria-label={t("review.petSwitch")}>
      {group.map((g) => {
        const here = g.id === current.id;
        const name = g.patient_name || t("review.pet");
        return (
          <Pressable
            key={g.id}
            className={cx("pet-tab-h", here && "here")}
            aria-current={here ? "page" : undefined}
            onClick={() => {
              if (!here) void navigate(visitPath(appt, g.id));
            }}
          >
            <Avatar initials={name.charAt(0)} size={32} />
            <span className="flex min-w-0 flex-col text-left">
              <span className="truncate text-body-strong">{name}</span>
              <span className="truncate text-meta">{t(`status.${petNoteStatus(g)}`)}</span>
            </span>
          </Pressable>
        );
      })}
      {onAdd && others.length > 0 && (
        <DropdownMenu.Root>
          <DropdownMenu.Trigger asChild>
            <Pressable className="add-pet">
              <Icon name="add" size={16} />
              {t("review.addPet")}
              <span className="font-num text-text-secondary">{t("before.addPetCount", { count: others.length })}</span>
              <Icon name="expand_more" size={16} className="text-text-secondary" />
            </Pressable>
          </DropdownMenu.Trigger>
          <DropdownMenu.Content align="start">
            {others.map((p) => (
              <DropdownMenu.Item key={p.id} icon="add" onSelect={() => onAdd(p)}>
                {p.name}
              </DropdownMenu.Item>
            ))}
          </DropdownMenu.Content>
        </DropdownMenu.Root>
      )}
    </nav>
  );
}

/**
 * One recording for the room: says so in a plain line, and switches the transcript between this pet's
 * lines and the whole room's.
 */
export function RoomLine({ e, whole, onWhole }: { e: Encounter; whole: boolean; onWhole: (whole: boolean) => void }) {
  const { t } = useTranslation();
  const pet = e.patient_name;
  return (
    <section className="room-line" aria-label={t("review.roomRecording")}>
      <Icon name="mic" className="text-text-secondary" />
      <p className="min-w-0 flex-[1_1_240px] text-meta">
        <b className="text-body-strong text-text">
          {e.audio_seconds
            ? t("review.roomOne", { minutes: Math.max(1, Math.round(e.audio_seconds / 60)) })
            : t("review.roomOneNoLength")}
        </b>{" "}
        {t("review.roomSplit")} {whole ? t("review.roomWhole") : t("review.roomOnly", { whose: possessive(pet) })}
      </p>
      <Segmented
        aria-label={t("review.roomShow")}
        value={whole ? "room" : "pet"}
        onValueChange={(v) => onWhole(v === "room")}
        options={[
          { value: "pet", label: pet },
          { value: "room", label: t("review.wholeRoom") },
        ]}
      />
    </section>
  );
}
