# CLAUDE.md

Scope: the general rules for developing this website, and the content, trademark and legal rules every page must respect. Features, open items and to-dos are GitHub issues, not part of this file.

Related docs:

- [DESIGN.md](DESIGN.md): visual design and the REMAX visual identity (colours, tokens, type, layout, logos, graphic elements, imagery, icons, components, focus, motion) and the open design decisions. Read it before any visual change. Design rules live only there; do not repeat them here.
- [tests/README.md](tests/README.md): how the tests run and what they cover.

## Project

- Website for a REMAX real estate agent, Montreal, QC
- Bilingual: French (primary) and English
- Static site built with Eleventy (11ty), hosted on GitHub Pages
- Content via Decap CMS (git-based, Decap Turbo auth)
- Custom domain with no REMAX mark
- Repo is private for now and may go public later. Treat it as public: never commit secrets, brand manual PDFs, or personal data beyond the agent's published contact details.
- Architect: Matteo. Architecture ownership and approval boundaries are defined below.

## Source of truth

- The REMAX manual, as named in DESIGN.md, for the trademark and content rules below too.
- If local law and the manual differ, local law wins.
- Use the referenced manual as the source of REMAX brand requirements. Do not assume that an unofficial interpretation supersedes it.
- If the applicable manual version or requirement cannot be established, flag the uncertainty instead of inventing a rule.

## Stack and layout

- Eleventy 3 (`eleventy.config.ts`), Nunjucks templates (`*.njk`, `_includes/`).
- TypeScript everywhere. Browser scripts in `js/` and `admin/preview.ts`: the build strips their types, so no bundler.
- CSS: plain CSS in `css/`.
- Content: `content/` (CMS-edited JSON), `_data/site.json`, loaded through `lib/content.ts`. CMS config: `admin/config.yml`.
- Tests: Playwright + axe-core in `tests/`.
- Node 24 (same as CI). Exact dependency versions; `package-lock.json` is committed.

## Architecture ownership and decisions

- Matteo owns architecture decisions.
- Follow the established architecture, project boundaries, technologies and conventions.
- Do not introduce, replace or significantly restructure architectural patterns, technologies, dependencies, integrations or project boundaries without Matteo's approval.
- Local implementation decisions within established patterns are delegated to Claude.
- For architectural concerns, present the problem, viable options, tradeoffs and recommendation. Wait for approval before implementing changes that require architectural approval.
- Do not ask for approval for routine implementation details already covered by these instructions or established project conventions.
- Flag architectural risks and inconsistencies even when they are outside the requested scope. Do not fix them without approval.

## Git flow

- `main` is production: every push to it deploys to GitHub Pages (`.github/workflows/deploy.yml`). `develop` is where work comes together.
- Start every change on a new branch from an up-to-date `develop`. One topic per branch, short kebab-case name that says what it does (`about-text-follows-scroll`).
- Never commit or push directly to `develop` or `main`. Every change reaches them through a PR.
- Feature PRs target `develop`. A release is a PR from `develop` into `main`.
- Merge with rebase (`gh pr merge --rebase`). No merge commits, and no merging one branch back into another.
- To catch up with `develop`, rebase onto it. Force-push only your own feature branch, with `--force-with-lease`.
- Delete the branch once its PR is merged.
- Automation also writes to the repo: Decap CMS commits content straight to `main`, and the listings workflow opens and merges its own PR. Expect content-only commits you did not write.

## Commits and PRs

- Small commits when make sense, one logical change each. The subject says what changed, in the imperative, as in the existing history.
- Commit only source: never `_site/`, `_site-test/`, `test-results/`, `playwright-report/`, `screenshots/`, `coverage/`, or local files like `.DS_Store`.
- PR description: what changed and why, how it was tested (commands and devices), screenshots for visual changes, open questions for Matteo.
- Keep PRs reviewable. Split unrelated changes into separate PRs.

## Before every push

All of these pass, every time. Never push red.

1. `npm run lint`: typecheck, ESLint, Stylelint, Prettier.
2. `npm run build`: the site builds without errors or warnings.
3. `npm test`: every Playwright project passes.
4. Look at it: French and English, phone and desktop. Check Firefox too when images or CSS change (Playwright does not run Firefox).
5. Read your own diff: no secrets, no debug code, no leftover files, no unrelated changes.

During development, run the smallest relevant test suite first to get fast feedback. Before pushing, run all required quality gates above.

- Never claim a test passed unless it was actually executed.
- If a test cannot be executed, report it and explain why.
- When a test fails, fix the code or, if the behaviour changed on purpose, the test. Never skip, loosen or delete a test to get green.
- A known gap is marked `test.fail` with its reason.
- Screenshot baselines are updated only for an intended visual change, reviewed, and committed with it (`npm test -- --project=<name> --update-snapshots`).

## Development practices

