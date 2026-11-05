// Header: phone burger menu, desktop navigation, scroll states, language switch.
import { test, expect } from "./support/fixtures.js";
import { site, t, url, menuLinks } from "./support/site.js";

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

  // A link closes the menu and goes to its target (first home-page section in the menu)
  const section = menuLinks("fr").find((l) => l.href.startsWith("/fr/#"));
  test.skip(!section, "no home-page section in the menu");
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

test("desktop logo: 72px, its R on the content's left edge, not clipped", async ({ page }, testInfo) => {
  test.skip(isPhone(testInfo), "desktop only");
  for (const width of [992, 1440, 1920]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("fr/");
    const logo = await page.locator(".brand__logo:visible").boundingBox();
    expect(logo.height).toBeCloseTo(72, 0);
    const content = await page.locator("#services .container").boundingBox();
    expect(Math.abs(logo.x + logo.height * .24 - content.x), `at ${width}px`).toBeLessThanOrEqual(1);
    expect(logo.x).toBeGreaterThanOrEqual(0);
    await expect(page.locator(".brand__office")).toHaveText(site.office.nameSuffix);
  }
});

test("header turns white when About reaches it, and keeps its height", async ({ page }) => {
  await page.goto("fr/");
  const header = page.locator(".site-header");
  const height = (await header.boundingBox()).height;
  const aboutTop = await page.locator("#about").evaluate((el) => el.getBoundingClientRect().top + scrollY);
  // Instant scrolls: the site scrolls smoothly when motion is allowed, which is slow on a busy machine.
  const scrollTo = (top) => page.evaluate((top) => window.scrollTo({ top, behavior: "instant" }), top);

  await expect(header).not.toHaveAttribute("data-past-hero", "");
  await scrollTo(aboutTop - height - 40);
  await expect(header, "still over the hero").not.toHaveAttribute("data-past-hero", "");
  await scrollTo(aboutTop - height + 1);
  await expect(header).toHaveAttribute("data-past-hero", "");
  await expect(header).toHaveCSS("background-color", "rgb(255, 255, 255)");
  await scrollTo(aboutTop + 2000);
  expect((await header.boundingBox()).height, "the header does not shrink").toBeCloseTo(height, 0);
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
