"""Generate src/data/lines/*.json from the archived references.

Inputs (all under references/raw, listed in references/manifest.json):
- nta-web/schedules-*/...xlsx       NTA published schedules (phases, work areas, opening dates)
- iplan-gis/tatal-*.geojson         statutory plan boundaries + deposit/approval dates
- osm/*.json                        OpenStreetMap route relations and street geometry
- nta-site/**, mavat-*/**           plan documents, cited as materials

Run: .venv/bin/python -m scripts.data_build.build_lines   (from the repo root)
"""

from __future__ import annotations

import datetime as dt
import json
import re
from dataclasses import dataclass, field
from pathlib import Path
from typing import TYPE_CHECKING

from shapely.geometry import LineString
from shapely.ops import linemerge, unary_union

from . import geo
from .route import END, START, Cut, along_street, chain_slice, relation_chains
from .schedule import Row, earliest_datespec, read_rows, to_datespec

if TYPE_CHECKING:
    from collections.abc import Callable

    from shapely.geometry.base import BaseGeometry

ROOT = geo.ROOT
OUT = ROOT / "src" / "data" / "lines"
MANIFEST = json.loads((ROOT / "references" / "manifest.json").read_text(encoding="utf-8"))
DOC_BY_PATH = {d["path"]: d for d in MANIFEST["documents"]}

GREEN_XLSX = "nta-web/schedules-2026-q3/green-line-schedule-2026-q3.xlsx"
PURPLE_XLSX = "nta-web/schedules-2026-q3/purple-line-schedule-2026-q3.xlsx"
METRO_XLSX = "nta-web/schedules-2026-q3/metro-schedule-2026-07.xlsx"
OSM_REL = "osm/lrt-relations-2026-11-19.json"
OSM_STREETS = "osm/streets-2026-11-19.json"

Json = dict[str, object]


def doc_id(raw_relative: str) -> str:
    """Manifest id of a file under references/raw."""
    path = f"references/raw/{raw_relative}"
    if path not in DOC_BY_PATH:
        msg = f"not in manifest: {path}"
        raise KeyError(msg)
    return str(DOC_BY_PATH[path]["id"])


def has_doc(raw_relative: str) -> bool:
    """Whether a file is archived (in the manifest)."""
    return f"references/raw/{raw_relative}" in DOC_BY_PATH


def src(
    raw_relative: str, *, page: int | None = None, quote: str | None = None, note: str | None = None
) -> Json:
    """Build a SourceRef."""
    out: Json = {"docId": doc_id(raw_relative)}
    if page is not None:
        out["page"] = page
    if quote:
        out["quote"] = " ".join(quote.split())[:300]
    if note:
        out["note"] = note
    return out


def row_src(xlsx: str, row: Row, quote: str) -> Json:
    """Source pointing at one spreadsheet row."""
    return src(xlsx, quote=quote, note=f"Sheet '{row.sheet.strip()}', row {row.row}")


# --------------------------------------------------------------------------------------------- statutory plans


@dataclass(frozen=True)
class Plan:
    """A statutory plan in the iplan GIS extract."""

    family: str  # e.g. "71"
    number: str  # e.g. "תתל/ 71/ א"

    def props(self) -> dict[str, object]:
        """GIS attributes."""
        for f in geo.plan_features(self.family):
            if f["properties"]["pl_number"] == self.number:
                return f["properties"]
        msg = f"plan {self.number} missing"
        raise KeyError(msg)

    def source(self) -> Json:
        """Source ref for this plan's GIS record."""
        p = self.props()
        return src(
            f"iplan-gis/tatal-{self.family}.geojson",
            quote=f"{p['pl_number']} – {p['pl_name']}",
            note="Planning Administration GIS record",
        )


def _ms(value: object) -> str | None:
    if not isinstance(value, int | float):
        return None
    return dt.datetime.fromtimestamp(value / 1000, tz=dt.UTC).strftime("%Y-%m-%d")


def plan_entries(plan: Plan) -> tuple[list[Json], list[Json]]:
    """Statutory planning phase + milestones (deposit / approval) for a plan."""
    p = plan.props()
    deposit, approval = _ms(p.get("depositing_date")), _ms(p.get("pl_date_8"))
    name = f"{p['pl_number']} – {p['pl_name']}"
    phases: list[Json] = []
    milestones: list[Json] = []
    if deposit is not None:
        milestones.append({"date": deposit, "label": f"Plan deposited: {name}", "sources": [plan.source()]})
    if approval is not None:
        milestones.append(
            {"date": approval, "label": f"Plan approved (in force): {name}", "sources": [plan.source()]}
        )
    if deposit is not None:
        phase: Json = {
            "kind": "planning",
            "label": f"Statutory planning – {p['pl_number']}",
            "start": deposit,
            "sources": [plan.source()],
        }
        if approval is not None:
            phase["end"] = approval
        phases.append(phase)
    elif approval is None:
        milestones.append(
            {
                "date": "2026-11-19",
                "label": f"Plan status ({p['station_desc']}): {name}",
                "sources": [plan.source()],
            }
        )
    return phases, milestones


