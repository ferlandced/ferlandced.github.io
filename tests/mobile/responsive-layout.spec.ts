// Phone layout under hardware insets: the header, burger, menu, dialogs and footer stay clear of the
// notch, Dynamic Island and home indicator, and the header lets iOS 26 Safari show the hero behind
// the status bar. Insets come from the project (playwright.config.ts) via support/safe-area.ts.
import type { Locator, Page } from "@playwright/test";
import { test, expect, present, safeRect, expectInside } from "./support/safe-area.ts";
import { pageUrl } from "../support/site.ts";

test.use({ reducedMotion: "reduce" });

const contactPage = pageUrl("contact", "fr").slice(1);

/** True when a tap at the element's centre lands on the element (or inside it). */
const isHitAtCentre = (locator: Locator) =>
  locator.evaluate((element) => {
    const box = element.getBoundingClientRect();
    const target = document.elementFromPoint(box.x + box.width / 2, box.y + box.height / 2);
    return target !== null && element.contains(target);
  });

const scrollPastHero = async (page: Page) => {
  await page.locator("#about").evaluate((element) => {
    window.scrollTo({ top: element.getBoundingClientRect().top + scrollY, behavior: "instant" });
  });
  await expect(page.locator(".site-header")).toHaveAttribute("data-past-hero", "");
};

test("the page sees the device insets", async ({ page, safeAreaInsets }) => {
  const insets = present(safeAreaInsets, "insets for this project");
  await page.goto("fr/");
  const values = await page.evaluate(() => {
    const style = getComputedStyle(document.documentElement);
    return ["top", "right", "bottom", "left"].map((side) =>
      style.getPropertyValue(`--safe-${side}`).trim(),
    );
  });
  expect(values).toEqual(
    [insets.top, insets.right, insets.bottom, insets.left].map((px) => `${px}px`),
  );
});

test("header: its content starts below the top inset, the logo clears the side insets", async ({
  page,
  safeAreaInsets,
}) => {
  const insets = present(safeAreaInsets, "insets for this project");
  for (const path of ["fr/", contactPage]) {
    await page.goto(path);
    await expect(page.locator(".site-header")).toHaveCSS("padding-top", `${insets.top}px`);
    // The logo canvas is shifted up inside the header on purpose, so only its sides are compared
    const rect = safeRect(page, insets);
    const logo = present(await page.locator(".brand").boundingBox(), `the logo on ${path}`);
    expect(logo.x, `the logo on ${path}: left`).toBeGreaterThanOrEqual(rect.left);
    expect(logo.x + logo.width, `the logo on ${path}: right`).toBeLessThanOrEqual(rect.right);
  }
});

test("home over the hero: the status bar band shows the page, the header controls stay tappable", async ({
  page,
}) => {
  await page.goto("fr/");
  const header = page.locator(".site-header");
  await expect(header).not.toHaveAttribute("data-past-hero", "");
  await expect(header).toHaveCSS("pointer-events", "none");

  // iOS 26 Safari skips a fixed top element that lets taps through, and shows the page behind the clock
  const bandHitsHeader = await page.evaluate(
    () => document.elementFromPoint(innerWidth / 2, 5)?.closest(".site-header") != null,
  );
  expect(bandHitsHeader, "the top band reaches the page, not the header").toBe(false);

  expect(await isHitAtCentre(page.locator(".brand")), "logo").toBe(true);
  const toggle = page.locator(".nav-toggle");
  expect(await isHitAtCentre(toggle), "burger").toBe(true);
  await toggle.click();
  for (const link of await page.locator(".site-nav a:visible").all()) {
    await link.scrollIntoViewIfNeeded();
    expect(await isHitAtCentre(link), `menu link ${await link.textContent()}`).toBe(true);
  }
});

test("past the hero and on inner pages the header is opaque white", async ({ page }) => {
  await page.goto("fr/");
  await scrollPastHero(page);
  await expect(page.locator(".site-header")).toHaveCSS("background-color", "rgb(255, 255, 255)");
  await expect(page.locator(".site-header")).toHaveCSS("pointer-events", "auto");

  await page.goto(contactPage);
  await expect(page.locator(".site-header")).toHaveCSS("background-color", "rgb(255, 255, 255)");
});

test("burger and open menu stay inside the safe area", async ({ page, safeAreaInsets }) => {
  const insets = present(safeAreaInsets, "insets for this project");
  await page.goto("fr/");
  const rect = safeRect(page, insets);
  await expectInside(page.locator(".nav-toggle"), rect, "the burger");
  await page.locator(".nav-toggle").click();
  await expect(page.locator(".site-nav")).toBeVisible();
  // The menu covers the screen; what it holds stays clear of the notch and the home indicator
  for (const [index, item] of (await page.locator(".site-nav > :visible").all()).entries()) {
    await item.evaluate((element) => {
      element.scrollIntoView({ block: "center", behavior: "instant" });
    });
    await expectInside(item, rect, `menu item ${index + 1}`);
  }
});

