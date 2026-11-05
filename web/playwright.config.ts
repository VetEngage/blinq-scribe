import { defineConfig, devices } from "@playwright/test";

// The demo flow against a real Blinq Scribe server in demo mode (its own port, fresh data) and the
// built console served by `vite preview`, which proxies the API like FastAPI serving web/dist would.
// Account tests invite a person, which ends the open demo, so each width gets its own server pair.
const API_PORT = Number(process.env.E2E_API_PORT ?? 8042);
const WEB_PORT = Number(process.env.E2E_WEB_PORT ?? 4191);
const ACCOUNT = [
  { name: "1440", api: API_PORT + 2, web: WEB_PORT + 1, viewport: { width: 1440, height: 900 } },
  { name: "390", api: API_PORT + 3, web: WEB_PORT + 2, viewport: { width: 390, height: 844 } },
];

const servers = (api: number, web: number) => [
  {
    command: `PORT=${api} ./e2e/demo-server.sh`,
    url: `http://127.0.0.1:${api}/health`,
    reuseExistingServer: false,
    timeout: 60_000,
  },
  {
    command: `BLINQ_API=http://127.0.0.1:${api} pnpm exec vite preview --port ${web} --strictPort`,
    url: `http://localhost:${web}`,
    reuseExistingServer: false,
  },
];

export default defineConfig({
  testDir: "e2e",
  timeout: 60_000,
  expect: { timeout: 15_000 },
  fullyParallel: false,
  workers: 1,
  reporter: [["list"]],
  use: { baseURL: `http://localhost:${WEB_PORT}`, trace: "retain-on-failure" },
  projects: [
    {
      name: "desktop-1440",
      testIgnore: /account\.spec/,
      use: { ...devices["Desktop Chrome"], viewport: { width: 1440, height: 900 } },
    },
    {
      name: "phone-390",
      testIgnore: /account\.spec/,
      use: { ...devices["Desktop Chrome"], viewport: { width: 390, height: 844 }, isMobile: false, hasTouch: true },
    },
    ...ACCOUNT.map((a) => ({
      name: `account-${a.name}`,
      testMatch: /account\.spec/,
      use: {
        ...devices["Desktop Chrome"],
        viewport: a.viewport,
        baseURL: `http://localhost:${a.web}`,
      },
      // The test talks to its own server directly to invite the person it signs in as.
      metadata: { api: `http://127.0.0.1:${a.api}` },
    })),
  ],
  webServer: [...servers(API_PORT, WEB_PORT), ...ACCOUNT.flatMap((a) => servers(a.api, a.web))],
});
