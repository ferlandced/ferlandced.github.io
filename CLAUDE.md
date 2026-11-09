# CLAUDE.md

Scope: general website and brand guidelines. Feature-specific work (listing updater, etc.) is documented separately.

## Project

- Website for a REMAX real estate agent, Montreal, QC
- Bilingual: French (primary) and English
- Static site built with Eleventy (11ty), hosted on GitHub Pages
- Content via Decap CMS (git-based, Decap Turbo auth)
- Custom domain with no REMAX mark
- Repo is private for now and may go public later. Treat it as public: never commit secrets, brand manual PDFs, or personal data beyond the agent's published contact details.
- Architect: Matteo. Do not make architecture decisions; flag concerns and options with tradeoffs.

## Identity

- Agent: Cedrik Ferland, "Courtier immobilier résidentiel"
- Office: REMAX Privilège, "Agence immobilière"
- Office address: 103-7750 Boul. Cousineau, St-Hubert, Qc, J3Z 0C8
- Email: info@cedrikferland.com
- Phones: cell 450 776 4895, office 450 678 3150
- Tagline: « C'est l'humain derrière chaque transaction qui compte »
- Agent personal mark (house + signature): not a REMAX mark. Must not contain "MAX", a slash, or the Balloon.

## Source of truth

- REMAX Brand Identity manual + U.S./Canada supplement v1.0 (2026). Not in the repo.
- If local law and the manual differ, local law wins.
- Questions or exceptions: standards@remax.com

## Brand tokens (CSS custom properties, defined once; no hardcoded values elsewhere)

- Primary Red `#FF1200`
- Primary Blue `#0043FF`
- Dark Red `#660000`
- Dark Blue `#000E35`
- Bridge Red `#AA1120`
- Bridge Blue `#0C2749`
- Black `#000000`
- Dark Charcoal Gray `#232323`
- Cream `#F7F5EE`
- White `#FFFFFF`
- Sky Blue `#A3D4F2`
- Gradients: Primary Red and Primary Blue only.
- Typography: Figtree (headings, buttons) and Inter (text), self-hosted variable fonts, Arial fallback. Weights 300-700.
  - Exception (Matteo, 2026-11-07): the manual specifies Montserrat (Light, Medium, Bold). The site uses Figtree + Inter by design choice.

## Logo rules

- Primary logotype (Balloon + REMAX): Black or Cream only.
- Secondary logotype (REMAX only): Black or Cream recommended; any brand color, no gradients.
- Balloon: full color only. Always paired with the REMAX logotype. Stand-alone only on social profiles.
- Never place logos in a shape or box. Neutral background, no overlapping text or graphics.
- Clear space: at least half the height of the "X" in REMAX on all sides.
- Never distort, outline, shadow, recolor, tilt, add text, or imitate with a font.
- Balloon must not be used as a bullet, icon or map marker.
- Do not input REMAX logos into generative AI tools.
- Office logo: full office name required. Office name height 50-100% of REMAX capital height. No ® in office logos.

## Trademark text

- "REMAX" in capitals, no slash, never broken across lines, no plural or possessive. Use as adjective.
- ® once per piece at first or most prominent use, only when REMAX stands alone. Never with the office name.
- Do not create names, team names or logos containing "MAX", "/", "\" or "|".

## Graphic elements

- Slash Design: one solid brand color, fixed angle, never tilted, flipped, distorted, or surrounded by text.
- Slash patterns: Primary Red, Primary Blue, Black, Dark Red, Dark Blue, Cream. Angle -27.5°.
- Two-color angled design: Primary Blue/Dark Blue, Primary Red/Dark Red, Cream/Black.
- Outlined Balloon shape: background or framing only, single brand color, never as a logo.

## Mandatory content (home page required; sub-pages recommended)

- Full REMAX office name, prominent
- Office postal address, phone, email (no home address)
- "Each Office Independently Owned and Operated." English per manual. French wording must come from REMAX Québec. Do not write our own.
- Agent title and agency identification as required by OACIQ (wording and licence number display: TBC)
- Equal housing / fair housing compliance: no content that marginalizes people or neighbourhoods
- Footer on every page: office name, address, independence notice

