// Multi-step forms (estimation, property alert), in the home page dialog and on their own page.
// Web3Forms is answered locally (support/fixtures.ts); nothing is ever sent.
import type { Locator, Page, TestInfo } from "@playwright/test";
import {
  test,
  expect,
  fields,
  present,
  submissionAt,
  type Web3FormsMode,
} from "./support/fixtures.ts";
import { site, copyFor, languages, listings, url, pageUrl, type Lang } from "./support/site.ts";
import {
  FORMS,
  FORM_ENTRIES,
  FORM_PLACES,
  openForm,
  openWriteMe,
  steps,
  visibleStep,
  stepIndex,
  next,
  back,
  skip,
  submit,
  fillStep1,
  toContactStep,
  pick,
} from "./support/forms.ts";

const isPhone = (testInfo: TestInfo) => testInfo.project.name.endsWith("-phone");

/** The computed display of each element, whether or not its step is the one shown. */
const displays = (locator: Locator) =>
  locator.evaluateAll((elements) => elements.map((element) => getComputedStyle(element).display));

for (const [key, formConfig] of FORM_ENTRIES) {
  for (const where of FORM_PLACES) {
    test.describe(`${key} in ${where}`, () => {
      test("shows step 1 of N, nothing else", async ({ page }) => {
        const form = await openForm(page, key, "fr", where);
        await expect(steps(form)).toHaveCount(formConfig.steps);
        expect(await stepIndex(form)).toBe(0);
        await expect(form.locator("[data-progress]")).toHaveText(`Étape 1 sur ${formConfig.steps}`);
        await expect(form.locator("[data-error]")).toBeHidden();
        await expect(form.locator("[data-success]")).toBeHidden();
      });

      test("step 1 is required: names, and a phone or an email", async ({ page, submissions }) => {
        const form = await openForm(page, key, "fr", where);
        await next(form);
        expect(await stepIndex(form)).toBe(0);

        const contact = formConfig.contactStep;
        await fillStep1(form, key, { phone: null, email: null });
        await form.locator(`#${formConfig.prefix}-consent`).uncheck();
        await form.locator(`#${formConfig.prefix}-email`).fill("test@example.com");
        await next(form);
        expect(await stepIndex(form), "consent unchecked").toBe(contact);
        await form.locator(`#${formConfig.prefix}-consent`).check();
        await form.locator(`#${formConfig.prefix}-email`).fill("");
        await next(form);
        expect(await stepIndex(form)).toBe(contact);
        const phone = form.locator(`#${formConfig.prefix}-phone`);
        expect(await phone.evaluate((element: HTMLInputElement) => element.validationMessage)).toBe(
          await phone.getAttribute("data-one-of-message"),
        );

        await form.locator(`#${formConfig.prefix}-email`).fill("test@example.com");
        await next(form);
        expect(await stepIndex(form), "email alone is enough").toBe(contact + 1);
        await back(form);
        await form.locator(`#${formConfig.prefix}-email`).fill("");
        await phone.fill("450 776 4895");
        await next(form);
        expect(await stepIndex(form), "phone alone is enough").toBe(contact + 1);
        expect(submissions).toHaveLength(0);
      });

      test("phone: only digits, spaces, - ( ) + can be typed; 10 to 15 digits", async ({
        page,
      }) => {
        const form = await openForm(page, key, "fr", where);
        await toContactStep(form, key);
        const phone = form.locator(`#${formConfig.prefix}-phone`);
        await phone.pressSequentially("+1 (450) abc 776;4895x");
        await expect(phone).toHaveValue("+1 (450)  7764895");
        for (const [value, valid] of [
          ["450 776 4895", true],
          ["(450) 776-4895", true],
          ["+1 450-776-4895", true],
          ["+33 1 23 45 67 89", true],
          ["776-4895", false],
          ["45+0 776 4895", false],
          ["1234567890123456", false],
        ] satisfies [string, boolean][]) {
          await phone.fill(value);
          expect(
            await phone.evaluate((element: HTMLInputElement) => element.validity.valid),
            value,
          ).toBe(valid);
        }
      });

      test("Enter moves to the next step and never sends; Back keeps values", async ({
        page,
        submissions,
      }) => {
        const form = await openForm(page, key, "fr", where);
        await fillStep1(form, key);
        await form.locator(`#${formConfig.prefix}-email`).press("Enter");
        expect(await stepIndex(form)).toBe(formConfig.contactStep + 1);
        await expect(visibleStep(form).locator("h2")).toBeFocused();
        await back(form);
        await expect(form.locator(`#${formConfig.prefix}-first-name`)).toHaveValue("Jeanne");
        expect(submissions).toHaveLength(0);
      });

      test("full path: one POST with every field, then only the success message", async ({
        page,
        submissions,
      }) => {
        const form = await openForm(page, key, "fr", where);
        await fillStep1(form, key);
        if (key === "estimation") {
          await next(form);
          await pick(form, formConfig.typeTile);
          await next(form);
          await form.locator("#est-year").fill("1990");
          await next(form);
          await pick(form, "est-bedrooms-3");
          await pick(form, "est-pool-creusee");
          await next(form);
          await form.locator("#est-purpose").selectOption({ index: 1 });
        } else {
          await next(form);
          await form.locator("#pa-tab-montreal-rive-sud").click();
          await pick(form, "pa-loc-montreal-rive-sud-brossard");
          await form.locator("#pa-tab-monteregie").click();
          await pick(form, "pa-loc-monteregie-saint-hubert");
          await form.locator("#pa-tab-montreal-rive-sud").click();
          await pick(form, "pa-loc-montreal-rive-sud-saint-hubert");
          await next(form);
          await pick(form, formConfig.typeTile);
          await form.locator("#pa-tabtype-terrain-et-ferme").click();
          await pick(form, "pa-type-terrain");
          await next(form);
          await form.locator("#pa-budget-min").fill("300000");
          await form.locator("#pa-budget-max").fill("450000");
        }
        expect(submissions, "no request while moving between steps").toHaveLength(0);
        await submit(form);
        await expect(form.locator("[data-success]")).toBeVisible();
        await expect(form.locator("[data-success]")).toBeFocused();
        await expect(form.locator("[data-step]:not([hidden])")).toHaveCount(0);
        await expect(form.locator("[data-progress]")).toBeHidden();
        await expect(form.locator("[data-error]")).toBeHidden();

        expect(submissions).toHaveLength(1);
        expect(submissionAt(submissions, 0).contentType).toMatch(
          /^multipart\/form-data; boundary=/,
        );
        const sent = fields(submissionAt(submissions, 0).body);
        expect(sent.access_key).toBe(site.web3formsKey);
        expect(sent.form_type).toBe(key === "estimation" ? "estimation" : "property_alert");
        expect(sent.subject).toBeTruthy();
        expect(sent.from_name).toBeTruthy();
        expect(sent.first_name).toBe("Jeanne");
        expect(sent.phone).toBe("450 776 4895");
        expect(sent.botcheck, "unchecked honeypot is not sent").toBeUndefined();
        expect(sent.consent).toBe("yes");
        expect(sent.intent, "buy, picked on the first step; no intent on the estimation").toBe(
          key === "propertyAlert" ? "achat" : "",
        );
        if (key === "estimation") {
          expect(sent.address).toBe("123 rue Principale");
          expect(sent.property_type).toBe(formConfig.typeValue);
          expect(sent.construction_year).toBe("1990");
          expect(sent.bedrooms).toBe("3");
          expect(sent.pool).toBe("Creusée");
          expect(sent.attachment, "no photo field").toBeUndefined();
        } else {
          expect(sent.locations, "joined in page order, each city once").toBe(
            "Brossard, Saint-Hubert",
          );
          expect(sent.property_types).toBe("Condo, Terrain");
          expect(submissionAt(submissions, 0).body.match(/name="locations"/g)).toHaveLength(1);
          expect(sent.budget_min).toBe("300000");
        }
      });

      test("skip and send: sends what is filled so far", async ({ page, submissions }) => {
        const form = await openForm(page, key, "fr", where);
        await fillStep1(form, key);
        await next(form);
        await expect(visibleStep(form).locator(".form-skip")).toBeVisible();
        await skip(form);
        await expect(form.locator("[data-success]")).toBeVisible();
        expect(submissions).toHaveLength(1);
        expect(fields(submissionAt(submissions, 0).body).last_name).toBe("Tremblay");
      });

      for (const mode of ["error", "abort", "badjson"] satisfies Web3FormsMode[]) {
        test(`server ${mode}: error shown, data kept, can resend`, async ({
          page,
          web3forms,
          submissions,
        }) => {
          const form = await openForm(page, key, "fr", where);
          await fillStep1(form, key);
          await next(form);
          web3forms.mode = mode;
          await skip(form);
          await expect(form.locator("[data-error]")).toBeVisible();
          expect(await stepIndex(form)).toBe(formConfig.contactStep + 1);
          await expect(visibleStep(form).locator("button").first()).toBeEnabled();
          await back(form);
          await expect(form.locator(`#${formConfig.prefix}-first-name`)).toHaveValue("Jeanne");
          web3forms.mode = "ok";
          await next(form);
          await skip(form);
          await expect(form.locator("[data-success]")).toBeVisible();
          await expect(form.locator("[data-error]")).toBeHidden();
          expect(submissions).toHaveLength(2);
        });
      }

      test("buttons are disabled while sending; a second click sends nothing", async ({
        page,
        web3forms,
        submissions,
      }) => {
        const form = await openForm(page, key, "fr", where);
        await fillStep1(form, key);
        await next(form);
        web3forms.delay = 500;
        const button = visibleStep(form).locator(".form-skip");
        await button.click();
        await expect(button).toBeDisabled();
        // A second click on the disabled button must not send again; the click itself may fail
        await button.click({ force: true }).catch(() => undefined);
        await expect(form.locator("[data-success]")).toBeVisible();
        expect(submissions).toHaveLength(1);
      });

      test("honeypot checked: success shown, nothing sent", async ({ page, submissions }) => {
        const form = await openForm(page, key, "fr", where);
        await fillStep1(form, key);
        await form.locator('[name="botcheck"]').evaluate((element: HTMLInputElement) => {
          element.checked = true;
        });
        await next(form);
        await skip(form);
        await expect(form.locator("[data-success]")).toBeVisible();
        expect(submissions).toHaveLength(0);
      });

      test("an invalid optional field blocks skip and send on its step", async ({
        page,
        submissions,
      }) => {
        const form = await openForm(page, key, "fr", where);
        await fillStep1(form, key);
        await next(form);
        if (key === "estimation") {
          await next(form);
          await form.locator("#est-year").fill("12");
        } else {
          await next(form);
          await next(form);
          await form.locator("#pa-budget-min").fill("500000");
          await form.locator("#pa-budget-max").fill("400000");
          const max = form.locator("#pa-budget-max");
          expect(await max.evaluate((element: HTMLInputElement) => element.validationMessage)).toBe(
            await max.getAttribute("data-gte-message"),
          );
          await back(form);
          await skip(form);
          expect(await stepIndex(form), "jumps to the step with the invalid field").toBe(4);
          await form.locator("#pa-budget-min").fill("300000");
          expect(await max.evaluate((element: HTMLInputElement) => element.validity.valid)).toBe(
            true,
          );
          return;
        }
        await skip(form);
        expect(await stepIndex(form)).toBe(2);
        expect(submissions).toHaveLength(0);
      });
    });
  }
}

