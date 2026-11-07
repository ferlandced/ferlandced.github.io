// Helpers to drive the multi-step forms, in the home page dialog or on their own page.
import type { Locator, Page } from "@playwright/test";
import { expect } from "./fixtures.ts";
import { site, type Lang } from "./site.ts";

// contactStep: index of the contact details step (the property alert first asks buy or rent)
export const FORMS = {
  estimation: {
    prefix: "est",
    steps: 5,
    contactStep: 0,
    typeTile: "est-type-duplex",
    typeValue: "Duplex",
  },
  propertyAlert: {
    prefix: "pa",
    steps: 5,
    contactStep: 1,
    typeTile: "pa-type-condo",
    typeValue: "Condo",
  },
} as const;

/** The multi-step forms: estimation and property alert. */
export type FormKey = keyof typeof FORMS;

/** The multi-step forms with their settings, typed (Object.entries widens keys to string). */
export const FORM_ENTRIES = Object.entries(FORMS) as [FormKey, (typeof FORMS)[FormKey]][];

/** Where a form is opened: in the home page dialog, or on its own page. */
export type FormPlace = "dialog" | "page";

export const FORM_PLACES: FormPlace[] = ["dialog", "page"];

/** Opens a form and returns a locator scoped to it. */
export async function openForm(page: Page, key: FormKey, lang: Lang, where: FormPlace) {
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
export async function openWriteMe(page: Page, lang: Lang, where: FormPlace) {
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
export async function openContactPopup(page: Page, lang: Lang) {
  await page.goto(`${lang}/`);
  await page.locator(".hero__cta a").click();
  const popup = page.locator("#dialog-contact");
  await expect(popup).toHaveJSProperty("open", true);
  return popup;
}

export const steps = (form: Locator) => form.locator("[data-step]");
export const visibleStep = (form: Locator) => form.locator("[data-step]:not([hidden])");

/** Index of the visible step, or -1. */
export const stepIndex = (form: Locator) =>
  steps(form).evaluateAll((all: HTMLElement[]) => all.findIndex((step) => !step.hidden));

export const next = (form: Locator) => visibleStep(form).locator("[data-next]").click();
export const back = (form: Locator) => visibleStep(form).locator("[data-back]").click();
export const skip = (form: Locator) => visibleStep(form).locator(".form-skip").click();
export const submit = (form: Locator) =>
  visibleStep(form).locator('button[type="submit"]:not(.form-skip)').click();

/** Contact details for the first step; null leaves the field empty. */
interface ContactDetails {
  phone?: string | null;
  email?: string | null;
}

/** The property alert's buy-or-rent radio values. */
export type AlertIntent = "achat" | "location";

/**
 * Fills the required steps up to the contact details and stays on that step: for the property alert,
 * buy or rent first (keeps a choice already made, e.g. from ?intent=, otherwise picks `intent`);
 * for the estimation, the address.
 */
export async function fillStep1(
  form: Locator,
  key: FormKey,
  {
    phone = "450 776 4895",
    email = "test@example.com",
    intent = "achat",
  }: ContactDetails & { intent?: AlertIntent } = {},
) {
  const prefix = FORMS[key].prefix;
  if (key === "propertyAlert") {
    if ((await form.locator('input[name="intent"]:checked').count()) === 0) {
      await pick(form, `pa-intent-${intent}`);
    }
    // Without JS the form is one long page: no step to move to
    if (await form.evaluate((element) => element.hasAttribute("data-wizard-ready"))) {
      await next(form);
    }
  }
  if (key === "estimation") {
    await form.locator("#est-address").fill("123 rue Principale");
  }
  await form.locator(`#${prefix}-first-name`).fill("Jeanne");
  await form.locator(`#${prefix}-last-name`).fill("Tremblay");
  if (phone !== null) {
    await form.locator(`#${prefix}-phone`).fill(phone);
  }
  if (email !== null) {
    await form.locator(`#${prefix}-email`).fill(email);
  }
  await form.locator(`#${prefix}-consent`).check();
}

/** Moves to the contact details step: the property alert asks buy or rent first. */
export async function toContactStep(form: Locator, key: FormKey) {
  if (key === "propertyAlert") {
    await pick(form, "pa-intent-achat");
    await next(form);
  }
}

/** Clicks the tile/segment label for an input id (the input itself is visually hidden). */
export const pick = (form: Locator, id: string) => form.locator(`label[for="${id}"]`).click();
