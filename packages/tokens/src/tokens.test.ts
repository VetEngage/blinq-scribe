import { readFileSync } from "node:fs";
import { join } from "node:path";
import { color, colorDark, cssVariables, darkCssVariables, leading, shadow, shadowDark, text, themeVariables, tokens, type, typeUtilities, weight } from "./index.ts";
import { renderTheme, renderTokens } from "./render.ts";

const root = join(import.meta.dirname, "..");

describe("tokens", () => {
  it("the generated CSS is current (run the build after changing a token)", () => {
    expect(readFileSync(join(root, "css/tokens.css"), "utf8")).toBe(renderTokens());
    expect(readFileSync(join(root, "css/theme.css"), "utf8")).toBe(renderTheme());
  });

  it("names every variable the way Tailwind's theme reads it", () => {
    const vars = Object.fromEntries(cssVariables());
    expect(vars["--color-primary"]).toBe(color.primary);
    expect(vars["--color-text-secondary"]).toBe("#666666");
    expect(vars["--radius-pill"]).toBe("999px");
    expect(vars["--duration-fast"]).toBe("80ms");
    expect(vars["--space-4"]).toBe("16px");
    expect(vars["--font-weight-semibold"]).toBe("600");
  });

  describe("type", () => {
    const theme = () => readFileSync(join(root, "css/theme.css"), "utf8");
    const utility = (name: string) => {
      const css = theme();
      const start = css.indexOf(`@utility ${name} {`);
      return start < 0 ? "" : css.slice(start, css.indexOf("}", start) + 1);
    };

    it("reaches the theme only as the roles: no size, line or tracking variable is emitted", () => {
      for (const [name] of cssVariables()) expect(name).not.toMatch(/^--(text|tracking|leading)-/);
      expect(theme()).toContain("--text-*: initial;");
      expect(theme()).toContain("--font-weight-*: initial;");
    });

    it("keeps the design system's sizes in the export for reference and React Native", () => {
      expect(text.bodyLg).toBe(15);
      expect(Object.keys(leading).sort()).toEqual(Object.keys(text).sort());
    });

    it("uses three weights", () => {
      expect(Object.values(weight)).toEqual([400, 500, 600]);
      for (const r of Object.values(type)) expect([400, 500, 600]).toContain(r.weight);
    });

    it("puts every line on the 4px grid", () => {
      for (const r of Object.values(type)) expect(r.line % 2).toBe(0);
      expect(type.body.line).toBe(20);
      expect(type.meta.line).toBe(18);
      expect(type.display.line).toBe(32);
    });

    it.each([
      ["text-display", ["font-size: 24px;", "line-height: 32px;", "font-weight: 600;"]],
      ["text-title", ["font-size: 16px;", "line-height: 24px;", "font-weight: 600;"]],
      ["text-section", ["font-size: 13px;", "line-height: 20px;", "font-weight: 600;"]],
      ["text-body", ["font-size: 14px;", "line-height: 20px;", "font-weight: 400;"]],
      ["text-body-strong", ["font-size: 14px;", "line-height: 20px;", "font-weight: 500;"]],
      ["text-meta", ["font-size: 13px;", "line-height: 18px;", "font-weight: 400;", "color: var(--color-text-secondary);"]],
      [
        "text-label",
        ["font-size: 11px;", "line-height: 16px;", "font-weight: 500;", "letter-spacing: 0.06em;", "text-transform: uppercase;", "color: var(--color-text-secondary);"],
      ],
      ["text-rail-title", ["font-size: 15px;", "line-height: 20px;", "font-weight: 600;"]],
      ["text-rail-meta", ["font-size: 12.5px;", "line-height: 16px;", "font-weight: 400;", "color: var(--color-text-secondary);"]],
      ["text-rail-time", ["font-size: 12.5px;", "line-height: 16px;", "font-weight: 500;", "color: var(--color-text-quiet);"]],
      ["text-rail-group", ["font-size: 11px;", "line-height: 16px;", "font-weight: 500;", "color: var(--color-text-quiet);"]],
      ["text-rail-tag", ["font-size: 11px;", "line-height: 16px;", "font-weight: 600;"]],
      ["text-rail-name", ["font-size: 15px;", "line-height: 20px;", "font-weight: 600;"]],
      ["text-rail-sub", ["font-size: 12px;", "line-height: 16px;", "font-weight: 400;", "color: var(--color-text-quiet);"]],
      ["text-rail-reason", ["font-size: 13px;", "line-height: 18px;", "font-weight: 400;"]],
      ["text-rail-caution", ["font-size: 12.5px;", "line-height: 16px;", "font-weight: 500;"]],
    ])("%s is one utility with its size, line and weight", (name, decls) => {
      const block = utility(name);
      for (const d of decls) expect(block).toContain(d);
    });

    it("font-num is the text font with tabular figures, so a Number keeps the size and weight of its line", () => {
      const block = utility("font-num");
      expect(block).toContain("font-family: var(--font-sans);");
      expect(block).toContain("font-variant-numeric: tabular-nums;");
      expect(block).not.toMatch(/font-size|font-weight|line-height|--font-mono/);
    });

    it("has no mono: the rail's times are Poppins with tabular figures, like every other number", () => {
      expect(utility("font-time")).toBe("");
      expect(theme()).not.toMatch(/--font-mono|JetBrains/);
    });

    it("has a utility for every role", () => {
      expect(typeUtilities().map(([n]) => n)).toEqual([
        "text-display",
        "text-title",
        "text-section",
        "text-body",
        "text-body-strong",
        "text-meta",
        "text-label",
        "text-rail-title",
        "text-rail-meta",
        "text-rail-time",
        "text-rail-group",
        "text-rail-tag",
        "text-rail-name",
        "text-rail-sub",
        "text-rail-reason",
        "text-rail-caution",
        "font-num",
      ]);
    });
  });

  describe("shadows", () => {
    const theme = () => readFileSync(join(root, "css/theme.css"), "utf8");
    const themeBlock = () => theme().slice(theme().indexOf("@theme {"), theme().indexOf("\n}\n") + 3);

    it("stay out of @theme, where Tailwind would copy the light value into the utility", () => {
      expect(themeBlock()).toContain("--shadow-*: initial;");
      for (const [name] of themeVariables()) expect(name.startsWith("--shadow-")).toBe(false);
      expect(themeBlock()).not.toMatch(/--shadow-card:/);
    });

    it.each(Object.keys(shadow))("%s has a utility that reads the variable", (k) => {
      expect(theme()).toContain(`@utility shadow-${k} {\n  box-shadow: var(--shadow-${k});\n}`);
    });

    it("switch to the dark values under data-theme=dark and .theme-dark", () => {
      const css = theme();
      for (const scope of [':root[data-theme="dark"] {', ".theme-dark {"]) {
        const block = css.slice(css.indexOf(scope), css.indexOf("}", css.indexOf(scope)));
        expect(block).toContain(`--shadow-pop: ${shadowDark.pop};`);
        expect(block).toContain(`--shadow-card: ${shadowDark.card};`);
      }
      expect(css).toContain(`--shadow-pop: ${shadow.pop};`);
    });
  });

  it("is plain data: no DOM, safe for React Native", () => {
    expect(JSON.parse(JSON.stringify(tokens))).toEqual(tokens);
  });

  // Text colors on the tints they sit on keep WCAG AA (4.5:1).
  const lum = (hex: string) => {
    const c = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
    return 0.2126 * c[0]! + 0.7152 * c[1]! + 0.0722 * c[2]!;
  };
  const ratio = (a: string, b: string) => {
    const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p);
    return (x! + 0.05) / (y! + 0.05);
  };
  it.each([
    ["warning", color.warning, color.warningBg],
    ["error", color.error, color.errorBg],
    ["primary", color.primary, color.selected],
    ["ai", color.ai, color.aiBg],
    ["secondary text", color.textSecondary, color.divider],
    ["on primary", color.onPrimary, color.primary],
    ["success", color.success, color.surface],
    ["success on selected", color.success, color.selected],
    ["quiet text", color.textQuiet, color.surface],
    ["quiet text on the selected rail row", color.textQuiet, color.railSelected],
    ["quiet text on the hovered rail row", color.textQuiet, color.page],
    ["quiet text on the current pet row", color.textQuiet, color.selected],
    // The rail's statuses and caution line, on every fill a row can have.
    ...([
      ["In visit", color.primary],
      ["Draft ready", color.ai],
      ["Signed", color.success],
      ["the caution line", color.warning],
    ] as const).flatMap(([n, fg]) => [
      [`${n} on the rail`, fg, color.surface],
      [`${n} on the hovered rail row`, fg, color.page],
      [`${n} on the selected rail row`, fg, color.railSelected],
      [`${n} on the current pet row`, fg, color.selected],
    ]),
    ["on inverse", color.onPrimary, color.inverse],
    ["accent on inverse", color.onInverseAccent, color.inverse],
    ["words on the camera", color.onMedia, color.media],
  ])("%s text is at least 4.5:1 on its background", (_n, fg, bg) => {
    expect(ratio(fg, bg)).toBeGreaterThanOrEqual(4.5);
  });

  describe("dark set", () => {
    it("has a value for every color and shadow token, and none that the light set lacks", () => {
      expect(Object.keys(colorDark).sort()).toEqual(Object.keys(color).sort());
      expect(Object.keys(shadowDark).sort()).toEqual(Object.keys(shadow).sort());
    });

    it("is emitted under data-theme=dark with the same variable names", () => {
      const light = new Set(cssVariables().map(([k]) => k));
      for (const [name] of darkCssVariables()) expect(light.has(name)).toBe(true);
      const css = readFileSync(join(root, "css/tokens.css"), "utf8");
      expect(css).toContain(':root[data-theme="dark"] {');
      expect(css).toContain("--color-page: #121f1f;");
      expect(css).toContain("color-scheme: dark;");
    });

    it.each([
      ["text", colorDark.text, colorDark.page],
      ["text on surface", colorDark.text, colorDark.surface],
      ["secondary text on surface", colorDark.textSecondary, colorDark.surface],
      ["secondary text on page", colorDark.textSecondary, colorDark.page],
      ["secondary text on divider", colorDark.textSecondary, colorDark.divider],
      ["warning", colorDark.warning, colorDark.warningBg],
      ["error", colorDark.error, colorDark.errorBg],
      ["error on surface", colorDark.error, colorDark.surface],
      ["primary", colorDark.primary, colorDark.selected],
      ["primary on surface", colorDark.primary, colorDark.surface],
      ["ai", colorDark.ai, colorDark.aiBg],
      ["on primary", colorDark.onPrimary, colorDark.primary],
      ["on inverse", colorDark.onPrimary, colorDark.inverse],
      ["accent on inverse", colorDark.onInverseAccent, colorDark.inverse],
      ["success on surface", colorDark.success, colorDark.surface],
      ["quiet text on surface", colorDark.textQuiet, colorDark.surface],
      ["quiet text on the selected rail row", colorDark.textQuiet, colorDark.railSelected],
      ["quiet text on the current pet row", colorDark.textQuiet, colorDark.selected],
      ...([colorDark.primary, colorDark.ai, colorDark.success, colorDark.warning] as const).flatMap((fg) => [
        [`rail status ${fg} on the selected rail row`, fg, colorDark.railSelected],
        [`rail status ${fg} on the current pet row`, fg, colorDark.selected],
      ]),
    ])("%s is at least 4.5:1 in dark", (_n, fg, bg) => {
      expect(ratio(fg, bg)).toBeGreaterThanOrEqual(4.5);
    });
  });
});
