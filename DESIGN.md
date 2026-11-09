# DESIGN.md

Scope: visual design and the REMAX visual identity. How to build it lives in
CLAUDE.md; content, trademark text and legal rules too.

Source of truth: the REMAX Brand Identity manual + U.S./Canada supplement v1.0
(2026), not in the repo. Questions or exceptions: standards@remax.com.

## Principles

- Base: Cream, White, Black, Dark Blue / Bridge Blue. Red and blue are accents.
- Light theme only. No dark mode.
- Mobile-first.
- Contrast: WCAG 2.1 AA, no exceptions.
- Motion: subtle, and only when the visitor has not asked for reduced motion.

## Colour

Brand tokens, defined once in `css/tokens.css`:

| Token                  | Name               | Hex       |
| ---------------------- | ------------------ | --------- |
| `--color-primary-red`  | Primary Red        | `#FF1200` |
| `--color-primary-blue` | Primary Blue       | `#0043FF` |
| `--color-dark-red`     | Dark Red           | `#660000` |
| `--color-dark-blue`    | Dark Blue          | `#000E35` |
| `--color-bridge-red`   | Bridge Red         | `#AA1120` |
| `--color-bridge-blue`  | Bridge Blue        | `#0C2749` |
| `--color-black`        | Black              | `#000000` |
| `--color-charcoal`     | Dark Charcoal Gray | `#232323` |
| `--color-cream`        | Cream              | `#F7F5EE` |
| `--color-white`        | White              | `#FFFFFF` |
| `--color-sky-blue`     | Sky Blue           | `#A3D4F2` |

Semantic roles (`--brand-*` in `css/tokens.css`) say what a colour is for, with
the contrast of each text pairing next to it. Prefer a role over a raw colour.

Where each colour may go:

- Text: Black on Cream or White. Muted text: `--brand-muted`.
- Links: Black, underlined; Bridge Red on hover.
- Primary Red as text: only large bold text (19px and up, e.g. the price,
  3.9:1 on white) or on Dark Blue (4.8:1). Never body text on a light
  background.
- Buttons: Dark Red (white text 13.4:1); Bridge Red on hover.
- Status pills: white text on Primary Blue (6.5:1).
- Focus: Primary Blue.
- Gradients: Primary Red and Primary Blue only.

## Typography

- Figtree for headings and buttons, Inter for text. Self-hosted variable fonts,
  Latin subset (covers French). Fallback: Arial, metric-matched to Inter
  (`Inter Fallback`) so the swap barely moves the text.
- Weights 300 to 700, through the `--font-*` tokens. Body text is Inter Light
  (300).
- Exception (Matteo, 2026-11-07): the manual specifies Montserrat (Light,
  Medium, Bold). The site uses Figtree + Inter by design choice.

## Layout

- One breakpoint, 768px: phones below, desktop from 768px. Write it as
  `width >= 768px` and `width <= 767.98px`. Add an in-between range only for one
  component that needs it.
- Gutter: 16px on phones, 24px on desktop, plus the safe-area insets.
- Content is aligned left from `--wrap-left` and at most `--wrap-max` (1320px)
  wide; background colours bleed to the screen edge.
- Fixed and full-bleed elements respect `env(safe-area-inset-*)`. iOS 26 Safari
  needs the page to run under its status bar and toolbar (see the `html` rules
  in `css/site.css`).
- No sideways scroll at any width.

## Shape and depth

- Corner radius: `--brand-radius` (6px). Pill buttons are fully rounded.
- Shadows: `--brand-shadow` and `--brand-shadow-strong` only.

## Logos

- Primary logotype (Balloon + REMAX): Black or Cream only.
- Secondary logotype (REMAX only): Black or Cream recommended; any brand colour,
  no gradients.
- Balloon: full colour only, always paired with the REMAX logotype. Stand-alone
  only on social profiles.
- Never place logos in a shape or box. Neutral background, no overlapping text
  or graphics.
