// Header: phone burger menu, desktop navigation, scroll states, language switch.
import type { TestInfo } from "@playwright/test";
import { test, expect, present } from "./support/fixtures.ts";
import { site, copyFor, url, menuLinks } from "./support/site.ts";

const isPhone = (testInfo: TestInfo) => testInfo.project.name.endsWith("-phone");

test("phone menu opens, closes with the button, Escape and a link", async ({ page }, testInfo) => {
  test.skip(!isPhone(testInfo), "phones only");
  await page.goto("fr/");
  const root = page.locator("[data-nav-root]");
  const toggle = page.locator(".nav-toggle");
  const copy = copyFor("fr");

  await expect(toggle).toBeVisible();
  await expect(toggle).toHaveAttribute("aria-expanded", "false");
  await expect(toggle.locator(".visually-hidden")).toHaveText(copy.menu.nav.open);

  await toggle.click();
  await expect(root).toHaveAttribute("data-open", "");
  await expect(toggle).toHaveAttribute("aria-expanded", "true");
  await expect(toggle.locator(".visually-hidden")).toHaveText(copy.menu.nav.close);
  await expect(page.locator(".site-nav a").first()).toBeVisible();

  await page.keyboard.press("Escape");
  await expect(root).not.toHaveAttribute("data-open", "");
  await expect(toggle).toBeFocused();

  // A link closes the menu and goes to its target (first home-page section in the menu)
  const section = menuLinks("fr").find((link) => link.href.startsWith("/fr/#"));
  if (!section) {
    test.skip(true, "no home-page section in the menu");
    return;
  }
  await toggle.click();
  await page.locator(`.site-nav a[href="${url(section.href)}"]`).click();
  await expect(root).not.toHaveAttribute("data-open", "");
  await expect(page).toHaveURL(new RegExp(`${section.href.split("#")[1]}$`));
});

test("desktop shows the menu without a burger", async ({ page }, testInfo) => {
  test.skip(isPhone(testInfo), "desktop only");
  await page.goto("fr/");
  await expect(page.locator(".nav-toggle")).toBeHidden();
  await expect(page.locator(".site-nav a").first()).toBeVisible();
  await expect(page.locator(".lang-switch")).toBeVisible();
});

test("desktop logo: 72px, its R on the content's left edge, not clipped", async ({
  page,
}, testInfo) => {
  test.skip(isPhone(testInfo), "desktop only");
  for (const width of [1024, 1440, 1920]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("fr/");
    const logo = present(
      await page.locator(".brand__logo:visible").boundingBox(),
      "the logo's box",
    );
    expect(logo.height).toBeCloseTo(72, 0);
    const contentLeft = await page
      .locator("#services .container")
      .evaluate(
        (element) =>
          element.getBoundingClientRect().left + parseFloat(getComputedStyle(element).paddingLeft),
      );
    expect(
      Math.abs(logo.x + logo.height * 0.24 - contentLeft),
      `at ${width}px`,
    ).toBeLessThanOrEqual(1);
    expect(logo.x).toBeGreaterThanOrEqual(0);
    await expect(page.locator(".brand__office")).toHaveText(site.office.nameSuffix);
  }
});

test("header turns white when About reaches it, and keeps its height", async ({ page }) => {
  await page.goto("fr/");
  const header = page.locator(".site-header");
  const height = present(await header.boundingBox(), "the header's box").height;
  const aboutTop = await page
    .locator("#about")
    .evaluate((element) => element.getBoundingClientRect().top + scrollY);
  // Instant scrolls: the site scrolls smoothly when motion is allowed, which is slow on a busy machine.
  const scrollTo = (top: number) =>
    page.evaluate((top) => {
      window.scrollTo({ top, behavior: "instant" });
    }, top);

  await expect(header).not.toHaveAttribute("data-past-hero", "");
  await scrollTo(aboutTop - height - 40);
  await expect(header, "still over the hero").not.toHaveAttribute("data-past-hero", "");
  await scrollTo(aboutTop - height + 1);
  await expect(header).toHaveAttribute("data-past-hero", "");
  await expect(header).toHaveCSS("background-color", "rgb(255, 255, 255)");
  await scrollTo(aboutTop + 2000);
  expect(
    present(await header.boundingBox(), "the header's box").height,
    "the header does not shrink",
  ).toBeCloseTo(height, 0);
  await scrollTo(0);
  await expect(header).not.toHaveAttribute("data-past-hero", "");
});

for (const [key, urls] of Object.entries({ home: { fr: "/fr/", en: "/en/" }, ...site.pages })) {
  test(`language switch on ${key} goes to the same page in English`, async ({ page }, testInfo) => {
    await page.goto(urls.fr.slice(1));
    if (isPhone(testInfo)) {
      await page.locator(".nav-toggle").click();
      await page.locator(".site-nav__lang").click();
    } else {
      await page.locator(".lang-switch").click();
    }
    await expect(page).toHaveURL(new RegExp(`${url(urls.en)}$`));
    await expect(page.locator("html")).toHaveAttribute("lang", "en");
  });
}

test("phones: no contact icons above the burger; they are in the menu", async ({
  page,
}, testInfo) => {
  test.skip(!isPhone(testInfo), "phones only");
  await page.goto("fr/");
  await expect(page.locator(".site-header__tools .contact-icons--header")).toBeHidden();
  await page.locator(".nav-toggle").click();
  await expect(page.locator(".contact-icons--menu")).toBeVisible();
});

test("phones: the burger sits on a 44px Dark Red circle", async ({ page }, testInfo) => {
  test.skip(!isPhone(testInfo), "phones only");
  await page.goto("fr/");
  const toggle = page.locator(".nav-toggle");
  const box = present(await toggle.boundingBox(), "the burger's box");
  expect(box.width).toBe(44);
  expect(box.height).toBe(44);
  await expect(toggle).toHaveCSS("background-color", "rgb(102, 0, 0)");
  await expect(toggle).toHaveCSS("border-radius", "50%");
});

test("phones: the open menu covers the screen in Dark Red and keeps focus inside", async ({
  page,
}, testInfo) => {
  test.skip(!isPhone(testInfo), "phones only");
  await page.goto("fr/");
  await page.locator(".nav-toggle").click();
  const nav = page.locator(".site-nav");
  await expect(nav).toHaveCSS("background-color", "rgb(102, 0, 0)");
  const { width, height } = present(page.viewportSize(), "the viewport");
  const box = present(await nav.boundingBox(), "the menu's box");
  expect(box).toEqual({ x: 0, y: 0, width, height });
  await expect(page.locator("main")).toHaveJSProperty("inert", true);
  await expect(page.locator(".site-footer")).toHaveJSProperty("inert", true);
  await expect(page.locator(".brand")).toHaveJSProperty("inert", true);
  await expect(nav.locator("a").last()).toBeVisible();
  await page.locator(".nav-toggle").click();
  await expect(page.locator("main")).toHaveJSProperty("inert", false);
});
