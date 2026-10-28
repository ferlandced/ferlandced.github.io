// End-to-end tests (tests/). `npm test` builds the site, serves _site under /ced/ and runs every
// spec in Chromium and WebKit (Safari's engine), desktop and phone. See tests/README.md.
import { defineConfig, devices } from "@playwright/test";

const PORT = 8090;

export default defineConfig({
  testDir: "tests",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: [["list"], ["html", { open: "never" }]],
  globalTeardown: "./tests/support/coverage-report.js",
  use: {
    baseURL: `http://localhost:${PORT}/ced/`,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [
    { name: "chromium-desktop", use: { ...devices["Desktop Chrome"], viewport: { width: 1440, height: 900 } } },
    { name: "chromium-phone", use: { ...devices["Pixel 7"] } },
    { name: "webkit-desktop", use: { ...devices["Desktop Safari"], viewport: { width: 1440, height: 900 } } },
    { name: "webkit-phone", use: { ...devices["iPhone 14"] } },
  ],
  webServer: {
    // Own output folder, so a running `npm start` (which rebuilds _site) cannot change files mid-test.
    command: `npx @11ty/eleventy --quiet --output=_site-test && node tests/support/serve.js ${PORT} _site-test`,
    url: `http://localhost:${PORT}/ced/fr/`,
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
  },
});
