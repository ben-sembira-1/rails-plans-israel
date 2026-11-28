# Project target

## What this is

A public web page (GitHub Pages) that shows the **planned and existing rail network of Gush Dan** (the Tel Aviv
metropolitan area) on a regular street map, together with a **playable timeline** that answers two questions for any
point in time:

1. **What is running?** Which light-rail, metro and Israel Railways sections are in service.
2. **What is being built, and how badly does it hurt the street?** Which sections are under heavy or light
   construction works, drawn as work zones around the line.

## Lines

| Line            | Type       | Shown as                                                              |
| --------------- | ---------- | --------------------------------------------------------------------- |
| Red             | Light rail | In service since 2023Q3; Rishon LeZion extension planned (no date)    |
| Purple          | Light rail | Under works; whole line opens 2028Q2                                  |
| Green           | Light rail | Under works; south opens 2028Q4, north and branches 2030              |
| M1, M2, M3      | Metro      | Preparatory sites now, heavy works from 2029, stage A opening ~2037   |
| Israel Railways | Heavy rail | In service throughout (context layer, loaded live from OpenStreetMap) |

## Requirements

### Map

- A **Google Map** (street map with satellite and terrain options), in Hebrew.
- Every line is split into **sections**, taken from the published works schedule. Each section has an ordered list
  of **phases** (`none` = planned, `minor` = light works, `major` = heavy works, `open` = in service).
- A section is drawn according to its phase at the selected time:
  - **open** – solid line;
  - **works** (`minor` / `major`) – dashed line inside a **work zone**;
  - **planned** – faint dotted line.
- **Work zones** are drawn to real scale around the line ("sausages") with two bands: a dark inner band up to
  **20 m** from the line (worst affected) and a light outer band from **20 m to 100 m**. Heavy works are orange,
  light works are yellow.
- Before the metro's heavy works start (2029), the metro lines are **not** shown as works along their whole length;
  only the known **preparatory sites** get a circular two-band work zone, from their start date.
- Stations are markers; their names appear from zoom 15. Future stations have a dashed ring. Clicking a station
  shows its line, opening date and whether its position is approximate.
- Clicking a section shows all its phases with their date ranges. Every popup has the same frame: a swatch of what
  was clicked, the title, the details, and the source with its date; estimates are tagged "משוער".
- A work zone that appears (works start) fades in briefly, unless the user prefers reduced motion.
- A **layers picker** on the map (next to the map/satellite switch, always visible) hides or shows each line,
  Israel Railways and the construction layers. Hovering a line dims the others; its zoom button fits the map to
  it. A dot on the button says some layers are hidden.
- After the user moves in time, a **"what changed" note** over the map lists the lines whose sections opened or
  started works (and the change in active building sites); each row zooms to those sections. It stays until
  closed or the next move.

### City construction

- **Building and road works** from the cities' GIS servers (today Tel Aviv-Yafo; see
  [CONSTRUCTION.md](CONSTRUCTION.md)) follow the same timeline. Each project is requested, then permitted, then
  under works, then gone.
- Building sites under works get a real-scale **noise zone** around the site's outline: a dark **high-noise** band
  up to **20 m** and a light **low-noise** band from **20 m to 50 m**, in brown (apart from the rail zones).
  Permits waiting to start are brown outlines, requests in process gray outlines (hidden by default), and road
  works dashed teal lines. Below zoom 15 (or with more than 600 projects in view) projects close together are
  **counted per area**: a bubble with their number and a ring showing the share of each layer; clicking it zooms
  in until the projects unpack into shapes. A project alone in its area is a dot that opens its popup.
- Clicking a project shows what is built, its phases with dates (an estimated end is marked), its stage, housing
  units, TAMA 38, night works, a link to the city's file, the source and the update date.
- The panel shows the counts at the selected time and has a toggle per layer. At the "no date" step only the
  upcoming projects (requested or permitted) are shown.
- A daily GitHub Actions job is the only caller of the city APIs. Its snapshot is served as a static file next
  to the site.

### Places of interest

