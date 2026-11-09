// CLAUDE.md brand and content rules that can be checked on the rendered pages.
// Known gaps are marked test.fail with the reason: they pass while the gap exists and turn red once fixed,
// as a reminder to remove the marker.
import { test, expect } from "./support/fixtures.ts";
import { pages, site } from "./support/site.ts";

for (const sitePage of pages) {
  test(`${sitePage.name}: trademark text`, async ({ page }) => {
    await page.goto(sitePage.path);
    const text = await page.locator("body").innerText();
    // "REMAX" in capitals, no slash, no plural or possessive: every spelling, in any case and with any separator, must be exactly "REMAX"
    const spellings = text.match(/\bre\s*[/\\|]?\s*max\b/gi) ?? [];
    expect(
      spellings.filter((spelling) => spelling !== "REMAX"),
      "RE/MAX or a mixed-case variant",
    ).toEqual([]);
    expect(text, "REMAX plural or possessive").not.toMatch(/REMAX(?:'s|’s|s)\b/i);
    // ® at most once per page, never with the office name
    expect((text.match(/®/g) ?? []).length, "® count").toBeLessThanOrEqual(1);
    expect(text, "® with the office name").not.toContain(`${site.office.name}®`);
    // No "powered by", no commission rates
    expect(text).not.toMatch(/powered by|propulsé par/i);
    expect(text, "commission rate").not.toMatch(
      /commission[^.]{0,40}\d+\s?%|\d+\s?%[^.]{0,40}commission/i,
    );
  });
}

test("office name is shown in the header next to the REMAX logo", async ({ page }) => {
  await page.goto("fr/");
  await expect(page.locator(".site-header .brand")).toHaveAttribute(
    "aria-label",
    new RegExp(site.office.name),
  );
  await expect(page.locator(".brand__office")).toHaveText(site.office.nameSuffix);
});

test("every French page has an English equivalent and the reverse", () => {
  const frenchPages = pages.filter((sitePage) => sitePage.lang === "fr").length;
  const englishPages = pages.filter(
    (sitePage) => sitePage.lang === "en" && sitePage.alternates,
  ).length;
  expect(englishPages).toBe(frenchPages);
});

test("known issue: the listings page exists in English only", async ({ page }) => {
  test.fail(
    true,
    "listings.njk has one English page at /listings/ with hardcoded text; CLAUDE.md requires FR (primary) and EN.",
  );
  const response = await page.goto("fr/listings/");
  expect(response?.status()).toBe(200);
});

test("known issue: the French independence notice is still the English text", async ({ page }) => {
  test.fail(true, "Issue #46: French wording must come from REMAX Québec.");
  await page.goto("fr/");
  await expect(page.locator(".site-footer__notice")).toHaveAttribute("lang", "fr");
});
