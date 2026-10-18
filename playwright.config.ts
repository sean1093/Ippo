import { defineConfig, devices } from "@playwright/test";

/**
 * End-to-end tests against the production build, the same files GitHub Pages
 * serves. Unit tests (`npm test`) cover the logic; these cover what only a
 * browser shows: routing, rendering, storage across reloads, the offline shell.
 */
const PORT = 4173;

export default defineConfig({
  testDir: "e2e",
  testMatch: "*.e2e.ts",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: 0,
  reporter: process.env.CI ? [["list"], ["html", { open: "never" }]] : "list",
  use: {
    baseURL: `http://localhost:${PORT}/`,
    // Phone first: the course is built for one hand on a small screen.
    ...devices["Pixel 7"],
    locale: "zh-TW",
    // The service worker would serve a stale build between runs; the offline test opts back in.
    serviceWorkers: "block",
    trace: "retain-on-failure",
    // A pre-installed browser (cloud sandboxes) instead of one Playwright downloads.
    launchOptions: process.env.PLAYWRIGHT_CHROMIUM ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM } : {},
  },
  projects: [{ name: "mobile-chromium" }],
  webServer: {
    command: `npm run build && npx vite preview --port ${PORT} --strictPort`,
    url: `http://localhost:${PORT}/`,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
