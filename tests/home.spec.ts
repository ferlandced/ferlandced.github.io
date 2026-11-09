// Home page content: hero, contact links, About and its story, service buttons and info links,
// the property cards, and the reduced-motion layout.
import type { Locator, Page } from "@playwright/test";
import { test, expect, present } from "./support/fixtures.ts";
import { site, agent, listings, copyFor, url, languages, pageUrl, textAt } from "./support/site.ts";

type Box = NonNullable<Awaited<ReturnType<Locator["boundingBox"]>>>;

/** Scrolls instantly and waits two frames, so scroll-driven styles have updated. */
const scrollToY = (page: Page, y: number) =>
  page.evaluate(
    (y: number) =>
      new Promise<void>((done) => {
        window.scrollTo({ top: y, behavior: "instant" });
        requestAnimationFrame(() =>
          requestAnimationFrame(() => {
            done();
          }),
        );
      }),
    y,
  );

for (const lang of languages) {
  test.describe(`home (${lang})`, () => {
    test.beforeEach(async ({ page }) => {
      await page.goto(`${lang}/`);
    });

    test("hero shows the agent, his title and the tagline with its bold words", async ({
      page,
    }) => {
      const tagline = copyFor(lang).home.hero.tagline;
      await expect(page.locator("h1")).toHaveText(agent.name);
      await expect(page.locator(".hero__tagline")).toHaveText(
        tagline
          .replaceAll("**", "")
          .replaceAll("_", "")
          .replaceAll(/\s*\n\s*/g, " "),
      );
      const bold = [...tagline.matchAll(/\*\*(.+?)\*\*/g)].map((match) => match[1]);
      expect(bold.length, "the tagline has bold words").toBeGreaterThan(0);
      await expect(page.locator(".hero__tagline strong")).toHaveText(bold as string[]);
      await expect(page.locator(".hero__role")).toHaveText(agent.title[lang]);
      await expect(page.locator(".hero__agency")).toHaveCount(0);
    });

    test("the quote's middle is smaller and Light, with the line break from the CMS on every screen", async ({
      page,
    }) => {
      const tagline = page.locator(".hero__tagline");
      const light = tagline.locator(".text-light");
      await expect(light).toHaveCount(1);
      await expect(light).toHaveCSS("font-weight", "300");
      const [quoteSize, lightSize] = await Promise.all(
        [tagline, light].map((locator) =>
          locator.evaluate((element) => parseFloat(getComputedStyle(element).fontSize)),
        ),
      );
      expect(lightSize).toBeLessThan(present(quoteSize, "the quote's font size"));
      await expect(tagline.locator("br"), "one line break, as written in the CMS").toHaveCount(1);
      const lines = await tagline.evaluate((element) => {
        const style = getComputedStyle(element);
        return Math.round(element.getBoundingClientRect().height / parseFloat(style.lineHeight));
      });
      expect(lines, "two lines, the same on phones and desktop").toBe(2);
    });

    test("hero has one action: the contact popup, from a Dark Red pill with an icon", async ({
      page,
    }) => {
      const action = page.locator(".hero a");
      await expect(action).toHaveCount(1);
      await expect(action).toHaveText(copyFor(lang).home.hero.button);
      await expect(action).toHaveAttribute("href", url(site.pages.contact[lang]));
      await expect(action.locator("svg")).toBeVisible();
      await expect(action, "Dark Red: white text passes AA at any size").toHaveCSS(
        "background-color",
        "rgb(102, 0, 0)",
      );
      await expect(action).toHaveCSS("color", "rgb(255, 255, 255)");

      await action.click();
      const popup = page.locator("#dialog-contact");
      await expect(popup).toHaveJSProperty("open", true);
      await page.keyboard.press("Escape");
      await expect(popup).toHaveJSProperty("open", false);
      await expect(action, "focus returns to the button").toBeFocused();
    });

    test("contact links call, email and open social profiles safely", async ({ page }) => {
      const telLink = `tel:+1${agent.phone.replaceAll(" ", "")}`;
      for (const area of [".contact-icons--header", ".about__contact"]) {
        await expect(page.locator(`${area} a[href="${telLink}"]`)).toHaveCount(1);
        await expect(page.locator(`${area} a[href="mailto:${agent.email}"]`)).toHaveCount(1);
      }
      const social = page.locator('.contact-icons--header a[target="_blank"]');
      for (const link of await social.all()) {
        await expect(link).toHaveAttribute("rel", /noopener/);
        expect(Object.values(agent.social)).toContain(await link.getAttribute("href"));
      }
    });

    test("About links to the story page", async ({ page }) => {
      await expect(page.locator(`.about a[href="${url(site.pages.about[lang])}"]`)).toHaveText(
        copyFor(lang).home.about.storyLink,
      );
    });

    test("About is followed directly by Services", async ({ page }) => {
      await expect(page.locator(".trust")).toHaveCount(0);
      const follows = await page
        .locator(".stage")
        .evaluate((stage) => stage.nextElementSibling?.id);
      expect(follows).toBe("services");
    });

    test("two services: looking (buy or rent) and selling, each linking to its information pages", async ({
      page,
    }) => {
      const services = copyFor(lang).home.services;
      await expect(page.locator(".service")).toHaveCount(2);
      const expected = {
        search: [
          ["buy", services.search.buyLink],
          ["rent", services.search.rentLink],
        ],
        sell: [["sell", services.sell.sellLink]],
      } as const;
      for (const [id, links] of Object.entries(expected)) {
        await expect(page.locator(`.service--${id} .service__title`)).toHaveText(
          textAt(services, `${id}.title`),
        );
        const anchors = page.locator(`.service--${id} .service__links a`);
        await expect(anchors).toHaveCount(links.length);
        for (const [index, [pageKey, label]] of links.entries()) {
          await expect(anchors.nth(index)).toHaveAttribute("href", url(site.pages[pageKey][lang]));
          await expect(anchors.nth(index)).toHaveText(label);
        }
      }
    });

    test("service buttons point to the form pages and open the matching dialog, no intent", async ({
      page,
    }) => {
      for (const [id, key] of [
        ["search", "propertyAlert"],
        ["sell", "estimation"],
      ] as const) {
        const button = page.locator(`.service--${id} .service__action a`);
        await expect(button).toHaveCount(1);
        await expect(button).toHaveAttribute("href", url(pageUrl(key, lang)));
        await expect(button).toHaveAttribute("data-dialog", `dialog-${key}`);
        await expect(button).not.toHaveAttribute("data-intent", /.*/);
        await expect(button).toHaveText(textAt(copyFor(lang).home.services, `${id}.button`));
      }
    });

    test("About tells the story in two parts, in reading order", async ({ page }) => {
      await expect(page.locator(".about__line")).toHaveText([
        copyFor(lang).home.about.storyPart1,
        copyFor(lang).home.about.storyPart2,
      ]);
    });
  });
}