for (const lang of languages) {
  for (const where of FORM_PLACES) {
    test.describe(`writeMe in ${where} (${lang})`, () => {
      const fill = async (form: Locator) => {
        await form.locator("#ct-first-name").fill("Jeanne");
        await form.locator("#ct-last-name").fill("Tremblay");
        await form.locator("#ct-email").fill("test@example.com");
        await form.locator("#ct-message").fill("Bonjour");
        await form.locator("#ct-consent").check();
      };
      const send = (form: Locator) => form.locator('button[type="submit"]').click();

      test("title from i18n, one step, no progress bar", async ({ page }) => {
        const form = await openWriteMe(page, lang, where);
        await expect(page.locator(where === "page" ? "h1" : "#dialog-writeMe-title")).toHaveText(
          copyFor(lang).forms.writeMe.title,
        );
        await expect(steps(form)).toHaveCount(1);
        await expect(form.locator("[data-progress]")).toHaveCount(0);
      });

      test("names, a phone or an email, a message and consent are required", async ({
        page,
        submissions,
      }) => {
        const form = await openWriteMe(page, lang, where);
        await send(form);
        expect(submissions).toHaveLength(0);
        await fill(form);
        for (const [id, value] of [
          ["#ct-first-name", "Jeanne"],
          ["#ct-message", "Bonjour"],
        ] satisfies [string, string][]) {
          await form.locator(id).fill("");
          await send(form);
          expect(submissions, id).toHaveLength(0);
          await form.locator(id).fill(value);
        }
        await form.locator("#ct-email").fill("");
        await send(form);
        const phone = form.locator("#ct-phone");
        expect(await phone.evaluate((element: HTMLInputElement) => element.validationMessage)).toBe(
          await phone.getAttribute("data-one-of-message"),
        );
        expect(submissions).toHaveLength(0);
        await phone.fill("450 776 4895");
        await form.locator("#ct-consent").uncheck();
        await send(form);
        expect(submissions).toHaveLength(0);
      });

      test("sends one POST and shows the success message", async ({ page, submissions }) => {
        const form = await openWriteMe(page, lang, where);
        await fill(form);
        await send(form);
        await expect(form.locator("[data-success]")).toBeVisible();
        await expect(form.locator("[data-success]")).toBeFocused();
        expect(submissions).toHaveLength(1);
        const sent = fields(submissionAt(submissions, 0).body);
        expect(sent.access_key).toBe(site.web3formsKey);
        expect(sent.form_type).toBe("contact");
        expect(sent.first_name).toBe("Jeanne");
        expect(sent.email).toBe("test@example.com");
        expect(sent.message).toBe("Bonjour");
        expect(sent.consent).toBe("yes");
        expect(sent.botcheck).toBeUndefined();
      });

      test("server error: error shown, data kept, can resend", async ({
        page,
        web3forms,
        submissions,
      }) => {
        const form = await openWriteMe(page, lang, where);
        await fill(form);
        web3forms.mode = "error";
        await send(form);
        await expect(form.locator("[data-error]")).toBeVisible();
        await expect(form.locator("#ct-message")).toHaveValue("Bonjour");
        web3forms.mode = "ok";
        await send(form);
        await expect(form.locator("[data-success]")).toBeVisible();
        await expect(form.locator("[data-error]")).toBeHidden();
        expect(submissions).toHaveLength(2);
      });

      test("honeypot checked: success shown, nothing sent", async ({ page, submissions }) => {
        const form = await openWriteMe(page, lang, where);
        await fill(form);
        await form.locator('[name="botcheck"]').evaluate((element: HTMLInputElement) => {
          element.checked = true;
        });
        await send(form);
        await expect(form.locator("[data-success]")).toBeVisible();
        expect(submissions).toHaveLength(0);
      });
    });
  }
}