- Clear space: at least half the height of the "X" in REMAX on all sides. The
  logo files' canvas already includes it.
- Never distort, outline, shadow, recolour, tilt, add text, or imitate with a
  font.
- The Balloon is never a bullet, icon or map marker.
- Do not put REMAX logos into generative AI tools.
- Office logo: full office name required, its height 50 to 100% of the REMAX
  capital height. No ® in office logos.
- Header: the REMAX logo with the full office name. Dark logo by default; Cream
  logo over the home page photo on phones.
- Agent personal mark (house + signature): not a REMAX mark. Must not contain
  "MAX", a slash, or the Balloon.

## Graphic elements

- Slash Design: one solid brand colour, fixed angle, never tilted, flipped,
  distorted, or surrounded by text.
- Slash patterns: Primary Red, Primary Blue, Black, Dark Red, Dark Blue, Cream.
  Angle -27.5° (`--slash-angle` in `css/site.css`).
- Two-colour angled design: Primary Blue / Dark Blue, Primary Red / Dark Red,
  Cream / Black. The hero uses Primary Red (1/4, next to the photo) and Dark Red
  (3/4); the phone menu corner reuses it.
- Outlined Balloon shape: background or framing only, single brand colour,
  never as a logo.

## Imagery

- Professional photography. Clipped agent photos where used. No clip art,
  cartoons or bitmojis.
- Text over a photo sits on a scrim that keeps it at AA (the hero is measured in
  the tests).

## Icons

- Lucide, inline SVG, for interface icons. Simple Icons for social networks
  only. Sources and licences: `_includes/icons/README.md`.
- An icon is decorative (`aria-hidden`) and has a text label, visible or
  visually hidden.

## Components

- Buttons, Figtree:
  - Text button (`.btn`): uppercase, bold, Dark Red; underlined in Bridge Red on
    hover.
  - Main action (`.btn--cta`): pill, white on Dark Red, Bridge Red on hover.
  - Outlined (`.btn--outline`): pill, 2px Dark Red border and label; fills Dark
    Red on hover.
- Listing card: photo fading into a Dark Charcoal Gray panel, price, address or
  neighbourhood, beds, baths, area, one button. Its structure is in CLAUDE.md.

## Focus

- Default: 3px Primary Blue outline, 2px offset, on `:focus-visible`.
- Form fields: Primary Blue border and a 3px tint halo instead of the outline.
- Listing card: the ring goes around the whole card when its link has focus.
- Elements focused by script (form step headings, success message) show no ring.
- Exception (Matteo, 2026-11-05): buttons (`.btn`, `<button>`, dialog close)
  show no focus ring, even from the keyboard. Design choice, not a brand rule.
  Buttons therefore do not meet WCAG 2.4.7. Links, form fields, radio tiles and
  listing cards keep their ring.

## Motion

- Animate only inside `@media (prefers-reduced-motion: no-preference)`, smooth
  scrolling included. With reduced motion, everything is shown in its final
  state.
- Content revealed on scroll must also show when it receives focus.

## Open decisions

- Scrims: the hero (black to transparent) and the card photo fade (transparent
  to Dark Charcoal Gray) are gradients outside Primary Red and Primary Blue.
  Allow neutral scrims for legibility, or replace them?
- Raw colours: may components use `--color-*` directly (`css/forms.css` does),
  or only `--brand-*` roles?
- Slash angle: the manual's -27.5° and the code's `27.5deg` likely measure from
  different references. State the direction in words.
- Radius scale: 6px is the token, but 3px and 16px are also in use. Make them
  tokens or drop them.
- Grain texture (`--grain`): not in the manual. Approved exception or remove?
- Hover: `css/forms.css` limits hover effects to `(hover: hover) and (pointer:
fine)`, `css/site.css` does not. Pick one rule.
- Slash Blue / Black hex values (the manual gives CMYK only).
- Whether the agent photo / Dynamic logo is used.
