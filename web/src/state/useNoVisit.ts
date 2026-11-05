import { useEffect } from "react";
import { useApp } from "./app";

/** Leaving a visit: nothing is open, so the schedule highlights nothing and Ask Blinq knows no patient. */
export function useNoVisit(): void {
  useEffect(() => {
    useApp.setState({ openAppt: null, openPatient: null, current: null });
  }, []);
}
