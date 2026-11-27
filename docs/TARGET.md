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

- A normal zoomable street map (Esri World Street Map tiles, no API key), with topographic and satellite options.
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
- Stations are markers; their names appear from zoom 15. Future stations are faded. Clicking a station shows its
  line, opening date and whether its position is approximate.
- Clicking a section shows all its phases with their date ranges.
- A legend explains the styles and lets the user hide individual lines.

### Timeline

- A slider over time. It moves by **quarter** until 2029Q4 and by **full year** from 2030 (later dates are too
  uncertain for quarters), followed by a final "no announced date" step where the full network is shown as a
  plain map.
- A play button that steps from event to event.
- Two rows of buttons:
  - **Milestones** – the main openings (2023Q3, 2028Q2, 2028Q4, 2030, 2034–37, no date);
  - **Works-status changes** – every point in time at which a section's or site's works status changes, plus
    "today".
- When the timeline is on a button's time, that button is highlighted.
- A summary under the buttons lists the sections under heavy and light works at the selected time.
- Dates are formatted `YYYYQn` before 2030 and `YYYY` from 2030.

### Engineering

- Vite + React + TypeScript with the strictest compiler settings, and strict ESLint.
- Data lives in JSON (`src/data/network.json`), typed by `src/data/schema.ts`, and validated by unit tests.
- Domain logic (time steps, formatting, status at a time, events) is pure TypeScript with unit tests.
- `pre-commit` runs formatting, linting and type checks locally and in CI. CI also runs the tests and the build.
- **Versioning**: the version in `package.json` is shown in the UI. Every PR to `master` must bump it above the
  latest `vX.Y.Z` tag; a CI job fails otherwise.
- **CD**: on every merge to `master`, a workflow tags the commit `vX.Y.Z` and deploys the site to GitHub Pages.

## Non-goals

- Exact tunnel alignments for the metro (drawn as straight lines between stations).
- Day-level closure schedules (they are only announced one or two weeks ahead).
