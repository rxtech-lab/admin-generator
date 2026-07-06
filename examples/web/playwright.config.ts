import { defineConfig, devices } from "@playwright/test";

const WEB_PORT = 3100;
const API_PORT = 8080;

/**
 * E2E config. `webServer` boots BOTH processes before the tests run and tears
 * them down after, so `bun run test:e2e` is the only command you need:
 *   - the Go admin API (examples/server) on :8080, with a throwaway SQLite DB
 *   - this Next.js app on :3100
 */
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  workers: 1,
  timeout: 30_000,
  reporter: process.env.CI ? "list" : "html",
  use: {
    baseURL: `http://localhost:${WEB_PORT}`,
    trace: "on-first-retry",
  },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
  ],
  webServer: [
    {
      // Fresh DB each run so create/edit/delete assertions are deterministic.
      command: "sh -c 'rm -f e2e.db && DATABASE_URL=\"file:e2e.db\" PORT=8080 CORS_ORIGIN=http://localhost:3100 go run .'",
      cwd: "../server",
      url: `http://localhost:${API_PORT}/healthz`,
      reuseExistingServer: !process.env.CI,
      timeout: 60_000,
    },
    {
      command: `bun run start -- -p ${WEB_PORT}`,
      env: {
        ADMIN_API_URL: `http://localhost:${API_PORT}`,
        APP_URL: `http://localhost:${WEB_PORT}`,
      },
      url: `http://localhost:${WEB_PORT}`,
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
    },
  ],
});
