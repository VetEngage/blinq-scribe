// The one recording-consent question at a time, asked by Start recording and answered in ConsentDialog.
import { create } from "zustand";

interface ConsentState {
  owner: string;
  resolve: ((yes: boolean) => void) | null;
}

export const useConsent = create<ConsentState>(() => ({ owner: "", resolve: null }));

/** Asks whether the owner agreed to recording; true only on "Owner agreed, start". */
export function askConsent(owner: string): Promise<boolean> {
  useConsent.getState().resolve?.(false); // a question still open is a no
  return new Promise((resolve) => useConsent.setState({ owner, resolve }));
}

export const answer = (yes: boolean) => {
  const { resolve } = useConsent.getState();
  useConsent.setState({ resolve: null });
  resolve?.(yes);
};

