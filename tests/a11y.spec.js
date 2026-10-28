// Accessibility: axe-core WCAG 2.1 A/AA rules on every page, and on every step of each form dialog
// (each step is a different view). Failures list the rule, the reason and the offending elements.
import AxeBuilder from "@axe-core/playwright";
import { test, expect } from "./support/fixtures.js";
import { pages } from "./support/site.js";
import { FORMS, openForm, next, fillStep1 } from "./support/forms.js";

const TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"];

// Known gap (CLAUDE.md contrast rule), tracked by its own test below: on the desktop home page the header links
// are white on the Primary Red stripe (3.93:1). Ignored here so other problems on that page still fail.
const KNOWN = (v, n, project, path) => v.id === "color-contrast" && project.endsWith("-desktop") && /^(fr|en)\/$/.test(path)
  && n.target.join(" ").match(/#about|#services|listings\/|lang-switch/);

const check = async (page, include, known = () => false) => {
  // Measure the settled page: e.g. the phone menu fades out once JS has loaded, and mid-fade colours are meaningless.
  // Only transitions: the home page also has scroll-driven animations, which never finish.
  await page.waitForFunction(() => document.getAnimations().every((a) => !(a instanceof CSSTransition) || a.playState !== "running"));
  const builder = new AxeBuilder({ page }).withTags(TAGS);
  if (include) builder.include(include);
  const violations = (await builder.analyze()).violations
    .map((v) => ({ ...v, nodes: v.nodes.filter((n) => !known(v, n)) }))
    .filter((v) => v.nodes.length);
  const summary = violations.map((v) => `${v.id} (${v.impact}): ${v.help}\n  ${v.nodes.map((n) => n.target.join(" ")).slice(0, 5).join("\n  ")}`);
  expect(summary, "axe violations").toEqual([]);
};

for (const p of pages) {
  test(`page ${p.name}`, async ({ page }, testInfo) => {
    await page.goto(p.path);
    await check(page, undefined, (v, n) => KNOWN(v, n, testInfo.project.name, p.path));
  });
}

test("known issue: header links over the red stripe lack contrast (desktop home)", async ({ page }, testInfo) => {
  test.skip(!testInfo.project.name.endsWith("-desktop"), "desktop only");
  test.fail(true, "White on Primary Red is 3.93:1, WCAG AA needs 4.5:1. Design decision pending; remove this marker once fixed.");
  await page.goto("fr/");
  await check(page, ".site-header");
});

for (const [key, f] of Object.entries(FORMS)) {
  test(`dialog ${key}: every step`, async ({ page }) => {
    const form = await openForm(page, key, "fr", "dialog");
    await fillStep1(form, key);
    for (let i = 0; i < f.steps; i++) {
      await check(page, `#dialog-${key}`);
      if (i < f.steps - 1) await next(form);
    }
  });
}
