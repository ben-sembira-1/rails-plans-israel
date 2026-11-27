# Regression screenshots

Every PR shows how the app looks in a fixed list of UI states, in a desktop and a phone layout, and is compared
with earlier releases before it is marked ready for review.

## The list

The list lives in [`regression/scenarios.ts`](../regression/scenarios.ts) and is maintained with the app: add a
scenario when a new panel or state is added, and update the steps when the UI changes.

| Scenario             | What it shows                                                       |
| -------------------- | ------------------------------------------------------------------- |
| `all-closed`         | Everything closed: no side panel tab open, no details panel         |
| `trains-tab`         | Side panel open on the trains information tab                       |
| `places-tab`         | Side panel open on the places of interest tab, with one saved place |
| `details-panel`      | Google's place details panel open on the right, side panel closed   |
| `places-and-details` | Places tab and the details panel open together                      |

Each scenario is captured in two layouts: **desktop** (1440×900) and **phone** (390×844). A scenario that an
older release can't show (e.g. places before they existed) is recorded as `n/a` for that release.

## Baselines

Each run compares the PR with up to three releases ([`regression/refs.ts`](../regression/refs.ts)):

- the **latest** release tag;
- the latest tag of the **previous minor** version;
- the most recent tag that is **at least a week old**, if there is one.

## Running

Needs Google Chrome, `npm ci`, and the local Google Maps key in `.env.local` (allowed for
`http://localhost:5173/*`, see [GOOGLE_MAPS.md](GOOGLE_MAPS.md)). Stop any dev server on port 5173 first.

```sh
npm run regression -- --assets https://media.githubusercontent.com/media/ben-sembira-1/rails-plans-israel/pr-assets/pr-<n>/regression
```

How it runs: every version is built in development mode (so it opens without sign-in), each under its own path,
in parallel; one local static server on port 5173 serves them all; and every version × layout × scenario is
captured in its own Chrome tab, 8 at a time (`--jobs <n>` to change). Places are kept in memory (no Firebase).
A run takes about a minute when the releases are cached, and about 2–3 minutes from scratch.

The output goes to the git-ignored `regression-output/`:

- `current/` and one folder per release: `<scenario>-<layout>.png` and `manifest.json`;
- `compare/<scenario>-<layout>.png`: the PR next to each baseline;
- `pr-regression.md`: the PR's regression section (small images that link to the full size).

Release screenshots are cached in `regression-output/<tag>/`; delete a folder to capture it again.

## PR process

1. Open the PR as a **draft**.
2. Run the regression, then upload `regression-output/current/*` and `regression-output/compare/*` to the
   `pr-assets` branch under `pr-<n>/regression/` (Git LFS; see CLAUDE.md).
3. Evaluate every comparison sheet: what changed against each baseline, and whether each change is intended.
4. Write the PR description in this order:
   1. text: what and why;
   2. **big images of the features the PR adds** (desktop and phone);
   3. the **Regression** section from `pr-regression.md`, with the evaluation filled in: that the images were
      evaluated, which releases they were compared with, and every difference found (intended or not).
5. Only then mark the PR **ready for review**.