for (const [lang, path] of [
  ["fr", "fr/"],
  ["en", "en/"],
  ["en", "listings/"],
] satisfies [Lang, string][]) {
  test.describe(`property info dialog on ${path}`, () => {
    const open = async (page: Page) => {
      const button = page.locator("[data-property-info]").first();
      await button.click();
      const dialog = page.locator("#dialog-propertyInfo");
      await expect(dialog).toHaveJSProperty("open", true);
      return { button, dialog, form: dialog.locator("form[data-wizard]") };
    };

    test("one shared dialog, filled from the clicked card; the email carries the property", async ({
      page,
      submissions,
    }) => {
      await page.goto(path);
      await expect(page.locator("dialog#dialog-propertyInfo")).toHaveCount(1);
      await expect(page.locator("html")).toHaveAttribute("lang", lang);
      const item = present(listings[0], "a listing in content/listings/listings.json");
      const { dialog, form } = await open(page);
      const address = item.flag_show_addresse ? item.address.display[lang] : "";
      await expect(dialog.locator(".form-panel__title")).toHaveText(
        copyFor(lang).forms.propertyInfo.title,
      );
      await expect(dialog.locator("[data-property-label]")).toContainText(item.property_kind[lang]);
      await expect(dialog.locator('a[href^="tel:"]')).toBeVisible();
      await form.locator("#pi-name").fill("Jeanne Tremblay");
      await form.locator("#pi-email").fill("test@example.com");
      await form.locator("#pi-consent").check();
      await form.locator('button[type="submit"]').click();
      await expect(form.locator("[data-success]")).toBeVisible();
      const sent = fields(submissionAt(submissions, 0).body);
      expect(sent.form_type).toBe("property-info");
      expect(sent.listing_number).toBe(String(item.no_inscription));
      expect(sent.property_address).toBe(address);
      expect(sent.subject).toContain(String(item.no_inscription));
      expect(sent.subject).toContain(item.property_kind[lang]);
      expect(sent.name).toBe("Jeanne Tremblay");
      expect(sent.message, "message is optional").toBe("");
    });

    test("a phone or an email, a name and consent are required", async ({ page, submissions }) => {
      await page.goto(path);
      const { form } = await open(page);
      const send = form.locator('button[type="submit"]');
      await send.click();
      await form.locator("#pi-name").fill("Jeanne");
      await form.locator("#pi-consent").check();
      await send.click();
      const phone = form.locator("#pi-phone");
      expect(await phone.evaluate((element: HTMLInputElement) => element.validationMessage)).toBe(
        await phone.getAttribute("data-one-of-message"),
      );
      expect(submissions).toHaveLength(0);
    });

    test("the fields follow the clicked button; a sent form starts over", async ({
      page,
      submissions,
    }) => {
      await page.goto(path);
      const { button, dialog, form } = await open(page);
      await dialog.locator(".form-panel__close").click();
      await expect(dialog).toHaveJSProperty("open", false);
      await expect(button, "focus returns to the button").toBeFocused();
      // The data holds one listing today: stand in for a second card, with no address to show.
      await button.evaluate((element: HTMLElement) => {
        element.dataset.listingNumber = "99999999";
        element.dataset.propertyAddress = "";
        element.dataset.subject = "S 99999999";
        element.dataset.propertyLabel = "Condo";
      });
      await open(page);
      await expect(form.locator('input[name="listing_number"]')).toHaveValue("99999999");
      await expect(form.locator('input[name="property_address"]')).toHaveValue("");
      await expect(dialog.locator("[data-property-label]")).toHaveText("Condo");
      await form.locator("#pi-name").fill("Jeanne");
      await form.locator("#pi-email").fill("test@example.com");
      await form.locator("#pi-consent").check();
      await form.locator('button[type="submit"]').click();
      await expect(form.locator("[data-success]")).toBeVisible();
      expect(fields(submissionAt(submissions, 0).body).subject).toBe("S 99999999");
      await dialog.locator(".form-panel__close").click();
      await open(page);
      await expect(form.locator("[data-success]")).toBeHidden();
      await expect(form.locator("#pi-name")).toHaveValue("");
      await expect(form.locator('input[name="listing_number"]')).toHaveValue("99999999");
      await expect(form.locator('input[name="subject"]')).toHaveValue("S 99999999");
      expect(submissions).toHaveLength(1);
    });
  });
}

