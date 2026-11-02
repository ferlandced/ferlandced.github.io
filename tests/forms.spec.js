// Multi-step forms (estimation, property alert), in the home page dialog and on their own page.
// Web3Forms is answered locally (support/fixtures.js); nothing is ever sent.
import { test, expect, fields } from "./support/fixtures.js";
import { site, t, languages } from "./support/site.js";
import { FORMS, openForm, steps, visibleStep, stepIndex, next, back, skip, submit, fillStep1, pick } from "./support/forms.js";

const isPhone = (testInfo) => testInfo.project.name.endsWith("-phone");

for (const [key, f] of Object.entries(FORMS)) {
  for (const where of ["dialog", "page"]) {
    test.describe(`${key} in ${where}`, () => {
      test("shows step 1 of N, nothing else", async ({ page }) => {
        const form = await openForm(page, key, "fr", where);
        await expect(steps(form)).toHaveCount(f.steps);
        expect(await stepIndex(form)).toBe(0);
        await expect(form.locator("[data-progress]")).toHaveText(`Étape 1 sur ${f.steps}`);
        await expect(form.locator("[data-error]")).toBeHidden();
        await expect(form.locator("[data-success]")).toBeHidden();
      });

      test("step 1 is required: names, and a phone or an email", async ({ page, submissions }) => {
        const form = await openForm(page, key, "fr", where);
        await next(form);
        expect(await stepIndex(form)).toBe(0);

        await fillStep1(form, key, { phone: null, email: null });
        await form.locator(`#${f.prefix}-consent`).uncheck();
        await form.locator(`#${f.prefix}-email`).fill("test@example.com");
        await next(form);
        expect(await stepIndex(form), "consent unchecked").toBe(0);
        await form.locator(`#${f.prefix}-consent`).check();
        await form.locator(`#${f.prefix}-email`).fill("");
        await next(form);
        expect(await stepIndex(form)).toBe(0);
        const phone = form.locator(`#${f.prefix}-phone`);
        expect(await phone.evaluate((e) => e.validationMessage)).toBe(await phone.getAttribute("data-one-of-message"));

        await form.locator(`#${f.prefix}-email`).fill("test@example.com");
        await next(form);
        expect(await stepIndex(form), "email alone is enough").toBe(1);
        await back(form);
        await form.locator(`#${f.prefix}-email`).fill("");
        await phone.fill("450 776 4895");
        await next(form);
        expect(await stepIndex(form), "phone alone is enough").toBe(1);
        expect(submissions).toHaveLength(0);
      });

      test("phone: only digits, spaces, - ( ) + can be typed; 10 to 15 digits", async ({ page }) => {
        const form = await openForm(page, key, "fr", where);
        const phone = form.locator(`#${f.prefix}-phone`);
        await phone.pressSequentially("+1 (450) abc 776;4895x");
        await expect(phone).toHaveValue("+1 (450)  7764895");
        for (const [value, valid] of [["450 776 4895", true], ["(450) 776-4895", true], ["+1 450-776-4895", true], ["+33 1 23 45 67 89", true],
          ["776-4895", false], ["45+0 776 4895", false], ["1234567890123456", false]]) {
          await phone.fill(value);
          expect(await phone.evaluate((e) => e.validity.valid), value).toBe(valid);
        }
      });

      test("Enter moves to the next step and never sends; Back keeps values", async ({ page, submissions }) => {
        const form = await openForm(page, key, "fr", where);
        await fillStep1(form, key);
        await form.locator(`#${f.prefix}-email`).press("Enter");
        expect(await stepIndex(form)).toBe(1);
        await expect(visibleStep(form).locator("h2")).toBeFocused();
        await back(form);
        await expect(form.locator(`#${f.prefix}-first-name`)).toHaveValue("Jeanne");
        expect(submissions).toHaveLength(0);
      });

      test("full path: one POST with every field, then only the success message", async ({ page, submissions }) => {
        const form = await openForm(page, key, "fr", where);
        await fillStep1(form, key);
        if (key === "estimation") {
          await next(form); await pick(form, f.typeTile);
          await next(form); await form.locator("#est-year").fill("1990");
          await next(form); await pick(form, "est-bedrooms-3"); await pick(form, "est-pool-creusee");
          await next(form); await form.locator("#est-purpose").selectOption({ index: 1 });
        } else {
          await next(form);
          await form.locator("#pa-tab-montreal-rive-sud").click(); await pick(form, "pa-loc-montreal-rive-sud-brossard");
          await form.locator("#pa-tab-monteregie").click(); await pick(form, "pa-loc-monteregie-saint-hubert");
          await form.locator("#pa-tab-montreal-rive-sud").click(); await pick(form, "pa-loc-montreal-rive-sud-saint-hubert");
          await next(form); await pick(form, f.typeTile);
          await form.locator("#pa-tabtype-terrain-ferme").click(); await pick(form, "pa-type-terrain");
          await next(form); await form.locator("#pa-budget-min").fill("300000"); await form.locator("#pa-budget-max").fill("450000");
        }
        expect(submissions, "no request while moving between steps").toHaveLength(0);
        await submit(form);
        await expect(form.locator("[data-success]")).toBeVisible();
        await expect(form.locator("[data-success]")).toBeFocused();
        await expect(form.locator("[data-step]:not([hidden])")).toHaveCount(0);
        await expect(form.locator("[data-progress]")).toBeHidden();
        await expect(form.locator("[data-error]")).toBeHidden();

        expect(submissions).toHaveLength(1);
        expect(submissions[0].contentType).toMatch(/^multipart\/form-data; boundary=/);
        const sent = fields(submissions[0].body);
        expect(sent.access_key).toBe(site.web3formsKey);
        expect(sent.form_type).toBe(key === "estimation" ? "estimation" : "property_alert");
        expect(sent.subject).toBeTruthy();
        expect(sent.from_name).toBeTruthy();
        expect(sent.first_name).toBe("Jeanne");
        expect(sent.phone).toBe("450 776 4895");
        expect(sent.botcheck, "unchecked honeypot is not sent").toBeUndefined();
        expect(sent.consent).toBe("yes");
        expect(sent.intent, "no intent from a plain link").toBe("");
        if (key === "estimation") {
          expect(sent.address).toBe("123 rue Principale");
          expect(sent.property_type).toBe(f.typeValue);
          expect(sent.construction_year).toBe("1990");
          expect(sent.bedrooms).toBe("3");
          expect(sent.pool).toBe("Creusée");
          expect(sent.attachment, "no photo field").toBeUndefined();
        } else {
          expect(sent.locations, "joined in page order, each city once").toBe("Brossard, Saint-Hubert");
          expect(sent.property_types).toBe("Condo, Terrain");
          expect(submissions[0].body.match(/name="locations"/g)).toHaveLength(1);
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
        expect(fields(submissions[0].body).last_name).toBe("Tremblay");
      });

      for (const mode of ["error", "abort", "badjson"]) {
        test(`server ${mode}: error shown, data kept, can resend`, async ({ page, web3forms, submissions }) => {
          const form = await openForm(page, key, "fr", where);
          await fillStep1(form, key);
          await next(form);
          web3forms.mode = mode;
          await skip(form);
          await expect(form.locator("[data-error]")).toBeVisible();
          expect(await stepIndex(form)).toBe(1);
          await expect(visibleStep(form).locator("button").first()).toBeEnabled();
          await back(form);
          await expect(form.locator(`#${f.prefix}-first-name`)).toHaveValue("Jeanne");
          web3forms.mode = "ok";
          await next(form);
          await skip(form);
          await expect(form.locator("[data-success]")).toBeVisible();
          await expect(form.locator("[data-error]")).toBeHidden();
          expect(submissions).toHaveLength(2);
        });
      }

      test("buttons are disabled while sending; a second click sends nothing", async ({ page, web3forms, submissions }) => {
        const form = await openForm(page, key, "fr", where);
        await fillStep1(form, key);
        await next(form);
        web3forms.delay = 500;
        const button = visibleStep(form).locator(".form-skip");
        await button.click();
        await expect(button).toBeDisabled();
        await button.click({ force: true }).catch(() => {});
        await expect(form.locator("[data-success]")).toBeVisible();
        expect(submissions).toHaveLength(1);
      });

      test("honeypot checked: success shown, nothing sent", async ({ page, submissions }) => {
        const form = await openForm(page, key, "fr", where);
        await fillStep1(form, key);
        await form.locator('[name="botcheck"]').evaluate((e) => { e.checked = true; });
        await next(form);
        await skip(form);
        await expect(form.locator("[data-success]")).toBeVisible();
        expect(submissions).toHaveLength(0);
      });

      test("an invalid optional field blocks skip and send on its step", async ({ page, submissions }) => {
        const form = await openForm(page, key, "fr", where);
        await fillStep1(form, key);
        await next(form);
        if (key === "estimation") {
          await next(form);
          await form.locator("#est-year").fill("12");
        } else {
          await next(form); await next(form);
          await form.locator("#pa-budget-min").fill("500000");
          await form.locator("#pa-budget-max").fill("400000");
          const max = form.locator("#pa-budget-max");
          expect(await max.evaluate((e) => e.validationMessage)).toBe(await max.getAttribute("data-gte-message"));
          await back(form);
          await skip(form);
          expect(await stepIndex(form), "jumps to the step with the invalid field").toBe(3);
          await form.locator("#pa-budget-min").fill("300000");
          expect(await max.evaluate((e) => e.validity.valid)).toBe(true);
          return;
        }
        await skip(form);
        expect(await stepIndex(form)).toBe(2);
        expect(submissions).toHaveLength(0);
      });
    });
  }
}

test.describe("tabs and choice controls", () => {
  test("region tabs: one panel at a time, arrow keys, selections kept across tabs", async ({ page }) => {
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

  test("Enter on a tab selects it without changing step; other keys do nothing", async ({ page, submissions }) => {
    const form = await openForm(page, "propertyAlert", "fr", "page");
    await fillStep1(form, "propertyAlert");
    await next(form);
    const tabs = form.locator("[data-tabs]").first().locator('[role="tab"]');
    await tabs.nth(2).focus();
    await page.keyboard.press("Enter");
    await expect(tabs.nth(2)).toHaveAttribute("aria-selected", "true");
    expect(await stepIndex(form)).toBe(1);
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
    await next(form); await next(form); await next(form);
    await pick(form, "est-bedrooms-2");
    await pick(form, "est-bedrooms-4");
    await expect(form.locator('input[name="bedrooms"]:checked')).toHaveValue("4");
    await expect(form.locator('label[for="est-bedrooms-4"]')).toHaveCSS("color", "rgb(255, 255, 255)");
  });
});

test.describe("dialog", () => {
  for (const lang of languages) {
    test(`(${lang}) X, Annuler and Escape close it; reopening keeps the values; page cannot scroll behind`, async ({ page }) => {
      const form = await openForm(page, "estimation", lang, "dialog");
      const dialog = page.locator("#dialog-estimation");
      await expect(dialog.locator(".form-panel__title")).toHaveText(t(lang).forms.estimation.title);
      expect(await page.evaluate(() => getComputedStyle(document.documentElement).overflow)).toBe("hidden");
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

  test("reopening after a sent request starts over; a failed one is kept", async ({ page, web3forms }) => {
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
    await expect(form.locator("[data-progress]")).toHaveText("Étape 1 sur 4");
    await expect(form.locator("#pa-first-name")).toHaveValue("");
    await expect(form.locator("#pa-consent")).not.toBeChecked();
  });

  for (const [key, lang] of [["propertyAlert", "fr"], ["estimation", "en"]]) {
    test(`rental button opens ${key} (${lang}) with the rental intent and subject; buy/sell does not`, async ({ page, submissions }) => {
      await page.goto(`${lang}/`);
      const dialog = page.locator(`#dialog-${key}`);
      const form = dialog.locator("form[data-wizard]");
      const subject = form.locator('input[name="subject"]');
      const rental = await subject.getAttribute("data-subject-location");
      const plain = await subject.getAttribute("value");

      await page.locator(`.service--rent a[data-dialog="dialog-${key}"]`).click();
      await fillStep1(form, key);
      await next(form);
      await skip(form);
      await expect(form.locator("[data-success]")).toBeVisible();
      let sent = fields(submissions[0].body);
      expect(sent.intent).toBe("location");
      expect(sent.subject).toBe(rental);

      await dialog.locator(".form-panel__close").click();
      await page.locator(`.service--${key === "estimation" ? "sell" : "buy"} a[data-dialog="dialog-${key}"]`).click();
      await fillStep1(form, key);
      await next(form);
      await skip(form);
      await expect(form.locator("[data-success]")).toBeVisible();
      sent = fields(submissions[1].body);
      expect(sent.intent).toBe("");
      expect(sent.subject).toBe(plain);
    });
  }

  test("backdrop click closes on desktop; a tap below the form on a phone does not", async ({ page }, testInfo) => {
    await openForm(page, "propertyAlert", "fr", "dialog");
    const dialog = page.locator("#dialog-propertyAlert");
    const box = await dialog.boundingBox();
    const vp = page.viewportSize();
    if (isPhone(testInfo)) {
      expect(Math.round(box.width)).toBe(vp.width);
      await page.mouse.click(vp.width / 2, vp.height - 5);
      await expect(dialog).toHaveJSProperty("open", true);
    } else {
      await page.mouse.click(box.x + 20, box.y + box.height - 6);
      await expect(dialog, "click inside the card").toHaveJSProperty("open", true);
      await page.mouse.click(10, vp.height / 2);
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

  test("?intent=location sets the rental intent; an unknown intent is ignored", async ({ page, submissions }) => {
    for (const [query, intent] of [["?intent=location", "location"], ["?intent=hack", ""]]) {
      await page.goto(site.pages.propertyAlert.fr.slice(1) + query);
      const form = page.locator("form[data-wizard]");
      await fillStep1(form, "propertyAlert");
      await next(form);
      await skip(form);
      await expect(form.locator("[data-success]")).toBeVisible();
      const sent = fields(submissions.at(-1).body);
      expect(sent.intent, query).toBe(intent);
      const subject = form.locator('input[name="subject"]');
      expect(sent.subject).toBe(await subject.getAttribute(intent ? "data-subject-location" : "value"));
    }
  });

  test("English pages show English steps", async ({ page }) => {
    const form = await openForm(page, "estimation", "en", "page");
    await expect(form.locator("[data-progress]")).toHaveText(`Step 1 of ${FORMS.estimation.steps}`);
    await expect(page.locator("h1")).toHaveText(t("en").forms.estimation.title);
  });
});

test.describe("without JavaScript", () => {
  test.use({ javaScriptEnabled: false });

  for (const key of Object.keys(FORMS)) {
    test(`${key}: one long form with browser validation, posts to Web3Forms`, async ({ page, submissions }) => {
      await page.goto(site.pages[key].fr.slice(1));
      const form = page.locator("form[data-wizard]");
      for (const step of await form.locator("[data-step]").all()) await expect(step).toBeVisible();
      await expect(form.locator("[data-next], [data-back], .form-skip").first()).toBeHidden();
      const send = form.locator('button[type="submit"]:not(.form-skip)');
      await expect(send).toHaveCount(1);
      await expect(send).toBeVisible();
      expect(await form.evaluate((f) => f.noValidate)).toBe(false);

      await send.click();
      expect(submissions, "required fields block the browser submit").toHaveLength(0);
      await fillStep1(form, key);
      await Promise.all([page.waitForURL("https://api.web3forms.com/submit"), send.click()]);
      expect(submissions).toHaveLength(1);
      const sent = new URLSearchParams(submissions[0].body);
      expect(sent.get("first_name")).toBe("Jeanne");
      expect(sent.get("consent")).toBe("yes");
    });
  }
});
