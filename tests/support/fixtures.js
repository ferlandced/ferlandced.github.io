// Shared test setup. Every test gets:
// - a page that cannot reach the internet: requests leaving localhost are blocked and listed in `external`,
//   and Web3Forms is answered locally (`web3forms.mode`), so no test ever emails the agent;
// - `submissions`: the bodies posted to Web3Forms;
// - a check that the page threw no JavaScript error;
// - in Chromium, JS coverage of /js/*.js, merged by support/coverage-report.js after the run.
import { test as base, expect } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

export const WEB3FORMS = "https://api.web3forms.com/submit";

export const test = base.extend({
  web3forms: async ({}, use) => { await use({ mode: "ok", delay: 0 }); },
  submissions: async ({}, use) => { await use([]); },
  external: async ({}, use) => { await use([]); },

  page: async ({ page, browserName, javaScriptEnabled, web3forms, submissions, external }, use, testInfo) => {
    const errors = [];
    page.on("pageerror", (e) => errors.push(e.message));

    await page.route("**/*", (route) => {
      const url = new URL(route.request().url());
      if (url.hostname === "localhost") return route.continue();
      external.push(route.request().url());
      return route.abort();
    });
    await page.route(WEB3FORMS, async (route) => {
      const req = route.request();
      submissions.push({ body: req.postData() || "", contentType: req.headers()["content-type"] || "" });
      if (web3forms.delay) await new Promise((r) => setTimeout(r, web3forms.delay));
      if (web3forms.mode === "abort") return route.abort();
      if (web3forms.mode === "badjson") return route.fulfill({ status: 200, body: "not json" });
      const ok = web3forms.mode === "ok";
      return route.fulfill({ status: ok ? 200 : 500, contentType: "application/json", body: JSON.stringify({ success: ok }) });
    });

    const coverage = browserName === "chromium" && javaScriptEnabled !== false;
    if (coverage) await page.coverage.startJSCoverage({ resetOnNavigation: false });
    await use(page);
    if (coverage) {
      const entries = (await page.coverage.stopJSCoverage()).filter((e) => /\/ced\/js\/[^/]+\.js$/.test(e.url));
      if (entries.length) {
        const dir = path.resolve("coverage/raw");
        fs.mkdirSync(dir, { recursive: true });
        fs.writeFileSync(path.join(dir, `${crypto.randomUUID()}.json`), JSON.stringify(entries));
      }
    }
    expect(errors, `JavaScript errors in "${testInfo.title}"`).toEqual([]);
  },
});

export { expect };

/** Fields of one multipart body, as { name: value } (last value wins; joined groups are single values). */
export const fields = (body) => Object.fromEntries(
  [...body.matchAll(/name="([^"]+)"(?:; filename="[^"]*")?\r\n(?:Content-Type: [^\r]*\r\n)?\r\n([\s\S]*?)\r\n--/g)].map((m) => [m[1], m[2]])
);
