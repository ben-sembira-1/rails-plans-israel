# CLAUDE.md

Guidance for AI agents working in this repository.

- Target and requirements: [docs/TARGET.md](docs/TARGET.md). Sign-in setup: [docs/FIREBASE.md](docs/FIREBASE.md).
- Stack: Vite + React + TypeScript (strictest settings), Leaflet via react-leaflet, Firebase Auth + Firestore.
- Data: `src/data/network.json`, validated by `src/data/schema.ts` (tests fail on invalid data). Time values are
  decimal years (2026.75 = 2026Q4); `9999` means "no announced date".
- Keep TypeScript and ESLint strict; do not disable rules to make code pass.
- Before committing: `pre-commit run --all-files`, `npm test`, `npm run build`.
- Changes reach `master` only via PRs, and every PR must bump `version` in `package.json` above the latest
  `vX.Y.Z` tag. Merging tags the release and deploys GitHub Pages. Never force-push.
- react-leaflet: `pathOptions` changes go through Leaflet's merging `setStyle`, so always set every style key
  that can change (e.g. `dashArray: undefined` for solid). Options like `pane` and a Tooltip's `className` are
  read only on creation; change the React `key` to recreate the layer when they change.
