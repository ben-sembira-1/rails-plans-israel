# CLAUDE.md

Guidance for AI agents working in this repository.

## Project

Vite + React + TypeScript (strictest settings) site, deployed to GitHub Pages, showing the planned light rail and
metro lines of Gush Dan on a map with a playable timeline. Every item on the site cites an archived source
document.

- Data: `src/data/lines/<lineId>.json` (schema: `src/data/schema.ts`), sources: `references/manifest.json`.
- Archived originals: `references/raw/**` (Git LFS). Extracted page text: `references/text/**`.
  Page images served by the site: `public/references/**`.
- Status logic (planned / construction / operational): `src/domain/status.ts`.

## Updating the data

When asked to update the data, follow [docs/UPDATING_DATA.md](docs/UPDATING_DATA.md) exactly. In short: start
from <https://www.nta.co.il/>, download new documents **into this repo** (`references/raw/`, LFS), rebuild the
manifest, update `src/data/lines/*.json` with a source on every item, open a PR with a `version:*` label, and
after merge create and push the tag `reference-update-YYYY/MM/DD` on `master`.

## Rules

- Never add a fact, date, geometry or image without a `sources` entry pointing to a manifest document.
- Keep TypeScript and ESLint strict; do not disable rules to make code pass.
- Run `pre-commit run --all-files`, `npm test`, `npm run validate-data` and `npm run build` before committing.
- Changes reach `master` only via PRs that carry exactly one of `version:patch`, `version:minor`,
  `version:major`. The release workflow tags `vX.Y.Z` and deploys.
