// The server's account rules, as the web shows them before asking it.
export const MIN_PASSWORD = 10;
/** The demo vet that Try the demo clinic signs in as: settings are shown, not changed. */
export const DEMO_USERNAME = "demo.vet";

/** A rough hint while typing a new password. The server decides; this only helps. */
export function passwordStrength(pw: string): "" | "short" | "fair" | "strong" {
  if (!pw) return "";
  if (pw.length < MIN_PASSWORD) return "short";
  const kinds = [/[a-z]/, /[A-Z]/, /\d/, /[^A-Za-z0-9]/].filter((r) => r.test(pw)).length;
  return pw.length >= 14 && kinds >= 2 ? "strong" : kinds >= 3 ? "strong" : "fair";
}