test.describe("tabs and choice controls", () => {
  test("region tabs: one panel at a time, arrow keys, selections kept across tabs", async ({
    page,
  }) => {
    const form = await openForm(page, "propertyAlert", "fr", "page");
    await fillStep1(form, "propertyAlert");
    await next(form);
    const tabs = form.locator("[data-tabs]").first().locator('[role="tab"]');
    await expect(tabs.first()).toHaveAttribute("aria-selected", "true");
    await tabs.first().focus();
    await page.keyboard.press("ArrowRight");
    await expect(tabs.nth(1)).toBeFocused();
    await expect(tabs.nth(1)).toHaveAttribute("aria-selected", "true");
    await expect(form.locator("#pa-region-montreal-ile")).toBeHidden();
    await page.keyboard.press("ArrowLeft");
    await page.keyboard.press("ArrowLeft");
    await expect(tabs.last()).toHaveAttribute("aria-selected", "true");
    await pick(form, "pa-loc-lanaudiere-lavaltrie");
    await tabs.first().click();
    await expect(form.locator("#pa-loc-lanaudiere-lavaltrie")).toBeChecked();
  });

  test("Enter on a tab selects it without changing step; other keys do nothing", async ({
    page,
    submissions,
  }) => {
    const form = await openForm(page, "propertyAlert", "fr", "page");
    await fillStep1(form, "propertyAlert");
    await next(form);
    const tabs = form.locator("[data-tabs]").first().locator('[role="tab"]');
    await tabs.nth(2).focus();
    await page.keyboard.press("Enter");
    await expect(tabs.nth(2)).toHaveAttribute("aria-selected", "true");
    expect(await stepIndex(form)).toBe(2);
    await page.keyboard.press("Home");
    await page.keyboard.press("a");
    await expect(tabs.nth(2)).toHaveAttribute("aria-selected", "true");
    await expect(tabs.nth(2)).toBeFocused();
    expect(submissions).toHaveLength(0);
  });

  test("estimation property type: one choice across category tabs", async ({ page }) => {
    const form = await openForm(page, "estimation", "fr", "page");
    await fillStep1(form, "estimation");
    await next(form);
    await pick(form, "est-type-duplex");
    await form.locator("#est-tabtype-commercial").click();
    await pick(form, "est-type-condo-commercial");
    await expect(form.locator("#est-type-duplex")).not.toBeChecked();
    await expect(form.locator("#est-type-condo-commercial")).toBeChecked();
  });

  test("segmented control: one value per question", async ({ page }) => {
    const form = await openForm(page, "estimation", "fr", "page");
    await fillStep1(form, "estimation");
    await next(form);
    await next(form);
    await next(form);
    await pick(form, "est-bedrooms-2");
    await pick(form, "est-bedrooms-4");
    await expect(form.locator('input[name="bedrooms"]:checked')).toHaveValue("4");
    await expect(form.locator('label[for="est-bedrooms-4"]')).toHaveCSS(
      "color",
      "rgb(255, 255, 255)",
    );
  });
});

