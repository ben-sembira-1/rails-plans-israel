# CLAUDE.md

Guidance for AI agents working in this repository.

- Target and requirements: [docs/TARGET.md](docs/TARGET.md). Sign-in setup: [docs/FIREBASE.md](docs/FIREBASE.md).
  Map setup: [docs/GOOGLE_MAPS.md](docs/GOOGLE_MAPS.md).
- Stack: Vite + React + TypeScript (strictest settings), Google Maps via `@vis.gl/react-google-maps`, Firebase Auth +
  Firestore.
- Data: `src/data/network.json`, validated by `src/data/schema.ts` (tests fail on invalid data). Time values are
  decimal years (2026.75 = 2026Q4); `9999` means "no announced date".
- Keep TypeScript and ESLint strict; do not disable rules to make code pass.
- Before committing: `pre-commit run --all-files`, `npm test`, `npm run build`.
- Changes reach `master` only via PRs, and every PR must bump `version` in `package.json` above the latest
  `vX.Y.Z` tag. Merging tags the release and deploys GitHub Pages. Never force-push.
- Map shapes (`Polyline`, `Circle`, …) are updated with Google's merging `setOptions`, so always pass every option
  that can change (e.g. `icons: []` for a solid line), or the old value stays. When an option is only read on
  creation, change the React `key` to recreate the shape.
- Every PR description includes screenshots of the change from a local test run (desktop, and phone width ~390 px
  when the UI is affected; for non-visual changes, a screenshot of the relevant local run, e.g. the tests).
  `gh` can't upload images, so commit them to the `pr-assets` branch under `pr-<number>/` (a separate orphan
  branch, e.g. via `git worktree`; never force-push it). Images there are stored in Git LFS (its
  `.gitattributes`), so embed them with
  `https://media.githubusercontent.com/media/ben-sembira-1/rails-plans-israel/pr-assets/pr-<number>/<file>`;
  `raw.githubusercontent.com` serves the LFS pointer, not the image.
