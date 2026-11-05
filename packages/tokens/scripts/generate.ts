// Writes css/tokens.css (plain custom properties on :root) and css/theme.css (a Tailwind 4 theme)
// from src/index.ts. Run with `pnpm --filter @blinq-scribe/tokens build`; a test checks they're current.
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { renderTheme, renderTokens } from "../src/render.ts";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
mkdirSync(join(root, "css"), { recursive: true });
writeFileSync(join(root, "css/tokens.css"), renderTokens());
writeFileSync(join(root, "css/theme.css"), renderTheme());
console.log("Wrote css/tokens.css and css/theme.css");