test.describe("dialog", () => {
  for (const lang of languages) {
    test(`(${lang}) X, Annuler and Escape close it; reopening keeps the values; page cannot scroll behind`, async ({
      page,
    }) => {
      const form = await openForm(page, "estimation", lang, "dialog");
      const dialog = page.locator("#dialog-estimation");
      await expect(dialog.locator(".form-panel__title")).toHaveText(
        copyFor(lang).forms.estimation.title,
      );
      expect(await page.evaluate(() => getComputedStyle(document.documentElement).overflow)).toBe(
        "hidden",
      );
      await form.locator("#est-address").fill("1 rue A");

      await dialog.locator(".form-panel__close").click();
      await expect(dialog).toHaveJSProperty("open", false);
      expect(page.url()).toMatch(new RegExp(`/ced/${lang}/$`));

      await page.locator('a[data-dialog="dialog-estimation"]').first().click();
      await expect(form.locator("#est-address")).toHaveValue("1 rue A");
      await dialog.locator(".form-cancel").click();
      await expect(dialog).toHaveJSProperty("open", false);

      await page.locator('a[data-dialog="dialog-estimation"]').first().click();
      await page.keyboard.press("Escape");
      await expect(dialog).toHaveJSProperty("open", false);
    });
  }

  test("reopening after a sent request starts over; a failed one is kept", async ({
    page,
    web3forms,
  }) => {
    const form = await openForm(page, "propertyAlert", "fr", "dialog");
    const dialog = page.locator("#dialog-propertyAlert");
    const reopen = async () => {
      await dialog.locator(".form-panel__close").click();
      await page.locator('a[data-dialog="dialog-propertyAlert"]').first().click();
    };
    await fillStep1(form, "propertyAlert");
    await next(form);
    web3forms.mode = "error";
    await skip(form);
    await expect(form.locator("[data-error]")).toBeVisible();
    await reopen();
    await expect(form.locator("[data-error]"), "failed request kept").toBeVisible();
    await expect(form.locator("#pa-first-name")).toHaveValue("Jeanne");

    web3forms.mode = "ok";
    await skip(form);
    await expect(form.locator("[data-success]")).toBeVisible();
    await reopen();
    await expect(form.locator("[data-success]")).toBeHidden();
    await expect(form.locator("[data-error]")).toBeHidden();
    expect(await stepIndex(form)).toBe(0);
    await expect(form.locator("[data-progress]")).toHaveText(
      `Étape 1 sur ${FORMS.propertyAlert.steps}`,
    );
    await expect(form.locator("#pa-first-name")).toHaveValue("");
    await expect(form.locator("#pa-consent")).not.toBeChecked();
  });

  for (const lang of languages) {
    test(`(${lang}) the search button opens the alert; buy or rent sets the intent, the subject and the texts`, async ({
      page,
      submissions,
    }) => {
      await page.goto(`${lang}/`);
      const dialog = page.locator("#dialog-propertyAlert");
      const form = dialog.locator("form[data-wizard]");
      const subject = form.locator('input[name="subject"]');
      const rental = await subject.getAttribute("data-subject-location");
      const plain = await subject.getAttribute("value");
      const rentTexts = form.locator('[data-when-intent="location"]');
      const buyTexts = form.locator('[data-when-intent="achat"]');

      await page.locator('.service--search a[data-dialog="dialog-propertyAlert"]').click();
      await expect(dialog).toHaveJSProperty("open", true);
      await expect(form.locator('input[name="intent"]:checked'), "nothing chosen yet").toHaveCount(
        0,
      );
      await fillStep1(form, "propertyAlert", { intent: "location" });
      expect(await displays(rentTexts), "rent wording shown").not.toContain("none");
      expect(await displays(buyTexts), "buy wording hidden").toEqual(
        Array.from({ length: await buyTexts.count() }, () => "none"),
      );
      await next(form);
      await skip(form);
      await expect(form.locator("[data-success]")).toBeVisible();
      let sent = fields(submissionAt(submissions, 0).body);
      expect(sent.intent).toBe("location");
      expect(sent.subject).toBe(rental);

      await dialog.locator(".form-panel__close").click();
      await page.locator('.service--search a[data-dialog="dialog-propertyAlert"]').click();
      await expect(
        form.locator('input[name="intent"]:checked'),
        "a sent form starts over",
      ).toHaveCount(0);
      expect(await displays(buyTexts), "back to the buy wording").not.toContain("none");
      await fillStep1(form, "propertyAlert", { intent: "achat" });
      await next(form);
      await skip(form);
      await expect(form.locator("[data-success]")).toBeVisible();
      sent = fields(submissionAt(submissions, 1).body);
      expect(sent.intent).toBe("achat");
      expect(sent.subject).toBe(plain);
    });
  }

  test("the sell button opens the estimation without an intent", async ({ page, submissions }) => {
    await page.goto("en/");
    const form = page.locator("#dialog-estimation form[data-wizard]");
    await page.locator('.service--sell a[data-dialog="dialog-estimation"]').click();
    await fillStep1(form, "estimation");
    await next(form);
    await skip(form);
    await expect(form.locator("[data-success]")).toBeVisible();
    const sent = fields(submissionAt(submissions, 0).body);
    expect(sent.intent).toBe("");
    expect(sent.subject).toBe(await form.locator('input[name="subject"]').getAttribute("value"));
  });

  test("backdrop click closes on desktop; a tap below the form on a phone does not", async ({
    page,
  }, testInfo) => {
    await openForm(page, "propertyAlert", "fr", "dialog");
    const dialog = page.locator("#dialog-propertyAlert");
    const box = present(await dialog.boundingBox(), "the dialog's box");
    const viewport = present(page.viewportSize(), "a viewport size");
    if (isPhone(testInfo)) {
      expect(Math.round(box.width)).toBe(viewport.width);
      await page.mouse.click(viewport.width / 2, viewport.height - 5);
      await expect(dialog).toHaveJSProperty("open", true);
    } else {
      await page.mouse.click(box.x + 20, box.y + box.height - 6);
      await expect(dialog, "click inside the card").toHaveJSProperty("open", true);
      await page.mouse.click(10, viewport.height / 2);
      await expect(dialog).toHaveJSProperty("open", false);
    }
  });
});

