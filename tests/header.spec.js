// Header: phone burger menu, desktop navigation, scroll states, language switch.
import { test, expect } from "./support/fixtures.js";
import { site, t, url } from "./support/site.js";

const isPhone = (testInfo) => testInfo.project.name.endsWith("-phone");

test("phone menu opens, closes with the button, Escape and a link", async ({ page }, testInfo) => {
  test.skip(!isPhone(testInfo), "phones only");
  await page.goto("fr/");
  const root = page.locator("[data-nav-root]");
  const toggle = page.locator(".nav-toggle");
  const tr = t("fr");

  await expect(toggle).toBeVisible();
  await expect(toggle).toHaveAttribute("aria-expanded", "false");
  await expect(toggle.locator(".visually-hidden")).toHaveText(tr.nav.open);

  await toggle.click();
  await expect(root).toHaveAttribute("data-open", "");
  await expect(toggle).toHaveAttribute("aria-expanded", "true");
  await expect(toggle.locator(".visually-hidden")).toHaveText(tr.nav.close);
  await expect(page.locator(".site-nav a").first()).toBeVisible();

  await page.keyboard.press("Escape");
  await expect(root).not.toHaveAttribute("data-open", "");
  await expect(toggle).toBeFocused();

  await toggle.click();
  await page.locator(`.site-nav a[href="${url("/fr/#services")}"]`).click();
  await expect(root).not.toHaveAttribute("data-open", "");
  await expect(page).toHaveURL(/#services$/);
});

test("desktop shows the menu without a burger", async ({ page }, testInfo) => {
  test.skip(isPhone(testInfo), "desktop only");
  await page.goto("fr/");
  await expect(page.locator(".nav-toggle")).toBeHidden();
  await expect(page.locator(".site-nav a").first()).toBeVisible();
  await expect(page.locator(".lang-switch")).toBeVisible();
});

test("header changes state when the page scrolls past the hero", async ({ page, browserName }) => {
  test.fixme(browserName === "webkit", "In headless WebKit, data-past-hero (header contact icons) is sometimes never set after "
    + "scrolling past the hero, about 1 run in 7, even with further scrolling. Check on a real iPhone/Safari.");
  await page.goto("fr/");
  const header = page.locator(".site-header");
  await expect(header).not.toHaveAttribute("data-scrolled", "");
  await expect(header).not.toHaveAttribute("data-past-hero", "");
  // Instant scrolls: the site scrolls smoothly when motion is allowed, which is slow on a busy machine.
  await page.evaluate(() => window.scrollTo({ top: document.querySelector("#services").offsetTop, behavior: "instant" }));
  await expect(header).toHaveAttribute("data-scrolled", "");
  await expect(header).toHaveAttribute("data-past-hero", "");
  await page.evaluate(() => window.scrollTo({ top: 0, behavior: "instant" }));
  await expect(header).not.toHaveAttribute("data-scrolled", "");
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
