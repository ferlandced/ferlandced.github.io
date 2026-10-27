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

  // CMS-managed single files (Decap "file" collections).
  eleventyConfig.addGlobalData("agent", () => readJson("content/agent.json"));
  eleventyConfig.addGlobalData("home", () => readJson("content/home.json"));
  eleventyConfig.addWatchTarget("content/");

  // CMS-managed listings (Decap "folder" collection), newest first.
  eleventyConfig.addCollection("listings", (api) =>
    api.getFilteredByGlob("content/listings/*.md").sort((a, b) => String(b.data.published).localeCompare(String(a.data.published)))
  );

  eleventyConfig.addFilter("money", (n) =>
    n === undefined || n === null || n === "" ? "" : new Intl.NumberFormat("en-CA", { style: "currency", currency: "CAD", maximumFractionDigits: 0 }).format(n)
  );
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