for (const lang of languages) {
  test(`property cards (${lang}): the listing's data and one external link across the card`, async ({
    page,
  }) => {
    await page.goto(`${lang}/`);
    const shown = listings.slice(0, 6);
    await expect(page.locator("#properties .card")).toHaveCount(shown.length);
    for (const [index, item] of shown.entries()) {
      const card = page.locator("#properties .card").nth(index);
      await expect(card.locator("a")).toHaveCount(1);
      const link = card.locator(".card__title a");
      await expect(link).toHaveText(item.property_kind[lang]);
      await expect(link).toHaveAttribute("href", site.listingUrl[lang] + item.slug[lang]);
      await expect(link).toHaveAttribute("target", "_blank");
      await expect(link).toHaveAttribute("rel", "noopener");
      await expect(card.locator(".card__number")).toContainText(String(item.no_inscription));
      if (item.flag_show_addresse) {
        await expect(card.locator(".card__meta")).toHaveText(item.address.display[lang]);
      } else {
        await expect(card.locator(".card__meta")).toHaveCount(0);
      }
      await expect(card.locator(".card__price")).toContainText(
        item.display_price[lang].replace(/\s*\$/, "").trim(),
      );
      if (item.photos[0]) {
        await expect(card.locator("img.card__img")).toHaveAttribute(
          "src",
          url(`/images/listings/${item.no_inscription}.jpg`),
        );
      } else {
        await expect(card.locator(".card__img--empty")).toHaveCount(1);
      }
      const more = card.locator("button[data-property-info]");
      await expect(more).toHaveText(copyFor(lang).properties.cards.moreInfo);
      await expect(more.locator("svg"), "phone icon").toHaveCount(1);
      await expect(more).toHaveAttribute(
        "aria-label",
        new RegExp(
          `^${copyFor(lang).properties.cards.moreInfo}.*${item.property_kind[lang]}.*${item.no_inscription}`,
        ),
      );
      await card.scrollIntoViewIfNeeded();
      const onButton = await more.evaluate((element) => {
        const rect = element.getBoundingClientRect();
        const hit = document.elementFromPoint(rect.x + rect.width / 2, rect.y + rect.height / 2);
        return hit !== null && element.contains(hit);
      });
      expect(onButton, "the button sits above the stretched link").toBe(true);
      const hit = await card.locator(".card__media").evaluate((element) => {
        const rect = element.getBoundingClientRect();
        return document.elementFromPoint(rect.x + rect.width / 2, rect.y + rect.height / 2)
          ?.tagName;
      });
      expect(hit).toBe("A");
    }
  });
}

test("the link to all properties shows only with more than the 6 cards on the home page", async ({
  page,
}) => {
  await page.goto("fr/");
  await expect(page.locator(".properties__all")).toHaveCount(listings.length > 6 ? 1 : 0);
});

