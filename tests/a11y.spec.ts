// Accessibility: axe-core WCAG 2.1 A/AA rules on every page, and on every step of each form dialog
// (each step is a different view). Failures list the rule, the reason and the offending elements.
import { AxeBuilder } from "@axe-core/playwright";
import type { Page } from "@playwright/test";
import { test, expect } from "./support/fixtures.ts";
import { pages } from "./support/site.ts";
import {
  FORM_ENTRIES,
  openForm,
  openWriteMe,
  openContactPopup,
  next,
  fillStep1,
} from "./support/forms.ts";

const TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"];

const check = async (page: Page, include?: string) => {
  // Measure the settled page: e.g. the phone menu fades out once JS has loaded, and mid-fade colours are meaningless.
  // Only transitions: the home page also has scroll-driven animations, which never finish.
  await page.waitForFunction(() =>
    document
      .getAnimations()
      .every(
        (animation) => !(animation instanceof CSSTransition) || animation.playState !== "running",
      ),
  );
  const builder = new AxeBuilder({ page }).withTags(TAGS);
  if (include) {
    builder.include(include);
  }
  const { violations } = await builder.analyze();
  const summary = violations.map(
    (violation) =>
      `${violation.id} (${violation.impact}): ${violation.help}\n  ${violation.nodes
        .map((node) => node.target.join(" "))
        .slice(0, 5)
        .join("\n  ")}`,
  );
  expect(summary, "axe violations").toEqual([]);
};

for (const sitePage of pages) {
  test(`page ${sitePage.name}`, async ({ page }) => {
    // Reduced motion: the home page text is then all shown, so axe checks every block's final colours
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto(sitePage.path);
    await check(page);
  });
}

test("dialog propertyInfo", async ({ page }) => {
  await page.goto("fr/");
  await page.locator("[data-property-info]").first().click();
  await check(page, "#dialog-propertyInfo");
});

test("dialog contact", async ({ page }) => {
  await openContactPopup(page, "fr");
  await check(page, "#dialog-contact");
});

test("dialog writeMe", async ({ page }) => {
  await openWriteMe(page, "fr", "dialog");
  await check(page, "#dialog-writeMe");
});

for (const [key, formConfig] of FORM_ENTRIES) {
  test(`dialog ${key}: every step`, async ({ page }) => {
    const form = await openForm(page, key, "fr", "dialog");
    for (let index = 0; index < formConfig.contactStep; index++) {
      await check(page, `#dialog-${key}`);
    }
    await fillStep1(form, key);
    for (let index = formConfig.contactStep; index < formConfig.steps; index++) {
      await check(page, `#dialog-${key}`);
      if (index < formConfig.steps - 1) {
        await next(form);
      }
    }
  });
}
