// Phone layout under hardware insets: the header, burger, menu, dialogs and footer stay clear of the
// notch, Dynamic Island and home indicator, and the header lets iOS 26 Safari show the hero behind
// the status bar. Insets come from the project (playwright.config.ts) via support/safe-area.ts.
import type { Locator, Page } from "@playwright/test";
import { test, expect, present, safeRect, expectInside } from "./support/safe-area.ts";
import { pageUrl } from "../support/site.ts";

test.use({ reducedMotion: "reduce" });

const contactPage = pageUrl("contact", "fr").slice(1);

/** True when a tap at the element's centre lands on the element (or inside it). */
const isHitAtCentre = (locator: Locator) =>
  locator.evaluate((element) => {
    const box = element.getBoundingClientRect();
    const target = document.elementFromPoint(box.x + box.width / 2, box.y + box.height / 2);
    return target !== null && element.contains(target);
  });

const scrollPastHero = async (page: Page) => {
  await page.locator("#about").evaluate((element) => {
    window.scrollTo({ top: element.getBoundingClientRect().top + scrollY, behavior: "instant" });
  });
  await expect(page.locator(".site-header")).toHaveAttribute("data-past-hero", "");
};

test("the page sees the device insets", async ({ page, safeAreaInsets }) => {
  const insets = present(safeAreaInsets, "insets for this project");
  await page.goto("fr/");
  const values = await page.evaluate(() => {
    const style = getComputedStyle(document.documentElement);
    return ["top", "right", "bottom", "left"].map((side) =>
      style.getPropertyValue(`--safe-${side}`).trim(),
    );
  });
  expect(values).toEqual(
    [insets.top, insets.right, insets.bottom, insets.left].map((px) => `${px}px`),
  );
});

test("header: its content starts below the top inset, the logo clears the side insets", async ({
  page,
  safeAreaInsets,
}) => {
  const insets = present(safeAreaInsets, "insets for this project");
  for (const path of ["fr/", contactPage]) {
    await page.goto(path);
    await expect(page.locator(".site-header")).toHaveCSS("padding-top", `${insets.top}px`);
    // The logo canvas is shifted up inside the header on purpose, so only its sides are compared
    const rect = safeRect(page, insets);
    const logo = present(await page.locator(".brand").boundingBox(), `the logo on ${path}`);
    expect(logo.x, `the logo on ${path}: left`).toBeGreaterThanOrEqual(rect.left);
    expect(logo.x + logo.width, `the logo on ${path}: right`).toBeLessThanOrEqual(rect.right);
  }
});

test("home over the hero: the status bar band shows the page, the header controls stay tappable", async ({
  page,
}) => {
  await page.goto("fr/");
  const header = page.locator(".site-header");
  await expect(header).not.toHaveAttribute("data-past-hero", "");
  await expect(header).toHaveCSS("pointer-events", "none");

  // iOS 26 Safari skips a fixed top element that lets taps through, and shows the page behind the clock
  const bandHitsHeader = await page.evaluate(
    () => document.elementFromPoint(innerWidth / 2, 5)?.closest(".site-header") != null,
  );
  expect(bandHitsHeader, "the top band reaches the page, not the header").toBe(false);

  expect(await isHitAtCentre(page.locator(".brand")), "logo").toBe(true);
  const toggle = page.locator(".nav-toggle");
  expect(await isHitAtCentre(toggle), "burger").toBe(true);
  await toggle.click();
  for (const link of await page.locator(".site-nav a:visible").all()) {
    await link.scrollIntoViewIfNeeded();
    expect(await isHitAtCentre(link), `menu link ${await link.textContent()}`).toBe(true);
  }
});

test("past the hero and on inner pages the header is opaque white", async ({ page }) => {
  await page.goto("fr/");
  await scrollPastHero(page);
  await expect(page.locator(".site-header")).toHaveCSS("background-color", "rgb(255, 255, 255)");
  await expect(page.locator(".site-header")).toHaveCSS("pointer-events", "auto");

  await page.goto(contactPage);
  await expect(page.locator(".site-header")).toHaveCSS("background-color", "rgb(255, 255, 255)");
});

