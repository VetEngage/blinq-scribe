import { useSession } from "../api/session";

// One navigation token for the whole console. Every navigation (and every sign out) bumps it, and an
// answer that comes back after the vet moved on is dropped instead of landing on the wrong visit.
let navSeq = 0;

export const bumpNav = (): number => ++navSeq;

/** A checker that stays true while the vet is still on the screen it was made on. */
export function onScreen(): () => boolean {
  const seq = navSeq;
  const epoch = useSession.getState().epoch;
  return () => seq === navSeq && epoch === useSession.getState().epoch;
}