test.describe("form pages", () => {
  test("X and Annuler go back to the home page", async ({ page }) => {
    await openForm(page, "propertyAlert", "en", "page");
    await page.locator(".form-panel__close").click();
    await expect(page).toHaveURL(/\/ced\/en\/$/);
    await openForm(page, "propertyAlert", "en", "page");
    await page.locator(".form-cancel").click();
    await expect(page).toHaveURL(/\/ced\/en\/$/);
  });

  test("?intent=location picks Rent; an unknown intent leaves the choice to the visitor", async ({
    page,
    submissions,
  }) => {
    for (const [query, intent] of [
      ["?intent=location", "location"],
      ["?intent=hack", "achat"],
    ] satisfies [string, string][]) {
      await page.goto(site.pages.propertyAlert.fr.slice(1) + query);
      const form = page.locator("form[data-wizard]");
      await expect(form.locator('input[name="intent"]:checked')).toHaveCount(
        query === "?intent=location" ? 1 : 0,
      );
      await fillStep1(form, "propertyAlert");
      await next(form);
      await skip(form);
      await expect(form.locator("[data-success]")).toBeVisible();
      const sent = fields(submissionAt(submissions, -1).body);
      expect(sent.intent, query).toBe(intent);
      const subject = form.locator('input[name="subject"]');
      expect(sent.subject).toBe(
        await subject.getAttribute(intent === "location" ? "data-subject-location" : "value"),
      );
    }
  });

  test("English pages show English steps", async ({ page }) => {
    const form = await openForm(page, "estimation", "en", "page");
    await expect(form.locator("[data-progress]")).toHaveText(`Step 1 of ${FORMS.estimation.steps}`);
    await expect(page.locator("h1")).toHaveText(copyFor("en").forms.estimation.title);
  });
});

