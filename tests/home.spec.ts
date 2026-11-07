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
      const tagline = copyFor(lang).hero.tagline;
      await expect(page.locator("h1")).toHaveText(agent.name);
      await expect(page.locator(".hero__tagline")).toHaveText(tagline.replaceAll("**", ""));
      const bold = [...tagline.matchAll(/\*\*(.+?)\*\*/g)].map((match) => match[1]);
      expect(bold.length, "the tagline has bold words").toBeGreaterThan(0);
      await expect(page.locator(".hero__tagline strong")).toHaveText(bold as string[]);
      await expect(page.locator(".hero__role")).toHaveText(agent.title[lang]);
      await expect(page.locator(".hero__agency")).toHaveCount(0);
    });

    test("hero has one action: the contact popup, from a Dark Red pill with an icon", async ({
      page,
    }) => {
      const action = page.locator(".hero a");
      await expect(action).toHaveCount(1);
      await expect(action).toHaveText(copyFor(lang).hero.cta);
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
        copyFor(lang).about.more,
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
      const services = copyFor(lang).services;
      await expect(page.locator(".service")).toHaveCount(2);
      const expected = {
        search: [
          ["buy", services.search.moreBuy],
          ["rent", services.search.moreRent],
        ],
        sell: [["sell", services.sell.more]],
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
        await expect(button).toHaveText(textAt(copyFor(lang).services, `${id}.action`));
      }
    });

    test("About tells the story in three parts, in reading order", async ({ page }) => {
      await expect(page.locator(".about__line")).toHaveText([
        agent.story_introduction[lang],
        agent.story_paramedic[lang],
        agent.story_today[lang],
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
      await expect(more).toHaveText(copyFor(lang).properties.moreInfo);
      await expect(more.locator("svg"), "phone icon").toHaveCount(1);
      await expect(more).toHaveAttribute(
        "aria-label",
        new RegExp(
          `^${copyFor(lang).properties.moreInfo}.*${item.property_kind[lang]}.*${item.no_inscription}`,
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
  const parts = [".hero__name", ".hero__role", ".hero__tagline"];
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

test("About: a link reached with the keyboard shows even before its part of the story", async ({
  page,
  isMobile,
}) => {
  test.skip(isMobile, "the held story text is desktop only");
  await page.goto("fr/");
  test.skip(
    !(await page.evaluate(
      () => CSS.supports("animation-timeline: view()") && CSS.supports("timeline-scope: --about"),
    )),
    "needs scroll-driven animations",
  );
  const step = page.locator('.about__actions[data-story-step="3"]');
  await expect(step, "part 3 waits at the top of the page").toHaveCSS("opacity", "0");
  await step.locator("a").focus();
  await expect(step).toHaveCSS("opacity", "1");
});

test("short landscape screens: the About text scrolls normally, all three parts shown", async ({
  page,
  isMobile,
}) => {
  test.skip(isMobile, "landscape phone size on the desktop layout");
  await page.setViewportSize({ width: 844, height: 390 });
  await page.goto("fr/#about");
  for (const line of await page.locator(".about__line").all()) {
    await expect(line).toHaveCSS("opacity", "1");
  }
  await expect(page.locator(".about__inner")).toHaveCSS("position", "static");
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth - innerWidth),
  ).toBeLessThanOrEqual(0);
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

test.describe("About story: the paramedic photo replaces the agent, then the agent comes back", () => {
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

  /** Scroll position at a fraction of the story's scroll range (the timeline's "contain" range).
      View timelines leave out the page's scroll-padding-top (the header), like the browser does. */
  const storyAt = (page: Page, subject: string, fraction: number) =>
    page.locator(subject).evaluate((element: HTMLElement, fraction: number) => {
      const inset = parseFloat(getComputedStyle(document.documentElement).scrollPaddingTop) || 0;
      const start = element.getBoundingClientRect().top + scrollY - inset;
      return start + (element.offsetHeight - (innerHeight - inset)) * fraction;
    }, fraction);

  const noSideScroll = async (page: Page) => {
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth - innerWidth),
      "no sideways scroll",
    ).toBeLessThanOrEqual(0);
  };

  test("in step with the scroll, never showing two photos side by side at rest", async ({
    page,
    isMobile,
  }) => {
    await page.goto("fr/");
    test.skip(
      !(await page.evaluate(
        () => CSS.supports("animation-timeline: view()") && CSS.supports("timeline-scope: --about"),
      )),
      "needs scroll-driven animations",
    );
    // Desktop: the pinned copy over About; phones: the card in About
    const container = isMobile ? ".about__card" : ".stage__agent";
    const subject = isMobile ? ".about__media" : ".about";
    const lines = page.locator(".about__line");

    await scrollToY(page, await storyAt(page, subject, 0));
    expect(await layerOffsets(page, container)).toEqual({ agent: 0, paramedic: 1, back: -1 });
    await noSideScroll(page);

    await scrollToY(page, await storyAt(page, subject, 0.5));
    expect(await layerOffsets(page, container), "paramedic only").toEqual({
      agent: -1,
      paramedic: 0,
      back: -1,
    });
    if (!isMobile) {
      await expect(lines.nth(1)).toHaveCSS("opacity", "1");
      await expect(lines.nth(2), "part 3 waits for the agent").toHaveCSS("opacity", "0");
    }
    await noSideScroll(page);

    await scrollToY(page, await storyAt(page, subject, 1));
    expect(await layerOffsets(page, container), "the agent again only").toEqual({
      agent: -1,
      paramedic: 1,
      back: 0,
    });
    await page.locator(".about__contact").scrollIntoViewIfNeeded();
    for (const line of await lines.all()) {
      await expect(line).toHaveCSS("opacity", "1");
    }
    await noSideScroll(page);
  });

  test.describe("with reduced motion", () => {
    test.use({ reducedMotion: "reduce" });

    test("all three parts show at once, with the agent photo only", async ({ page }) => {
      await page.goto("fr/#about");
      for (const line of await page.locator(".about__line").all()) {
        await expect(line).toHaveCSS("opacity", "1");
      }
      await expect(page.locator(".agent-photos__layer--paramedic").first()).toBeHidden();
    });
  });
});
