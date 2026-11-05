// Contact options: the popup on the home page and the Contact page show the same list from site.json.
import { test, expect } from "./support/fixtures.js";
import { site, agent, t, url, languages } from "./support/site.js";
import { openContactPopup } from "./support/forms.js";

const expectOptions = async (area, lang) => {
  const tr = t(lang).contactOptions;
  const call = area.locator('a[href^="tel:"]');
  await expect(call).toHaveAttribute("href", `tel:+1${agent.phone.replaceAll(" ", "")}`);
  await expect(call).toContainText(tr.call);
  await expect(call).toContainText(agent.phone);
  const links = area.locator(".contact-options a[data-dialog]");
  await expect(links).toHaveCount(site.contactOptions.length);
  for (const [i, o] of site.contactOptions.entries()) {
    await expect(links.nth(i)).toHaveText(tr[o.id]);
    await expect(links.nth(i)).toHaveAttribute("href", url(site.pages[o.form][lang]) + (o.intent ? `?intent=${o.intent}` : ""));
    await expect(links.nth(i).locator("svg")).toHaveCount(1);
  }
};

for (const lang of languages) {
  test(`popup (${lang}): the options, from one list`, async ({ page }) => {
    await expectOptions(await openContactPopup(page, lang), lang);
  });

  test(`Contact page (${lang}): the same options, with a place for the picture`, async ({ page }) => {
    await page.goto(site.pages.contact[lang].slice(1));
    await expect(page.locator("h1")).toHaveText(t(lang).contactOptions.title);
    await expect(page.locator(".contact-page__photo")).toBeVisible();
    await expectOptions(page.locator("main"), lang);
  });

  for (const o of site.contactOptions) {
    test(`popup (${lang}): ${o.id} closes the popup and opens its form`, async ({ page }) => {
      const popup = await openContactPopup(page, lang);
      await popup.locator(`a[data-dialog="dialog-${o.form}"]${o.intent ? `[data-intent="${o.intent}"]` : ":not([data-intent])"}`).click();
      await expect(popup).toHaveJSProperty("open", false);
      const dialog = page.locator(`#dialog-${o.form}`);
      await expect(dialog).toHaveJSProperty("open", true);
      const intent = dialog.locator('input[name="intent"]');
      if (await intent.count()) await expect(intent).toHaveValue(o.intent || "");
    });

    test(`Contact page (${lang}): ${o.id} goes to the form page`, async ({ page }) => {
      await page.goto(site.pages.contact[lang].slice(1));
      await page.locator(`main a[href="${url(site.pages[o.form][lang]) + (o.intent ? `?intent=${o.intent}` : "")}"]`).click();
      await expect(page).toHaveURL(new RegExp(`${url(site.pages[o.form][lang])}${o.intent ? `\\?intent=${o.intent}` : ""}$`));
    });
  }
}

test("popup: Escape and the X close it", async ({ page }) => {
  const popup = await openContactPopup(page, "fr");
  await page.keyboard.press("Escape");
  await expect(popup).toHaveJSProperty("open", false);
  await page.locator(".hero__cta a").click();
  await popup.locator(".form-panel__close").click();
  await expect(popup).toHaveJSProperty("open", false);
});

test("copy button: desktop only, copies the number and confirms", async ({ page, isMobile }) => {
  const popup = await openContactPopup(page, "fr");
  const copy = popup.locator("[data-copy]");
  if (isMobile) return expect(copy).toBeHidden();
  await page.evaluate(() => { window.copied = []; navigator.clipboard.writeText = async (text) => { window.copied.push(text); }; });
  await expect(copy).toHaveText(t("fr").contactOptions.copy);
  await copy.click();
  await expect(copy).toHaveText(t("fr").contactOptions.copied);
  expect(await page.evaluate(() => window.copied)).toEqual([agent.phone]);
});

test.describe("without JavaScript", () => {
  test.use({ javaScriptEnabled: false });

  test("Contact page options are plain links and the copy button stays hidden", async ({ page }) => {
    await page.goto(site.pages.contact.en.slice(1));
    await expect(page.locator("main [data-copy]")).toBeHidden();
    await page.locator(`main a[href="${url(site.pages.writeMe.en)}"]`).click();
    await expect(page).toHaveURL(new RegExp(`${url(site.pages.writeMe.en)}$`));
  });
});
