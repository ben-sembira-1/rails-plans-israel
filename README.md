# rails-plans-israel

An interactive map of all the planned light rail and metro lines in the Tel Aviv district (גוש דן), with a
timeline you can play through. It shows which parts are operational, which are under construction (including
closed work areas) and which are still only planned. Click a segment to see its full timeline, the raw
materials, and the page images from the original planning documents. Every item cites its source.

**Live site:** <https://ben-sembira-1.github.io/rails-plans-israel/>

The header shows the site version (`vX.Y.Z`) and "Data from" – the date of the newest
`reference-update-YYYY/MM/DD` tag, i.e. when the source documents were downloaded.

## What is on the map

| Line           | Plans (תת"ל)       | Timeline source                                 | Geometry                    |
| -------------- | ------------------ | ----------------------------------------------- | --------------------------- |
| Green          | 71/א, 71/ב, 71/ג   | NTA schedule (Q3 2026) + plan approvals         | OpenStreetMap route         |
| Purple         | 70/א/1, 70/ב, 70/ג | NTA schedule (Q3 2026) + plan approvals         | OpenStreetMap route         |
| Metro M1/M2/M3 | 101, 102, 103      | NTA metro schedule (July 2026) + plan approvals | traced from plan boundaries |
| Brown          | 72/א, 72/ב         | plan approvals only (no schedule published)     | traced from plan boundaries |

Traced geometry is an approximation of the corridor centreline, not the exact alignment.

## Development

```sh
npm ci
npm run dev            # http://localhost:5173/rails-plans-israel/
npm test               # unit tests (vitest)
npm run typecheck
npm run lint
npm run validate-data  # schema + source references
```

Pre-commit hooks (lint, format, types, data validation, secrets, LFS checks):

```sh
pip install pre-commit   # or: brew install pre-commit
pre-commit install
pre-commit run --all-files
```

Python tooling for extracting text/images from the reference PDFs:

```sh
python3 -m venv .venv && .venv/bin/pip install -r scripts/requirements.txt
npm run extract-references
```

## Data

- `references/raw/` – archived copies of the original documents (Git LFS), grouped by collection
  (`references/collections.json`).
- `references/manifest.json` – one entry per document: id, original URL, sha256, retrieval date.
- `src/data/lines/*.json` – lines → segments → phases, milestones, work areas, stations, materials. Every item
  has `sources: [{ docId, page?, quote? }]`.

To refresh the data see [docs/UPDATING_DATA.md](docs/UPDATING_DATA.md).

## Releases and deployment

- Every PR must carry exactly one label: `version:patch`, `version:minor` or `version:major` (enforced by the
  `version-label` check).
- On merge to `master`, the `release-deploy` workflow tags `vX.Y.Z` and deploys to GitHub Pages.
- The header shows the version and the date of the latest `reference-update-YYYY/MM/DD` tag (when the data
  was taken).
