// Site data read from the same files the build uses, so tests follow content changes instead of
// hardcoding copy. `copyFor(lang)` returns i18n.json for one language, merged like eleventy.config.ts does.
import {
  isLang,
  pick,
  readJson,
  type Agent,
  type ContentPage,
  type Copy,
  type Lang,
  type Listing,
  type Menu,
  type Site,
  type Translated,
} from "../../lib/content.ts";

export type { Lang } from "../../lib/content.ts";

export const site = readJson("_data/site.json") as Site;
export const agent = readJson("content/agent.json") as Agent;
export const listings = readJson("content/listings/listings.json") as Listing[];
const menu = readJson("content/menu.json") as Menu;

/** Header menu links for one language, as the build renders them: [{ href, label }] (href without the /ced prefix). */
export const menuLinks = (lang: Lang) =>
  menu.items
    .map((item) => ({ href: item.url[lang], label: item.label[lang] }))
    .filter((link) => link.href && link.label);

const copy = readJson("content/i18n.json") as Copy;
export const copyFor = (lang: Lang) => pick(copy, lang);

export const languages: Lang[] = site.languages.filter(isLang);

if (!isLang(site.defaultLang)) {
  throw new Error(`defaultLang in _data/site.json is not a language: ${site.defaultLang}`);
}
export const defaultLang: Lang = site.defaultLang;

/** Content pages (About, services, legal): content/pages/<key>.json, keyed by site.contentPages. */
export const content: Record<string, ContentPage> = Object.fromEntries(
  site.contentPages.map((key) => [key, readJson(`content/pages/${key}.json`) as ContentPage]),
);

/** One page of the site, with its URL in every language when it has one. */
export interface SitePage {
  name: string;
  path: string;
  lang: Lang;
  alternates?: Partial<Record<Lang, string>>;
  contentKey?: string;
  formKey?: string;
}

/** Every page of the site: home per language, each form and content page per language, the listings page. */
export const pages: SitePage[] = [
  ...languages.map((lang) => ({
    name: `home-${lang}`,
    path: `${lang}/`,
    lang,
    alternates: Object.fromEntries(languages.map((language) => [language, `/${language}/`])),
  })),
  ...Object.entries(site.pages).flatMap(([key, urls]) =>
    languages.map((lang) => ({
      name: `${key}-${lang}`,
      path: urls[lang].slice(1),
      lang,
      alternates: urls,
      ...(site.contentPages.includes(key) ? { contentKey: key } : { formKey: key }),
    })),
  ),
  { name: "listings", path: "listings/", lang: "en" },
];

const pageUrls: Partial<Record<string, Translated>> = site.pages;

/** A page's path in one language (a key of site.pages), as written in the templates. */
export const pageUrl = (key: string, lang: Lang) => {
  const urls = pageUrls[key];
  if (!urls) {
    throw new Error(`No page "${key}" in _data/site.json`);
  }
  return urls[lang];
};

/**
 * The string at a key path in a copy object, for keys that come from data or are built at run time,
 * e.g. textAt(copy.contactOptions, option.id) or textAt(copy.services.buy, "action1.label").
 */
export const textAt = (record: object, keyPath: string) => {
  let value: unknown = record;
  for (const key of keyPath.split(".")) {
    value =
      typeof value === "object" && value !== null
        ? (value as Record<string, unknown>)[key]
        : undefined;
  }
  if (typeof value !== "string") {
    throw new Error(`No text "${keyPath}" in the copy`);
  }
  return value;
};

/** The site's URL for a path written in the templates (pathPrefix added). */
export const url = (pagePath: string) => `/ced${pagePath}`;