- Fix the cause, not the symptom. Keep the change to what was asked; flag other problems instead of fixing them on the side.
- Names in full words (`event`, `element`, `--header-height`). Only `x`, `y` and `_` may be short.
- Very few comments: only for something genuinely surprising. Explain the change in the PR instead.
- Shell and workflow scripts read step by step: named variables, small named functions, plain if/else, one echo per action. No dense one-liners.
- Lint rules stay on. Disable one only on a single line, with the reason.
- No hardcoded text in templates or scripts: every string comes from the content files (see Bilingual). No hardcoded colours, fonts, sizes or radii: use the tokens (DESIGN.md).
- Progressive enhancement: pages and forms work without JavaScript; scripts add to working HTML.
- Semantic HTML first; ARIA only when HTML has no element for it. Every page passes the axe checks in `tests/a11y.spec.ts`.
- Performance: WebP images with `width` and `height`, lazy loading below the fold, no layout shift. Do not encode AVIF with macOS `sips` (broken in Firefox).
- New behaviour comes with a test, or an updated one. Tests read copy from the content files, never hardcoded strings.
- Changing a content file's structure means updating `admin/config.yml`, `lib/content.ts`, the templates and the tests together. The CMS editor is not technical: French labels, hints that say where the text appears on the site, one file per page or part.
- No new dependency (runtime or dev), external service or third-party request without Matteo's approval. Pin exact versions.
- Secrets live in GitHub Actions secrets, never in the repo or in logs.
- Keep the docs true: when a rule or decision changes, update CLAUDE.md, DESIGN.md or tests/README.md in the same PR.

## Simplicity

- Prefer the simplest implementation that satisfies the requirements.
- Do not introduce abstractions, helpers, configuration or extensibility without a demonstrated need.
- Do not anticipate hypothetical future requirements.
- Reuse existing patterns before introducing alternatives.
- Avoid duplicating existing functionality.
- Avoid refactoring unrelated code.
- Do not optimize prematurely. Address measurable performance problems or explicit requirements.

## Accessibility and compatibility

- Preserve keyboard accessibility for all interactive elements.
- Ensure visible and understandable focus indicators.
- Respect `prefers-reduced-motion` for non-essential motion.
- Test keyboard navigation and focus behaviour when adding or changing interactive components.
- Check responsive behaviour at phone and desktop sizes.
- Verify cross-browser behaviour when changing CSS, layout or image handling, including Firefox.

## Content validation

- Validate both French and English content for required fields and missing translations.
- Do not silently fall back to another language when content is missing unless that fallback is explicitly part of the established implementation.
- Verify that language switchers point to the equivalent page in the other language.
- Keep content schemas, CMS configuration, TypeScript types, templates and tests consistent.
- Flag content that appears legally incomplete, misleading or inconsistent rather than inventing corrections.

## Execution

- Before changing code, inspect the relevant implementation and surrounding conventions.
- Understand the affected templates, content, scripts, styles and tests before making changes.
- Make changes directly when requirements are clear and within scope.
- Do not stop to ask questions about decisions already covered by these instructions or established project conventions.
- Ask Matteo when requirements are ambiguous, architectural approval is needed, or a decision has legal, financial or external consequences.
- Do not silently expand the scope of a task.
- At completion, report:
  - What changed.
  - Tests and checks actually executed.
  - Any tests that could not be executed and why.
  - Outstanding concerns or decisions requiring Matteo's input.

## Trademark text

- "REMAX" in capitals, no slash, never broken across lines, no plural or possessive. Use as adjective.
- ® once per piece at first or most prominent use, only when REMAX stands alone. Never with the office name.
- Do not create names, team names or logos containing "MAX", "/", "\\" or "|".

## Mandatory content (home page required; sub-pages recommended)

- Full REMAX office name, prominent.
- Office postal address, phone, email (no home address).
- "Each Office Independently Owned and Operated." English per manual. French wording must come from REMAX Québec. Do not write our own.
- Agent title and agency identification as required by OACIQ.
- Equal housing / fair housing compliance: no content that marginalizes people or neighbourhoods.
- Footer on every page: office name, address, independence notice.

## Content rules

- No misleading claims (market area, transactions, volume, awards, experience). Awards need year, scope, team vs individual.
- Do not advertise commission rates.
- Real REMAX Group: About Us section only, approved text only, REMAX more prominent. Never in header, footer, metatags or domain.
- No competitor disparagement. No political or controversial endorsements with REMAX marks.
- No "powered by" or combining other company logos with REMAX marks.
- Outbound links: REMAX website only, plus legal/required links.
- Mortgage rates/payments: no figures without compliant disclosure.
- Listings: the agent's own only.
- No lorem ipsum or stock copy in production.

## Compliance verification

- Never interpret uncertain legal, regulatory or trademark requirements as established facts.
- Do not invent approved French translations, legal wording, disclosures or REMAX requirements.
- When a requirement cannot be verified against the referenced source, flag it for Matteo rather than improvising.
- Distinguish mandatory requirements from recommendations.
- Preserve the source and version of compliance requirements where possible.
- If legal or regulatory guidance conflicts with this document, flag the conflict. Do not independently resolve ambiguous legal questions.
- Do not claim that a page is legally compliant solely because automated tests pass.

## Domain

- Custom domain with no "remax", "rmx" or "MAX" in it. No REMAX-named subdomains or redirects.

## Bilingual (Eleventy)

- URL structure: `/fr/` and `/en/`. Default French. `hreflang` on every page. Language switcher maps to the equivalent page.
- All UI strings in the content file of the page or part where they appear (`content/pages/<page>.json`, `menu.json`, `footer.json`, `forms.json`), French and English side by side. Agent details once, in `content/agent.json`.
- French not less prominent than English (Bill 96). Content parity.
- Locale formatting `fr-CA` / `en-CA` (e.g. 450 000 $).
- Brand names (REMAX, office name) are not translated.

## Privacy (Quebec Law 25)

- What visitors send reaches the agent by email only. No database or CRM on our side.
- Every form that collects personal data has a consent checkbox linking to the privacy policy, in both languages.
- Consent before analytics or cookies.
- No third-party font CDN.
- Every service that receives visitor data or sets cookies is named in the privacy policy.
- Images are stored in the repo. Never hotlink them from other sites.
