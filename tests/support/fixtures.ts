// Shared test setup. Every test gets:
// - a page that cannot reach the internet: requests leaving localhost are blocked and listed in `external`,
//   and Web3Forms is answered locally (`web3forms.mode`), so no test ever emails the agent;
// - `submissions`: the bodies posted to Web3Forms;
// - a check that the page threw no JavaScript error;
// - in Chromium, JS coverage of /js/*.js, merged by support/coverage-report.ts after the run.
import { test as base, expect } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

export const WEB3FORMS = "https://api.web3forms.com/submit";

/** How the local Web3Forms answers: success, a server error, a non-JSON body, or a network failure. */
export type Web3FormsMode = "ok" | "error" | "badjson" | "abort";

export interface Submission {
  body: string;
  contentType: string;
}

interface Fixtures {
  web3forms: { mode: Web3FormsMode; delay: number };
  submissions: Submission[];
  external: string[];
}

export const test = base.extend<Fixtures>({
  web3forms: async ({}, use) => {
    await use({ mode: "ok", delay: 0 });
  },
  submissions: async ({}, use) => {
    await use([]);
  },
  external: async ({}, use) => {
    await use([]);
  },

  page: async (
    { page, browserName, javaScriptEnabled, web3forms, submissions, external },
    use,
    testInfo,
  ) => {
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));

    await page.route("**/*", (route) => {
      const url = new URL(route.request().url());
      if (url.hostname === "localhost") {
        return route.continue();
      }
      external.push(route.request().url());
      return route.abort();
    });
    await page.route(WEB3FORMS, async (route) => {
      const request = route.request();
      submissions.push({
        body: request.postData() || "",
        contentType: request.headers()["content-type"] || "",
      });
      if (web3forms.delay) {
        await new Promise((resolve) => setTimeout(resolve, web3forms.delay));
      }
      if (web3forms.mode === "abort") {
        return route.abort();
      }
      if (web3forms.mode === "badjson") {
        return route.fulfill({ status: 200, body: "not json" });
      }
      const ok = web3forms.mode === "ok";
      return route.fulfill({
        status: ok ? 200 : 500,
        contentType: "application/json",
        body: JSON.stringify({ success: ok }),
      });
    });

    const coverage = browserName === "chromium" && javaScriptEnabled;
    if (coverage) {
      await page.coverage.startJSCoverage({ resetOnNavigation: false });
    }
    await use(page);
    if (coverage) {
      const entries = (await page.coverage.stopJSCoverage()).filter((entry) =>
        /\/ced\/js\/[^/]+\.js$/.test(entry.url),
      );
      if (entries.length) {
        const directory = path.resolve("coverage/raw");
        fs.mkdirSync(directory, { recursive: true });
        fs.writeFileSync(
          path.join(directory, `${crypto.randomUUID()}.json`),
          JSON.stringify(entries),
        );
      }
    }
    expect(errors, `JavaScript errors in "${testInfo.title}"`).toEqual([]);
  },
});

export { expect };

/** The value, or a failed test naming what was missing (e.g. a box for an element that is not rendered). */
export const present = <T>(value: T | null | undefined, what: string): T => {
  if (value === null || value === undefined) {
    throw new Error(`Expected ${what}`);
  }
  return value;
};

/** One request posted to Web3Forms; negative indexes count from the last one. */
export const submissionAt = (submissions: Submission[], index: number) =>
  present(submissions.at(index), `submission ${index < 0 ? "from the end " : ""}${index}`);

/** Fields of one multipart body, as { name: value } (last value wins; joined groups are single values). */
export const fields = (body: string): Record<string, string> =>
  Object.fromEntries(
    [
      ...body.matchAll(
        /name="([^"]+)"(?:; filename="[^"]*")?\r\n(?:Content-Type: [^\r]*\r\n)?\r\n([\s\S]*?)\r\n--/g,
      ),
    ].map((match) => [match[1] ?? "", match[2] ?? ""]),
  );
