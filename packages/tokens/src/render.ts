import { cssVariables, darkCssVariables, lightColorVariables, motion, shadow, shadowVariables, themeVariables, typeUtilities } from "./index.ts";

const HEADER = "/* Generated from packages/tokens/src/index.ts by scripts/generate.ts. Don't edit by hand. */\n";
const decl = ([k, v]: [string, string]): string => `  ${k}: ${v};`;
const kebab = (s: string): string => s.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`);

/**
 * The dark overrides. On the root element, after the light set, so they win on source order and
 * outrank the light :root. `color-scheme` turns the browser's own scrollbars and form controls dark too.
 */
const darkBlock = (): string =>
  `:root[data-theme="dark"] {\n  color-scheme: dark;\n${darkCssVariables().map(decl).join("\n")}\n}\n`;

/**
 * `.theme-light` puts the light colors back on one element and everything inside it, for things that
 * show how something will print (the letter page). Shadows are left alone so they still suit the page.
 */
const lightBlock = (): string =>
  `.theme-light {\n  color-scheme: light;\n${lightColorVariables().map(decl).join("\n")}\n}\n`;

/**
 * `.theme-dark` puts the dark set on one element and everything inside it, whatever the page's theme:
 * for showing a component in both themes side by side (the component gallery).
 */
const darkScopeBlock = (): string =>
  `.theme-dark {\n  color-scheme: dark;\n${darkCssVariables().map(decl).join("\n")}\n}\n`;

/** Plain CSS custom properties, for anything that isn't Tailwind. */
export const renderTokens = (): string =>
  `${HEADER}:root {\n  color-scheme: light;\n${cssVariables().map(decl).join("\n")}\n}\n${darkBlock()}${lightBlock()}${darkScopeBlock()}`;

/**
 * One utility per shadow token that reads the variable, so `shadow-card` follows the dark override
 * and the `.theme-dark` scope. (A shadow in @theme gets its value copied into the utility.)
 */
const shadowUtilities = (): string =>
  Object.keys(shadow)
    .map((k) => `@utility shadow-${kebab(k)} {\n  box-shadow: var(--shadow-${kebab(k)});\n}\n`)
    .join("");

/**
 * One utility per type role, plus `font-num`. A role carries size, line and weight (and for Meta, Label and
 * the gray rail roles, gray and case), so one class sets all the type an element has.
 */
const typeUtilityBlocks = (): string =>
  typeUtilities()
    .map(([name, decls]) => `@utility ${name} {\n${decls.map(decl).join("\n")}\n}\n`)
    .join("");

/**
 * A Tailwind 4 theme: the same variables (Tailwind turns --color-*, --radius-*, --font-* and
 * --font-weight-* into utilities and emits every one on :root), plus the animations. Tailwind's own
 * colors, sizes, weights, radii and shadows are cleared, so only the design system's exist; type comes
 * only from the role utilities that follow. The shadows follow as plain variables with their own
 * utilities.
 */
export const renderTheme = (): string => `${HEADER}@theme {
  --color-*: initial;
  --text-*: initial;
  --font-weight-*: initial;
  --tracking-*: initial;
  --leading-*: initial;
  --radius-*: initial;
  --shadow-*: initial;
  --spacing: 4px;
${themeVariables().map(decl).join("\n")}

  --animate-pulse-dot: pulse-dot ${motion.pulse}ms ease-in-out infinite;
  --animate-blink: blink 1s steps(2, start) infinite;
  --animate-shimmer: shimmer ${motion.shimmer}ms ease-in-out infinite;
  --animate-bounce-dot: bounce-dot ${motion.pulse}ms ease-in-out infinite;
  --animate-spin: spin 0.9s linear infinite;
  --animate-level-bar: level-bar ${motion.level}ms ease-in-out infinite;

  @keyframes pulse-dot {
    0%, 100% { opacity: 1; transform: scale(1); }
    50% { opacity: 0.35; transform: scale(0.8); }
  }
  @keyframes blink {
    to { visibility: hidden; }
  }
  @keyframes shimmer {
    0% { background-position: -200px 0; }
    100% { background-position: calc(200px + 100%) 0; }
  }
  @keyframes bounce-dot {
    0%, 80%, 100% { transform: translateY(0); opacity: 0.4; }
    40% { transform: translateY(-4px); opacity: 1; }
  }
  @keyframes spin {
    to { transform: rotate(360deg); }
  }
  @keyframes level-bar {
    0%, 100% { transform: scaleY(0.3); }
    50% { transform: scaleY(1); }
  }
}

:root {
  color-scheme: light;
${shadowVariables().map(decl).join("\n")}
}
${shadowUtilities()}${typeUtilityBlocks()}${darkBlock()}${lightBlock()}${darkScopeBlock()}`;
