# Updating the reference data

This is the procedure for refreshing the site's data from the official sources. It is written so that a
future prompt (human or AI agent) can follow it end to end.

## Sources

| Collection id        | Where it comes from                                                                                  |
| -------------------- | ---------------------------------------------------------------------------------------------------- |
| `nta-site`           | NTA public OneDrive folder "אתר נתע" (linked from <https://www.nta.co.il/>)                          |
| `metro-july-2025`    | NTA public OneDrive folder "מטרו יולי 2025"                                                          |
| `mavat-<planNumber>` | Plan pages on <https://mavat.iplan.gov.il/> (regulations "הוראות התכנית" and drawing "תשריט התכנית") |

The authoritative list, with the exact folder URLs, is [`references/collections.json`](../references/collections.json).
Start every update at <https://www.nta.co.il/>: look for new or changed documents, new folders, new plans
(תת"ל numbers) and updated schedules, and add new collections to `collections.json` when needed.

## Rules

1. **The repository is the archive.** Every document the site cites must be committed under
   `references/raw/<collection>/...` (stored with Git LFS – see `.gitattributes`). Never cite a file that is
   only online.
2. **Never delete old documents** that are still cited. If a document was replaced, add the new one next to it;
   the manifest keeps both (different `sha256` → different `id`).
3. **Everything shown on the site has a source.** Every phase, milestone, work area, station, material and
   geometry in `src/data/lines/*.json` has a non-empty `sources` array (`docId` + `page` + optional `quote`).
   `npm run validate-data` enforces this.
4. **Every data update ends with a tag** `reference-update-YYYY/MM/DD` (the date the documents were
   downloaded) on `master`. The site header shows the newest such tag reachable from the deployed commit.

## Step by step

1. Create a branch: `git switch -c data/update-YYYY-MM-DD`.
2. Download new or changed files. OneDrive folders: open the folder link, select items, **Download** (zip).
   Mavat: open the plan page and download the regulations and the drawing. NTA schedules: the
   "לוחות זמנים לפרויקטים" page links one `.xlsx` per line/metro; save them under
   `references/raw/nta-web/schedules-<year>-q<n>/` and add their URLs/titles to `collections.json`.
   - OneDrive zips of whole folders can be several GB and the server stops streaming after ~15 minutes.
     Download one top-level folder at a time; if a zip is truncated, run
     `.venv/bin/python -I scripts/recover_zip.py <zip> <outdir>` to extract every complete file, then
     download only the missing items.
   - Chrome may keep finished downloads under a temporary `.com.google.Chrome.*` name until a save
     prompt is answered; those files are complete once their size stops changing.
   - nta.co.il is behind a bot check; open it in a normal browser rather than with `curl`.
3. Unpack into `references/raw/<collection>/` keeping the original folder structure and file names.
4. `npm run build-manifest -- --retrieved YYYY-MM-DD` – updates `references/manifest.json`
   (unchanged files keep their ids and dates). Optionally give new documents a readable `title`.
5. `npm run extract-references` – writes page text to `references/text/<docId>/` (needs the Python venv:
   `python3 -m venv .venv && .venv/bin/pip install -r scripts/requirements.txt`).
6. Regenerate the data: `npm run build-data`. The generator (`scripts/data_build/build_lines.py`) reads the
   schedules, plan boundaries (`iplan-gis`) and OSM extracts and writes `src/data/lines/*.json` and
   `src/data/documents.json`. When the NTA spreadsheets change (new rows, renamed sub-segments), update the
   segment definitions there – every phase, work area and material must keep a source. Refresh the GIS
   and OSM extracts with the queries recorded in `collections.json` (`fileUrls`). Then run
   `npm run extract-references` again – it renders WebP images for every cited page into `public/references/`.
7. `npm run validate-data && npm test && npm run build`, then `pre-commit run --all-files`.
8. Commit, push, open a PR and add one label: `version:patch` (data only), `version:minor` (new lines or
   features) or `version:major`.
9. After the PR is merged:

   ```sh
   git switch master && git pull
   git tag reference-update-YYYY/MM/DD
   git push origin reference-update-YYYY/MM/DD
   ```

   Then run the **release-deploy** workflow manually (Actions → release-deploy → Run workflow), or wait for
   the next merge, so the site header shows the new data date.
