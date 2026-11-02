// Site data read from the same files the build uses, so tests follow content changes instead of
// hardcoding copy. `t(lang)` returns i18n.json for one language, merged like eleventy.config.js does.
import fs from "node:fs";

const readJson = (p) => JSON.parse(fs.readFileSync(p, "utf8"));

export const site = readJson("_data/site.json");
export const agent = readJson("content/agent.json");
const menu = readJson("content/menu.json");
/** Header menu links for one language, as the build renders them: [{ href, label }] (href without the /ced prefix). */
export const menuLinks = (lang) => menu.items
  .map((item) => ({ href: item.url[lang], label: item.label[lang] }))
  .filter((l) => l.href && l.label);
const copy = readJson("content/i18n.json");

const isPair = (v) => v && typeof v === "object" && typeof v.fr === "string" && typeof v.en === "string";
const pick = (node, lang) => isPair(node) ? node[lang]
  : Object.fromEntries(Object.entries(node).map(([k, v]) => [k, pick(v, lang)]));
export const t = (lang) => pick(copy, lang);

export const languages = site.languages;

/** Content pages (About, services, legal): content/pages/<key>.json, keyed by site.contentPages. */
export const content = Object.fromEntries(site.contentPages.map((key) => [key, readJson(`content/pages/${key}.json`)]));

/** Every page of the site: home per language, each form and content page per language, the listings page. */
export const pages = [
  ...languages.map((lang) => ({ name: `home-${lang}`, path: `${lang}/`, lang, alternates: Object.fromEntries(languages.map((l) => [l, `/${l}/`])) })),
  ...Object.entries(site.pages).flatMap(([key, urls]) => languages.map((lang) => ({
    name: `${key}-${lang}`, path: urls[lang].slice(1), lang, alternates: urls,
    ...(site.contentPages.includes(key) ? { contentKey: key } : { formKey: key }),
  }))),
  { name: "listings", path: "listings/", lang: "en" },
];

/** The site's URL for a path written in the templates (pathPrefix added). */
export const url = (p) => `/ced${p}`;
