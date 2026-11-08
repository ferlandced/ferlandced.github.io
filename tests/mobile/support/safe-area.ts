// Phone layout tests with hardware insets (notch, Dynamic Island, home indicator). Each mobile
// project sets `safeAreaInsets`; the page fixture passes them to Chromium through the DevTools
// protocol before the test navigates, so env(safe-area-inset-*) resolves as on the device.
// WebKit has no such override: Safari itself still needs a real iPhone.
import type { Locator, Page } from "@playwright/test";
import { test as base, expect, present } from "../../support/fixtures.ts";

export interface SafeAreaInsets {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

export interface SafeAreaOptions {
  safeAreaInsets: SafeAreaInsets | null;
}

export const test = base.extend<SafeAreaOptions>({
  safeAreaInsets: [null, { option: true }],

  page: async ({ page, browserName, safeAreaInsets }, use) => {
    if (safeAreaInsets) {
      if (browserName !== "chromium") {
        throw new Error(`safeAreaInsets needs Chromium, this project runs ${browserName}`);
      }
      const session = await page.context().newCDPSession(page);
      await session.send("Emulation.setSafeAreaInsetsOverride", { insets: safeAreaInsets });
    }
    await use(page);
  },
});

export { expect, present };

/** The part of the viewport clear of the insets. */
export interface SafeRect {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

export const safeRect = (page: Page, insets: SafeAreaInsets): SafeRect => {
  const viewport = present(page.viewportSize(), "a viewport size");
  return {
    top: insets.top,
    right: viewport.width - insets.right,
    bottom: viewport.height - insets.bottom,
    left: insets.left,
  };
};

/** Fails unless the element's box lies inside the rectangle (half a pixel of rounding allowed). */
export const expectInside = async (locator: Locator, rect: SafeRect, what: string) => {
  const box = present(await locator.boundingBox(), `a box for ${what}`);
  const slack = 0.5;
  expect(box.y, `${what}: top`).toBeGreaterThanOrEqual(rect.top - slack);
  expect(box.x, `${what}: left`).toBeGreaterThanOrEqual(rect.left - slack);
  expect(box.y + box.height, `${what}: bottom`).toBeLessThanOrEqual(rect.bottom + slack);
  expect(box.x + box.width, `${what}: right`).toBeLessThanOrEqual(rect.right + slack);
};