# --------------------------------------------------------------------------------------------- schedules

STAGE_KIND = {"תכנון": "planning", "ביצוע": "construction", "מכרז": "planning"}


@dataclass
class ScheduleItem:
    """A schedule row normalised to a phase (and optionally a work area)."""

    row: Row
    kind: str  # planning | construction | operational
    label: str
    start: str | None
    end: str | None
    xlsx: str

    def source(self) -> Json:
        """Source ref for the row."""
        return row_src(self.xlsx, self.row, self.label)

    def phase(self) -> Json | None:
        """As a Phase (needs a start date)."""
        start = self.start or self.end
        if start is None:
            return None
        out: Json = {"kind": self.kind, "label": self.label, "start": start, "sources": [self.source()]}
        if self.end is not None and self.end >= start and self.kind != "operational":
            out["end"] = self.end
        return out


def lrt_items(xlsx: str, header_row: int, serial_key: str) -> dict[str, ScheduleItem]:
    """Purple/Green schedule rows keyed by sub-segment code (תת מקטע) or serial."""
    items: dict[str, ScheduleItem] = {}
    for row in read_rows(xlsx, header_row):
        code = str(row.get("תת מקטע") or row.get(serial_key) or "").strip()
        stage = str(row.get("שלב") or "")
        desc = " ".join(str(x).strip() for x in (row.get("תיאור תת מקטע"), row.get("תיאור מקטע")) if x)
        start = to_datespec(row.get("התחלה עדכני", "התחלה מעודכן")) or to_datespec(row.get("התחלה מקורי"))
        end = to_datespec(row.get("סיום עדכני")) or to_datespec(row.get("סיום מקורי"))
        if not code or (start is None and end is None):
            continue
        kind = next((v for k, v in STAGE_KIND.items() if k in stage), "construction")
        if "PTO" in code or "הפעלה" in stage:
            kind = "operational"
            start = end
            end = None
        elif "TR" in code or "בדיקות" in stage:
            kind = "construction"
        phase_word = {"planning": "Planning", "construction": "Works", "operational": "Opening (PTO)"}[kind]
        if "תכנון" in stage:
            phase_word = "Detailed design"
        infra = "Infra 2" if "2" in stage else ("Infra 1" if "1" in stage else stage.strip())
        label = f"{phase_word} ({infra}, {code}): {desc}" if desc else f"{phase_word} ({infra}, {code})"
        key = f"{code}|{kind}" if f"{code}|{kind}" not in items else f"{code}|{kind}|{row.row}"
        items[key] = ScheduleItem(row, kind, label, start, end, xlsx)
    return items


def metro_items() -> list[ScheduleItem]:
    """Metro schedule rows (line, stage, sub-segment)."""
    out = []
    for row in read_rows(METRO_XLSX, 1, sheet_index=1):
        segment = str(row.get("מקטע") or "")
        stage = str(row.get("שלב") or "")
        sub = str(row.get("תת מקטע") or "").strip()
        desc = str(row.get("תיאור המקטע") or "").strip()
        start = earliest_datespec(row.get("תאריך התחלה עדכני")) or earliest_datespec(
            row.get("תאריך התחלה מקורי")
        )
        end = to_datespec(row.get("תאריך סיום עדכני")) or to_datespec(row.get("תאריך סיום מקורי"))
        if not segment.startswith("קו M") or (start is None and end is None):
            continue
        if "הפעלה" in stage:
            kind, label = "operational", f"Opening{(' ' + sub) if sub and sub != '-' else ''}: {desc}"
            start, end = end, None
        elif "הקמה" in stage:
            kind, label = (
                "construction",
                f"Construction {stage.replace('הקמה - ', '')}{(' ' + sub) if sub and sub != '-' else ''}: {desc}",
            )
        elif "מכרז" in stage:
            kind, label = "planning", f"Tender{(' ' + sub) if sub and sub != '-' else ''}: {desc}"
        else:
            kind, label = "planning", f"Preliminary design{(' ' + sub) if sub and sub != '-' else ''}: {desc}"
        out.append(ScheduleItem(row, kind, label, start, end, METRO_XLSX))
    return out


# --------------------------------------------------------------------------------------------- segments


@dataclass
class SegmentSpec:
    """How to build one segment."""

    id: str
    name: str
    geometry: Callable[[], BaseGeometry]
    geometry_kind: str
    geometry_ref: str
    geometry_sources: list[Json]
    plans: list[Plan] = field(default_factory=list)
    items: list[ScheduleItem] = field(default_factory=list)
    work_areas: list[tuple[str, str, Callable[[], BaseGeometry], ScheduleItem]] = field(default_factory=list)
    materials: list[Json] = field(default_factory=list)