test.describe("desktop hero", () => {
  test.skip(({ isMobile }) => isMobile, "desktop only");

  for (const [width, height] of [
    [768, 1024],
    [1024, 768],
    [1440, 900],
    [1920, 1080],
  ] satisfies [number, number][]) {
    test(`at ${width}px: full-screen image, text clear of the agent, agent under the stripes`, async ({
      page,
    }) => {
      await page.emulateMedia({ reducedMotion: "reduce" });
      await page.setViewportSize({ width, height });
      await page.goto("fr/");
      const box = async (selector: string) =>
        present(await page.locator(selector).boundingBox(), `the box of ${selector}`);

      const hero = await box(".hero");
      expect(hero.height).toBe(height);
      const image = await box(".hero__side img");
      expect(image).toMatchObject({ x: 0, y: 0, width: hero.width, height });

      const text = await box(".hero__id");
      const agent = await box(".hero__photo");
      // The photo has a transparent margin of about 12% of its width on the left
      expect(text.x + text.width, "text ends before the agent").toBeLessThanOrEqual(
        agent.x + agent.width * 0.12 + 1,
      );
      expect(text.x, "text stays inside the content area").toBeGreaterThanOrEqual(0);
      expect(agent.x + agent.width).toBeLessThanOrEqual(width);
      const textCentre = text.x + text.width / 2;
      if (width >= 1440) {
        expect(Math.abs(textCentre - (width / 2 - 14)), "centred on the page").toBeLessThan(2);
      }

      const zIndexOf = (selector: string) =>
        page.locator(selector).evaluate((element) => Number(getComputedStyle(element).zIndex));
      const [side, figure, band, inner] = await Promise.all([
        zIndexOf(".hero__side"),
        zIndexOf(".hero__figure"),
        zIndexOf(".hero__band"),
        zIndexOf(".hero__inner"),
      ]);
      expect(side).toBeLessThan(figure);
      expect(figure).toBeLessThan(band);
      expect(band).toBeLessThan(inner);

      const shot = (await page.screenshot({ scale: "css" })).toString("base64");
      const fillStart = (rows: number[]) =>
        page.evaluate(
          async ([shot, rows]: readonly [string, number[]]) => {
            const img = new Image();
            img.src = `data:image/png;base64,${shot}`;
            await img.decode();
            const canvas = new OffscreenCanvas(img.width, img.height);
            const context = canvas.getContext("2d");
            if (!context) {
              throw new Error("No 2D canvas context");
            }
            context.drawImage(img, 0, 0);
            const { data } = context.getImageData(0, 0, img.width, img.height);
            const isDarkRed = (x: number, y: number) => {
              const index = (y * img.width + x) * 4;
              return data[index] === 102 && data[index + 1] === 0 && data[index + 2] === 0;
            };
            return rows.map((y) => {
              let x = img.width - 1;
              while (x >= 0 && isDarkRed(x, y)) {
                x--;
              }
              return x + 1;
            });
          },
          [shot, rows] as const,
        );
      const starts = await fillStart([height - 10, height - 110]);
      const low = present(starts[0], "where Dark Red starts near the bottom");
      const high = present(starts[1], "where Dark Red starts 100px higher");
      expect(low, "Dark Red is solid from the slash to the right edge").toBeLessThan(width - 50);
      expect((high - low) / 100, "fixed slash angle").toBeCloseTo(
        Math.tan((27.5 * Math.PI) / 180),
        1,
      );

      const header = await box(".site-header");
      const stripes = await box(".hero__band");
      expect(stripes.y, "stripes start below the header").toBeGreaterThanOrEqual(header.height);
    });
  }

  test("the agent stays still from the hero into About, on its right", async ({ page }) => {
    await page.goto("fr/");
    test.skip(
      !(await page.evaluate(() => CSS.supports("animation-timeline: view()"))),
      "needs scroll-driven animations",
    );
    const heroHeight = await page
      .locator(".hero")
      .evaluate((element: HTMLElement) => element.offsetHeight);
    const boxOf = async (selector: string) =>
      present(await page.locator(selector).boundingBox(), `the box of ${selector}`);
    /** The agent photo, his place in About and the About text, at a scroll position. */
    const at = async (y: number) => {
      await scrollToY(page, y);
      return Promise.all([
        boxOf(".stage__agent .agent-photos__layer--agent img"),
        boxOf(".about__card"),
        boxOf(".about__body"),
      ]);
    };
    const same = (actual: Box, expected: Box, what: string) => {
      for (const key of ["x", "y", "width", "height"] as const) {
        expect(actual[key], `${what}: ${key}`).toBeCloseTo(expected[key], 0);
      }
    };
    const [start] = await at(0);
    for (const y of [heroHeight / 4, heroHeight / 2, heroHeight]) {
      const [agent] = await at(y);
      same(agent, start, `agent at ${y}px of scroll`);
    }
    const [agent, place, text] = await at(heroHeight);
    same(place, agent, "his place in About");
    expect(text.x + text.width, "About text ends before the agent").toBeLessThanOrEqual(agent.x);
  });

  test("cream logo over the hero, dark logo once About reaches the header", async ({ page }) => {
    await page.goto("fr/");
    const dark = page.locator(".brand__logo:not(.brand__logo--light)");
    const light = page.locator(".brand__logo--light");
    await expect(light).toBeVisible();
    await expect(dark).toBeHidden();
    await page.evaluate(() => {
      window.scrollTo({ top: 200, behavior: "instant" });
    });
    await expect(light).toBeVisible();
    await page.evaluate(() => {
      window.scrollTo({
        top: document.querySelector<HTMLElement>("#about")?.offsetTop,
        behavior: "instant",
      });
    });
    await expect(dark).toBeVisible();
    await expect(light).toBeHidden();
  });
});

test("every section after the hero is on white, none on cream", async ({ page }) => {
  await page.goto("fr/");
  await expect(page.locator("body > main")).toHaveCSS("background-color", "rgb(255, 255, 255)");
  for (const id of ["#about", "#services", "#properties"]) {
    const color = await page
      .locator(id)
      .evaluate((element) => getComputedStyle(element).backgroundColor);
    expect(["rgb(255, 255, 255)", "rgba(0, 0, 0, 0)"], id).toContain(color);
  }
});

test("the body is dark over the hero and white past it, for the iOS Safari bars", async ({
  page,
}) => {
  await page.goto("fr/");
  const body = page.locator("body");
  await expect(body).toHaveCSS("background-color", "rgb(35, 35, 35)");
  await page.evaluate(() => {
    window.scrollTo({ top: innerHeight * 3, behavior: "instant" });
  });
  await expect(page.locator(".site-header")).toHaveAttribute("data-past-hero", "");
  await expect(body).toHaveCSS("background-color", "rgb(255, 255, 255)");
});