test("burger and open menu stay inside the safe area", async ({ page, safeAreaInsets }) => {
  const insets = present(safeAreaInsets, "insets for this project");
  await page.goto("fr/");
  const rect = safeRect(page, insets);
  await expectInside(page.locator(".nav-toggle"), rect, "the burger");
  await page.locator(".nav-toggle").click();
  await expect(page.locator(".site-nav")).toBeVisible();
  // The menu scrolls on short landscape screens, so its scroll box is what must fit
  await expectInside(page.locator(".site-nav"), rect, "the menu");
});

test("dialogs: close button and the form's buttons stay inside the safe area", async ({
  page,
  safeAreaInsets,
}) => {
  const insets = present(safeAreaInsets, "insets for this project");
  await page.goto("fr/");
  const rect = safeRect(page, insets);

  await page.locator(".hero__cta a").click();
  const contact = page.locator("#dialog-contact");
  await expect(contact).toBeVisible();
  await expectInside(contact.locator(".form-panel__close"), rect, "the contact popup's close");
  await page.keyboard.press("Escape");

  await page.locator(".service__action a").first().click();
  const form = page.locator("dialog.form-dialog[open]");
  await expect(form).toBeVisible();
  await expectInside(form.locator(".form-panel__close"), rect, "the form's close");
  await form.evaluate((dialog) => {
    dialog.scrollTo({ top: dialog.scrollHeight, behavior: "instant" });
  });
  await expectInside(form.locator(".form-actions:visible"), rect, "the form's buttons");
});

test("footer ends above the home indicator", async ({ page, safeAreaInsets }) => {
  const insets = present(safeAreaInsets, "insets for this project");
  await page.goto("fr/");
  await expect(page.locator(".site-footer")).toHaveCSS("padding-bottom", `${insets.bottom}px`);
});

test("outside iOS Safari the page has no runways and opens at the top", async ({ page }) => {
  await page.goto("fr/");
  const runways = await page.evaluate(() => {
    const style = getComputedStyle(document.documentElement);
    return ["--top-runway", "--footer-runway"].map((name) => style.getPropertyValue(name).trim());
  });
  expect(runways).toEqual(["0px", "0px"]);
  expect(await page.evaluate(() => scrollY)).toBe(0);
});

test.describe("iOS runways", () => {
  // Playwright's WebKit is not iOS, so the iPhone-only values are forced here
  test.beforeEach(async ({ page }) => {
    await page.route("**/css/site.css", async (route) => {
      const response = await route.fetch();
      const css = `${await response.text()}\n:root { --top-runway: 80px; --footer-runway: 120px; }`;
      await route.fulfill({ response, body: css });
    });
  });

  const restingAt = (page: Page) => page.evaluate(() => scrollY);
  const scrollEnd = (page: Page) =>
    page.evaluate(() => document.documentElement.scrollHeight - innerHeight);
  const jumpTo = (page: Page, top: number) =>
    page.evaluate((top) => {
      window.scrollTo({ top, behavior: "instant" });
    }, top);

  for (const path of ["fr/", contactPage]) {
    test(`${path}: opens past the top runway and glides back out of both`, async ({ page }) => {
      await page.goto(path);
      await expect.poll(() => restingAt(page)).toBe(80);

      await jumpTo(page, 0);
      await expect.poll(() => restingAt(page)).toBe(80);

      const end = await scrollEnd(page);
      await jumpTo(page, end);
      await expect.poll(() => restingAt(page)).toBe(end - 120);

      await jumpTo(page, end - 300);
      await expect.poll(() => restingAt(page)).toBe(end - 300);
    });
  }

  test("with an anchor the page opens at the anchor", async ({ page }) => {
    await page.goto("fr/#services");
    expect(await restingAt(page)).toBeGreaterThan(80);
  });
});

