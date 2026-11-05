// Every page: loads, language, title, one h1, hreflang, language switch, header links, mandatory footer
// content, nothing loaded from outside the site. Saves a full-page screenshot per page and device
// in screenshots/<project>/ for visual review.
import fs from "node:fs";
import { test, expect } from "./support/fixtures.js";
import { pages, site, agent, t, url, menuLinks } from "./support/site.js";

test.describe("every page", () => {
  for (const p of pages) {
    test(`${p.name} (${p.path})`, async ({ page, external }, testInfo) => {
      const res = await page.goto(p.path);
      expect(res.status()).toBe(200);
      const tr = t(p.lang);

      await expect(page.locator("html")).toHaveAttribute("lang", p.lang);
      await expect(page).toHaveTitle(new RegExp(agent.name));
      expect(await page.locator('meta[name="description"]').getAttribute("content")).toBeTruthy();
      await expect(page.locator("h1")).toHaveCount(1);
      await expect(page.locator("main")).toHaveCount(1);
      await expect(page.locator('meta[name="viewport"]')).toHaveAttribute("content", /viewport-fit=cover/);
      await expect(page.locator('meta[name="theme-color"]')).toHaveAttribute("content", p.name.startsWith("home-") ? site.themeColor.home : site.themeColor.page);

      // hreflang and language switch point to the same page in the other language
      if (p.alternates) {
        for (const lang of site.languages) {
          await expect(page.locator(`link[rel="alternate"][hreflang="${lang}-CA"]`)).toHaveAttribute("href", url(p.alternates[lang]));
        }
        await expect(page.locator('link[rel="alternate"][hreflang="x-default"]')).toHaveAttribute("href", url(p.alternates[site.defaultLang]));
        const other = site.languages.find((l) => l !== p.lang);
        await expect(page.locator(".lang-switch")).toHaveAttribute("href", url(p.alternates[other]));
        await expect(page.locator(".site-nav__lang")).toHaveAttribute("href", url(p.alternates[other]));
      }

      // Header: logo to this language's home, menu links from content/menu.json, in order
      await expect(page.locator(".site-header .brand")).toHaveAttribute("href", url(`/${p.lang}/`));
      const links = menuLinks(p.lang);
      const navLinks = page.locator(".site-nav > a:not(.site-nav__lang)");
      await expect(navLinks).toHaveText(links.map((l) => l.label));
      for (const [i, l] of links.entries()) {
        await expect(navLinks.nth(i)).toHaveAttribute("href", /^https?:/.test(l.href) ? l.href : url(l.href));
      }

      // Footer on every page: office name, address, phone, independence notice (CLAUDE.md)
      const footer = page.locator(".site-footer");
      await expect(footer).toContainText(site.office.name);
      await expect(footer.locator("address")).toHaveText(site.office.address);
      await expect(footer.locator(`a[href="tel:+1${site.office.phone.replaceAll(" ", "")}"]`)).toHaveText(site.office.phone);
      const notice = footer.locator(".site-footer__notice");
      await expect(notice).toHaveText(site.office.independence[p.lang]);
      await expect(notice).toHaveAttribute("lang", site.office.independenceLang[p.lang]);
      await expect(footer).toContainText(agent.name);
      await expect(footer).toContainText(agent.title[p.lang]);
      // OACIQ identification on every page, only once the licence number is filled in
      const licence = footer.locator(".site-footer__licence");
      await expect(licence).toHaveCount(agent.licence ? 1 : 0);
      if (agent.licence) {
        await expect(licence).toContainText(tr.office.licence);
        await expect(licence).toContainText(agent.licence);
        await expect(licence.locator("a")).toHaveCount(agent.licenceRegisterUrl ? 1 : 0);
      }
      // Legal links on every page
      await expect(footer.locator(`a[href="${url(site.pages.privacy[p.lang])}"]`)).toHaveText(tr.office.privacy);
      await expect(footer.locator(`a[href="${url(site.pages.terms[p.lang])}"]`)).toHaveText(tr.office.terms);

      await expect(page.locator("body")).not.toContainText(/lorem ipsum/i);
      expect(external, "requests leaving the site").toEqual([]);

      await page.screenshot({ path: `screenshots/${testInfo.project.name}/${p.name}.png`, fullPage: true });
    });
  }
});

test("theme colours come from the brand tokens", () => {
  const tokens = fs.readFileSync("css/tokens.css", "utf8");
  for (const colour of Object.values(site.themeColor)) expect(tokens).toContain(colour);
});

// Playwright cannot emulate iOS insets: this checks they are wired in. The visual check needs a real iPhone.
test("safe-area insets reach the header, the phone menu, the footer and the dialogs", () => {
  const css = fs.readFileSync("css/site.css", "utf8");
  for (const side of ["top", "right", "bottom", "left"]) expect(css).toContain(`--safe-${side}: env(safe-area-inset-${side}, 0px)`);
  for (const rule of [/\.site-header \{[^}]*padding-top: var\(--safe-top\)/, /\.nav-toggle \{ position: fixed; right: calc\(12px \+ var\(--safe-right\)\); bottom: calc\(12px \+ var\(--safe-bottom\)\)/, /\.site-footer \{ padding-bottom: var\(--safe-bottom\)/]) expect(css).toMatch(rule);
  expect(fs.readFileSync("css/forms.css", "utf8")).toMatch(/\.form-panel \{[^}]*calc\(var\(--form-pad\) \+ var\(--safe-bottom\)\)/);
});

test("site root redirects to the French home page", async ({ page }) => {
  await page.goto("");
  await page.waitForURL(/\/ced\/fr\/$/);
  await expect(page.locator("html")).toHaveAttribute("lang", "fr");
});

test("unknown pages answer 404", async ({ page }) => {
  const res = await page.goto("fr/does-not-exist/");
  expect(res.status()).toBe(404);
});
