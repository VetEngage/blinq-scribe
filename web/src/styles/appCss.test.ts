/// <reference types="node" />
import { readFileSync } from "node:fs";
import { join } from "node:path";

// The screens' own styles never set type: the roles in the generated theme.css do, applied here with
// @apply. ESLint guards the class names in the components; this guards the one stylesheet it can't read.
const css = readFileSync(join(process.cwd(), "src/styles/app.css"), "utf8").replace(/\/\*[\s\S]*?\*\//g, "");
const declarations = [...css.matchAll(/([a-z-]+)\s*:\s*([^;{}]+);/g)].map(([, prop, value]) => [prop!, value!.trim()] as const);

describe("app.css", () => {
  it("sets no size, weight, line, tracking, family or case of its own", () => {
    const own = declarations.filter(([prop, value]) => {
      if (prop === "font") return value !== "inherit";
      // An icon font is sized by font-size: that's the icon's size, not type.
      if (prop === "font-size") return !/^var\(--size-icon[a-z-]*\)$/.test(value);
      return ["font-weight", "line-height", "letter-spacing", "font-family", "text-transform", "font-variant-numeric"].includes(prop);
    });
    expect(own).toEqual([]);
  });

  it("reads no retired type variable", () => {
    expect(css).not.toMatch(/var\(--(text|tracking|leading|font-weight)-/);
  });

  it("applies only the roles and font-num", () => {
    const applied = [...css.matchAll(/@apply ([^;]+);/g)].flatMap(([, list]) => list!.split(/\s+/));
    for (const c of applied) expect(c).toMatch(/^(text-(display|title|section|body|body-strong|meta|label|rail-(title|meta|time|group|tag))|font-num)$/);
    expect(applied.length).toBeGreaterThan(0);
  });
});
