# ced

## Setup

Requires Node.js, and [ffmpeg](https://ffmpeg.org) for the videos (`npm run videos`).

```sh
brew install ffmpeg                      # macOS; once
npm install
npx playwright install chromium webkit   # once, downloads the test browsers
npm start                                # dev server on http://localhost:8080
```

Tests and videos: `tests/README.md`.

## Content

Edited in the CMS (`/admin/`, labels in French). Every text has a French and an English version, side by side,
in the file of the page or part where it appears:

| CMS                | File                        | Holds                                                                    |
| ------------------ | --------------------------- | ------------------------------------------------------------------------ |
| Pages              | `content/pages/<page>.json` | One file per page: home (by section), contact, properties, about, buy... |
| Menu               | `content/menu.json`         | Menu links, and the header's screen reader texts                         |
| Pied de page       | `content/footer.json`       | Footer texts (office identity is fixed in `_data/site.json`)             |
| Formulaires        | `content/forms.json`        | Every form text: shared texts, then each form step by step, its lists    |
| Profil du courtier | `content/agent.json`        | Name, title, phone, email, social links, licence: shown in many places   |

`lib/content.ts` reads them; templates use `i18n[lang]`, e.g. `i18n.fr.home.hero.tagline`. Form ids come from
the French names, so editing a list (cities, property types) needs no code change.

## Listing updates

The "Update listings" workflow fetches the agent's listings from the REMAX Québec API three times a day. When they change, it opens a PR against the branch it runs on and squash-merges it right away (main requires PRs, with no approvals or checks). Commits made with `GITHUB_TOKEN` don't trigger other workflows, so on main it starts the deploy itself.

It needs:

- the repo secret `REMAX_API_KEY`
- Settings → Actions → General → "Allow GitHub Actions to create and approve pull requests"
