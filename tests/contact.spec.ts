// Contact options: the popup on the home page and the Contact page show the same list from site.json.
import type { Locator } from "@playwright/test";
import { test, expect } from "./support/fixtures.ts";
import {
  site,
  agent,
  copyFor,
  url,
  languages,
  pageUrl,
  textAt,
  type Lang,
} from "./support/site.ts";
import { openContactPopup } from "./support/forms.ts";

declare global {
  interface Window {
    /** Text the stubbed clipboard received. */
    copied: string[];
  }
}

const expectOptions = async (area: Locator, lang: Lang) => {
  const copy = copyFor(lang).contact.options;
  const call = area.locator('a[href^="tel:"]');
  await expect(call).toHaveAttribute("href", `tel:+1${agent.phone.replaceAll(" ", "")}`);
  await expect(call).toContainText(copy.call);
  await expect(call).toContainText(agent.phone);
  const links = area.locator(".contact-options a[data-dialog]");
  await expect(links).toHaveCount(site.contactOptions.length);
  for (const [index, option] of site.contactOptions.entries()) {
    await expect(links.nth(index)).toHaveText(textAt(copy, option.id));
    await expect(links.nth(index)).toHaveAttribute(
      "href",
      url(pageUrl(option.form, lang)) + (option.intent ? `?intent=${option.intent}` : ""),
    );
    await expect(links.nth(index).locator("svg")).toHaveCount(1);
  }
};

for (const lang of languages) {
  test(`popup (${lang}): the options, from one list`, async ({ page }) => {
    await expectOptions(await openContactPopup(page, lang), lang);
  });

  test(`Contact page (${lang}): the same options, with a place for the picture`, async ({
    page,
  }) => {
    await page.goto(site.pages.contact[lang].slice(1));
    await expect(page.locator("h1")).toHaveText(copyFor(lang).contact.title);
    await expect(page.locator(".contact-page__photo")).toBeVisible();
    await expectOptions(page.locator("main"), lang);
  });

  for (const option of site.contactOptions) {
    // The intent the form starts with: a hidden field (estimation) holds it, empty without one;
    // radios (property alert) have it picked, or none; the other forms have no intent
    const startingIntents =
      {
        estimation: [option.intent ?? ""],
        propertyAlert: option.intent ? [option.intent] : [],
      }[option.form] ?? [];

    test(`popup (${lang}): ${option.id} closes the popup and opens its form`, async ({ page }) => {
      const popup = await openContactPopup(page, lang);
      await popup
        .locator(
          `a[data-dialog="dialog-${option.form}"]${option.intent ? `[data-intent="${option.intent}"]` : ":not([data-intent])"}`,
        )
        .click();
      await expect(popup).toHaveJSProperty("open", false);
      const dialog = page.locator(`#dialog-${option.form}`);
      await expect(dialog).toHaveJSProperty("open", true);
      const intents = await dialog
        .locator('input[name="intent"]')
        .evaluateAll((inputs: HTMLInputElement[]) =>
          inputs
            .filter((input) => input.type === "hidden" || input.checked)
            .map((input) => input.value),
        );
      expect(intents, "the intent it starts with").toEqual(startingIntents);
    });

    test(`Contact page (${lang}): ${option.id} goes to the form page`, async ({ page }) => {
      await page.goto(site.pages.contact[lang].slice(1));
      await page
        .locator(
          `main a[href="${url(pageUrl(option.form, lang)) + (option.intent ? `?intent=${option.intent}` : "")}"]`,
        )
        .click();
      await expect(page).toHaveURL(
        new RegExp(
          `${url(pageUrl(option.form, lang))}${option.intent ? `\\?intent=${option.intent}` : ""}$`,
        ),
      );
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

test("copy button: hidden on touch screens, which can call", async ({ page, isMobile }) => {
  test.skip(!isMobile, "touch screens");
  const popup = await openContactPopup(page, "fr");
  await expect(popup.locator("[data-copy]")).toBeHidden();
});

test("copy button: copies the number and confirms", async ({ page, isMobile }) => {
  test.skip(isMobile, "desktop: touch screens hide it");
  const popup = await openContactPopup(page, "fr");
  const copy = popup.locator("[data-copy]");
  await page.evaluate(() => {
    window.copied = [];
    navigator.clipboard.writeText = (text) => {
      window.copied.push(text);
      return Promise.resolve();
    };
  });
  await expect(copy).toHaveText(copyFor("fr").contact.options.copy);
  await copy.click();
  await expect(copy).toHaveText(copyFor("fr").contact.options.copied);
  expect(await page.evaluate(() => window.copied)).toEqual([agent.phone]);
});

test.describe("without JavaScript", () => {
  test.use({ javaScriptEnabled: false });

  test("Contact page options are plain links and the copy button stays hidden", async ({
    page,
  }) => {
    await page.goto(site.pages.contact.en.slice(1));
    await expect(page.locator("main [data-copy]")).toBeHidden();
    await page.locator(`main a[href="${url(site.pages.writeMe.en)}"]`).click();
    await expect(page).toHaveURL(new RegExp(`${url(site.pages.writeMe.en)}$`));
  });
});
