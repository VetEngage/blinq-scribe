import js from "@eslint/js";
import typeRoles from "@blinq-scribe/tokens/eslint";
import prettier from "eslint-config-prettier";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import globals from "globals";
import tseslint from "typescript-eslint";

// Server data is text, never HTML.
const noHtml = {
  selector: "JSXAttribute[name.name='dangerouslySetInnerHTML']",
  message: "Server data is rendered as text only.",
};
// Times are 12-hour with AM/PM everywhere, so only formatTime and formatDateTime (@blinq-scribe/ui) build them.
const timeMessage = "Format times with formatTime or formatDateTime from @blinq-scribe/ui.";
const ownTimes = [
  { selector: "CallExpression[callee.property.name=/^(toLocaleTimeString|getHours)$/]", message: timeMessage },
  { selector: "MemberExpression[object.name='Intl'][property.name='DateTimeFormat']", message: timeMessage },
  { selector: "Property[key.name=/^(hour|hour12|hourCycle|timeStyle)$/]", message: timeMessage },
  { selector: "Literal[value=/\\bHH:mm\\b/]", message: timeMessage },
];

export default tseslint.config(
  { ignores: ["dist", "src/gql", "playwright-report", "test-results"] },
  {
    extends: [js.configs.recommended, ...tseslint.configs.strict],
    files: ["**/*.{ts,tsx}"],
    languageOptions: { ecmaVersion: 2023, globals: globals.browser },
    plugins: { "react-hooks": reactHooks, "react-refresh": reactRefresh, blinq: typeRoles },
    rules: {
      ...reactHooks.configs.recommended.rules,
      "react-refresh/only-export-components": ["warn", { allowConstantExport: true }],
      "no-restricted-syntax": ["error", noHtml, ...ownTimes],
      // Type comes from the seven roles and font-num; spacing from 4, 8, 12, 16, 24 and 32.
      "blinq/type-roles": "error",
    },
  },
  {
    // Screens build from @blinq-scribe/ui, so a raw control on a screen is a copy of a library one.
    files: ["src/screens/**/*.tsx"],
    rules: {
      "no-restricted-syntax": [
        "error",
        noHtml,
        ...ownTimes,
        {
          selector: "JSXOpeningElement[name.name=/^(button|input|select|textarea|dialog)$/]",
          message:
            "Use the @blinq-scribe/ui component (Button, IconButton, Pressable, TextField, Select, TextArea, Dialog).",
        },
      ],
    },
  },
  // Formatting is Prettier's job, so no lint rule argues with it.
  prettier,
  {
    // Tests index into arrays they just built.
    files: ["**/*.test.{ts,tsx}", "e2e/**/*.ts"],
    rules: { "@typescript-eslint/no-non-null-assertion": "off" },
  },
);