## Content rules

- No misleading claims (market area, transactions, volume, awards, experience). Awards need year, scope, team vs individual.
- Do not advertise commission rates.
- Real REMAX Group: About Us section only, approved text only, REMAX more prominent. Never in header, footer, metatags or domain.
- No competitor disparagement. No political or controversial endorsements with REMAX marks.
- No "powered by" or combining other company logos with REMAX marks.
- Outbound links: REMAX website only, plus legal/required links.
- Mortgage rates/payments: no figures without compliant disclosure.

## Domain

- Custom domain with no "remax", "rmx" or "MAX" in it. No REMAX-named subdomains or redirects.

## Design rules

- Palette: Cream, White, Black, Dark Blue/Bridge Blue as base. Red and blue as accents.
- Header: REMAX logo with full office name.
- Photography: professional, clipped agent photos where used. No clip art, cartoons or bitmojis.
- Contrast: WCAG 2.1 AA minimum. No exceptions: the hero "Contact me" button is now Dark Red (white text passes AA).
- Focus visible: WCAG AA (2.4.7) except on buttons.
  - Exception (Matteo, 2026-11-05): buttons (`.btn`, `<button>`, dialog close) show no focus ring, even from the keyboard. Design choice, not a brand rule.
  - Links, form fields, radio tiles and listing cards keep their focus ring.
- Motion: subtle, respect `prefers-reduced-motion`.
- Mobile-first. Breakpoints TBD.
- Listing card: image, price, address/neighbourhood, beds/baths/area, one link and one button. One real `<a>` on the title, stretched over the card with CSS; it is the card's only link. Do not wrap the whole card in an anchor. Mark as external, `rel="noopener"`. A real `<button>` "More info", above the stretched link, opens one shared dialog to call or write the agent about that listing (a link to the Contact page without JS).

## Bilingual (Eleventy)

- URL structure: `/fr/` and `/en/` (TBC). Default French. `hreflang` on every page. Language switcher maps to the equivalent page.
- All UI strings in the content file of the page or part where they appear (`content/pages/<page>.json`, `menu.json`, `footer.json`, `forms.json`), French and English side by side. Agent details once, in `content/agent.json`. No hardcoded text in templates.
- French not less prominent than English (Bill 96). Content parity.
- Locale formatting `fr-CA` / `en-CA` (e.g. 450 000 $).
- Brand names (REMAX, office name) are not translated.
- Decap i18n: multi-file or multi-folder mode.

## Listings (general)

- Decap CMS is the source of truth. Agent's own listings only.
- No on-site listing detail pages. Cards link to the listing on remax.ca (FR site to FR page, EN site to EN page).
- Fields: Centris number, `remaxUrlFr`, `remaxUrlEn`, `status`, `lastVerified`, bilingual title and description, price, address/neighbourhood, beds, baths, area, photos.
- Photos: confirm usage rights. Do not hotlink remax.ca CDN.
- No per-listing pages means no `RealEstateListing` structured data. Intentional.

## Contact form and privacy

- Form sends an email to the agent only. No database or CRM on our side.
- Provider: Web3Forms, retention set to 7 days. Access key is public by design; restrict it to the site domain.
- hCaptcha: open in dev. Before production: consent gating (or confirm what it sets), domain-restricted key.
- Fields: name, email or phone, message, bilingual consent checkbox linking to the privacy policy.
- Privacy policy (FR and EN) required before launch. Must cover form data (7-day retention, storage outside Quebec), hCaptcha, analytics/cookies, contact for privacy requests. Needs legal or office privacy officer review.
- Law 25: consent for analytics/cookies. Self-host fonts (no third-party font CDN).

## Code conventions

- TBD (CSS approach, JS, image pipeline, testing)
- No lorem ipsum or stock copy in production.

## Open items

- French independence notice from REMAX Québec
- OACIQ identification wording and licence number display
- Slash Blue/Black hex values (CMYK only in manual)
- Privacy policy FR/EN
- Photo reuse rights
- Whether the agent photo / Dynamic logo is used
- Service photos (images/services/): usage rights, and the sell photo's sign is in English
- Final wording for the About story (three parts) and the two service texts, FR and EN
