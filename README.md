# Rails plans – Gush Dan

The light-rail (Red, Purple, Green), metro (M1, M2, M3) and Israel Railways lines of the Tel Aviv metropolitan area
on a street map, with a playable timeline of openings and construction works.

**Site:** <https://ben-sembira-1.github.io/rails-plans-israel/> (Google sign-in; access is approved by the admin).

See [docs/TARGET.md](docs/TARGET.md) for what the site shows and why.

## Features

- Each line is split into sections; at the selected time a section is drawn as **in service** (solid),
  **under works** (dashed, inside a work zone) or **planned** (dotted).
- **Work zones** to real scale: a dark band up to 20 m from the line and a light band to 100 m; orange for heavy
  works, yellow for light works. Metro preparatory sites are circular zones until the line-wide works start (2029).
- **Timeline** at the top of the side panel: quarterly until 2029Q4, yearly from 2030, then "no announced date"
  (the full network). Previous/next event buttons, a clickable "today" marker, and every event as a marker on the
  bar with the main milestones bigger.
- **Places of interest**: search a place on the Google map (or click one), save it, add comments, and open
  Google's details (photos, opening hours, reviews). Saved per user in Firebase.
- **Top strip**: logo, name, version and the time shown; admins get an admin center button.
- **Accounts**: Google sign-in; new users wait for the admin's approval; each user's last timeline position is
  saved and restored.

## Development

```sh
npm ci
pre-commit install          # once
npm run dev                 # http://localhost:5173/rails-plans-israel/ (no sign-in without .env.local)
npm test
pre-commit run --all-files  # prettier, eslint, tsc, file hygiene, secret scan (gitleaks)
npm run build
```

Copy `.env.example` to `.env.local` and set at least `VITE_GOOGLE_MAPS_API_KEY` (see
[docs/GOOGLE_MAPS.md](docs/GOOGLE_MAPS.md)); without Firebase config, places are kept in memory only. To develop
with sign-in, also fill in the Firebase web-app config (see [docs/FIREBASE.md](docs/FIREBASE.md)).

| Path                    | What                                                            |
| ----------------------- | --------------------------------------------------------------- |
| `src/data/network.json` | Sections (geometry + works phases), sites, stations, rail layer |
| `src/data/schema.ts`    | Types and the runtime validator for `network.json`              |
| `src/domain/`           | Pure logic: time steps and formatting, status at a time, events |
| `src/components/`       | Google map layers, timeline, side panel, legend                 |
| `src/places/`           | Places of interest: search, pins, comments, Google details      |
| `src/auth/`             | Firebase sign-in, approval flow, admin panel, saved position    |
| `firestore.rules`       | Server-side access rules                                        |
| `scripts/version.ts`    | Version-bump check used by CI                                   |

## Releases

Every PR to `master` must bump `version` in `package.json` above the latest `vX.Y.Z` tag
(`npm version patch|minor|major --no-git-tag-version`); the `version-check` job fails otherwise. On merge, the
release workflow tags the commit `vX.Y.Z` and deploys to GitHub Pages. The version is shown next to the title.

## License

All rights reserved; see [LICENSE](LICENSE). No permission is granted to use, copy, modify or distribute this
repository.

## Data sources

Planning Administration GIS layers (TAMA 70 and "Hatzav"), NTA (נת״ע) publications and line maps, Hebrew
Wikipedia station tables, OpenStreetMap (Israel Railways, loaded live), and news reports for the works schedule
(as of November 2026). Metro lines are straight lines between stations, not tunnel alignments. Positions marked
"מיקום משוער" are estimates.
