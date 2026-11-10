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

for (const [width, expectedMargin] of [
  [1440, 120],
  [1800, 120],
] as const) {
  test(`home at ${width}px: every section's content in the centred 1500px container`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("fr/");
    const containers = page.locator(
      "#about .container, #services .container, #properties .container",
    );
    await expect(containers).toHaveCount(3);
    const expectedWidth = Math.min(width, 1500);
    for (const container of await containers.all()) {
      const box = present(await container.boundingBox(), "a section's container");
      expect(box.width).toBeCloseTo(expectedWidth, 0);
      expect(box.x, "centred").toBeCloseTo((width - expectedWidth) / 2, 0);
      await expect(container).toHaveCSS("padding-left", `${expectedMargin}px`);
      await expect(container).toHaveCSS("padding-right", `${expectedMargin}px`);
    }
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow, "no horizontal scroll").toBeLessThanOrEqual(0);
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
