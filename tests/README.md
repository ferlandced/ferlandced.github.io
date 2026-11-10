# Tests

End-to-end tests with [Playwright](https://playwright.dev), on the built site.

```sh
npx playwright install chromium webkit   # once, downloads the browsers
npm test                                 # everything
npm test -- --project=chromium-desktop   # one device
npm test -- tests/forms.spec.ts          # one file
npm run test:report                      # open the HTML report of the last run
```

`npm test` builds the site into `_site-test/` (not `_site/`, so a running `npm start` cannot change files
mid-test), serves it under `/ced/` on port 8090, and runs every spec on four devices:
`chromium-desktop`, `chromium-phone`, `webkit-desktop` (Safari's engine), `webkit-phone`.

## Layout and screenshots: `mobile/` and `desktop/`

These two folders run on their own projects, never on the four above.

- `desktop/`: `desktop-chromium`, `desktop-webkit` (1440×900). No touch, no phone emulation.
- `mobile/`: `mobile-iphone-14-pro` (insets 59 top, 34 bottom), `mobile-iphone-14-pro-landscape`
  (59 left and right, 21 bottom), `mobile-pixel-7` (no insets). `mobile/support/safe-area.ts` hands
  each project's `safeAreaInsets` to Chromium (`Emulation.setSafeAreaInsetsOverride`), so
  `env(safe-area-inset-*)` resolves as on the device. The iPhones therefore run in Chromium:
  WebKit has no such override, and Safari's own status bar and toolbar never appear in a test.
  Check those on a real iPhone.

`toHaveScreenshot` baselines live in `__screenshots__/<project>/` and are committed. They are
rendered on macOS; after an intended visual change, review and refresh them:

```sh
npm test -- --project=mobile-iphone-14-pro --update-snapshots   # one project; repeat or list several
```

No test reaches the internet: requests leaving localhost are blocked, and Web3Forms is answered
locally (`support/fixtures.ts`), so nothing is ever emailed.

## What is covered

| File              | Covers                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `pages.spec.ts`   | Every page: status, `lang`, title, one `h1`, hreflang, language switch, header links, mandatory footer content and legal links. Saves a full-page screenshot per page and device.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| `header.spec.ts`  | Phone menu (open, close, Escape, link), desktop menu, scroll states, language switch on every page.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| `home.spec.ts`    | Hero (tagline, one action), contact links, About, service buttons and info links, property cards, reduced motion.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| `content.spec.ts` | Content pages (About, Buy, Sell, Rent, privacy, terms): title, description, Markdown body, review banner on legal drafts.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| `forms.spec.ts`   | The "Write me" form, and both multi-step forms, in the dialog and on their page: required step, phone or email, phone format, Enter, Back, one POST, skip and send, server errors, double submit, honeypot, budget rule, tabs, tiles, segments, dialog closing, no-JS pages.                                                                                                                                                                                                                                                                                                                                                                                                                           |
| `contact.spec.ts` | Contact popup and Contact page: the same options in both languages, each one opens the right form, copy button.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| `a11y.spec.ts`    | axe-core WCAG 2.1 A/AA on every page and every dialog step.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| `links.spec.ts`   | Internal links and anchors resolve, `tel:`/`mailto:` format, outbound links allowed by CLAUDE.md, form actions, every resource loads.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| `brand.spec.ts`   | CLAUDE.md trademark and content rules, office name in the header, FR/EN parity.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| `mobile/`         | Phones with insets: header below the notch; the home header lets iOS 26 Safari show the hero under the status bar; the iOS runways at both ends (forced, as Playwright is not iOS): the page opens past the top one and glides back out of either; the page circle following the scroll past the viewport's edges; the fixed circle kept off the top and bottom edges; open, the circle holding the whole menu but not the screen's top left; the burger's circle unseen in the hero's slash at the top of home, and visible once the slash has scrolled away; burger, menu, dialogs and footer inside the safe area; screenshots (animations allowed, so the scroll-driven circle is where it shows). |
| `desktop/`        | Desktop: no touch or insets, header height, no sideways scroll, footer; screenshots.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |

Known gaps are marked `test.fail` with the reason. They pass while the gap exists and fail once it is
fixed, as a reminder to remove the marker.

## Videos: `videos/`

MP4 videos of the site, to show a change: `tests/videos/*.video.ts`, on their own config
(`playwright.videos.config.ts`), never part of `npm test`. Each one drives the page (taps, glides,
pauses) while `videos/support/recorder.ts` takes 2x screenshots back to back; ffmpeg joins them at
their real timing. Needs ffmpeg (`brew install ffmpeg`, see the main README).

```sh
npm run videos                            # every video
npm run videos -- phone-menu              # one video
```

Output: `videos/<project>/<name>.mp4` (git-ignored). Frames stay in `test-results/`.

## Outputs (git-ignored)

- `screenshots/<device>/<page>.png`: full-page screenshots of every page, for visual review (not compared;
  the compared baselines are in `__screenshots__/`).
- `coverage/js-coverage.txt`: share of `js/*.ts` lines run by the tests (Chromium) and the lines never run.
- `playwright-report/`: HTML report; failed tests keep a trace and a screenshot in `test-results/`.

Tests read copy from the content files (`content/pages/*.json`, `content/menu.json`, `content/footer.json`,
`content/forms.json`, `content/agent.json`) and `_data/site.json` (`support/site.ts`),
so editing text in the CMS does not break them.
