// Desktop layout: no phone emulation, no touch, no insets. Header size, page width, footer, screenshots.
import { test, expect, present } from "../support/fixtures.ts";
import { site, pageUrl } from "../support/site.ts";

test.use({ reducedMotion: "reduce" });

const paths = ["fr/", pageUrl("contact", "fr").slice(1)];

test("runs as a desktop browser: no touch, no insets", async ({ page, isMobile, hasTouch }) => {
  expect(isMobile).toBe(false);
  expect(hasTouch).toBe(false);
  await page.goto("fr/");
  const values = await page.evaluate(() => {
    const style = getComputedStyle(document.documentElement);
    return ["top", "right", "bottom", "left"].map((side) =>
      style.getPropertyValue(`--safe-${side}`).trim(),
    );
  });
  expect(values).toEqual(["0px", "0px", "0px", "0px"]);
});

for (const path of paths) {
  test(`${path}: header at its set height, no sideways scroll, footer with the office`, async ({
    page,
  }) => {
    await page.goto(path);
    const header = page.locator(".site-header");
    const expected = await header.evaluate((element) =>
      Number.parseFloat(getComputedStyle(element).getPropertyValue("--header-height")),
    );
    const box = present(await header.boundingBox(), "the header's box");
    expect(box.y).toBe(0);
    expect(box.height).toBeCloseTo(expected, 0);

    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow, "no horizontal scroll").toBeLessThanOrEqual(0);

    const footer = page.locator(".site-footer");
    await expect(footer).toContainText(site.office.name);
    await expect(footer.locator(".site-footer__notice")).toHaveText(site.office.independence.fr);
  });
}

test.describe("screenshots", () => {
  test("home, top", async ({ page }) => {
    await page.goto("fr/");
    await expect(page).toHaveScreenshot("home-top.png");
  });

  test("contact page", async ({ page }) => {
    await page.goto(paths[1] ?? "");
    await expect(page).toHaveScreenshot("contact.png");
  });
});
