// Content pages (About, services, legal), edited in the CMS as content/pages/<key>.json:
// title and text in the page's language, and the review banner on legal drafts.
import { test, expect, present } from "./support/fixtures.ts";
import { pages, content, type SitePage } from "./support/site.ts";

const contentPages = pages.filter(
  (candidate): candidate is SitePage & { contentKey: string } => candidate.contentKey !== undefined,
);

for (const sitePage of contentPages) {
  const pageContent = present(content[sitePage.contentKey], `content for ${sitePage.contentKey}`);
  const firstHeading = /^## (.+)$/m.exec(pageContent.body[sitePage.lang])?.[1];

  test(`${sitePage.name}: title and description`, async ({ page }) => {
    await page.goto(sitePage.path);
    await expect(page.locator("h1")).toHaveText(pageContent.title[sitePage.lang]);
    await expect(page.locator('meta[name="description"]')).toHaveAttribute(
      "content",
      pageContent.description[sitePage.lang],
    );
  });

  if (firstHeading) {
    test(`${sitePage.name}: the Markdown body, from its first heading`, async ({ page }) => {
      await page.goto(sitePage.path);
      await expect(page.locator("main h2").first()).toHaveText(firstHeading);
    });
  }

  // Drafts pending legal review: one banner before the title, one after the text
  if (pageContent.reviewPending) {
    const bannerTitle = present(pageContent.draftBanner, `draft banner for ${sitePage.contentKey}`)
      .title[sitePage.lang];

    test(`${sitePage.name}: a review banner before the title and after the text`, async ({
      page,
    }) => {
      await page.goto(sitePage.path);
      const banners = page.locator("main > .legal-banner");
      await expect(banners).toHaveCount(2);
      await expect(banners.first()).toContainText(bannerTitle);
      await expect(page.locator("main > :first-child")).toHaveClass(/legal-banner/);
      await expect(page.locator("main > :last-child")).toHaveClass(/legal-banner/);
    });
  } else {
    test(`${sitePage.name}: no review banner`, async ({ page }) => {
      await page.goto(sitePage.path);
      await expect(page.locator("main > .legal-banner")).toHaveCount(0);
    });
  }
}