test.describe("without JavaScript", () => {
  test.use({ javaScriptEnabled: false });

  for (const [key] of FORM_ENTRIES) {
    test(`${key}: one long form with browser validation, posts to Web3Forms`, async ({
      page,
      submissions,
    }) => {
      await page.goto(pageUrl(key, "fr").slice(1));
      const form = page.locator("form[data-wizard]");
      for (const step of await form.locator("[data-step]").all()) {
        await expect(step).toBeVisible();
      }
      await expect(form.locator("[data-next], [data-back], .form-skip").first()).toBeHidden();
      const send = form.locator('button[type="submit"]:not(.form-skip)');
      await expect(send).toHaveCount(1);
      await expect(send).toBeVisible();
      expect(await form.evaluate((formElement: HTMLFormElement) => formElement.noValidate)).toBe(
        false,
      );

      await send.click();
      expect(submissions, "required fields block the browser submit").toHaveLength(0);
      await fillStep1(form, key);
      await Promise.all([page.waitForURL("https://api.web3forms.com/submit"), send.click()]);
      expect(submissions).toHaveLength(1);
      const sent = new URLSearchParams(submissionAt(submissions, 0).body);
      expect(sent.get("first_name")).toBe("Jeanne");
      expect(sent.get("consent")).toBe("yes");
    });
  }

  test("property alert: choosing Rent switches the wording without JS", async ({ page }) => {
    await page.goto(site.pages.propertyAlert.fr.slice(1));
    const form = page.locator("form[data-wizard]");
    const rentTexts = form.locator('[data-when-intent="location"]');
    const buyTexts = form.locator('[data-when-intent="achat"]');
    await expect(buyTexts.first()).toBeVisible();
    await expect(rentTexts.first()).toBeHidden();
    await pick(form, "pa-intent-location");
    await expect(rentTexts.first()).toBeVisible();
    await expect(buyTexts.first()).toBeHidden();
  });

  test("property cards: a link to the Contact page instead of the button", async ({ page }) => {
    await page.goto("fr/");
    const card = page.locator("#properties .card").first();
    await expect(card.locator("button[data-property-info]")).toBeHidden();
    await card.locator("a.card__more").click();
    await expect(page).toHaveURL(new RegExp(`${url(site.pages.contact.fr)}$`));
  });

  test("writeMe: posts straight to Web3Forms", async ({ page, submissions }) => {
    await page.goto(site.pages.writeMe.fr.slice(1));
    const form = page.locator("form[data-wizard]");
    await form.locator("#ct-first-name").fill("Jeanne");
    await form.locator("#ct-last-name").fill("Tremblay");
    await form.locator("#ct-email").fill("test@example.com");
    await form.locator("#ct-message").fill("Bonjour");
    await form.locator("#ct-consent").check();
    await Promise.all([
      page.waitForURL("https://api.web3forms.com/submit"),
      form.locator('button[type="submit"]').click(),
    ]);
    expect(new URLSearchParams(submissionAt(submissions, 0).body).get("form_type")).toBe("contact");
  });
});