test("hero text passes AA against the photo and its scrim, measured on the pixels behind it", async ({
  page,
}) => {
  await page.goto("fr/");
  await page.evaluate(() => document.fonts.ready);
  const parts = [".hero__name", ".hero__role", ".hero__tagline", ".hero__tagline .text-light"];
  const boxes = await page.evaluate(
    (selectors) =>
      selectors.map((selector) => {
        const element = document.querySelector(selector);
        if (!element) {
          throw new Error(`Missing ${selector}`);
        }
        const rect = element.getBoundingClientRect();
        const size = parseFloat(getComputedStyle(element).fontSize);
        const bold = Number(getComputedStyle(element).fontWeight) >= 700;
        // WCAG large text: 24px, or 18.66px bold
        const needed = size >= 24 || (bold && size >= 18.66) ? 3 : 4.5;
        return { selector, x: rect.x, y: rect.y, width: rect.width, height: rect.height, needed };
      }),
    parts,
  );
  await page.addStyleTag({ content: ".hero__id, .site-header { visibility: hidden !important; }" });
  const shot = (await page.screenshot({ scale: "css" })).toString("base64");
  const worst = await page.evaluate(
    async ([shot, boxes]) => {
      const img = new Image();
      img.src = `data:image/png;base64,${shot}`;
      await img.decode();
      const canvas = new OffscreenCanvas(img.width, img.height);
      const context = canvas.getContext("2d");
      if (!context) {
        throw new Error("No 2D canvas context");
      }
      context.drawImage(img, 0, 0);
      const linear = (channel: number) => {
        const value = channel / 255;
        return value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
      };
      return boxes.map((box) => {
        const { data } = context.getImageData(
          Math.max(0, Math.round(box.x)),
          Math.round(box.y),
          Math.max(1, Math.round(box.width)),
          Math.max(1, Math.round(box.height)),
        );
        const luminances: number[] = [];
        for (let index = 0; index < data.length; index += 4) {
          luminances.push(
            0.2126 * linear(data[index] ?? 0) +
              0.7152 * linear(data[index + 1] ?? 0) +
              0.0722 * linear(data[index + 2] ?? 0),
          );
        }
        luminances.sort((first, second) => first - second);
        // The lightest 5% of the background, against white text
        const light = luminances[Math.floor(0.95 * (luminances.length - 1))] ?? 1;
        return { selector: box.selector, needed: box.needed, ratio: 1.05 / (light + 0.05) };
      });
    },
    [shot, boxes] as const,
  );
  for (const { selector, needed, ratio } of worst) {
    expect(ratio, `${selector} contrast`).toBeGreaterThanOrEqual(needed);
  }
});

test("a status badge on a card lets clicks through to the listing link", async ({ page }) => {
  await page.goto("fr/");
  const badge = page.locator("#properties .card__status").first();
  test.skip((await badge.count()) === 0, "no listing with a status");
  await badge.scrollIntoViewIfNeeded();
  const hit = await badge.evaluate((element) => {
    const rect = element.getBoundingClientRect();
    return document.elementFromPoint(rect.x + rect.width / 2, rect.y + rect.height / 2)?.tagName;
  });
  expect(hit).toBe("A");
});

test.describe("without JavaScript", () => {
  test.use({ javaScriptEnabled: false });

  test("the hero button goes to the Contact page", async ({ page }) => {
    await page.goto("fr/");
    await page.locator(".hero a").click();
    await expect(page).toHaveURL(new RegExp(`${url(site.pages.contact.fr)}$`));
  });
});

test("buttons show no focus ring, links keep theirs (exception in CLAUDE.md)", async ({ page }) => {
  await page.goto("fr/");
  const action = page.locator(".hero a");
  const close = page.locator("#dialog-contact .form-panel__close");

  await action.click();
  await expect(close).toBeFocused();
  await expect(close).toHaveCSS("outline-style", "none");
  await page.keyboard.press("Escape");
  await expect(action).toBeFocused();
  await expect(action).toHaveCSS("outline-style", "none");

  const more = page.locator(".service__links a").first();
  await page.keyboard.press("Tab");
  await more.focus();
  await expect(more).toHaveCSS("outline-style", "solid");
});

const delayOf = (locator: Locator) =>
  locator.evaluateAll((elements: HTMLElement[]) =>
    elements.map((element) => parseFloat(element.style.getPropertyValue("--reveal-delay"))),
  );

test("Services: each block's title, text, links and button fade in one after the other, and stay", async ({
  page,
}) => {
  await page.goto("fr/");
  const blocks = page.locator(".service__content");
  for (const index of [0, 1]) {
    const block = blocks.nth(index);
    const title = block.locator(".service__title");
    const { top, vh } = await block.evaluate((element) => ({
      top: element.getBoundingClientRect().top + scrollY,
      vh: innerHeight,
    }));
    await scrollToY(page, top - vh * 1.5);
    await expect(title, "nothing shows before the block arrives").toHaveAttribute(
      "data-reveal",
      "",
    );
    await scrollToY(page, top - vh * 0.3);
    await expect(block.locator(".service__action")).toHaveAttribute("data-reveal", "in");
    const delays = await delayOf(block.locator(":scope > *"));
    for (const [position, delay] of delays.entries()) {
      if (position > 0) {
        expect(delay, `part ${position + 1} comes after part ${position}`).toBeGreaterThan(
          present(delays[position - 1], "the previous delay"),
        );
      }
    }
    await scrollToY(page, top + vh * 2);
    await expect(title, "blocks stay once shown").toHaveAttribute("data-reveal", "in");
  }
});

