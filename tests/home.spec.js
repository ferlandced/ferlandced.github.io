// Home page content: hero, contact links, About, trust strip, service buttons and info links,
// the existing contact form, and the reduced-motion layout.
import { test, expect } from "./support/fixtures.js";
import { site, agent, t, url, languages } from "./support/site.js";

for (const lang of languages) {
  test.describe(`home (${lang})`, () => {
    test.beforeEach(async ({ page }) => { await page.goto(`${lang}/`); });

    test("hero shows the agent, the agency and the tagline", async ({ page }) => {
      await expect(page.locator("h1")).toHaveText(agent.name);
      await expect(page.locator(".hero__tagline")).toHaveText(t(lang).hero.tagline);
      await expect(page.locator(".hero__role")).toHaveText(agent.title[lang]);
      await expect(page.locator(".hero__agency")).toHaveText([t(lang).hero.agency, t(lang).hero.area].filter(Boolean).join(", "));
    });

    test("hero has one action: the estimation form, opened in a dialog", async ({ page }) => {
      const actions = page.locator(".hero a");
      await expect(actions).toHaveCount(1);
      await expect(actions).toHaveText(t(lang).hero.cta);
      await expect(actions).toHaveAttribute("href", url(site.pages.estimation[lang]));
      await actions.click();
      await expect(page.locator("#dialog-estimation")).toBeVisible();
    });

    test("contact links call, email and open social profiles safely", async ({ page }) => {
      const tel = `tel:+1${agent.phone.replaceAll(" ", "")}`;
      for (const area of [".contact-icons--header", ".about__contact"]) {
        await expect(page.locator(`${area} a[href="${tel}"]`)).toHaveCount(1);
        await expect(page.locator(`${area} a[href="mailto:${agent.email}"]`)).toHaveCount(1);
      }
      const social = page.locator('.contact-icons--header a[target="_blank"]');
      for (const a of await social.all()) {
        await expect(a).toHaveAttribute("rel", /noopener/);
        expect(Object.values(agent.social)).toContain(await a.getAttribute("href"));
      }
    });

    test("About links to the story page", async ({ page }) => {
      await expect(page.locator(`.about a[href="${url(site.pages.about[lang])}"]`)).toHaveText(t(lang).about.more);
    });

    test("trust strip: the licence shows only once filled in", async ({ page }) => {
      const tr = t(lang).trust;
      const strip = page.locator(".trust");
      await expect(strip).toHaveAttribute("aria-label", tr.label);
      await expect(strip.locator(".trust__item--licence")).toHaveCount(agent.licence ? 1 : 0);
      for (const title of [tr.backingTitle, tr.responseTitle, tr.languagesTitle]) await expect(strip).toContainText(title);
    });

    test("each service links to its information page", async ({ page }) => {
      for (const id of ["buy", "sell", "rent"]) {
        const more = page.locator(`.service--${id} .service__more`);
        await expect(more).toHaveAttribute("href", url(site.pages[id][lang]));
        await expect(more).toHaveText(t(lang).services[id].more);
      }
    });

    test("About button scrolls to the contact form", async ({ page }) => {
      await page.locator(`.about a[href="#contact"]`).click();
      await expect(page).toHaveURL(/#contact$/);
      await expect(page.locator("#contact")).toBeInViewport();
    });

    test("service buttons point to the form pages and open the matching dialog", async ({ page }) => {
      const expected = { buy: [["propertyAlert"]], sell: [["estimation"]], rent: [["propertyAlert", "location"], ["estimation", "location"]] };
      for (const [id, actions] of Object.entries(expected)) {
        const links = page.locator(`.service--${id} .service__actions a`);
        await expect(links).toHaveCount(actions.length);
        for (const [i, [key, intent]] of actions.entries()) {
          await expect(links.nth(i)).toHaveAttribute("href", url(site.pages[key][lang]) + (intent ? `?intent=${intent}` : ""));
          await expect(links.nth(i)).toHaveAttribute("data-dialog", `dialog-${key}`);
          if (intent) await expect(links.nth(i)).toHaveAttribute("data-intent", intent);
          else await expect(links.nth(i)).not.toHaveAttribute("data-intent", /.*/);
          await expect(links.nth(i)).toHaveText(t(lang).services[id][`action${i + 1}`].label);
        }
      }
    });

    test("contact form: phone or email, message and consent are required, then it posts to Web3Forms", async ({ page, submissions }) => {
      const form = page.locator("[data-contact-form]");
      const submitBtn = form.locator('button[type="submit"]');
      await form.locator("#cf-name").fill("Jeanne Tremblay");
      await form.locator("#cf-message").fill("Bonjour");
      await submitBtn.click();
      expect(submissions).toHaveLength(0);
      expect(await form.locator("#cf-email").evaluate((e) => e.validationMessage)).toBe(t(lang).contact.either);

      await form.locator("#cf-phone").fill("450 776 4895");
      expect(await form.locator("#cf-email").evaluate((e) => e.validity.valid)).toBe(true);
      await submitBtn.click();
      expect(submissions, "consent unchecked").toHaveLength(0);

      await form.locator('input[name="consent"]').check();
      await Promise.all([page.waitForURL("https://api.web3forms.com/submit"), submitBtn.click()]);
      expect(submissions).toHaveLength(1);
      const sent = new URLSearchParams(submissions[0].body);
      expect(sent.get("access_key")).toBe(site.web3formsKey);
      expect(sent.get("subject")).toBe(t(lang).contact.subject);
      expect(sent.get("name")).toBe("Jeanne Tremblay");
      expect(sent.get("phone")).toBe("450 776 4895");
      expect(sent.get("consent")).toBe("yes");
    });
  });
}

test("reduced motion: the agent photo shows in About without the travelling copy", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("fr/#about");
  await expect(page.locator(".about__card img")).toBeVisible();
});