def single_line(geom: BaseGeometry) -> LineString:
    """Collapse to one LineString (merge, else the longest part)."""
    if isinstance(geom, LineString):
        return geom
    merged = linemerge(geom) if geom.geom_type == "MultiLineString" else geom
    if isinstance(merged, LineString):
        return merged
    return max(merged.geoms, key=lambda g: g.length)


def build_segment(spec: SegmentSpec) -> Json:
    """Segment JSON."""
    line = single_line(spec.geometry())
    phases: list[Json] = []
    milestones: list[Json] = []
    for plan in spec.plans:
        p, m = plan_entries(plan)
        phases += p
        milestones += m
    phases += [ph for it in spec.items if (ph := it.phase()) is not None]
    areas: list[Json] = []
    for area_id, name, geom_fn, item in spec.work_areas:
        try:
            geom = geom_fn()
        except ValueError as error:
            print(f"  work area {area_id}: {error}")
            continue
        parts = [g for g in getattr(geom, "geoms", [geom]) if g.length > 20]
        start = item.start or item.end
        if not parts or start is None:
            continue
        for i, part in enumerate(parts):
            area: Json = {
                "id": f"{area_id}-{i + 1}" if len(parts) > 1 else area_id,
                "name": name,
                "geometry": {"type": "Polygon", "coordinates": geo.buffer_polygon_coords(part)},
                "start": start,
                "sources": [item.source(), *spec.geometry_sources],
            }
            if item.end is not None and item.end >= start:
                area["end"] = item.end
            areas.append(area)
    return {
        "id": spec.id,
        "name": spec.name,
        "geometry": {"type": "LineString", "coordinates": geo.to_lnglat_coords(line.simplify(3))},
        "geometrySource": {
            "kind": spec.geometry_kind,
            "ref": spec.geometry_ref,
            "sources": spec.geometry_sources,
        },
        "stations": [],
        "phases": phases,
        "milestones": milestones,
        "workAreas": areas,
        "materials": spec.materials,
    }


