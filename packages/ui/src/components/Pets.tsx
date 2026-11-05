import { cx } from "../cx";
import { Icon } from "./Icon";

export type SpeciesKind = "dog" | "cat" | "bird" | "rabbit" | "other";

/** Which kind of animal a practice system's species word means ("Canine", "Dog", "Avian", "Lagomorph"). */
export function speciesKind(species: string | null | undefined): SpeciesKind {
  const s = String(species || "").toLowerCase();
  if (/^(dog|canine)/.test(s)) return "dog";
  if (/^(cat|feline)/.test(s)) return "cat";
  if (/^(bird|avian|parrot|cockatiel|budgie)/.test(s)) return "bird";
  if (/^(rabbit|lagomorph|bunny)/.test(s)) return "rabbit";
  return "other";
}

/** The plain word for a species in a pet's line: Dog, Cat, Bird, Rabbit; anything else as the practice wrote it. */
export function speciesLabel(species: string | null | undefined): string {
  const kind = speciesKind(species);
  return { dog: "Dog", cat: "Cat", bird: "Bird", rabbit: "Rabbit", other: String(species || "") }[kind];
}

// Material Symbols has one paw for dogs and cats, a bird, and a rabbit's face.
const speciesIcon: Record<SpeciesKind, string> = { dog: "pets", cat: "pets", bird: "flutter_dash", rabbit: "cruelty_free", other: "pets" };

/** A small grey square with the animal's icon. Decorative: the pet's name is always next to it. */
export function SpeciesTile({ species, className }: { species: string | null | undefined; className?: string }) {
  return (
    <span aria-hidden="true" className={cx("flex size-8 flex-none items-center justify-center rounded-control bg-surface-muted text-text-secondary", className)}>
      <Icon name={speciesIcon[speciesKind(species)]} />
    </span>
  );
}
