// Links and resources on every page: internal links and in-page anchors resolve, tel:/mailto: are well formed,
// outbound links are allowed by CLAUDE.md, forms post only to Web3Forms, and every image, script,
// stylesheet and font the page uses loads.
import { test, expect, WEB3FORMS } from "./support/fixtures.js";
import { pages, agent } from "./support/site.js";

// CLAUDE.md: outbound links to the REMAX website, plus legal/required links. The agent's own social
// profiles are listed in content/agent.json.
const ALLOWED_HOSTS = [/(^|\.)remax\.ca$/, /(^|\.)remax\.com$/, /(^|\.)remax-quebec\.com$/];
const allowedOutbound = (href) => Object.values(agent.social || {}).includes(href) || ALLOWED_HOSTS.some((re) => re.test(new URL(href).hostname));

for (const p of pages) {
  test(`${p.name}: links and resources`, async ({ page, request }) => {
    const failed = [];
    page.on("response", (r) => { if (r.url().includes("localhost") && r.status() >= 400 && !r.url().endsWith("/favicon.ico")) failed.push(`${r.status()} ${r.url()}`); });
    page.on("requestfailed", (r) => { if (r.url().includes("localhost")) failed.push(`failed ${r.url()}`); });
    await page.goto(p.path, { waitUntil: "networkidle" });
    // Lazy images: scroll through the page so they load too
    await page.evaluate(async () => { for (let y = 0; y < document.body.scrollHeight; y += 600) { window.scrollTo(0, y); await new Promise((r) => setTimeout(r, 30)); } });
    await page.waitForLoadState("networkidle");
    expect(failed, "resources that did not load").toEqual([]);

    const hrefs = await page.locator("a[href]").evaluateAll((as) => as.map((a) => a.getAttribute("href")));
    const checked = new Set();
    for (const href of hrefs) {
      if (href.startsWith("tel:")) { expect(href, "tel: format").toMatch(/^tel:\+1\d{10}$/); continue; }
      if (href.startsWith("mailto:")) { expect(href, "mailto: format").toMatch(/^mailto:[^@\s]+@[^@\s]+\.[a-z]{2,}$/i); continue; }
      if (href.startsWith("#")) { await expect(page.locator(href), `anchor ${href}`).toHaveCount(1); continue; }
      if (/^https?:/.test(href)) { expect(allowedOutbound(href), `outbound link ${href}`).toBe(true); continue; }
      expect(href, "internal links include the /ced/ prefix").toMatch(/^\/ced\//);
      const [path, hash] = href.split("#");
      if (!checked.has(path)) {
        checked.add(path);
        const res = await request.get(path);
        expect(res.status(), `link ${path}`).toBe(200);
      }
      if (hash) {
        const html = await (await request.get(path)).text();
        expect(html, `anchor #${hash} on ${path}`).toContain(`id="${hash}"`);
      }
    }

    const actions = await page.locator("form").evaluateAll((fs) => fs.map((f) => f.getAttribute("action")));
    for (const action of actions) expect(action, "form action").toBe(WEB3FORMS);
  });
}