test("a link to a section lands with its blocks shown, and the sections above it too", async ({
  page,
}) => {
  await page.goto("fr/#properties");
  await expect(page.locator("#properties-heading")).toHaveAttribute("data-reveal", "in");
  await expect(page.locator("#services .service__action").last()).toHaveAttribute(
    "data-reveal",
    "in",
  );
});

test.describe("reduced motion", () => {
  test.use({ reducedMotion: "reduce" });

  test("the text shows without the reveal", async ({ page }) => {
    await page.goto("fr/");
    await expect(page.locator("[data-reveal]")).toHaveCount(0);
  });
});

test("the hero image loads first", async ({ page }) => {
  await page.goto("fr/");
  await expect(page.locator(".hero__side img")).toHaveAttribute("fetchpriority", "high");
});

test("reduced motion: the agent photo shows in About without the travelling copy", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("fr/#about");
  await expect(page.locator(".about__card .agent-photos__layer--agent img")).toBeVisible();
});

/** Waits until a block of About has finished fading and rising in (the step around it moves). */
const settled = async (step: Locator) => {
  await expect(step).toHaveCSS("opacity", "1");
  await expect(step).toHaveCSS("translate", "0px");
};

/** The step around About's contact lines, the last block to appear. */
const contactStep = (page: Page) =>
  page.locator(".about__step", { has: page.locator(".about__contact") });

/** Fake timers that only move with clock.runFor(). CSS transitions still run in real time. */
const pauseClock = async (page: Page) => {
  await page.clock.install({ time: new Date("2026-01-01T09:00:00") });
  await page.clock.pauseAt(new Date("2026-01-01T09:00:01"));
};

/** Where each photo layer of the visible picture stands, in widths of the picture from its place. */
const layerOffsets = (page: Page, container: string) =>
  page.locator(container).evaluate((element) => {
    const base = element.getBoundingClientRect();
    const offset = (selector: string) => {
      const layer = element.querySelector(selector);
      return layer
        ? Math.round(((layer.getBoundingClientRect().x - base.x) / base.width) * 10) / 10
        : null;
    };
    return {
      agent: offset(".agent-photos__layer--agent"),
      paramedic: offset(".agent-photos__layer--paramedic"),
      back: offset(".agent-photos__layer--return"),
    };
  });

const paramedicOnly = { agent: -1, paramedic: 0, back: -1 };
const agentBack = { agent: -1, paramedic: 1, back: 0 };

/** The paramedic photo: its wipe (0.9 s), then at least 2 s fully shown before the agent returns. */
const PARAMEDIC_HELD_MS = 900 + 2000;

test("opened at a later section, About is shown in full at once", async ({ page }) => {
  await page.goto("fr/#services");
  await expect(page.locator(".stage")).toHaveAttribute("data-story", /^(agent|done)$/);
  for (const step of await page.locator(".about__step").all()) {
    await expect(step).toHaveCSS("opacity", "1");
  }
});

test("short landscape screens: About is not held, its parts play one after the other", async ({
  page,
  isMobile,
}) => {
  test.skip(isMobile, "landscape phone size on the desktop layout");
  await page.setViewportSize({ width: 844, height: 390 });
  await page.goto("fr/#about");
  await expect(page.locator(".about__pin")).toHaveCSS("position", "relative");
  await expect(page.locator(".stage")).toHaveAttribute("data-story", "done", { timeout: 8000 });
  for (const line of await page.locator(".about__line").all()) {
    await expect(line).toBeVisible();
  }
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth - innerWidth),
  ).toBeLessThanOrEqual(0);
});

