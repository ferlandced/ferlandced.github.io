// Every page: loads, language, title, one h1, hreflang, language switch, header links, mandatory footer
// content, nothing loaded from outside the site. Saves a full-page screenshot per page and device
// in screenshots/<project>/ for visual review.
import fs from "node:fs";
import { test, expect, present } from "./support/fixtures.ts";
import {
  pages,
  site,
  agent,
  copyFor,
  url,
  menuLinks,
  languages,
  defaultLang,
  type Lang,
} from "./support/site.ts";

test.describe("every page", () => {
  for (const sitePage of pages) {
    test(`${sitePage.name} (${sitePage.path})`, async ({ page, request, external }, testInfo) => {
      const response = await page.goto(sitePage.path);
      expect(response?.status()).toBe(200);
      const copy = copyFor(sitePage.lang);

      await expect(page.locator("html")).toHaveAttribute("lang", sitePage.lang);
      await expect(page).toHaveTitle(new RegExp(agent.name));
      await expect(page.locator('meta[name="description"]')).toHaveAttribute("content");
      await expect(page.locator("h1")).toHaveCount(1);
      await expect(page.locator("main")).toHaveCount(1);
      await expect(page.locator('meta[name="viewport"]')).toHaveAttribute(
        "content",
        /viewport-fit=cover/,
      );
      await expect(page.locator('meta[name="theme-color"]')).toHaveAttribute(
        "content",
        sitePage.name.startsWith("home-") ? site.themeColor.home : site.themeColor.page,
      );
      for (const relationship of ["icon", "apple-touch-icon"]) {
        const href = present(
          await page.locator(`link[rel="${relationship}"]`).getAttribute("href"),
          `the ${relationship} link`,
        );
        expect((await request.get(href)).status(), `${relationship} ${href}`).toBe(200);
      }

      // hreflang and language switch point to the same page in the other language
      if (sitePage.alternates) {
        const alternates = sitePage.alternates;
        const alternate = (lang: Lang) => url(present(alternates[lang], `the ${lang} URL`));
        for (const lang of languages) {
          await expect(
            page.locator(`link[rel="alternate"][hreflang="${lang}-CA"]`),
          ).toHaveAttribute("href", alternate(lang));
        }
        await expect(page.locator('link[rel="alternate"][hreflang="x-default"]')).toHaveAttribute(
          "href",
          alternate(defaultLang),
        );
        const other = present(
          languages.find((language) => language !== sitePage.lang),
          "another language",
        );
        await expect(page.locator(".lang-switch")).toHaveAttribute("href", alternate(other));
        await expect(page.locator(".site-nav__lang")).toHaveAttribute("href", alternate(other));
      }

      // Header: logo to this language's home, menu links from content/menu.json, in order
      await expect(page.locator(".site-header .brand")).toHaveAttribute(
        "href",
        url(`/${sitePage.lang}/`),
      );
      const links = menuLinks(sitePage.lang);
      const navLinks = page.locator(".site-nav > a:not(.site-nav__lang)");
      await expect(navLinks).toHaveText(links.map((link) => link.label));
      for (const [index, link] of links.entries()) {
        await expect(navLinks.nth(index)).toHaveAttribute(
          "href",
          /^https?:/.test(link.href) ? link.href : url(link.href),
        );
      }

      // Footer on every page: office name, address, phone, independence notice (CLAUDE.md)
      const footer = page.locator(".site-footer");
      await expect(footer).toContainText(site.office.name);
      await expect(footer.locator("address")).toHaveText(site.office.address);
      await expect(
        footer.locator(`a[href="tel:+1${site.office.phone.replaceAll(" ", "")}"]`),
      ).toHaveText(site.office.phone);
      const notice = footer.locator(".site-footer__notice");
      await expect(notice).toHaveText(site.office.independence[sitePage.lang]);
      await expect(notice).toHaveAttribute("lang", site.office.independenceLang[sitePage.lang]);
      await expect(footer).toContainText(agent.name);
      await expect(footer).toContainText(agent.title[sitePage.lang]);
      // OACIQ identification on every page, only once the licence number is filled in
      const licence = footer.locator(".site-footer__licence");
      await expect(licence).toHaveCount(agent.licence ? 1 : 0);
      if (agent.licence) {
        await expect(licence).toContainText(copy.footer.licence.text);
        await expect(licence).toContainText(agent.licence);
        await expect(licence.locator("a")).toHaveCount(agent.licenceRegisterUrl ? 1 : 0);
      }
      // Legal links on every page
      await expect(
        footer.locator(`a[href="${url(site.pages.privacy[sitePage.lang])}"]`),
      ).toHaveText(copy.footer.legalLinks.privacy);
      await expect(footer.locator(`a[href="${url(site.pages.terms[sitePage.lang])}"]`)).toHaveText(
        copy.footer.legalLinks.terms,
      );

      await expect(page.locator("body")).not.toContainText(/lorem ipsum/i);
      expect(external, "requests leaving the site").toEqual([]);

      await page.screenshot({
        path: `screenshots/${testInfo.project.name}/${sitePage.name}.png`,
        fullPage: true,
      });
    });
  }
});

test("theme colours come from the brand tokens", () => {
  const tokens = fs.readFileSync("css/tokens.css", "utf8");
  for (const colour of Object.values(site.themeColor)) {
    expect(tokens.toLowerCase()).toContain(colour.toLowerCase());
  }
});

// The header, burger, menu, dialogs and footer are measured under emulated insets in
// tests/mobile/. The About layout's inset rules are only checked here, in the CSS.
test("safe-area insets reach the About layout", () => {
  const css = fs.readFileSync("css/site.css", "utf8");
  for (const rule of [
    // The agent clear of a landscape notch; phones: About under the header and the notch, its text
    // above the burger's circle (which sits above the home indicator); desktop: the held text clear of both
    /--photo-x: calc\([^;]*var\(--safe-right\)\)/,
    /--about-top: calc\(var\(--header-height\) \+ var\(--safe-top\)\)/,
    /--about-text-clear: calc\([^;]*var\(--menu-circle-size\)[^;]*var\(--safe-bottom\)/,
    /\.about__pin \{[^}]*padding-block: calc\(var\(--header-height\) \+ var\(--safe-top\)\)\s+calc\(24px \+ var\(--safe-bottom\)\)/,
  ]) {
    expect(css).toMatch(rule);
  }
});

test("site root redirects to the French home page", async ({ page }) => {
  await page.goto("");
  await page.waitForURL(/\/ced\/fr\/$/);
  await expect(page.locator("html")).toHaveAttribute("lang", "fr");
});

test("unknown pages answer 404", async ({ page }) => {
  const response = await page.goto("fr/does-not-exist/");
  expect(response?.status()).toBe(404);
});
