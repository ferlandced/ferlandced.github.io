// End-to-end tests (tests/). `npm test` builds the site, serves _site under /ced/ and runs every
// spec in Chromium and WebKit (Safari's engine), desktop and phone. tests/mobile/ and tests/desktop/
// hold the layout and screenshot specs, on their own projects. See tests/README.md.
import { defineConfig, devices } from "@playwright/test";
import type { SafeAreaOptions } from "./tests/mobile/support/safe-area.ts";

const PORT = 8090;
const layoutFolders = ["mobile/**", "desktop/**"];
const desktopViewport = { width: 1440, height: 900 };

export default defineConfig<SafeAreaOptions>({
  testDir: "tests",
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  reporter: [["list"], ["html", { open: "never" }]],
  globalTeardown: "./tests/support/coverage-report.ts",
  snapshotPathTemplate: "{testDir}/__screenshots__/{projectName}/{testFilePath}/{arg}{ext}",
  expect: {
    toHaveScreenshot: { animations: "disabled", maxDiffPixelRatio: 0.01 },
  },
  use: {
    baseURL: `http://localhost:${PORT}/ced/`,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [
    {
      name: "chromium-desktop",
      testIgnore: layoutFolders,
      use: { ...devices["Desktop Chrome"], viewport: desktopViewport },
    },
    { name: "chromium-phone", testIgnore: layoutFolders, use: { ...devices["Pixel 7"] } },
    {
      name: "webkit-desktop",
      testIgnore: layoutFolders,
      use: { ...devices["Desktop Safari"], viewport: desktopViewport },
    },
    { name: "webkit-phone", testIgnore: layoutFolders, use: { ...devices["iPhone 14"] } },

    {
      name: "desktop-chromium",
      testMatch: "desktop/**/*.spec.ts",
      use: { ...devices["Desktop Chrome"], viewport: desktopViewport },
    },
    {
      name: "desktop-webkit",
      testMatch: "desktop/**/*.spec.ts",
      use: { ...devices["Desktop Safari"], viewport: desktopViewport },
    },
    {
      name: "mobile-iphone-14-pro",
      testMatch: "mobile/**/*.spec.ts",
      use: {
        ...devices["iPhone 14 Pro"],
        // The safe-area override is a Chrome DevTools call, so the iPhones run in Chromium
        browserName: "chromium",
        safeAreaInsets: { top: 59, right: 0, bottom: 34, left: 0 },
      },
    },
    {
      name: "mobile-iphone-14-pro-landscape",
      testMatch: "mobile/**/*.spec.ts",
      use: {
        ...devices["iPhone 14 Pro landscape"],
        browserName: "chromium",
        safeAreaInsets: { top: 0, right: 59, bottom: 21, left: 59 },
      },
    },
    {
      name: "mobile-pixel-7",
      testMatch: "mobile/**/*.spec.ts",
      use: { ...devices["Pixel 7"], safeAreaInsets: { top: 0, right: 0, bottom: 0, left: 0 } },
    },
  ],
  webServer: {
    // Own output folder, so a running `npm start` (which rebuilds _site) cannot change files mid-test.
    command: `npx @11ty/eleventy --config=eleventy.config.ts --quiet --output=_site-test && node tests/support/serve.ts ${PORT} _site-test`,
    url: `http://localhost:${PORT}/ced/fr/`,
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
  },
});
