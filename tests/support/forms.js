// Helpers to drive the multi-step forms, in the home page dialog or on their own page.
import { expect } from "./fixtures.js";
import { site } from "./site.js";

export const FORMS = {
  estimation: { prefix: "est", steps: 5, typeTile: "est-type-duplex", typeValue: "Duplex" },
  propertyAlert: { prefix: "pa", steps: 4, typeTile: "pa-type-condo", typeValue: "Condo" },
};

/** Opens a form and returns a locator scoped to it. where: "dialog" (home page) or "page" (form page). */
export async function openForm(page, key, lang, where) {
  if (where === "page") {
    await page.goto(site.pages[key][lang].slice(1));
    return page.locator("form[data-wizard]");
  }
  await page.goto(`${lang}/`);
  await page.locator(`a[data-dialog="dialog-${key}"]`).first().click();
  const dialog = page.locator(`#dialog-${key}`);
  await expect(dialog).toHaveJSProperty("open", true);
  return dialog.locator("form[data-wizard]");
}

/** Opens the one-step "Write me" form and returns a locator scoped to it. */
export async function openWriteMe(page, lang, where) {
  if (where === "page") {
    await page.goto(site.pages.writeMe[lang].slice(1));
    return page.locator("form[data-wizard]");
  }
  const popup = await openContactPopup(page, lang);
  await popup.locator('a[data-dialog="dialog-writeMe"]').click();
  const dialog = page.locator("#dialog-writeMe");
  await expect(dialog).toHaveJSProperty("open", true);
  return dialog.locator("form[data-wizard]");
}

/** Opens the contact popup on the home page and returns its locator. */
export async function openContactPopup(page, lang) {
  await page.goto(`${lang}/`);
  await page.locator(".hero__cta a").click();
  const popup = page.locator("#dialog-contact");
  await expect(popup).toHaveJSProperty("open", true);
  return popup;
}

export const steps = (form) => form.locator("[data-step]");
export const visibleStep = (form) => form.locator("[data-step]:not([hidden])");

/** Index of the visible step, or -1. */
export const stepIndex = (form) => steps(form).evaluateAll((all) => all.findIndex((s) => !s.hidden));

export const next = (form) => visibleStep(form).locator("[data-next]").click();
export const back = (form) => visibleStep(form).locator("[data-back]").click();
export const skip = (form) => visibleStep(form).locator(".form-skip").click();
export const submit = (form) => visibleStep(form).locator('button[type="submit"]:not(.form-skip)').click();

/** Fills the required first step (contact details, plus the address for the estimation). */
export async function fillStep1(form, key, { phone = "450 776 4895", email = "test@example.com" } = {}) {
  const p = FORMS[key].prefix;
  if (key === "estimation") await form.locator("#est-address").fill("123 rue Principale");
  await form.locator(`#${p}-first-name`).fill("Jeanne");
  await form.locator(`#${p}-last-name`).fill("Tremblay");
  if (phone !== null) await form.locator(`#${p}-phone`).fill(phone);
  if (email !== null) await form.locator(`#${p}-email`).fill(email);
  await form.locator(`#${p}-consent`).check();
}

/** Clicks the tile/segment label for an input id (the input itself is visually hidden). */
export const pick = (form, id) => form.locator(`label[for="${id}"]`).click();