def write_line(meta: Json, specs: list[SegmentSpec]) -> None:
    """Write src/data/lines/<id>.json."""
    print(f"line {meta['id']}")
    segments = []
    for spec in specs:
        print(f" segment {spec.id}")
        segments.append(build_segment(spec))
    OUT.mkdir(parents=True, exist_ok=True)
    (OUT / f"{meta['id']}.json").write_text(
        json.dumps({**meta, "segments": segments}, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )


def osm_source(relation: int) -> Json:
    """Source for geometry taken from an OSM relation."""
    return src(OSM_REL, note=f"OpenStreetMap relation {relation} (© OpenStreetMap contributors, ODbL)")


def street_source() -> Json:
    """Source for work-area geometry derived from OSM streets."""
    return src(
        OSM_STREETS, note="Street geometry used to place work areas (© OpenStreetMap contributors, ODbL)"
    )


def regulation_material(
    raw_relative: str, title: str, page: int = 1, quote: str | None = None
) -> Json | None:
    """Build an image material (and optional quote) from a page of an archived PDF."""
    if not has_doc(raw_relative):
        return None
    material: Json = {
        "kind": "image",
        "title": title,
        "image": f"references/{doc_id(raw_relative)}/page-{page}.webp",
        "sources": [src(raw_relative, page=page, quote=quote)],
    }
    if quote:
        material["body"] = quote
    return material


def compact(items: list[Json | None]) -> list[Json]:
    """Drop missing materials."""
    return [i for i in items if i is not None]


# --------------------------------------------------------------------------------------------- lines


def green() -> None:
    """Green line (תת"ל 71)."""
    rel = 9194005
    ch = relation_chains(rel)
    # chain 0: north junction (Einstein) -> Holon junction; 1: Kiryat Atidim branch; 2: Rishon west branch;
    # 3: north to Herzliya; 4: Holon junction -> Rishon east.
    trunk, ne, sw, north, se = ch[0], ch[1], ch[2], ch[3], ch[4]
    levinsky = Cut(street=("לוינסקי",))
    yarkon = Cut(street=("שדרות רוקח", "רוקח"))
    nordau = Cut(street=("שדרות נורדאו", "נורדאו"))
    items = lrt_items(GREEN_XLSX, 2, "סידורי")
    g = lambda *codes: [items[k] for k in items if k.split("|")[0] in codes]  # noqa: E731
    gs = [osm_source(rel)]
    s71a, s71b, s71c, s71d = (Plan("71", f"תתל/ 71/ {x}") for x in ("א", "ב", "ג", "ד"))
    regs = {
        "a": regulation_material(
            "nta-site/תתל 71 א/תכניות מאושרות סרוקות/הוראות.pdf",
            'תת"ל 71/א regulations (scanned) – cover page',
        ),
        "b": regulation_material(
            "nta-site/תתל 71 ב/תתל 71 ב- מסמכים סרוקים למתן תוקף/הוראות.pdf",
            'תת"ל 71/ב regulations (scanned) – cover page',
        ),
        "c": regulation_material(
            "nta-site/תתל 71 ג/תתל 71 ג- מסמכים סרוקים מאושרים/הוראות.pdf",
            'תת"ל 71/ג regulations (scanned) – cover page',
        ),
        "d": regulation_material(
            "nta-site/תתל 71 ד/תתל 71ד - חדרי נהגים/תתל_ 71_ ד_תדפיס הוראות התכנית_חתום להפקדה ות-ל_1.pdf",
            "תת\"ל 71/ד – drivers' rooms along the Green line (explanatory note)",
            page=2,
            quote="התכנית תאפשר את מיקום החדרים בתחום תת\"ל 71 א' ותת\"ל 71 ג', במיקום אשר מאפשר את שילובם במרחב ותפעולם בהתאם לצרכי התפעול של הקו הירוק.",
        ),
    }

    def along(chain: LineString, *names: str) -> Callable[[], BaseGeometry]:
        return lambda: along_street(chain, list(names))

    def between(chain: LineString, a: Cut, b: Cut) -> Callable[[], BaseGeometry]:
        return lambda: chain_slice(chain, a, b)

    def wa(
        code: str, name: str, fn: Callable[[], BaseGeometry]
    ) -> tuple[str, str, Callable[[], BaseGeometry], ScheduleItem]:
        item = next(it for k, it in items.items() if k.split("|")[0] == code)
        return (f"green-{code.lower().replace('.', '-').replace(' ', '-')}", name, fn, item)

    specs = [
        SegmentSpec(
            "green-rishon-east-holon",
            "Rishon LeZion (Kiryat HaHaklait) – Holon Junction",
            lambda: se,
            "osm",
            f"osm:relation/{rel}",
            gs,
            [s71a, s71d],
            g(
                "G1-1",
                "G1-2",
                "G1-3",
                "G1-4",
                "G1-5.2",
                "G1-5.3",
                "G1-6",
                "G1-7",
                "A1",
                "",
                "A2",
                "A3",
                "דיפו",
                "TR 1",
                "PTO 1",
            ),
            [
                wa(
                    "G1-3",
                    "Sayarim & Merkava bridges, Mifratz Shlomo underpass",
                    along(se, "הסיירים", "המרכבה", "מפרץ שלמה"),
                ),
                wa("G1-4", "Sderot Yerushalayim, Holon", along(se, "שדרות ירושלים")),
                wa("G1-5.2", "Sokolov (east), Holon", along(se, "סוקולוב")),
                wa("G1-6", "Kugel underpass and Kugel north", along(se, "שדרות קוגל", "קוגל")),
                wa(
                    "G1-7",
                    "Levi Eshkol, Holon Junction, Ben Zvi east",
                    along(se, "שדרות לוי אשכול", "לוי אשכול"),
                ),
            ],
            compact([regs["a"], regs["d"]]),
        ),
        SegmentSpec(
            "green-rishon-west-holon",
            "Rishon LeZion (Moshe Dayan) – Holon centre",
            lambda: sw,
            "osm",
            f"osm:relation/{rel}",
            gs,
            [s71a],
            g("G2-1", "G2-2", "G2-3", "G2-4", "G2-5", "G2-6", "A4", "A5", "2B"),
            [
                wa("G2-2", "Sderot Moshe Dayan, Rishon LeZion", along(sw, "משה דיין")),
                wa("G2-3", "Avraham Bar, Rishon LeZion", along(sw, "אברהם בר")),
                wa("G2-5", "Bar Lev, Bareket – Holon", along(sw, "בר לב", "ברקת")),
                wa("G2-6", "Fichman, Shenkar – Holon", along(sw, "פיכמן", "שנקר")),
            ],
            compact([regs["a"]]),
        ),
        SegmentSpec(
            "green-holon-levinsky",
            "Holon Junction – Levinsky (Tel Aviv)",
            lambda: chain_slice(trunk, levinsky, END),
            "osm",
            f"osm:relation/{rel}",
            gs,
            [s71a, s71b],
            g("G3-1.1", "G3-1.2", "G3-1.3", "A6", "1B", "3B", "TR 1", "PTO 1"),
            [
                wa("G3-1.1", "Ben Zvi street", along(trunk, "בן צבי", "שדרות בן צבי", "יצחק בן צבי")),
                wa("G3-1.2", "Lavon street", along(trunk, "לבון", "פנחס לבון")),
                wa("G3-1.3", "Har Zion street", along(trunk, "הר ציון", "שדרות הר ציון")),
            ],
            compact([regs["a"]]),
        ),
        SegmentSpec(
            "green-levinsky-yarkon",
            "Levinsky – Yarkon (underground section)",
            lambda: chain_slice(trunk, yarkon, levinsky),
            "osm",
            f"osm:relation/{rel}",
            gs,
            [s71b],
            g(
                "G3-2",
                "נורדאו קרליבך",
                "קרליבך לוינסקי",
                "תחנת ארלוזורוב",
                "תחנת לוינסקי",
                "תחנת נורדאו",
                "תחנת קפלן",
                "תחנת רבין",
                "G3-4",
                "A7",
                "4B",
                "TR 2",
                "PTO 2",
            ),
            [
                wa("G3-2", "Tunnel between Levinsky and Nordau", between(trunk, levinsky, nordau)),
                wa("G3-4", "Yarkon bridge (Rokach)", along(trunk, "שדרות רוקח", "רוקח")),
            ],
            compact([regs["b"]]),
        ),
        SegmentSpec(
            "green-north-herzliya",
            "Tel Aviv north – Herzliya",
            lambda: unary_union([chain_slice(trunk, START, yarkon), north]),
            "osm",
            f"osm:relation/{rel}",
            gs,
            [s71c, s71d],
            g(
                "G5-1",
                "G5-2",
                "G5-3",
                "G5-4",
                "G5-5",
                "G5-6",
                "G5-7",
                "G5-8",
                "A8",
                "A12",
                "6B",
                "TR 2",
                "PTO 2",
            ),
            [
                wa("G5-5", "Einstein street", along(north, "איינשטיין")),
                wa(
                    "G5-7",
                    "Yeshayahu Leibowitz to Naomi Shemer, Herzliya",
                    along(north, "ישעיהו ליבוביץ", "נעמי שמר"),
                ),
            ],
            compact([regs["c"], regs["d"]]),
        ),
        SegmentSpec(
            "green-kiryat-atidim",
            "Einstein – Kiryat Atidim branch",
            lambda: ne,
            "osm",
            f"osm:relation/{rel}",
            gs,
            [s71c],
            g(
                "G4-2",
                "G4-3.1",
                "G4-3.2",
                "G4-4",
                "G4-5.1",
                "G4-5.2",
                "G4-6",
                "G4-8",
                "G4-9.1",
                "G4-9.2",
                "G4-9.3",
                "A9",
                "A10",
                "A11",
                "5B",
                "TR 2",
                "PTO 2",
            ),
            [
                wa("G4-2", "Namir sunken station", along(ne, "דרך נמיר")),
                wa("G4-3.1", "Einstein street", along(ne, "איינשטיין")),
                wa("G4-3.2", "Haim Levanon street", along(ne, "חיים לבנון")),
                wa("G4-4", "Rosenfeld tunnel, Ayalon & Rokach bridges", along(ne, "שדרות רוקח", "רוקח")),
                wa("G4-6", "Shitrit street", along(ne, "שטרית", "בכור שטרית")),
                wa("G4-8", "Pinhas Rosen bridge", along(ne, "פנחס רוזן")),
                wa(
                    "G4-9.1",
                    "Raoul Wallenberg (HaBarzel – HaNehoshet)",
                    between(ne, Cut(street=("הברזל",)), Cut(street=("הנחושת",))),
                ),
                wa(
                    "G4-9.2",
                    "Raoul Wallenberg (HaNehoshet – Dvora HaNevia)",
                    between(ne, Cut(street=("הנחושת",)), Cut(street=("דבורה הנביאה",))),
                ),
                wa(
                    "G4-9.3",
                    "Raoul Wallenberg (Dvora HaNevia – east end)",
                    between(ne, Cut(street=("דבורה הנביאה",)), END),
                ),
            ],
            compact([regs["c"]]),
        ),
    ]
    write_line(
        {
            "id": "green",
            "name": "Green Line",
            "nameHe": "הקו הירוק",
            "mode": "lrt",
            "color": "#2e9d47",
            "description": "Light rail from Rishon LeZion and Holon through Tel Aviv (underground under Carlebach/Ibn Gabirol) to Herzliya and Kiryat Atidim. Statutory plans תת\"ל 71/א (south), 71/ב (central), 71/ג (north) and 71/ד (drivers' rooms).",
            "sources": [
                s71a.source(),
                s71b.source(),
                s71c.source(),
                src(GREEN_XLSX, note="NTA Green line schedule, Q3 2026"),
            ],
        },
        specs,
    )


def purple() -> None:
    """Purple line (תת"ל 70)."""
    rel = 9111705
    ch = relation_chains(rel)
    west, east, bar_ilan = ch[0], ch[1], ch[2]
    oded = Cut(street=("עודד",))
    levanda = Cut(street=("לבנדה",))
    items = lrt_items(PURPLE_XLSX, 1, "מספר סידורי")
    g = lambda *codes: [items[k] for k in items if k.split("|")[0] in codes]  # noqa: E731
    gs = [osm_source(rel)]
    p70a1, p70b, p70c = Plan("70", "תתל/ 70/ א/ 1"), Plan("70", "תתל/ 70/ ב"), Plan("70", "תתל/ 70/ ג")
    reg70a = regulation_material(
        "nta-site/תתל 70 א/הוראות.pdf", 'תת"ל 70/א regulations (scanned) – cover page'
    )
    reg70b = regulation_material(
        "nta-site/תתל 70 ב/הוראות תתל 70 ב.pdf", 'תת"ל 70/ב regulations (scanned) – cover page'
    )
    reg70c = regulation_material(
        "nta-site/תתל 70 ג/תת~ל 70 ג/הוראות תתל 70 ג.pdf", 'תת"ל 70/ג regulations (scanned) – cover page'
    )

    def along(chain: LineString, *names: str) -> Callable[[], BaseGeometry]:
        return lambda: along_street(chain, list(names))

    def between(chain: LineString, a: Cut, b: Cut) -> Callable[[], BaseGeometry]:
        return lambda: chain_slice(chain, a, b)

    def wa(
        code: str, name: str, fn: Callable[[], BaseGeometry]
    ) -> tuple[str, str, Callable[[], BaseGeometry], ScheduleItem]:
        item = next(it for k, it in items.items() if k.split("|")[0] == code)
        return (f"purple-{code.lower().replace('.', '-').replace('+', '-')}", name, fn, item)

    namir, weizmann, ibn_gabirol = (
        Cut(street=("דרך נמיר",)),
        Cut(street=("ויצמן",)),
        Cut(street=("אבן גבירול",)),
    )
    specs = [
        SegmentSpec(
            "purple-arlozorov-levinsky",
            "Arlozorov (Savidor) – Ben Yehuda – Allenby – Levinsky",
            lambda: chain_slice(west, START, levanda),
            "osm",
            f"osm:relation/{rel}",
            gs,
            [p70a1],
            g(
                "PLW1-1",
                "PLW1-2",
                "PLW1-3",
                "PLW1-4",
                "PLW1-5+6",
                "PLW1-7",
                "PLW1-8",
                "PLW1-9.1",
                "PLW1-9.2",
                "PLW1-10.1",
                "PLW1-10.2",
                "A1",
                "A2",
                "A3",
                "B1",
                "TR",
                "PTO",
            ),
            [
                wa("PLW1-1", "Arlozorov: Savidor station – Namir", between(west, START, namir)),
                wa("PLW1-2", "Arlozorov: Namir – Weizmann", between(west, namir, weizmann)),
                wa("PLW1-3", "Arlozorov: Weizmann – Ibn Gabirol", between(west, weizmann, ibn_gabirol)),
                wa(
                    "PLW1-4",
                    "Arlozorov: Ibn Gabirol – Ben Yehuda",
                    between(west, ibn_gabirol, Cut(street=("בן יהודה",))),
                ),
                wa("PLW1-5+6", "Ben Yehuda: Arlozorov – Allenby", along(west, "בן יהודה")),
                wa(
                    "PLW1-7",
                    "Allenby: Ben Yehuda – King George",
                    between(west, Cut(street=("בן יהודה",), nth=99), Cut(street=("המלך ג'ורג'",))),
                ),
                wa(
                    "PLW1-9.1",
                    "Allenby: King George – Montefiore",
                    between(west, Cut(street=("המלך ג'ורג'",)), Cut(street=("מונטיפיורי",))),
                ),
                wa(
                    "PLW1-9.2",
                    "Allenby: Montefiore – Yehuda HaLevi",
                    between(west, Cut(street=("מונטיפיורי",)), Cut(street=("יהודה הלוי",))),
                ),
                wa("PLW1-10.2", "Levinsky: Lishansky – Levanda", along(west, "לוינסקי")),
            ],
            compact([reg70a]),
        ),
        SegmentSpec(
            "purple-hahagana-oded",
            "HaHagana – Oded junction",
            lambda: chain_slice(west, levanda, oded),
            "osm",
            f"osm:relation/{rel}",
            gs,
            [p70a1],
            g("PLW1-11.1", "PLW1-11.2", "PLW1-12", "PLW1-13", "PLW1-14", "A4", "A5", "B2", "TR", "PTO"),
            [
                wa(
                    "PLW1-11.1",
                    "HaHagana: Levanda – Kehilat New York",
                    between(west, levanda, Cut(street=("קהילת ניו יורק",))),
                ),
                wa(
                    "PLW1-12",
                    "HaHagana: Kehilat New York – Moshe Dayan",
                    between(west, Cut(street=("קהילת ניו יורק",)), Cut(street=("משה דיין",))),
                ),
                wa(
                    "PLW1-13",
                    "HaHagana: Moshe Dayan – HaTayasim",
                    between(west, Cut(street=("משה דיין",)), Cut(street=("הטייסים",))),
                ),
                wa(
                    "PLW1-14",
                    "HaHagana / Derech HaShalom: HaTayasim – Oded",
                    between(west, Cut(street=("הטייסים",)), oded),
                ),
            ],
            compact([reg70a]),
        ),
        SegmentSpec(
            "purple-aluf-sadeh-sheba",
            "Aluf Sadeh – Sheba (Ramat Gan)",
            lambda: chain_slice(west, oded, END),
            "osm",
            f"osm:relation/{rel}",
            gs,
            [p70b],
            g("PLW2-1", "PLW2-2", "PLW2-3", "PLW2-4", "A6", "A7", "B3", "B4", "TR", "PTO"),
            [
                wa("PLW2-1", "Aluf Sadeh: Oded – Rabin", along(west, "אלוף שדה")),
                wa("PLW2-4", "Raphael Eitan: Sheba – HaRav Goren", along(west, "רפאל איתן")),
            ],
            compact([reg70b]),
        ),
        SegmentSpec(
            "purple-bar-ilan",
            "Bar-Ilan University – Givat Shmuel branch",
            lambda: bar_ilan,
            "osm",
            f"osm:relation/{rel}",
            gs,
            [p70b],
            g("PLW2-5", "PLW2-6", "A8", "TR", "PTO"),
            [wa("PLW2-6", "Max ve-Anna Webb: Bar-Ilan – Jabotinsky", along(bar_ilan, "מקס ואנה ווב"))],
            compact([reg70b]),
        ),
        SegmentSpec(
            "purple-east-yehud",
            "Sheba – Road 461 – HaTayasim depot (Yehud)",
            lambda: east,
            "osm",
            f"osm:relation/{rel}",
            gs,
            [p70b, p70c],
            g("PLE1", "PLE2.5", "PLE3.2", "A9", "A10", "B5", "TR", "PTO"),
            [wa("PLE1", "Raphael Eitan: Sheba – Road 461", along(east, "רפאל איתן"))],
            compact([reg70b, reg70c]),
        ),
    ]
    write_line(
        {
            "id": "purple",
            "name": "Purple Line",
            "nameHe": "הקו הסגול",
            "mode": "lrt",
            "color": "#7b3fa0",
            "description": 'Light rail from central Tel Aviv (Allenby, Ben Yehuda, Arlozorov) through Givatayim and Ramat Gan to Bar-Ilan University and Yehud. Statutory plans תת"ל 70/א, 70/א/1, 70/ב and 70/ג.',
            "sources": [p70b.source(), src(PURPLE_XLSX, note="NTA Purple line schedule, Q3 2026")],
        },
        specs,
    )


def traced_segment(
    seg_id: str, name: str, plan: Plan, items: list[ScheduleItem], materials: list[Json]
) -> SegmentSpec:
    """Segment whose geometry is the traced centerline of a plan boundary."""
    poly = geo.plan_polygon(plan.family, plan.number)
    return SegmentSpec(
        seg_id,
        name,
        lambda: max(geo.centerline(poly), key=lambda line: line.length),
        "traced",
        f"centerline of {plan.number} boundary (iplan GIS)",
        [plan.source()],
        [plan],
        items,
        [],
        materials,
    )


def metro() -> None:
    """Metro lines M1, M2, M3 (תת"ל 101, 102, 103)."""
    rows = metro_items()
    by_line = {m: [it for it in rows if f"קו M{m}" in str(it.row.get("מקטע"))] for m in ("1", "2", "3")}
    m1c_purpose = regulation_material(
        "metro-july-2025/תתל 101 ג/תתל_ 101_ ג_תדפיס הוראות התכנית_חתום לאישור ות-ל_1.pdf",
        'תת"ל 101/ג regulations – plan objective (section 2.1)',
        page=22,
        quote="התוויה של חלקו הצפוני של קו מטרו M1, המבנים והמתקנים המהווים חלק ממנו והנחוצים להקמתו, הפעלתו ותחזוקתו.",
    )
    m2_regs = regulation_material(
        "metro-july-2025/תתל 102/הוראות - תדפיס הוראות התכנית.pdf",
        'תת"ל 102 regulations (scanned) – cover page',
    )
    mavat_103g = regulation_material(
        "mavat-5005400010/tatal-103-g-regulations.pdf", 'תת"ל 103/ג regulations – cover page'
    )
    mavat_103g_draw = regulation_material(
        "mavat-5005400010/tatal-103-g-drawing.pdf", 'תת"ל 103/ג – plan drawing (תשריט)'
    )
    mavat_102b = regulation_material(
        "mavat-99005512864/tatal-102-b-regulations.pdf", 'תת"ל 102/ב regulations – cover page'
    )
    mavat_102b_draw = regulation_material(
        "mavat-99005512864/tatal-102-b-drawing.pdf", 'תת"ל 102/ב – plan drawing (תשריט)'
    )
    lines = [
        (
            {
                "id": "m1",
                "name": "Metro M1",
                "nameHe": "קו מטרו M1",
                "color": "#1f6fd1",
                "description": "Metro line M1: from the south (Rehovot/Rishon LeZion/Lod) through Tel Aviv to the north (Herzliya/Kfar Sava/Ra'anana). Statutory plans תת\"ל 101/א–ד.",
            },
            [
                traced_segment("m1-south", "M1 South (101/א)", Plan("101", "תתל/ 101/ א"), by_line["1"], []),
                traced_segment(
                    "m1-north-central", "M1 North – central part (101/ב)", Plan("101", "תתל/ 101/ ב"), [], []
                ),
                traced_segment(
                    "m1-north",
                    "M1 North (101/ג)",
                    Plan("101", "תתל/ 101/ ג"),
                    [],
                    compact([m1c_purpose]),
                ),
            ],
        ),
        (
            {
                "id": "m2",
                "name": "Metro M2",
                "nameHe": "קו מטרו M2",
                "color": "#e8811a",
                "description": 'Metro line M2: from Petah Tikva (Segula depot) through Bnei Brak and Tel Aviv to Holon. Statutory plans תת"ל 102 and 102/ב.',
            },
            [
                traced_segment(
                    "m2",
                    "M2 Segula depot – Holon terminus (102)",
                    Plan("102", "תתל/ 102"),
                    by_line["2"],
                    compact([m2_regs, mavat_102b, mavat_102b_draw]),
                )
            ],
        ),
        (
            {
                "id": "m3",
                "name": "Metro M3",
                "nameHe": "קו מטרו M3",
                "color": "#8c1d40",
                "description": 'Metro line M3: a ring line from Bat Yam through Holon, Or Yehuda, Ramat Gan and Kiryat Arye to north Tel Aviv. Statutory plans תת"ל 103, 103/ב and 103/ג.',
            },
            [
                traced_segment(
                    "m3",
                    "M3 Bat Yam – Kiryat Arye – north (103)",
                    Plan("103", "תתל/ 103"),
                    by_line["3"],
                    compact([mavat_103g, mavat_103g_draw]),
                )
            ],
        ),
    ]
    for meta, specs in lines:
        plan_sources = [s.geometry_sources[0] for s in specs]
        write_line(
            {
                **meta,
                "mode": "metro",
                "sources": [*plan_sources, src(METRO_XLSX, note="NTA metro schedule, July 2026")],
            },
            specs,
        )


def brown() -> None:
    """Brown line (תת"ל 72) – statutory plans only (no published schedule)."""
    a, b = Plan("72", "תתל/ 72/ א"), Plan("72", "תתל/ 72/ ב")
    specs = [
        traced_segment(
            "brown-west",
            "Brown line and southern Red line branch (72/א)",
            a,
            [],
            compact(
                [
                    regulation_material(
                        "nta-site/תתל72א/נתע חוברות/הוראות התוכנית .pdf",
                        'תת"ל 72/א regulations (scanned) – cover page',
                    )
                ]
            ),
        ),
        traced_segment(
            "brown-east",
            "Brown line – eastern section (72/ב)",
            b,
            [],
            compact(
                [
                    regulation_material(
                        "nta-site/תתל72ב/חוברות/הוראות התכנית.pdf",
                        'תת"ל 72/ב regulations (scanned) – cover page',
                    )
                ]
            ),
        ),
    ]
    write_line(
        {
            "id": "brown",
            "name": "Brown Line",
            "nameHe": "הקו החום",
            "mode": "lrt",
            "color": "#8b5a2b",
            "description": 'Light rail in the southern metropolis (Rishon LeZion, Ness Ziona, Rehovot area). Statutory plans תת"ל 72/א and 72/ב; no construction schedule is published yet.',
            "sources": [a.source(), b.source()],
        },
        specs,
    )


def write_cited_documents() -> None:
    """Write src/data/documents.json: the manifest entries the site actually cites."""
    cited: set[str] = set()
    for file in OUT.glob("*.json"):
        if file.name != "documents.json":
            cited.update(re.findall(r'"docId": "([^"]+)"', file.read_text(encoding="utf-8")))
    keep = ("id", "title", "collection", "path", "originalUrl", "retrievedAt", "pages")
    docs = [{k: d[k] for k in keep if k in d} for d in MANIFEST["documents"] if d["id"] in cited]
    target = OUT.parent / "documents.json"
    target.write_text(json.dumps({"documents": docs}, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"cited documents: {len(docs)}")


def main() -> None:
    """Build all lines."""
    green()
    purple()
    metro()
    brown()
    write_cited_documents()


if __name__ == "__main__":
    main()


__all__ = ["Path", "geo"]
