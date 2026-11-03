import fs from "node:fs";
import { HtmlBasePlugin, RenderPlugin } from "@11ty/eleventy";

const readJson = (p) => JSON.parse(fs.readFileSync(p, "utf8"));

export default function (eleventyConfig) {
  // Write links as "/listings/"; the base plugin prefixes them with pathPrefix at build time.
  eleventyConfig.addPlugin(HtmlBasePlugin);
  // Adds the renderContent filter, used to render Markdown fields from JSON data.
  eleventyConfig.addPlugin(RenderPlugin);

  // Static files, copied as-is. /admin is the Decap CMS and must not be processed.
  ["admin", "css", "js", "images", "fonts"].forEach((dir) => eleventyConfig.addPassthroughCopy(dir));
  eleventyConfig.ignores.add("admin/**");
  eleventyConfig.ignores.add("README.md");
  eleventyConfig.ignores.add("CLAUDE.md");
  // Tests (Playwright) and their outputs: not site content, and their writes must not trigger rebuilds.
  ["tests/**", "test-results/**", "playwright-report/**", "screenshots/**", "coverage/**", "_site-test/**"].forEach((glob) => {
    eleventyConfig.ignores.add(glob);
    eleventyConfig.watchIgnores.add(glob);
  });

  // CMS-managed single files (Decap "file" collections).
  eleventyConfig.addGlobalData("agent", () => readJson("content/agent.json"));
  eleventyConfig.addGlobalData("home", () => readJson("content/home.json"));
  // Header menu: a label and a URL per language for each item.
  eleventyConfig.addGlobalData("menu", () => readJson("content/menu.json"));
  // Site copy: content/i18n.json holds {fr, en} pairs at every leaf. Templates read it per
  // language as i18n[lang], e.g. i18n.fr.nav.open. Office identity is merged from site.json.
  eleventyConfig.addGlobalData("i18n", () => {
    const copy = readJson("content/i18n.json");
    const site = readJson("_data/site.json");
    const isPair = (v) => v && typeof v === "object" && typeof v.fr === "string" && typeof v.en === "string";
    const pick = (node, lang) => isPair(node) ? node[lang]
      : Object.fromEntries(Object.entries(node).map(([k, v]) => [k, pick(v, lang)]));
    return Object.fromEntries(site.languages.map((lang) => {
      const t = pick(copy, lang);
      const o = site.office;
      t.office = { ...t.office, name: o.name, nameSuffix: o.nameSuffix, address: o.address, phone: o.phone,
        independence: o.independence[lang], independenceLang: o.independenceLang[lang] };
      return [lang, t];
    }));
  });
  // Content pages (About, services, legal): content/pages/<key>.json, listed in site.contentPages.
  // One entry per page and language, so page.njk paginates over a flat list.
  eleventyConfig.addGlobalData("contentPages", () => {
    const site = readJson("_data/site.json");
    return site.contentPages.flatMap((key) => {
      const data = readJson(`content/pages/${key}.json`);
      return site.languages.map((lang) => ({ key, lang, data }));
    });
  });
  eleventyConfig.addGlobalData("listings", () => readJson("content/listings/listings.json"));
  eleventyConfig.addWatchTarget("content/");

  // CMS-managed listings (Decap "folder" collection), newest first.
  eleventyConfig.addCollection("listings", (api) =>
    api.getFilteredByGlob("content/listings/*.md").sort((a, b) => String(b.data.published).localeCompare(String(a.data.published)))
  );

  eleventyConfig.addFilter("money", (n) =>
    n === undefined || n === null || n === "" ? "" : new Intl.NumberFormat("en-CA", { style: "currency", currency: "CAD", maximumFractionDigits: 0 }).format(n)
  );
  eleventyConfig.addFilter("listingPrice", (price, lang) => lang === "fr" ? String(price).replace(/(\d)\s*\$/, "$1\u00A0$") : price);
  eleventyConfig.addFilter("head", (arr, n) => (n < 0 ? arr.slice(n) : arr.slice(0, n)));
  eleventyConfig.addFilter("year", () => new Date().getFullYear());

  return {
    templateFormats: ["njk", "md"],
    markdownTemplateEngine: "njk",
    htmlTemplateEngine: "njk",
    pathPrefix: "/ced/",
    dir: { input: ".", includes: "_includes", output: "_site" },
  };
}