/** How far the page circle's box reaches past the viewport's top and bottom, in px. */
const pageCircleOverhang = (page: Page) =>
  page.evaluate(() => {
    const shape = document.querySelector(".page-circle__shape");
    if (!shape) {
      throw new Error("Expected the page circle");
    }
    const box = shape.getBoundingClientRect();
    return [Math.round(-box.top), Math.round(box.bottom - innerHeight)];
  });

test("the page circle follows the scroll and reaches past the viewport's edges", async ({
  page,
}) => {
  for (const path of ["fr/", contactPage]) {
    await page.goto(path);
    await expect(page.locator(".page-circle")).toBeVisible();
    const end = await page.evaluate(() => document.documentElement.scrollHeight - innerHeight);
    for (const top of [0, Math.round(end / 2), end]) {
      await page.evaluate((top) => {
        window.scrollTo({ top, behavior: "instant" });
      }, top);
      await expect
        .poll(() => pageCircleOverhang(page), { message: `${path} scrolled to ${top}` })
        .toEqual([160, 160]);
    }
  }
});

test("the fixed circle stays off the viewport's top and bottom edges, closed and open", async ({
  page,
}) => {
  await page.goto(contactPage);
  const edgeGaps = () =>
    page.locator(".menu-circle").evaluate((circle) => {
      const box = circle.getBoundingClientRect();
      return [Math.round(box.top), Math.round(innerHeight - box.bottom)];
    });
  expect(await edgeGaps()).toEqual([6, 6]);
  await page.locator(".nav-toggle").click();
  await expect(page.locator(".site-nav")).toBeVisible();
  expect(await edgeGaps()).toEqual([6, 6]);
});

test("open, the circle holds the whole menu and leaves the top left of the page", async ({
  page,
}) => {
  for (const path of ["fr/", contactPage]) {
    await page.goto(path);
    await page.locator(".nav-toggle").click();
    await expect(page.locator(".site-nav")).toBeVisible();
    const reach = await page.evaluate(() => {
      const toggleBox = document.querySelector(".nav-toggle")?.getBoundingClientRect();
      const navBox = document.querySelector(".site-nav")?.getBoundingClientRect();
      if (!toggleBox || !navBox) {
        throw new Error("Expected the burger and the menu");
      }
      const radius = Number.parseFloat(
        getComputedStyle(document.documentElement).getPropertyValue("--menu-circle-radius"),
      );
      const centreX = toggleBox.left + toggleBox.width / 2;
      const centreY = toggleBox.top + toggleBox.height / 2;
      return {
        menuCorner: radius - Math.hypot(centreX - navBox.left, centreY - navBox.top),
        screenCorner: Math.hypot(centreX, centreY) - radius,
      };
    });
    expect(reach.menuCorner, `${path}: the menu's farthest corner inside`).toBeGreaterThanOrEqual(
      24,
    );
    expect(reach.screenCorner, `${path}: the screen's top left outside`).toBeGreaterThan(0);
  }
});

const DARK_RED = [102, 0, 0];

/**
 * The colours on screen at points around the burger's centre: `distance` px away, every 15°.
 * Points off the screen are left out.
 */
const coloursAroundBurger = async (page: Page, distance: number) => {
  const burger = present(await page.locator(".nav-toggle").boundingBox(), "the burger");
  const shot = (await page.screenshot({ scale: "css", animations: "allow" })).toString("base64");
  return page.evaluate(
    async ([shot, burger, distance]) => {
      const image = new Image();
      image.src = `data:image/png;base64,${shot}`;
      await image.decode();
      const canvas = new OffscreenCanvas(image.width, image.height);
      const context = canvas.getContext("2d");
      if (!context) {
        throw new Error("No 2D canvas context");
      }
      context.drawImage(image, 0, 0);
      const { data } = context.getImageData(0, 0, image.width, image.height);
      const centreX = burger.x + burger.width / 2;
      const centreY = burger.y + burger.height / 2;
      const colours: number[][] = [];
      for (let degrees = 0; degrees < 360; degrees += 15) {
        const radians = (degrees * Math.PI) / 180;
        const x = Math.round(centreX + distance * Math.cos(radians));
        const y = Math.round(centreY + distance * Math.sin(radians));
        if (x >= 0 && y >= 0 && x < image.width && y < image.height) {
          const index = (y * image.width + x) * 4;
          colours.push(Array.from(data.subarray(index, index + 3)));
        }
      }
      return colours;
    },
    [shot, burger, distance] as const,
  );
};

