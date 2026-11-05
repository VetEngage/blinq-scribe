import type { CodegenConfig } from "@graphql-codegen/cli";

// Typed documents for every GraphQL operation the console sends, from the server's SDL in schema.graphql.
const config: CodegenConfig = {
  schema: "schema.graphql",
  documents: ["src/api/operations.ts"],
  ignoreNoDocuments: true,
  generates: {
    "src/gql/": {
      preset: "client",
      presetConfig: { fragmentMasking: false },
      config: {
        useTypeImports: true,
        enumsAsTypes: true,
        scalars: { DateTime: "string", Date: "string", JSON: "unknown" },
      },
    },
  },
};

export default config;
