// Home page content: hero, contact links, About, service buttons and info links,
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

    test("hero shows the agent, the agency and the tagline", async ({ page }) => {
      await expect(page.locator("h1")).toHaveText(agent.name);
      await expect(page.locator(".hero__tagline")).toHaveText(copyFor(lang).hero.tagline);
      await expect(page.locator(".hero__role")).toHaveText(agent.title[lang]);
      await expect(page.locator(".hero__agency")).toHaveText(
        [copyFor(lang).hero.agency, copyFor(lang).hero.area].filter(Boolean).join(", "),
      );
    });

    test("hero has one action: the contact popup, from a red button with an icon", async ({
      page,
    }) => {
      const action = page.locator(".hero a");
      await expect(action).toHaveCount(1);
      await expect(action).toHaveText(copyFor(lang).hero.cta);
      await expect(action).toHaveAttribute("href", url(site.pages.contact[lang]));
      await expect(action.locator("svg")).toBeVisible();
      await expect(action).toHaveCSS("background-color", "rgb(255, 18, 0)");
      await expect(action).toHaveCSS("color", "rgb(255, 255, 255)");
      const size = await action.evaluate((element) =>
        parseFloat(getComputedStyle(element).fontSize),
      );
      expect(
        size,
        "large text: white on Primary Red passes AA only from 18.66px bold",
      ).toBeGreaterThanOrEqual(18.66);
      await expect(action).toHaveCSS("font-weight", "700");

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

    test("each service links to its information page", async ({ page }) => {
      for (const id of ["buy", "sell", "rent"] as const) {
        const more = page.locator(`.service--${id} .service__more`);
        await expect(more).toHaveAttribute("href", url(site.pages[id][lang]));
        await expect(more).toHaveText(copyFor(lang).services[id].more);
      }
    });

    test("service buttons point to the form pages and open the matching dialog", async ({
      page,
    }) => {
      // Per service: each button's form and, for rentals, its intent
      const expected: Record<string, [form: string, intent?: string][]> = {
        buy: [["propertyAlert"]],
        sell: [["estimation"]],
        rent: [
          ["propertyAlert", "location"],
          ["estimation", "location"],
        ],
      };
      for (const [id, actions] of Object.entries(expected)) {
        const links = page.locator(`.service--${id} .service__actions a`);
        await expect(links).toHaveCount(actions.length);
        for (const [index, [key, intent]] of actions.entries()) {
          await expect(links.nth(index)).toHaveAttribute(
            "href",
            url(pageUrl(key, lang)) + (intent ? `?intent=${intent}` : ""),
          );
          await expect(links.nth(index)).toHaveAttribute("data-dialog", `dialog-${key}`);
          if (intent) {
            await expect(links.nth(index)).toHaveAttribute("data-intent", intent);
          } else {
            await expect(links.nth(index)).not.toHaveAttribute("data-intent", /.*/);
          }
          await expect(links.nth(index)).toHaveText(
            textAt(copyFor(lang).services, `${id}.action${index + 1}.label`),
          );
        }
      }
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
      await expect(more).toHaveAttribute(
        "aria-label",
        new RegExp(
          `^${copyFor(lang).properties.moreInfo}.*${item.property_kind[lang]}.*${item.no_inscription}`,
        ),
      );
      await card.scrollIntoViewIfNeeded();
      const onButton = await more.evaluate((element) => {
        const rect = element.getBoundingClientRect();
        return (
          document.elementFromPoint(rect.x + rect.width / 2, rect.y + rect.height / 2) === element
        );
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
      expect(text.x + text.width, "text ends before the agent").toBeLessThanOrEqual(agent.x);
      expect(agent.x + agent.width).toBeLessThanOrEqual(width);

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
        boxOf(".stage__agent img"),
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
  await expect(page.locator("body")).toHaveCSS("background-color", "rgb(255, 255, 255)");
  for (const id of ["#about", "#services", "#properties"]) {
    const color = await page
      .locator(id)
      .evaluate((element) => getComputedStyle(element).backgroundColor);
    expect(["rgb(255, 255, 255)", "rgba(0, 0, 0, 0)"], id).toContain(color);
  }
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

  const more = page.locator(".service__more").first();
  await page.keyboard.press("Tab");
  await more.focus();
  await expect(more).toHaveCSS("outline-style", "solid");
});

const delayOf = (locator: Locator) =>
  locator.evaluateAll((elements: HTMLElement[]) =>
    elements.map((element) => parseFloat(element.style.getPropertyValue("--reveal-delay"))),
  );

test("desktop: Services fades in row by row as it arrives, columns side by side together, and stays", async ({
  page,
  isMobile,
}) => {
  test.skip(isMobile, "desktop only: on phones the columns are stacked");
  await page.goto("fr/");
  const section = page.locator("#services");
  const heading = page.locator("#services-heading");
  const { top, vh } = await section.evaluate((element) => ({
    top: element.getBoundingClientRect().top + scrollY,
    vh: innerHeight,
  }));

  await scrollToY(page, top - vh);
  await expect(heading, "nothing shows before the section arrives").toHaveAttribute(
    "data-reveal",
    "",
  );

  await scrollToY(page, top - vh * 0.2);
  await expect(page.locator(".service__more").last()).toHaveAttribute("data-reveal", "in");
  const [headingDelay] = await delayOf(heading);
  let previous = present(headingDelay, "the Services heading delay");
  for (const part of [".service__title", ".service__text", ".service__actions", ".service__more"]) {
    const delays = await delayOf(page.locator(part));
    expect(new Set(delays).size, `every ${part} appears at the same time`).toBe(1);
    const delay = present(delays[0], `a delay on ${part}`);
    expect(delay, `${part} comes after the row above`).toBeGreaterThan(previous);
    previous = delay;
  }
  await expect(heading).toHaveCSS("opacity", "1");
  await expect(heading).toHaveCSS("translate", "none");

  await scrollToY(page, top + vh * 2);
  await expect(heading, "blocks stay once shown").toHaveAttribute("data-reveal", "in");
});

test("phones: each Services column fades in as it arrives", async ({ page, isMobile }) => {
  test.skip(!isMobile, "phones only");
  await page.goto("fr/");
  const columns = page.locator(".service");
  const first = await columns
    .first()
    .evaluate((element) => element.getBoundingClientRect().top + scrollY);
  await scrollToY(page, first - (await page.evaluate(() => innerHeight)) / 2);
  await expect(columns.first().locator(".service__title")).toHaveAttribute("data-reveal", "in");
  const lastTop = await columns
    .last()
    .evaluate((element) => element.getBoundingClientRect().top / innerHeight);
  expect(lastTop, "the last column is still below the trigger line").toBeGreaterThan(0.7);
  await expect(columns.last().locator(".service__title")).toHaveAttribute("data-reveal", "");
});

test("a link to a section lands with its blocks shown, and the sections above it too", async ({
  page,
}) => {
  await page.goto("fr/#properties");
  await expect(page.locator("#properties-heading")).toHaveAttribute("data-reveal", "in");
  await expect(page.locator("#services .service__more").last()).toHaveAttribute(
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
  await expect(page.locator(".about__card img")).toBeVisible();
});
