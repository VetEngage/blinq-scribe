import js from "@eslint/js";
import tseslint from "typescript-eslint";

export default tseslint.config(
  { ignores: ["css"] },
  { extends: [js.configs.recommended, ...tseslint.configs.strict], files: ["**/*.ts"] },
  { files: ["**/*.test.ts"], rules: { "@typescript-eslint/no-non-null-assertion": "off" } },
);
