// Content pages (About, services, legal), edited in the CMS as content/pages/<key>.json:
// title and text in the page's language, and the review banner on legal drafts.
import { test, expect, present } from "./support/fixtures.ts";
import { pages, content, copyFor, type SitePage } from "./support/site.ts";

const contentPages = pages.filter(
  (candidate): candidate is SitePage & { contentKey: string } => candidate.contentKey !== undefined,
);

for (const sitePage of contentPages) {
  test(`${sitePage.name}: title, text and review banner`, async ({ page }) => {
    const pageContent = present(content[sitePage.contentKey], `content for ${sitePage.contentKey}`);
    await page.goto(sitePage.path);
    await expect(page.locator("h1")).toHaveText(pageContent.title[sitePage.lang]);
    await expect(page.locator('meta[name="description"]')).toHaveAttribute(
      "content",
      pageContent.description[sitePage.lang],
    );
    // First heading of the Markdown body is rendered
    const firstHeading = /^## (.+)$/m.exec(pageContent.body[sitePage.lang])?.[1];
    if (firstHeading) {
      await expect(page.locator("main h2").first()).toHaveText(firstHeading);
    }

    // Drafts pending legal review: one banner before the title, one after the text
    const banners = page.locator("main > .legal-banner");
    if (pageContent.reviewPending) {
      await expect(banners).toHaveCount(2);
      await expect(banners.first()).toContainText(copyFor(sitePage.lang).legal.pending);
      await expect(page.locator("main > :first-child")).toHaveClass(/legal-banner/);
      await expect(page.locator("main > :last-child")).toHaveClass(/legal-banner/);
    } else {
      await expect(banners).toHaveCount(0);
    }
  });
}