test("dialogs: close button and the form's buttons stay inside the safe area", async ({
  page,
  safeAreaInsets,
}) => {
  const insets = present(safeAreaInsets, "insets for this project");
  await page.goto("fr/");
  const rect = safeRect(page, insets);

  await page.locator(".hero__cta a").click();
  const contact = page.locator("#dialog-contact");
  await expect(contact).toBeVisible();
  await expectInside(contact.locator(".form-panel__close"), rect, "the contact popup's close");
  await page.keyboard.press("Escape");

  await page.locator(".service__action a").first().click();
  const form = page.locator("dialog.form-dialog[open]");
  await expect(form).toBeVisible();
  await expectInside(form.locator(".form-panel__close"), rect, "the form's close");
  await form.evaluate((dialog) => {
    dialog.scrollTo({ top: dialog.scrollHeight, behavior: "instant" });
  });
  await expectInside(form.locator(".form-actions:visible"), rect, "the form's buttons");
});

test("footer ends above the home indicator", async ({ page, safeAreaInsets }) => {
  const insets = present(safeAreaInsets, "insets for this project");
  await page.goto("fr/");
  await expect(page.locator(".site-footer")).toHaveCSS("padding-bottom", `${insets.bottom}px`);
});

test("outside iOS Safari the page has no runways and opens at the top", async ({ page }) => {
  await page.goto("fr/");
  const runways = await page.evaluate(() => {
    const style = getComputedStyle(document.documentElement);
    return ["--top-runway", "--footer-runway"].map((name) => style.getPropertyValue(name).trim());
  });
  expect(runways).toEqual(["0px", "0px"]);
  expect(await page.evaluate(() => scrollY)).toBe(0);
});

test.describe("iOS runways", () => {
  // Playwright's WebKit is not iOS, so the iPhone-only values are forced here
  test.beforeEach(async ({ page }) => {
    await page.route("**/css/site.css", async (route) => {
      const response = await route.fetch();
      const css = `${await response.text()}\n:root { --top-runway: 80px; --footer-runway: 120px; }`;
      await route.fulfill({ response, body: css });
    });
  });

  const restingAt = (page: Page) => page.evaluate(() => scrollY);
  const scrollEnd = (page: Page) =>
    page.evaluate(() => document.documentElement.scrollHeight - innerHeight);
  const jumpTo = (page: Page, top: number) =>
    page.evaluate((top) => {
      window.scrollTo({ top, behavior: "instant" });
    }, top);

  for (const path of ["fr/", contactPage]) {
    test(`${path}: opens past the top runway and glides back out of both`, async ({ page }) => {
      await page.goto(path);
      await expect.poll(() => restingAt(page)).toBe(80);

      await jumpTo(page, 0);
      await expect.poll(() => restingAt(page)).toBe(80);

      const end = await scrollEnd(page);
      await jumpTo(page, end);
      await expect.poll(() => restingAt(page)).toBe(end - 120);

      await jumpTo(page, end - 300);
      await expect.poll(() => restingAt(page)).toBe(end - 300);
    });
  }

  test("with an anchor the page opens at the anchor", async ({ page }) => {
    await page.goto("fr/#services");
    expect(await restingAt(page)).toBeGreaterThan(80);
  });
});

test.describe("screenshots", () => {
  test("home, top", async ({ page }) => {
    await page.goto("fr/");
    await expect(page).toHaveScreenshot("home-top.png");
  });

  test("home, past the hero", async ({ page }) => {
    await page.goto("fr/");
    await scrollPastHero(page);
    await expect(page).toHaveScreenshot("home-past-hero.png");
  });

  test("menu open", async ({ page }) => {
    await page.goto("fr/");
    await page.locator(".nav-toggle").click();
    await expect(page.locator(".site-nav")).toHaveCSS("opacity", "1");
    await expect(page).toHaveScreenshot("menu-open.png");
  });

  test("form dialog", async ({ page }) => {
    await page.goto("fr/");
    await page.locator(".service__action a").first().click();
    await expect(page.locator("dialog.form-dialog[open]")).toBeVisible();
    await expect(page).toHaveScreenshot("form-dialog.png");
  });

  test("contact page", async ({ page }) => {
    await page.goto(contactPage);
    await expect(page).toHaveScreenshot("contact.png");
  });
});