test("at the top of home the burger's circle sits unseen in the slash's Dark Red", async ({
  page,
}) => {
  await page.goto("fr/");
  const burger = present(await page.locator(".nav-toggle").boundingBox(), "the burger");
  // 7px outside the circle: still Dark Red, so the red stripe stays at least that far away
  const ring = await coloursAroundBurger(page, burger.width / 2 + 7);
  expect(ring.length, "points on screen").toBeGreaterThan(8);
  for (const colour of ring) {
    expect(colour, "Dark Red all around the circle").toEqual(DARK_RED);
  }
  // Inside it, between the bars and its edge: the blur under the 80% fill brings at most a trace
  // of the red stripe (measured: 5 units of red at the edge nearest it), too little to see
  for (const colour of await coloursAroundBurger(page, burger.width / 2 - 4)) {
    colour.forEach((channel, index) => {
      expect(
        Math.abs(channel - (DARK_RED[index] ?? 0)),
        "Dark Red inside the circle",
      ).toBeLessThanOrEqual(6);
    });
  }
});

/** WCAG contrast of white on an sRGB colour. */
const contrastWithWhite = (colour: number[]) => {
  const linear = colour.map((channel) => {
    const value = channel / 255;
    return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  });
  const [red = 0, green = 0, blue = 0] = linear;
  return 1.05 / (0.2126 * red + 0.7152 * green + 0.0722 * blue + 0.05);
};

test("past the hero the slash has scrolled away and the circle keeps the burger visible", async ({
  page,
}) => {
  await page.goto("fr/");
  await scrollPastHero(page);
  const band = present(await page.locator(".hero__band").boundingBox(), "the hero's slash");
  expect(band.y + band.height, "the slash is above the screen").toBeLessThanOrEqual(0);
  const burger = present(await page.locator(".nav-toggle").boundingBox(), "the burger");
  // Inside the circle, between the bars and its edge: Dark Red at 80% over the blurred page
  for (const colour of await coloursAroundBurger(page, burger.width / 2 - 4)) {
    const [red = 0, green = 0, blue = 0] = colour;
    expect(red - Math.max(green, blue), "the circle reads as red").toBeGreaterThanOrEqual(60);
    expect(contrastWithWhite(colour), "the white bars at AA").toBeGreaterThanOrEqual(4.5);
  }
  const outside = await coloursAroundBurger(page, burger.width / 2 + 4);
  expect(
    outside.some((colour) => colour.join() !== DARK_RED.join()),
    "the page around it is not",
  ).toBe(true);
});

// The page circle is a scroll-driven animation: with animations disabled it would sit at the page's top
const asOnScreen = { animations: "allow" } as const;

test.describe("screenshots", () => {
  test("home, top", async ({ page }) => {
    await page.goto("fr/");
    await expect(page).toHaveScreenshot("home-top.png", asOnScreen);
  });

  test("home, past the hero", async ({ page }) => {
    await page.goto("fr/");
    await scrollPastHero(page);
    await expect(page).toHaveScreenshot("home-past-hero.png", asOnScreen);
  });

  test("menu open", async ({ page }) => {
    await page.goto("fr/");
    await page.locator(".nav-toggle").click();
    await expect(page.locator(".site-nav")).toHaveCSS("opacity", "1");
    await expect(page).toHaveScreenshot("menu-open.png", asOnScreen);
  });

  test("form dialog", async ({ page }) => {
    await page.goto("fr/");
    await page.locator(".service__action a").first().click();
    await expect(page.locator("dialog.form-dialog[open]")).toBeVisible();
    await expect(page).toHaveScreenshot("form-dialog.png", asOnScreen);
  });

  test("contact page", async ({ page }) => {
    await page.goto(contactPage);
    await expect(page).toHaveScreenshot("contact.png", asOnScreen);
  });
});
