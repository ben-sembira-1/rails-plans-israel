# City construction projects

The map shows building works, building permits and road works from the cities' own GIS servers, on the same
timeline as the rail works. Today only **Tel Aviv-Yafo** publishes this data in a form we can use (we found no
public endpoint for Ramat Gan, Givatayim, Bnei Brak, Holon, Bat Yam, Petah Tikva, Herzliya or Rishon LeZion).

## How the data gets to the site

```
cron, about 03:30 Israel time ─► scripts/construction/fetch.ts ─► one adapter per city (≈15 paged GETs in all)
   .github/workflows/construction-data.yml   │ normalize, merge, validate (parseConstruction)
                                             ▼
                          public/data/construction.json ─► build master ─► deploy GitHub Pages
release.yml (every merge) ─► downloads the live data/construction.json (no API call)
the app ─► fetch(`${BASE_URL}data/construction.json`) after sign-in
```

- **Only the daily job calls the city APIs**: one request at a time, with a pause between requests, a generic
  user agent, and retries (the Tel Aviv server sometimes cuts long responses short, so each page is fully parsed
  before it is accepted).
- **The data is never committed.** The daily update needs no PR or version bump. Both workflows share the `pages`
  concurrency group, so they never deploy over each other.
- **Sanity gate**: the job fails, and nothing is deployed, when any source returns no records or less than half
  of the live snapshot's count. The site then keeps yesterday's data.
- The file is ~3.5 MB (~0.5 MB gzipped) and is validated by `parseConstruction` (`src/data/construction.ts`)
  in the job and again in the browser.

### Running it by hand

```sh
npm run construction:fetch -- public/data/construction.json   # takes 2–3 minutes; the file is git-ignored
npm run dev                                                   # then open http://localhost:5173/rails-plans-israel/?construction=live
```

Without `?construction=live`, development uses `src/construction/sample.json`, a fixed set of about 250 real
projects around Allenby and Dizengoff. The tests and the regression screenshots use it too, so they don't change
from day to day. To rerun the production job: **Actions → Construction data → Run workflow** on `master`. On any
other branch the workflow only checks the fetch and doesn't deploy.

## Model

Every project has phases on the timeline's grid (decimal years, quarter starts), and an `until` after which it
disappears:

| Status         | Meaning                              | Drawn as (zoom ≥ 15)                                                     |
| -------------- | ------------------------------------ | ------------------------------------------------------------------------ |
| `requested`    | Permit requested, in process         | Thin gray outline (hidden by default)                                    |
| `permitted`    | Permit issued, works not started yet | Brown outline                                                            |
| `construction` | Works                                | Filled outline with **noise zones**: dark to 20 m, light from 20 to 50 m |
| road works     | `construction` of a `road` project   | Dashed teal line                                                         |

Below zoom 15, or when more than 600 shapes would be in view, every project is a dot. At the "no date" step
only the projects still waiting at the snapshot (`requested`, `permitted`) are shown.

## Tel Aviv-Yafo mapping (`scripts/construction/sources/telAviv.ts`)

Server: `https://gisn.tel-aviv.gov.il/arcgis/rest/services/IView2/MapServer`. The city reloads these layers
nightly.

| Layer                        | Used for                                                                   |
| ---------------------------- | -------------------------------------------------------------------------- |
| 772 בקשות והיתרי בניה (~10k) | One project per request (`request_num`; a request can span several rows)   |
| 499 אתרי בניה (~1.6k)        | Active sites: start date and stage of the matching permit, or a project    |
| 852 עבודות כבישים (~140)     | Road works, with start and end dates, lane closures and day or night works |

- **Noisy requests only**: the request types new building, additions, public and commercial building are kept.
  Changes without works, use permits and the short track are left out.
- **Phases**:
  - `open_request` → requested.
  - `permission_date` → permitted.
  - Construction: the matching site's `tr_tchilat_avoda`. Without a site, `tr_hathalat_bniya`, but only if it is
    on or after this permit. Without either, the permit date when the building is "בבניה".
- **The end of works** is the completion (`finished`) or occupancy (`occupation`) date, if it is after the start
  (these dates belong to the building, so earlier ones are from older works).
  - Finished requests without a usable date can't be placed and are dropped.
  - Works with no published end get an **estimated** end: 3 years from the start for a new building, 2 years
    for other works, and never before the next quarter. The popup says "(סיום משוער)".
- **Permits that wait** show until `expiry_date`. Permits that expired before works started are dropped.
- **Sites ↔ permits**: a site lists every permit of its building file in `heterim`. It is joined to the latest
  noisy one; the file's other permits are the same or older works and are dropped. Sites with no matching permit
  become their own projects.
- **Privacy**: only the fields above are requested; the permit holders' names (`baalei_heter`) never are.

## Adding a city

1. Find an endpoint: open the city's public web map and look in the browser's network panel for ArcGIS REST
   (`…/MapServer/<id>/query`) or WFS requests on permit, site or works layers.
2. Add `scripts/construction/sources/<city>.ts` with a pure `build<City>(raw, snapshot, now)` and a `fetch<City>`
   that uses `queryAll` from `scripts/construction/arcgis.ts`. Record a few real rows in
   `scripts/construction/fixtures/` and test the mapping.
3. Call it from `scripts/construction/fetch.ts`, and add its name to `SOURCE` in
   `src/construction/ProjectPopup.tsx`.