- A **search box** on the map (Google place search, biased to Gush Dan) finds a place; clicking a Google point of
  interest on the map does the same. The place is shown with a card to **save it as a place of interest**.
- Saved places are **star pins** on the map. A place's card lists its **comments** (add and delete), and can
  remove the place.
- **Google details**: from a card, a panel on the right of the map shows Google's own view of the place (photos,
  opening hours, rating, reviews, website, …). On a phone it covers the map.
- The side panel has two tabs: **trains information** (everything below) and **places of interest** (a list;
  clicking one shows it on the map).
- Places and comments are saved in Firebase **per user**: only the (approved) user can read or change their own.

### Layout

- The look: ink on cool white (IBM Plex Sans Hebrew). Color is used only for what the map means (lines, works,
  construction); selected controls are ink.
- A **top strip** with the logo, the app name, the version, the time currently shown on the timeline, **copy link**
  (a link to the time shown, `?t=`, confirmed with a short message) and **about** (a dialog: what the map shows,
  how dates and zones are made, sources with dates, keyboard keys, how to report a mistake, and that the site is
  not official). Admins also get an **admin center** button (with a pending-requests count) that opens the
  access-management page; every signed-in user gets an account menu (sign out).
- The time shown is kept in the address (`?t=2028.25`); a shared link opens at its time (before the user's saved
  position).
- The **timeline** is always right under the top strip, on every screen size.
- **Desktop**: a **side panel on the left** holds the information, in a trains tab: the status at the current time
  (the milestone text, then one row per line with its state in a word, the share of it open / under works, and
  where the works are), city construction as three figures, the events as a vertical dated list, "how to read the
  map" (collapsible, remembered) and a footer with the data dates, the sources and that the site is not official.
  The map fills the rest.
- **Narrow screens / phone**: the side panel is a **bottom sheet** with a handle: it peeks with its tabs, and opens
  to half or full height by tapping the handle, dragging it or choosing a tab. Google's details panel is a sheet
  too (half or full; dragging it down closes it).

### Timeline

- A bar over time. It moves by **quarter** until 3 years from today (2029Q4) and by **full year** after that
  (later dates are too uncertain for quarters), followed by a final "no announced date" step where the full network is shown as a
  plain map.
- **Previous / next** buttons, side by side next to the current time, move one step of the bar: any quarter
  until 3 years from today, then one year. They don't skip to events.
- Events are only points on the bar (click one to jump to it); the main milestones (2023Q3, 2028Q2, 2028Q4, 2030, 2034–37, no date) are
  bigger and labelled, and the current marker is highlighted. Under the bar: the current caption. On a phone the
  markers are small, unlabelled and not tappable (the slider and the panel's event list do that job).
- Dates are formatted `YYYYQn` on the quarterly part and `YYYY` on the yearly part.
- The bar is drawn as a rail line: the travelled part solid, the future dashed, a tick per step, events as small
  stops, milestones as stations and the current time as a filled "train" that glides between steps. Labels on
  the same side of the bar never overlap.
- **Play** walks the bar step by step (a longer stop on events) and stops at the end or when the user moves the
  time. Keys on the bar: arrows step, PageUp / PageDown jump to the next / previous event, Space plays and stops.

### Engineering

- Vite + React + TypeScript with the strictest compiler settings, and strict ESLint.
- Data lives in JSON (`src/data/network.json`), typed by `src/data/schema.ts`, and validated by unit tests.
- Domain logic (time steps, formatting, status at a time, events) is pure TypeScript with unit tests.
- `pre-commit` runs formatting, linting, type checks and a secret scan (gitleaks) locally and in CI. CI also scans
  the whole git history for secrets, and runs the tests and the build.
- **Versioning**: the version in `package.json` is shown in the UI. Every PR to `master` must bump it above the
  latest `vX.Y.Z` tag; a CI job fails otherwise.
- **CD**: on every merge to `master`, a workflow tags the commit `vX.Y.Z` and deploys the site to GitHub Pages.

## Non-goals

- Exact tunnel alignments for the metro (drawn as straight lines between stations).
- Day-level closure schedules (they are only announced one or two weeks ahead).
