# Tests

End-to-end tests with [Playwright](https://playwright.dev), on the built site.

```sh
npx playwright install chromium webkit   # once, downloads the browsers
npm test                                 # everything
npm test -- --project=chromium-desktop   # one device
npm test -- tests/forms.spec.js          # one file
npm run test:report                      # open the HTML report of the last run
```

`npm test` builds the site into `_site-test/` (not `_site/`, so a running `npm start` cannot change files
mid-test), serves it under `/ced/` on port 8090, and runs every spec on four devices:
`chromium-desktop`, `chromium-phone`, `webkit-desktop` (Safari's engine), `webkit-phone`.

No test reaches the internet: requests leaving localhost are blocked, and Web3Forms is answered
locally (`support/fixtures.js`), so nothing is ever emailed.

## What is covered

| File | Covers |
|---|---|
| `pages.spec.js` | Every page: status, `lang`, title, one `h1`, hreflang, language switch, header links, mandatory footer content and legal links. Saves a full-page screenshot per page and device. |
| `header.spec.js` | Phone menu (open, close, Escape, link), desktop menu, scroll states, language switch on every page. |
| `home.spec.js` | Hero (tagline, one action), contact links, About, trust strip, service buttons and info links, the home contact form, reduced motion. |
| `content.spec.js` | Content pages (About, Buy, Sell, Rent, privacy, terms): title, description, Markdown body, review banner on legal drafts. |
| `forms.spec.js` | Both multi-step forms, in the dialog and on their page: required step, phone or email, phone format, Enter, Back, one POST, skip and send, server errors, double submit, honeypot, budget rule, tabs, tiles, segments, dialog closing, no-JS pages. |
| `a11y.spec.js` | axe-core WCAG 2.1 A/AA on every page and every dialog step. |
| `links.spec.js` | Internal links and anchors resolve, `tel:`/`mailto:` format, outbound links allowed by CLAUDE.md, form actions, every resource loads. |
| `brand.spec.js` | CLAUDE.md trademark and content rules, office name in the header, FR/EN parity. |

Known gaps are marked `test.fail` with the reason. They pass while the gap exists and fail once it is
fixed, as a reminder to remove the marker.

## Outputs (git-ignored)

- `screenshots/<device>/<page>.png`: full-page screenshots of every page, for visual review.
- `coverage/js-coverage.txt`: share of `js/*.js` lines run by the tests (Chromium) and the lines never run.
- `playwright-report/`: HTML report; failed tests keep a trace and a screenshot in `test-results/`.

Tests read copy from `content/i18n.json`, `content/agent.json` and `_data/site.json` (`support/site.js`),
so editing text in the CMS does not break them.
