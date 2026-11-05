import { ESLint } from "eslint";
import tseslint from "typescript-eslint";
import typeRoles from "../eslint/type-roles.js";

// The fixture: proves the rule's patterns before they guard the screens and the component library.
const eslint = new ESLint({
  overrideConfigFile: true,
  overrideConfig: [
    {
      files: ["**/*.tsx"],
      languageOptions: { parser: tseslint.parser, parserOptions: { ecmaFeatures: { jsx: true } } },
      plugins: { blinq: typeRoles },
      rules: { "blinq/type-roles": "error" },
    },
  ],
});

const lint = async (code: string): Promise<string[]> => {
  const [result] = await eslint.lintText(code, { filePath: "fixture.tsx" });
  return result!.messages.map((m) => m.message.split(":")[0]!);
};

describe("the type-roles lint rule", () => {
  it.each([
    `<p className="text-display">Biscuit</p>`,
    `<p className="text-meta text-ai">Drafted by Blinq</p>`,
    `<span className="text-body font-num whitespace-nowrap">10:00 AM</span>`,
    `<span className="text-rail-time font-num">10:30 AM</span>`,
    `<div className={cx("flex gap-4 p-4", open && "gap-6 md:px-8")} />`,
    `<div className="-mx-1 my-1 gap-x-3 space-y-2 pt-px" />`,
    `const size = "small"; const copy = "a small leading dog";`,
    `<Icon size={20} style={{ width: 20 }} />`,
  ])("allows %s", async (code) => {
    expect(await lint(code)).toEqual([]);
  });

  it.each([
    [`<p className="text-small">x</p>`, "text-small"],
    [`<p className="text-eyebrow text-text-secondary">x</p>`, "text-eyebrow"],
    [`<p className="text-body-lg">x</p>`, "text-body-lg"],
    [`<p className="text-body-xl">x</p>`, "text-body-xl"],
    [`<p className="text-header-xxs">x</p>`, "text-header-xxs"],
    [`<p className="text-micro">x</p>`, "text-micro"],
    [`<p className="text-card-title">x</p>`, "text-card-title"],
    [`<p className="text-[18px]">x</p>`, "text-[18px]"],
    [`<b className="font-bold">x</b>`, "font-bold"],
    [`<b className="font-light">x</b>`, "font-light"],
    [`<b className="font-semibold">x</b>`, "font-semibold"],
    [`<span className="font-mono">pat-1</span>`, "font-mono"],
    [`<span className="font-time">10:30 AM</span>`, "font-time"],
    [`<span className="small muted">x</span>`, "small"],
    [`<span className={cx("mono", a)}>x</span>`, "mono"],
    [`<p className="leading-tight">x</p>`, "leading-tight"],
    [`<p className={\`uppercase \${x}\`}>x</p>`, "uppercase"],
    [`const variants = { primary: "bg-primary font-semibold" };`, "font-semibold"],
    [`<div className="p-5" />`, "p-5"],
    [`<div className="gap-2.5" />`, "gap-2.5"],
    [`<div className="md:gap-1.5" />`, "gap-1.5"],
    [`<div className="-ml-0.5" />`, "-ml-0.5"],
    [`<div className="space-y-5" />`, "space-y-5"],
    [`<input style={{ fontSize: 22 }} />`, "fontSize"],
  ])("flags %s", async (code, token) => {
    expect(await lint(code)).toEqual([token]);
  });
});
