// Content files: their types, inferred from the JSON so they follow content changes, and the
// helpers the build (eleventy.config.ts) and the tests (tests/support/site.ts) share.
import fs from "node:fs";

export type Lang = "fr" | "en";

export type Translated<T = string> = Record<Lang, T>;

export type Site = typeof import("../_data/site.json");
export type Agent = typeof import("../content/agent.json");
export type Menu = typeof import("../content/menu.json");
export type Listing = (typeof import("../content/listings/listings.json"))[number];

/** The text of the site, one file per page or shared part, each with { fr, en } at every text. */
export interface Copy {
  home: typeof import("../content/pages/home.json");
  contact: typeof import("../content/pages/contact.json");
  properties: typeof import("../content/pages/properties.json");
  menu: Menu;
  footer: typeof import("../content/footer.json");
  forms: typeof import("../content/forms.json");
}

const COPY_FILES: Record<keyof Copy, string> = {
  home: "content/pages/home.json",
  contact: "content/pages/contact.json",
  properties: "content/pages/properties.json",
  menu: "content/menu.json",
  footer: "content/footer.json",
  forms: "content/forms.json",
};

export interface ContentPage {
  title: Translated;
  description: Translated;
  body: Translated;
  updated?: Translated;
  reviewPending?: boolean;
  draftBanner?: { title: Translated; text: Translated };
  updatedLabel?: Translated;
}

/** A content tree with { fr, en } pairs at its texts; this is the same tree with one language picked. */
export type Picked<T> = T extends Translated
  ? string
  : T extends object
    ? { [Key in keyof T]: Picked<T[Key]> }
    : T;

/** Reads a content file. Read at build time, not imported, so `npm start` picks up CMS edits. */
/** The caller states the file's type (`readJson(path) as Site`): JSON is not checked at run time. */
export const readJson = (filePath: string): unknown =>
  JSON.parse(fs.readFileSync(filePath, "utf8"));

export const isLang = (value: unknown): value is Lang => value === "fr" || value === "en";

export const isTranslated = (value: unknown): value is Translated =>
  typeof value === "object" &&
  value !== null &&
  "fr" in value &&
  "en" in value &&
  typeof value.fr === "string" &&
  typeof value.en === "string";

/** The copy tree with one language picked at every { fr, en } leaf. */
export const pick = <T>(node: T, lang: Lang): Picked<T> => {
  if (isTranslated(node)) {
    return node[lang] as Picked<T>;
  }
  if (typeof node !== "object" || node === null) {
    return node as Picked<T>;
  }
  if (Array.isArray(node)) {
    return node.map((item: unknown) => pick(item, lang)) as Picked<T>;
  }
  return Object.fromEntries(
    Object.entries(node).map(([key, value]) => [key, pick(value, lang)]),
  ) as Picked<T>;
};

/** Every copy file, read now. */
export const readCopy = (): Copy =>
  Object.fromEntries(
    Object.entries(COPY_FILES).map(([key, filePath]) => [key, readJson(filePath)]),
  ) as unknown as Copy;

/** The text of the site in one language, as templates read it: i18n[lang].home.hero.tagline. */
export const copyFor = (copy: Copy, lang: Lang) => pick(copy, lang);
