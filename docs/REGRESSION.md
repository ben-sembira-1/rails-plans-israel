# Regression screenshots

Every PR shows how the app looks in a fixed list of UI states, in a desktop and a phone layout, and is compared
with `master` before it is marked ready for review.

## The list

The list lives in [`regression/scenarios.ts`](../regression/scenarios.ts) and is maintained with the app: add a
scenario when a new panel or state is added, and update the steps when the UI changes.

| Scenario                | What it shows                                                                        |
| ----------------------- | ------------------------------------------------------------------------------------ |
| `all-closed`            | Everything closed: no side panel tab open, no details panel                          |
| `works-closeup`         | Close-up of the Purple Line heavy works on Allenby (zoom 16): the 20 m / 100 m zones |
| `construction-layer`    | City construction near Allenby at zoom 17: sites with their 20 m / 50 m noise zones  |
| `construction-popup`    | The popup of a construction site (Allenby 110)                                       |
| `construction-upcoming` | The "no date" step: only the upcoming permits                                        |
| `trains-tab`            | Side panel open on the trains information tab                                        |
| `places-tab`            | Side panel open on the places of interest tab, with one saved place                  |
| `details-panel`         | Google's place details panel open on the right, side panel closed                    |
| `places-and-details`    | Places tab and the details panel open together                                       |

Each scenario is captured in two layouts: **desktop** (1440×900) and **phone** (390×844). A scenario that an
`master` can't show yet (a state the PR adds) is recorded as `n/a` for `master`.

## Baseline

Each run compares the PR with **`master`**: `origin/master` is fetched first, and its screenshots are cached
per commit (retaken when `master` moves).

## Running

Needs Google Chrome, `npm ci`, and the local Google Maps key in `.env.local` (allowed for
`http://localhost:5173/*`, see [GOOGLE_MAPS.md](GOOGLE_MAPS.md)). Stop any dev server on port 5173 first.

```sh
npm run regression -- --assets https://media.githubusercontent.com/media/ben-sembira-1/rails-plans-israel/pr-assets/pr-<n>/regression
```

How it runs: every version is built in development mode (so it opens without sign-in), each under its own path,
in parallel; one local static server on port 5173 serves them all; and every version × layout × scenario is
captured in its own Chrome tab, 8 at a time (`--jobs <n>` to change). Places are kept in memory (no Firebase).
A run takes about a minute when `master` is cached.

The output goes to the git-ignored `regression-output/`:

- `current/` and `master/`: `<scenario>-<layout>.png` and `manifest.json`;
- `compare/<scenario>-<layout>.png`: the PR next to `master`;
- `pr-regression.md`: the PR's regression section (small images that link to the full size).

`master`'s screenshots are cached in `regression-output/master/` for its current commit; delete the folder to
capture it again.

## PR process

In CI this whole process runs when the owner adds the `agent:finish` label ([CI-AGENT.md](CI-AGENT.md)). By hand:

1. Open the PR as a **draft**.
2. Run the regression, then upload the images with `scripts/upload-pr-assets.sh <n>` (to the `pr-assets` branch
   under `pr-<n>/regression/`, Git LFS).
3. Evaluate every comparison sheet: what changed against `master`, and whether each change is intended.
4. Write the PR description in this order:
   1. text: what and why;
   2. **big images of the features the PR adds** (desktop and phone);
   3. the **Regression** section from `pr-regression.md`. It starts with **one bullet list of every difference
      from `master`** (name the commit), each saying why it is OK and expected; then the statement that the images
      were evaluated against `master`; then the small images. A difference that is not OK is fixed before the PR is
      marked ready, not listed.
5. Only then mark the PR **ready for review**.
