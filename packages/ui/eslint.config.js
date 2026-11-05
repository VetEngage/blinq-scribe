import js from "@eslint/js";
import typeRoles from "@blinq-scribe/tokens/eslint";
import reactHooks from "eslint-plugin-react-hooks";
import globals from "globals";
import tseslint from "typescript-eslint";

export default tseslint.config(
  { extends: [js.configs.recommended, ...tseslint.configs.strict], files: ["**/*.{ts,tsx}"], languageOptions: { globals: globals.browser },
    plugins: { "react-hooks": reactHooks, blinq: typeRoles },
    // Type comes from the seven roles and font-num; spacing from 4, 8, 12, 16, 24 and 32.
    rules: { ...reactHooks.configs.recommended.rules, "blinq/type-roles": "error" } },
  { files: ["**/*.test.tsx"], rules: { "@typescript-eslint/no-non-null-assertion": "off" } },
);
