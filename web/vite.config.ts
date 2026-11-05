import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

// The dev server proxies the API to a local Blinq Scribe server (BLINQ_API, default port 8000),
// so the app always calls same-origin paths, exactly as it does when FastAPI serves web/dist.
const api = process.env.BLINQ_API ?? "http://127.0.0.1:8000";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    proxy: {
      "/api": api,
      "/health": api,
      "/s/": api,
      "/graphql": { target: api, ws: true },
    },
  },
  build: {
    outDir: "dist",
    sourcemap: true,
    chunkSizeWarningLimit: 900, // the one vendor chunk: React, Apollo, Radix, cmdk and friends (270 kB gzipped)
    rollupOptions: {
      output: {
        // Libraries and the generated GraphQL documents change less often than the console, so
        // they cache on their own. One vendor chunk: splitting React from what imports it breaks load order.
        manualChunks(id) {
          if (id.includes("/src/gql/")) return "operations";
          return id.includes("node_modules") ? "vendor" : undefined;
        },
      },
    },
  },
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./src/test/setup.ts"],
    include: ["src/**/*.test.{ts,tsx}"],
    css: false,
  },
});
