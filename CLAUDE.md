# CLAUDE.md

Guidance for AI agents working in this repository.

- Target and requirements: [docs/TARGET.md](docs/TARGET.md). Sign-in setup: [docs/FIREBASE.md](docs/FIREBASE.md).
  Map setup: [docs/GOOGLE_MAPS.md](docs/GOOGLE_MAPS.md).
- Stack: Vite + React + TypeScript (strictest settings), Google Maps via `@vis.gl/react-google-maps`, Firebase Auth +
  Firestore.
- Data: `src/data/network.json`, validated by `src/data/schema.ts` (tests fail on invalid data). Time values are
  decimal years (2026.75 = 2026Q4); `9999` means "no announced date".
- Keep TypeScript and ESLint strict; do not disable rules to make code pass.
- Never commit keys or other secrets (`.env.local` is git-ignored). gitleaks blocks them in pre-commit and CI; do
  not bypass it (`--no-verify`, allowlists) to get a commit through.
- Before committing: `pre-commit run --all-files`, `npm test`, `npm run build`.
- Changes reach `master` only via PRs, and every PR must bump `version` in `package.json` above the latest
  `vX.Y.Z` tag. Merging tags the release and deploys GitHub Pages. Never force-push.
- Map shapes (`Polyline`, `Circle`, …) are updated with Google's merging `setOptions`, so always pass every option
  that can change (e.g. `icons: []` for a solid line), or the old value stays. When an option is only read on
  creation, change the React `key` to recreate the shape.
- **Tasks for the owner** (console settings, secrets/variables, publishing rules, anything you can't do yourself)
  go on the PR as **review comment threads** on the relevant diff lines (`gh api .../pulls/<n>/reviews` with
  `comments`), one task per thread, with the exact steps. `master` requires conversation resolution, so the PR
  can't merge until each one is resolved. Also list them in the description's "Before merging" section.
- **PRs open as drafts.** Before marking one ready, run the regression (`npm run regression`, see
  [docs/REGRESSION.md](docs/REGRESSION.md)): every scenario in `regression/scenarios.ts`, in a desktop and a phone
  layout, compared with `master`.
  Evaluate every comparison sheet yourself. The PR description is, in order: the new version as its top header (`# vX.Y.Z`); text; big screenshots of the
  features the PR adds (desktop and phone); a **Regression** section that starts with **one bullet list of every
  difference from `master` (and its commit), each with why it is OK and expected**, then a statement that you
  evaluated the images against `master`, then the small images (linking to full size). Keep
  `regression/scenarios.ts` up to date when UI states are added or change.
  `gh` can't upload images, so commit them to the `pr-assets` branch under `pr-<number>/` (a separate orphan
  branch, e.g. via `git worktree`; never force-push it). Images there are stored in Git LFS (its
  `.gitattributes`), so embed them with
  `https://media.githubusercontent.com/media/ben-sembira-1/rails-plans-israel/pr-assets/pr-<number>/<file>`;
  `raw.githubusercontent.com` serves the LFS pointer, not the image.
