import fs from "node:fs";
import path from "node:path";
import { stripTypeScriptTypes } from "node:module";
import { HtmlBasePlugin, RenderPlugin } from "@11ty/eleventy";
import type UserConfig from "@11ty/eleventy/UserConfig";
import {
  isLang,
  pick,
  readJson,
  type ContentPage,
  type Copy,
  type Lang,
  type Site,
} from "./lib/content.ts";

// Scripts the browser loads. Types are stripped and replaced with spaces, so every line and column
// of the served .js matches its .ts source: no source maps needed to debug, and coverage lines match.
const BROWSER_SCRIPTS = ["js/site.ts", "js/forms.ts", "admin/preview.ts"];

const buildBrowserScripts = (outputDirectory: string) => {
  for (const source of BROWSER_SCRIPTS) {
    const target = path.join(outputDirectory, source.replace(/\.ts$/, ".js"));
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, stripTypeScriptTypes(fs.readFileSync(source, "utf8")));
  }
};

export default function (eleventyConfig: UserConfig) {
  // Write links as "/listings/"; the base plugin prefixes them with pathPrefix at build time.
  eleventyConfig.addPlugin(HtmlBasePlugin);
  // Adds the renderContent filter, used to render Markdown fields from JSON data.
  eleventyConfig.addPlugin(RenderPlugin);

  eleventyConfig.on("eleventy.before", ({ directories }: { directories: { output: string } }) => {
    buildBrowserScripts(directories.output);
  });
  BROWSER_SCRIPTS.forEach((source) => {
    eleventyConfig.addWatchTarget(source);
  });

  // Static files, copied as-is. /admin is the Decap CMS and must not be processed.
  for (const source of ["admin/*.{html,css,yml}", "css", "images", "fonts"]) {
    eleventyConfig.addPassthroughCopy(source);
  }
  eleventyConfig.ignores.add("admin/**");
  eleventyConfig.ignores.add("README.md");
  eleventyConfig.ignores.add("CLAUDE.md");
  // Tests (Playwright) and their outputs: not site content, and their writes must not trigger rebuilds.
  [
    "tests/**",
    "test-results/**",
    "playwright-report/**",
    "screenshots/**",
    "coverage/**",
    "_site-test/**",
  ].forEach((glob) => {
    eleventyConfig.ignores.add(glob);
    eleventyConfig.watchIgnores?.add(glob);
  });

  // CMS-managed single files (Decap "file" collections).
  eleventyConfig.addGlobalData("agent", () => readJson("content/agent.json"));
  eleventyConfig.addGlobalData("home", () => readJson("content/home.json"));
  // Header menu: a label and a URL per language for each item.
  eleventyConfig.addGlobalData("menu", () => readJson("content/menu.json"));
  // Site copy: content/i18n.json holds {fr, en} pairs at every leaf. Templates read it per
  // language as i18n[lang], e.g. i18n.fr.nav.open. Office identity is merged from site.json.
  eleventyConfig.addGlobalData("i18n", () => {
    const copy = readJson("content/i18n.json") as Copy;
    const site = readJson("_data/site.json") as Site;
    const office = site.office;
    return Object.fromEntries(
      site.languages.filter(isLang).map((lang) => {
        const strings = pick(copy, lang);
        return [
          lang,
          {
            ...strings,
            office: {
              ...strings.office,
              name: office.name,
              nameSuffix: office.nameSuffix,
              address: office.address,
              phone: office.phone,
              independence: office.independence[lang],
              independenceLang: office.independenceLang[lang],
            },
          },
        ];
      }),
    );
  });
  // Content pages (About, services, legal): content/pages/<key>.json, listed in site.contentPages.
  // One entry per page and language, so page.njk paginates over a flat list.
  eleventyConfig.addGlobalData("contentPages", () => {
    const site = readJson("_data/site.json") as Site;
    return site.contentPages.flatMap((key) => {
      const data = readJson(`content/pages/${key}.json`) as ContentPage;
      return site.languages.map((lang) => ({ key, lang, data }));
    });
  });
  eleventyConfig.addGlobalData("listings", () => readJson("content/listings/listings.json"));
  eleventyConfig.addWatchTarget("content/");

  // CMS-managed listings (Decap "folder" collection), newest first.
  eleventyConfig.addCollection(
    "listings",
    (api: { getFilteredByGlob(glob: string): { data: { published?: unknown } }[] }) =>
      api
        .getFilteredByGlob("content/listings/*.md")
        .sort((first, second) =>
          String(second.data.published).localeCompare(String(first.data.published)),
        ),
  );

  eleventyConfig.addFilter("money", (amount: number | string | null | undefined) =>
    amount === undefined || amount === null || amount === ""
      ? ""
      : new Intl.NumberFormat("en-CA", {
          style: "currency",
          currency: "CAD",
          maximumFractionDigits: 0,
        }).format(Number(amount)),
  );
  eleventyConfig.addFilter("listingPrice", (price: number | string, lang: Lang) =>
    lang === "fr" ? String(price).replace(/(\d)\s*\$/, "$1 $") : price,
  );
  eleventyConfig.addFilter("head", <T>(array: T[], count: number) =>
    count < 0 ? array.slice(count) : array.slice(0, count),
  );
  eleventyConfig.addFilter("year", () => new Date().getFullYear());
  // Short CMS texts (e.g. the hero tagline): escapes the text, then **words** become bold,
  // _words_ smaller and lighter (<span class="text-light">), and a new line a line break.
  eleventyConfig.addFilter("inlineMarkup", (text: string | null | undefined) =>
    (text ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll(/\*\*(.+?)\*\*/gs, "<strong>$1</strong>")
      .replaceAll(/_(.+?)_/gs, '<span class="text-light">$1</span>')
      .replaceAll(/\s*\r?\n\s*/g, " <br>"),
  );

  return {
    templateFormats: ["njk", "md"],
    markdownTemplateEngine: "njk",
    htmlTemplateEngine: "njk",
    pathPrefix: "/ced/",
    dir: { input: ".", includes: "_includes", output: "_site" },
  };
}
