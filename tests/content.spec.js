// Content pages (About, services, legal), edited in the CMS as content/pages/<key>.json:
// title and text in the page's language, and the review banner on legal drafts.
import { test, expect } from "./support/fixtures.js";
import { pages, content, t } from "./support/site.js";

for (const p of pages.filter((p) => p.contentKey)) {
  test(`${p.name}: title, text and review banner`, async ({ page }) => {
    const d = content[p.contentKey];
    await page.goto(p.path);
    await expect(page.locator("h1")).toHaveText(d.title[p.lang]);
    await expect(page.locator('meta[name="description"]')).toHaveAttribute("content", d.description[p.lang]);
    // First heading of the Markdown body is rendered
    const firstHeading = d.body[p.lang].match(/^## (.+)$/m);
    if (firstHeading) await expect(page.locator("main h2").first()).toHaveText(firstHeading[1]);

    // Drafts pending legal review: one banner before the title, one after the text
    const banners = page.locator("main > .legal-banner");
    if (d.reviewPending) {
      await expect(banners).toHaveCount(2);
      await expect(banners.first()).toContainText(t(p.lang).legal.pending);
      await expect(page.locator("main > :first-child")).toHaveClass(/legal-banner/);
      await expect(page.locator("main > :last-child")).toHaveClass(/legal-banner/);
    } else {
      await expect(banners).toHaveCount(0);
    }
  });
}
