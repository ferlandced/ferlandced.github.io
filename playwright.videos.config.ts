// Videos of the site (tests/videos/*.video.ts), as MP4 in videos/<project>/. Not part of `npm test`:
// run `npm run videos`. Same build and server as the tests. Needs ffmpeg (README, Setup).
import { defineConfig, devices } from "@playwright/test";
import testConfig from "./playwright.config.ts";

export default defineConfig({
  testDir: "tests/videos",
  testMatch: "*.video.ts",
  timeout: 120_000,
  reporter: [["list"]],
  use: { baseURL: testConfig.use?.baseURL },
  projects: [
    {
      name: "iphone-14-pro",
      // Chromium, as in the layout tests; 2x keeps the file small and sharp enough
      use: { ...devices["iPhone 14 Pro"], browserName: "chromium", deviceScaleFactor: 2 },
    },
  ],
  webServer: testConfig.webServer,
});
