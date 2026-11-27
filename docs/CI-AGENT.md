# CI: versions from labels, and Claude finishing PRs

Two workflows finish a PR without a local session.

## Version: `release:*` label → `version-check`

Every PR to `master` needs **exactly one** label: `release:patch`, `release:minor` or `release:major`.
[`version-check.yml`](../.github/workflows/version-check.yml) (a required check):

- fails without exactly one of these labels;
- computes the version: the newer of `master`'s `package.json` version and the latest `vX.Y.Z` tag, bumped by the
  label (`node scripts/version.ts target <level>`);
- if `package.json` differs, commits the new version (`package.json` and the lockfile) to the PR branch and pushes
  it. That push re-runs every check, and `version-check` then passes;
- after `master` moves (the branch must be updated before merging), the next run recomputes the version.

Changing the label re-runs it. Merging tags the release (`release.yml`) as before.

## Finishing: `agent:finish` label → `pr-agent`

When the owner adds the **`agent:finish`** label, [`pr-agent.yml`](../.github/workflows/pr-agent.yml):

1. builds this PR and `master` and captures the regression screenshots ([REGRESSION.md](REGRESSION.md)), with
   Playwright's Chromium;
2. uploads them to the `pr-assets` branch (`scripts/upload-pr-assets.sh <pr>`);
3. runs Claude Code ([`anthropics/claude-code-action`](https://github.com/anthropics/claude-code-action)), which
   reads every comparison sheet and the diff, rewrites the PR description in the required structure (version
   header, text, features, Regression section starting with the list of differences and why each is expected),
   adds owner tasks as review threads, and either marks the PR ready (every difference expected) or leaves it a
   draft with a comment;
4. sets the commit status **`agent-verdict`** on the PR's head commit: success only if every difference was
   expected;
5. removes the `agent:finish` label, so adding it again runs it again.

`agent-verdict` is a required status on `master`. A new commit has no verdict, so after pushing, add
`agent:finish` again before merging. (The required check is a commit status, not the job: a job skipped by its
condition, e.g. when another label is added, would count as passed.)

Claude may only use read tools and `gh pr view|diff|edit|ready|comment` / `gh api`; it can't change code or push.
Only labels added by the repository owner start it, because it reads PR content.

## One-time setup (owner)

| Secret / setting          | What                                                                                                                                                                                              |
| ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `CLAUDE_CODE_OAUTH_TOKEN` | Run `claude setup-token` (uses your Claude subscription) and add the token as an Actions secret. `/install-github-app` in Claude Code also installs the Claude GitHub app, which the action uses. |
| `RELEASE_BOT_TOKEN`       | A fine-grained personal access token: only this repository, **Contents: read and write**. Used to push the version commit so that it triggers the checks.                                         |
| `MAPS_CI_KEY`             | A Google Maps key for CI: website `http://localhost:5173/*`, APIs Maps JavaScript API, Places API (New), Places UI Kit, with low daily quotas. The regression serves the builds on that address.  |
| Labels                    | `release:patch`, `release:minor`, `release:major`, `agent:finish` (created by the setup PR).                                                                                                      |
| Branch protection         | Required checks `ci`, `version-check` and the status `agent-verdict`; branches up to date; conversations resolved.                                                                                |

## Cost

Each `agent:finish` run uses Claude (the images are most of it) and about one Places request (the sample place);
plain pushes cost nothing. A run takes a few minutes.

## Fallback

The same steps still work locally: `npm run regression`, `scripts/upload-pr-assets.sh <pr>`, and a Claude session
following CLAUDE.md.
