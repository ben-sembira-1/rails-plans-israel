"""Route geometry: OSM route chains, cut points at cross streets, and work areas along named streets."""

from __future__ import annotations

import json
from dataclasses import dataclass
from functools import cache
from typing import TYPE_CHECKING

from shapely.geometry import LineString, Point
from shapely.ops import linemerge, substring, unary_union

from .geo import RAW, street_geometry, to_m

if TYPE_CHECKING:
    from shapely.geometry.base import BaseGeometry

STREETS = "osm/streets-2026-11-19.json"
RELATIONS = "osm/lrt-relations-2026-11-19.json"


@cache
def relation_chains(relation_id: int) -> list[LineString]:
    """Way members of an archived OSM route relation merged into chains (metres), longest first."""
    data = json.loads((RAW / RELATIONS).read_text(encoding="utf-8"))
    rel = next(e for e in data["elements"] if e["id"] == relation_id)
    lines = [
        to_m(LineString([(p["lon"], p["lat"]) for p in m["geometry"]]))
        for m in rel["members"]
        if m["type"] == "way"
        and m.get("role", "") in ("", "forward", "backward")
        and len(m.get("geometry", [])) >= 2
    ]
    merged = linemerge(unary_union(lines))
    chains = list(getattr(merged, "geoms", [merged]))
    return sorted(chains, key=lambda c: c.length, reverse=True)


@dataclass(frozen=True)
class Cut:
    """A position along a chain: its start/end, a cross street, or a fixed lon/lat."""

    street: tuple[str, ...] = ()
    lonlat: tuple[float, float] | None = None
    end: bool = False  # with no street/lonlat: False = chain start, True = chain end
    nth: int = 0  # which crossing (ordered along the chain) when the street crosses several times

    def distance_along(self, chain: LineString) -> float:
        """Distance of this cut from the chain start (metres)."""
        if self.lonlat is not None:
            return chain.project(to_m(Point(*self.lonlat)))
        if not self.street:
            return chain.length if self.end else 0.0
        cross = street_geometry(STREETS, list(self.street), chain, radius=60)
        hits: list[float] = []
        for way in getattr(cross, "geoms", [cross]):
            inter = chain.intersection(way)
            if inter.is_empty:
                if way.distance(chain) <= 60:
                    hits.append(chain.project(way.interpolate(way.project(chain.centroid))))
                continue
            hits.extend(
                chain.project(g if g.geom_type == "Point" else g.centroid)
                for g in getattr(inter, "geoms", [inter])
            )
        if not hits:
            msg = f"street {self.street} does not reach the chain"
            raise ValueError(msg)
        hits = sorted({round(h) for h in hits})
        return float(hits[min(self.nth, len(hits) - 1)])


START = Cut()
END = Cut(end=True)


def chain_slice(chain: LineString, a: Cut, b: Cut) -> LineString:
    """Part of a chain between two cuts."""
    da, db = sorted((a.distance_along(chain), b.distance_along(chain)))
    return substring(chain, da, max(db, da + 1))


def along_street(route: BaseGeometry, names: list[str], width: float = 35) -> BaseGeometry:
    """Parts of the route that run along (within `width` m of) the named street."""
    street = street_geometry(STREETS, names, route, radius=width)
    return route.intersection(street.buffer(width))