test.describe("About story: the text follows the scroll, the photo changes on its own clock", () => {
  /** Desktop with scroll timelines: the pinned copy over About; otherwise the picture in About. */
  const pictureOf = async (page: Page) =>
    (await page.locator(".stage__agent").isVisible()) ? ".stage__agent" : ".about__card";

  /** How far a block has come in with the scroll, from 0 to 1 (its opacity once it settles). */
  const shown = async (locator: Locator) =>
    Number(await locator.evaluate((element) => element.style.getPropertyValue("--story-progress")));

  const noSideScroll = async (page: Page) => {
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth - innerWidth),
      "no sideways scroll",
    ).toBeLessThanOrEqual(0);
  };

  /** Contrast of each fully shown block's text against the darkest 5% of the pixels behind it. */
  const worstContrast = async (page: Page, selector: string) => {
    const boxes = await page.locator(selector).evaluateAll((elements) =>
      elements
        .filter(
          (element) =>
            element.getBoundingClientRect().top >=
              (document.querySelector(".site-header")?.getBoundingClientRect().bottom ?? 0) &&
            getComputedStyle(element.closest(".about__step") ?? element).opacity === "1",
        )
        .map((element) => {
          const box = element.getBoundingClientRect();
          // rgb(35, 35, 35) or, for mixed colours, color(srgb 0.34 0.34 0.33)
          const colour = getComputedStyle(element).color;
          const scale = colour.startsWith("color(") ? 255 : 1;
          const [red = 0, green = 0, blue = 0] = (colour.match(/[\d.]+/g) ?? [])
            .slice(0, 3)
            .map((channel) => Number(channel) * scale);
          return { x: box.x, y: box.y, width: box.width, height: box.height, red, green, blue };
        }),
    );
    const shot = (
      await page.screenshot({
        style:
          ".about__stack, .about__stack * { color: transparent !important; text-decoration-color: transparent !important; }",
      })
    ).toString("base64");
    return page.evaluate(
      async ([shot, boxes, ratio]) => {
        const img = new Image();
        img.src = `data:image/png;base64,${shot}`;
        await img.decode();
        const canvas = new OffscreenCanvas(img.width, img.height);
        const context = canvas.getContext("2d");
        if (!context) {
          throw new Error("No 2D canvas context");
        }
        context.drawImage(img, 0, 0);
        const linear = (channel: number) => {
          const value = channel / 255;
          return value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
        };
        const luminance = (red: number, green: number, blue: number) =>
          0.2126 * linear(red) + 0.7152 * linear(green) + 0.0722 * linear(blue);
        return boxes.map((box) => {
          const { data } = context.getImageData(
            Math.max(0, Math.round(box.x * ratio)),
            Math.max(0, Math.round(box.y * ratio)),
            Math.max(1, Math.round(box.width * ratio)),
            Math.max(1, Math.round(box.height * ratio)),
          );
          const backgrounds: number[] = [];
          for (let index = 0; index < data.length; index += 4) {
            backgrounds.push(
              luminance(data[index] ?? 0, data[index + 1] ?? 0, data[index + 2] ?? 0),
            );
          }
          backgrounds.sort((first, second) => first - second);
          const dark = backgrounds[Math.floor(0.05 * (backgrounds.length - 1))] ?? 0;
          return (dark + 0.05) / (luminance(box.red, box.green, box.blue) + 0.05);
        });
      },
      [shot, boxes, await page.evaluate(() => devicePixelRatio)] as const,
    );
  };

  /** Where About starts and the scroll of one step of the story (between the two triggers). */
  const storyScroll = (page: Page) =>
    page.locator(".about").evaluate((about) => {
      const triggerTop = (part: number) =>
        about.querySelector<HTMLElement>(`[data-story-trigger="${part}"]`)?.offsetTop ?? 0;
      return {
        top: about.getBoundingClientRect().top + scrollY,
        step: triggerTop(2) - triggerTop(1),
      };
    });

  /** Scrolls to a point of the story, in steps from where About pins (0) to where it moves on (4),
      then lets one animation frame run on the paused clock. */
  const scrollToStep = async (page: Page, position: number) => {
    const { top, step } = await storyScroll(page);
    await page.evaluate(
      (y: number) => {
        window.scrollTo({ top: y, behavior: "instant" });
      },
      Math.round(top + position * step),
    );
    await page.waitForTimeout(100);
    await page.clock.runFor(50);
  };

  const opacity = (locator: Locator) =>
    locator.evaluate((element) => Number(getComputedStyle(element).opacity));

  const stage = (page: Page) => page.locator(".stage");
  const storySteps = (page: Page) => page.locator(".about__stack .about__step");

  test.beforeEach(async ({ page }) => {
    await pauseClock(page);
    await page.goto("fr/");
  });

  test("the text follows the scroll, forwards and back; time alone does not move it", async ({
    page,
    isMobile,
  }) => {
    const title = page.locator(".about__title");
    const steps = storySteps(page);
    const [firstText, secondText, link, contact] = [0, 1, 2, 3].map((index) => steps.nth(index));
    if (!firstText || !secondText || !link || !contact) {
      throw new Error("About has four blocks of text");
    }

    await scrollToStep(page, -1);
    expect(await shown(title), "the title waits for About to settle").toBe(0);
    expect(await shown(firstText)).toBe(0);
    await expect(title).toHaveCSS("opacity", "0");

    await scrollToStep(page, -0.25);
    expect(await shown(title), "the title, half way in").toBeCloseTo(0.5, 1);
    await expect(title, "it fades, it does not rise").toHaveCSS("translate", "none");

    await scrollToStep(page, 0.4);
    expect(await shown(title)).toBe(1);
    expect(await shown(firstText), "part 1, half way through its step").toBeCloseTo(0.5, 1);
    await expect(firstText).not.toHaveCSS("opacity", "0");
    const halfHeight = present(await firstText.boundingBox(), "part 1").height;
    await page.clock.runFor(5000);
    expect(await shown(firstText), "time alone does not move it").toBeCloseTo(0.5, 1);
    expect(await shown(secondText), "part 2 waits for its step").toBe(0);

    await scrollToStep(page, 0.9);
    expect(await shown(firstText)).toBe(1);
    if (isMobile) {
      const fullHeight = present(await firstText.boundingBox(), "part 1").height;
      expect(halfHeight / fullHeight, "it takes its height as it comes in").toBeCloseTo(0.5, 1);
    }

    await scrollToStep(page, 1.4);
    expect(await shown(secondText), "part 2, half way through its step").toBeCloseTo(0.5, 1);
    expect(await shown(link)).toBe(0);

    await scrollToStep(page, 2.3);
    expect(await shown(secondText)).toBe(1);
    expect(await shown(link), "a pause to read part 2 before the link").toBe(0);
    expect(await shown(contact)).toBe(0);
    await page.clock.runFor(5000);
    expect(await shown(link), "time alone does not bring it").toBe(0);

    await scrollToStep(page, 2.55);
    expect(await shown(link), "the link, half way in").toBeCloseTo(0.5, 1);
    expect(await shown(contact), "the contact after it").toBe(0);

    await scrollToStep(page, 3.1);
    for (const step of [title, firstText, secondText, link, contact]) {
      await settled(step);
    }
    await noSideScroll(page);

    await scrollToStep(page, 0.4);
    expect(await shown(firstText), "scrolled back, part 1 half way again").toBeCloseTo(0.5, 1);
    for (const step of [secondText, link, contact]) {
      expect(await shown(step), "scrolled back, the later blocks go").toBe(0);
    }
  });

  test("a fast scroll past About still shows all its text, the photo catching up one change at a time", async ({
    page,
  }) => {
    const picture = await pictureOf(page);
    await scrollToStep(page, -1);
    await scrollToStep(page, 4.2);
    for (const step of await page.locator(".about__step").all()) {
      expect(await shown(step), "every block in at once").toBe(1);
    }
    await expect(stage(page), "part 1's photo first").toHaveAttribute("data-story", "paramedic");
    await scrollToStep(page, 3.5);
    for (const step of await page.locator(".about__step").all()) {
      await settled(step);
    }
    await page.clock.runFor(PARAMEDIC_HELD_MS);
    await expect(stage(page), "then part 2's").toHaveAttribute("data-story", "agent");
    await expect.poll(() => layerOffsets(page, picture)).toEqual(agentBack);
  });

  test("the overlay rises with each part's text, its white base comes in with the link and contact", async ({
    page,
  }) => {
    test.skip(!(await page.locator(".about__media").isVisible()), "phones: text over the photo");
    /** The blur's height in heights of the picture, and the white base's opacity. */
    const overlay = () =>
      page.locator(".about__media").evaluate((media) => {
        const blur = parseFloat(getComputedStyle(media, "::after").height);
        const share = Math.round((blur / media.getBoundingClientRect().height) * 100) / 100;
        return { share, base: Number(getComputedStyle(media, "::before").opacity) };
      });

    await scrollToStep(page, -1);
    expect(await overlay(), "none before the story").toEqual({ share: 0, base: 0 });

    await scrollToStep(page, 0.4);
    expect((await overlay()).share, "half way up his lower part").toBeCloseTo(0.3, 1);
    await page.clock.runFor(5000);
    expect((await overlay()).share, "time alone does not move it").toBeCloseTo(0.3, 1);

    await scrollToStep(page, 0.9);
    expect((await overlay()).share, "over his lower part").toBeCloseTo(0.61, 2);

    await scrollToStep(page, 1.9);
    expect((await overlay()).share, "over all of him").toBeGreaterThanOrEqual(1);
    expect((await overlay()).base).toBe(0);

    await scrollToStep(page, 2.3);
    expect((await overlay()).base, "not yet while part 2 is read").toBe(0);

    await scrollToStep(page, 2.7);
    expect((await overlay()).base, "the white base, half way in").toBeCloseTo(0.5, 1);

    await scrollToStep(page, 3.1);
    expect((await overlay()).base).toBe(1);

    await scrollToStep(page, 0.9);
    expect(await overlay(), "scrolled back, it goes down again").toEqual({ share: 0.61, base: 0 });
  });

  test("each photo change starts as its part's first line is in, then plays on its own clock, one at a time", async ({
    page,
    isMobile,
  }) => {
    test.skip(!isMobile, "phones: each block grows line by line");
    const picture = ".about__card";
    const firstText = storySteps(page).nth(0);
    /** Height shown of part 1, in lines of its text. */
    const linesShown = () =>
      firstText.evaluate((step) => {
        const text = step.firstElementChild ?? step;
        const lineHeight = Number.parseFloat(getComputedStyle(text).lineHeight);
        return step.getBoundingClientRect().height / lineHeight;
      });

    await scrollToStep(page, -1);
    await expect(stage(page)).toHaveAttribute("data-story", "start");
    expect(await layerOffsets(page, picture)).toEqual({ agent: 0, paramedic: 1, back: -1 });

    await scrollToStep(page, 0.05);
    await page.clock.runFor(2000);
    expect(await linesShown(), "part 1 just starting").toBeLessThan(1);
    await expect(stage(page), "the agent until its first line is in").toHaveAttribute(
      "data-story",
      "start",
    );

    await scrollToStep(page, 0.3);
    expect(await linesShown(), "its first line in").toBeGreaterThanOrEqual(1);
    expect(await opacity(firstText), "the rest still coming").toBeLessThan(1);
    await expect(stage(page), "the paramedic comes with it").toHaveAttribute(
      "data-story",
      "paramedic",
    );
    await expect.poll(() => layerOffsets(page, picture)).toEqual(paramedicOnly);

    await page.clock.runFor(PARAMEDIC_HELD_MS);
    await scrollToStep(page, 2);
    await expect(stage(page), "part 2's photo").toHaveAttribute("data-story", "agent");
    await expect.poll(() => layerOffsets(page, picture)).toEqual(agentBack);
  });

  test("once the agent is back, scrolling up never brings the paramedic again", async ({
    page,
  }) => {
    const picture = await pictureOf(page);
    await scrollToStep(page, -1);
    await scrollToStep(page, 0.5);
    await page.clock.runFor(PARAMEDIC_HELD_MS);
    await scrollToStep(page, 1.9);
    await page.clock.runFor(900);
    await expect(stage(page)).toHaveAttribute("data-story", "agent");

    for (const position of [1.02, 0.5, -1, 0.5, 1.9]) {
      await scrollToStep(page, position);
      await page.clock.runFor(PARAMEDIC_HELD_MS);
      await expect(stage(page), `at ${position}, still the agent`).toHaveAttribute(
        "data-story",
        "agent",
      );
    }
    await expect.poll(() => layerOffsets(page, picture)).toEqual(agentBack);
  });

  test("the paramedic stays at least 2 seconds once in, even if the scroll moves on at once", async ({
    page,
  }) => {
    const picture = await pictureOf(page);
    await scrollToStep(page, -1);
    await scrollToStep(page, 0.3);
    await expect(stage(page)).toHaveAttribute("data-story", "paramedic");
    await expect.poll(() => layerOffsets(page, picture)).toEqual(paramedicOnly);

    await scrollToStep(page, -1);
    await page.clock.runFor(PARAMEDIC_HELD_MS - 100);
    await expect(stage(page), "scrolled back at once: he stays").toHaveAttribute(
      "data-story",
      "paramedic",
    );
    await page.clock.runFor(100);
    await expect(stage(page), "then the agent returns").toHaveAttribute("data-story", "start");

    await page.clock.runFor(900);
    await scrollToStep(page, 0.3);
    await scrollToStep(page, 2);
    await page.clock.runFor(PARAMEDIC_HELD_MS - 100);
    await expect(stage(page), "scrolled on at once: he stays").toHaveAttribute(
      "data-story",
      "paramedic",
    );
    await page.clock.runFor(100);
    await expect(stage(page)).toHaveAttribute("data-story", "agent");
  });

  test("a fast scroll changes the photo one at a time, in order", async ({ page }) => {
    const picture = await pictureOf(page);
    await scrollToStep(page, -1);
    await scrollToStep(page, 2);
    await expect(stage(page), "part 1's photo first").toHaveAttribute("data-story", "paramedic");
    await expect.poll(() => layerOffsets(page, picture)).toEqual(paramedicOnly);
    await page.clock.runFor(PARAMEDIC_HELD_MS);
    await expect(stage(page), "then part 2's").toHaveAttribute("data-story", "agent");
    await expect.poll(() => layerOffsets(page, picture)).toEqual(agentBack);
  });

  test("the title above the agent, the text at the bottom over him, clear of the menu corner", async ({
    page,
    isMobile,
  }) => {
    test.skip(!isMobile, "phone layout");
    await scrollToStep(page, 3.1);
    const contact = page.locator(".about__contact");
    await settled(contactStep(page));
    await expect(page.locator(".about__title")).toHaveCSS("opacity", "1");
    const title = present(await page.locator(".about__body h2").boundingBox(), "the title");
    const card = present(await page.locator(".about__card").boundingBox(), "the agent");
    expect(card.y, "the agent starts below the title").toBeGreaterThanOrEqual(
      title.y + title.height - 1,
    );
    const clear = await contact.evaluate((element) => {
      const box = element.getBoundingClientRect();
      const cornerX = parseFloat(
        getComputedStyle(document.documentElement).getPropertyValue("--corner-x"),
      );
      const slope = Math.tan((27.5 * Math.PI) / 180);
      return cornerX + (innerHeight - box.bottom) * slope - box.right;
    });
    expect(clear, "the text ends left of the corner's line").toBeGreaterThanOrEqual(0);
    await expect(contact).toBeInViewport({ ratio: 1 });
    await expect(page.locator(".about__pin")).toHaveCSS("position", "sticky");
  });

  test("the text at AA over the picture at each step", async ({ page, isMobile }) => {
    test.skip(!isMobile, "phones: text over the photo");
    const picture = ".about__card";
    const text =
      ".about__stack :is(.about__line, .about__actions a, .about__contact li, .about__contact a)";

    await scrollToStep(page, 0.9);
    await expect.poll(() => layerOffsets(page, picture)).toEqual(paramedicOnly);
    for (const ratio of await worstContrast(page, text)) {
      expect(ratio, "part 1 over the paramedic").toBeGreaterThanOrEqual(4.5);
    }

    await scrollToStep(page, 1.9);
    await page.clock.runFor(PARAMEDIC_HELD_MS);
    await expect.poll(() => layerOffsets(page, picture)).toEqual(agentBack);
    for (const ratio of await worstContrast(page, text)) {
      expect(ratio, "parts 1 and 2 over the agent").toBeGreaterThanOrEqual(4.5);
    }

    await scrollToStep(page, 3.1);
    for (const ratio of await worstContrast(page, text)) {
      expect(ratio, "the whole text over the agent").toBeGreaterThanOrEqual(4.5);
    }
  });

  test("a link reached with the keyboard shows even before its part of the story", async ({
    page,
  }) => {
    const step = page.locator(".about__step", { has: page.locator(".about__actions") });
    await scrollToStep(page, 0.4);
    expect(await opacity(step)).toBe(0);
    await step.locator("a").focus();
    await expect(step).toHaveCSS("opacity", "1");
    await expect
      .poll(async () => (await step.boundingBox())?.height ?? 0, { message: "it takes its space" })
      .toBeGreaterThan(10);
  });

  test("desktop: the title stays in place, and the whole text a step on screen before About moves on", async ({
    page,
    isMobile,
  }) => {
    test.skip(isMobile, "desktop layout");
    const title = page.locator(".about__title");
    await scrollToStep(page, 0);
    await settled(title);
    const start = present(await title.boundingBox(), "the title");
    await scrollToStep(page, 3);
    await settled(contactStep(page));
    const end = present(await title.boundingBox(), "the title at the end");
    expect(end.y, "the text never pushes it up").toBeCloseTo(start.y, 0);

    await scrollToStep(page, 3.95);
    await expect(page.locator(".about__contact")).toBeInViewport({ ratio: 1 });
    await expect(page.locator(".about__pin")).toHaveCSS("position", "sticky");
  });
});

test.describe("About story with reduced motion", () => {
  test.use({ reducedMotion: "reduce" });

  test("both parts show at once, with the agent photo only", async ({ page }) => {
    await page.goto("fr/#about");
    for (const line of await page.locator(".about__line").all()) {
      await expect(line).toHaveCSS("opacity", "1");
    }
    await expect(page.locator(".agent-photos__layer--paramedic").first()).toBeHidden();
    await expect(page.locator(".about__pin")).not.toHaveCSS("position", "sticky");
  });
});
