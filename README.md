# ced

## Listing updates

The "Update listings" workflow fetches the agent's listings from the REMAX Québec API three times a day. When they change, it opens a PR against the branch it runs on and squash-merges it right away (main requires PRs, with no approvals or checks). Commits made with `GITHUB_TOKEN` don't trigger other workflows, so on main it starts the deploy itself.

It needs:

- the repo secret `REMAX_API_KEY`
- Settings → Actions → General → "Allow GitHub Actions to create and approve pull requests"
