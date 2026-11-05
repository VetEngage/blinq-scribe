import { useEffect, useRef, useState } from "react";
import { useSession } from "../../api/session";

/** null while it loads, false when it couldn't. */
export type Load<T> = T | null | false;

/**
 * One read per key, kept while the record is open, so switching pets or tabs and back reads nothing
 * again. The record page writes its tab and pet into the address, which bumps the navigation token,
 * so a read here is dropped by its own effect (a new key, or the record closing) and by sign out,
 * not by `onScreen`.
 */
export function useCached<T>(
  key: string,
  load: (key: string) => Promise<T>,
  enabled = true,
): [Load<T>, (change: (v: T) => T) => void] {
  const [got, setGot] = useState<Record<string, T | false>>({});
  const has = key in got;
  useEffect(() => {
    if (!enabled || !key || has) return;
    let live = true;
    const epoch = useSession.getState().epoch;
    load(key)
      .catch(() => false as const)
      .then((v) => {
        if (live && epoch === useSession.getState().epoch) setGot((g) => ({ ...g, [key]: v }));
      });
    return () => {
      live = false;
    };
    // `load` is a call on the api; the key says what to read.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, enabled, has]);
  const update = (change: (v: T) => T) =>
    setGot((g) => {
      const v = g[key];
      return v === undefined || v === false ? g : { ...g, [key]: change(v) };
    });
  return [has ? (got[key] as T | false) : null, update];
}

/**
 * A checker for answers that arrive later (an upload, a list): true while this part of the record is
 * still on screen and the same person is signed in. Unlike `onScreen`, switching the record's tab or
 * pet (which rewrites the address) doesn't drop them.
 */
export function useAlive(): () => () => boolean {
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  return () => {
    const epoch = useSession.getState().epoch;
    return () => mounted.current && epoch === useSession.getState().epoch;
  };
}
