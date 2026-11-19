"""Geometry helpers: OSM street slicing and plan-boundary centerlines."""

from __future__ import annotations

import itertools
import json
from functools import cache
from pathlib import Path
from typing import TYPE_CHECKING

import networkx as nx
import numpy as np
from pyproj import Transformer
from shapely.geometry import LineString, MultiLineString, Point, shape
from shapely.ops import linemerge, nearest_points, substring, transform, unary_union
from skimage.draw import polygon as draw_polygon
from skimage.morphology import binary_closing, disk, skeletonize

if TYPE_CHECKING:
    from shapely.geometry.base import BaseGeometry

ROOT = Path(__file__).resolve().parents[2]
RAW = ROOT / "references" / "raw"

_TO_M = Transformer.from_crs(4326, 2039, always_xy=True).transform
_TO_LL = Transformer.from_crs(2039, 4326, always_xy=True).transform


def to_m(geom: BaseGeometry) -> BaseGeometry:
    """WGS84 -> Israeli TM grid (metres)."""
    return transform(_TO_M, geom)


def to_ll(geom: BaseGeometry) -> BaseGeometry:
    """Israeli TM grid (metres) -> WGS84."""
    return transform(_TO_LL, geom)


_NON_ROAD = {"footway", "path", "cycleway", "steps", "corridor", "bridleway", "construction", "proposed"}


@cache
def streets(path: str) -> dict[str, list[LineString]]:
    """Street name -> list of road way geometries (metres), from an archived Overpass extract."""
    data = json.loads((RAW / path).read_text(encoding="utf-8"))
    out: dict[str, list[LineString]] = {}
    for el in data["elements"]:
        if el["tags"].get("highway") in _NON_ROAD:
            continue
        coords = [(p["lon"], p["lat"]) for p in el.get("geometry", [])]
        if len(coords) >= 2:
            out.setdefault(el["tags"]["name"], []).append(to_m(LineString(coords)))
    return out


def street_geometry(
    path: str, names: list[str], near: BaseGeometry | None = None, radius: float = 400
) -> BaseGeometry:
    """Union of all ways called any of `names`, optionally restricted to `radius` m around `near`."""
    ways = [w for n in names for w in streets(path).get(n, [])]
    if near is not None:
        zone = near.buffer(radius)
        ways = [w for w in ways if w.intersects(zone)]
    if not ways:
        msg = f"no ways named {names}"
        raise ValueError(msg)
    return unary_union(ways)


def longest_chain(geom: BaseGeometry) -> LineString:
    """Merge a (multi)line into its longest connected chain."""
    merged = linemerge(geom) if not isinstance(geom, LineString) else geom
    if isinstance(merged, LineString):
        return merged
    return max(merged.geoms, key=lambda g: g.length)


def junction(a: BaseGeometry, b: BaseGeometry) -> Point:
    """Point where two streets meet (or are closest)."""
    inter = a.intersection(b)
    if not inter.is_empty:
        return inter.centroid if inter.geom_type != "Point" else inter
    return a.interpolate(a.project(b.centroid))


def slice_between(line: LineString, p1: Point, p2: Point) -> LineString:
    """Part of `line` between the projections of two points."""
    d1, d2 = line.project(p1), line.project(p2)
    lo, hi = sorted((d1, d2))
    if hi - lo < 1:
        hi = min(line.length, lo + 1)
    return substring(line, lo, hi)


def _graph(ways: list[LineString]) -> nx.Graph:
    graph = nx.Graph()
    for way in ways:
        pts = [(round(x, 1), round(y, 1)) for x, y in way.coords]
        for a, b in itertools.pairwise(pts):
            graph.add_edge(a, b, weight=Point(a).distance(Point(b)))
    return graph


def route_along(ways: list[LineString], p1: Point, p2: Point) -> LineString:
    """Shortest path along the given ways between the nodes nearest to p1 and p2."""
    graph = _graph(ways)
    nodes = list(graph.nodes)

    def nearest(p: Point) -> tuple[float, float]:
        return min(nodes, key=lambda n: (n[0] - p.x) ** 2 + (n[1] - p.y) ** 2)

    a, b = nearest(p1), nearest(p2)
    try:
        path = nx.shortest_path(graph, a, b, weight="weight")
    except nx.NetworkXNoPath:
        # Disconnected (e.g. a gap in the data): fall back to slicing the merged chain.
        return slice_between(longest_chain(unary_union(ways)), p1, p2)
    if len(path) < 2:
        path = [a, (a[0] + 0.5, a[1] + 0.5)]
    return LineString(path)


def candidate_points(
    path: str, spec: list[str] | Point, main: BaseGeometry, radius: float = 200
) -> list[Point]:
    """Return the fixed point, or every place where `main` meets (or comes closest to) the cross street."""
    if isinstance(spec, Point):
        return [spec]
    cross = street_geometry(path, spec, main, radius=radius)
    points: list[Point] = []
    for way in getattr(cross, "geoms", [cross]):
        if way.distance(main) > radius:
            continue
        inter = main.intersection(way)
        if inter.is_empty:
            points.append(nearest_points(main, way)[0])
        else:
            points.extend(getattr(inter, "geoms", [inter]) if inter.geom_type != "Point" else [inter])
    return [p if p.geom_type == "Point" else p.centroid for p in points]


def street_slice(
    path: str, street: list[str], start: list[str] | Point, end: list[str] | Point, near: BaseGeometry
) -> LineString:
    """Slice of `street` between two cross streets (or fixed points), close to `near`.

    Street names repeat across cities, so among all candidate junctions we take the closest start/end pair.
    """
    main = street_geometry(path, street, near)
    starts = candidate_points(path, start, main)
    ends = candidate_points(path, end, main)
    p1, p2 = min(((a, b) for a in starts for b in ends), key=lambda ab: ab[0].distance(ab[1]))
    local = [w for w in getattr(main, "geoms", [main]) if w.distance(LineString([p1, p2])) < 1500]
    return route_along(local, p1, p2)


def ll_point(lon: float, lat: float) -> Point:
    """Point in metres from lon/lat."""
    return to_m(Point(lon, lat))


@cache
def plan_features(n: str) -> list[dict]:
    """Features of an archived iplan GIS extract (tatal-<n>.geojson)."""
    data = json.loads((RAW / "iplan-gis" / f"tatal-{n}.geojson").read_text(encoding="utf-8"))
    return data["features"]


def plan_polygon(n: str, pl_number: str) -> BaseGeometry:
    """Boundary polygon (metres) of a plan by its number, e.g. 'תתל/ 103'."""
    for f in plan_features(n):
        if f["properties"]["pl_number"] == pl_number:
            return to_m(shape(f["geometry"]))
    msg = f"plan {pl_number} not found"
    raise KeyError(msg)


def centerline(
    poly: BaseGeometry, res: float = 10.0, max_paths: int = 1, min_len: float = 300
) -> list[LineString]:
    """Trace approximate centerlines of a corridor polygon (metres) via raster skeletonization."""
    minx, miny, maxx, maxy = poly.bounds
    w, h = int((maxx - minx) / res) + 3, int((maxy - miny) / res) + 3
    img = np.zeros((h, w), dtype=bool)
    for p in getattr(poly, "geoms", [poly]):
        ext = np.asarray(p.exterior.coords)
        rr, cc = draw_polygon((ext[:, 1] - miny) / res + 1, (ext[:, 0] - minx) / res + 1, img.shape)
        img[rr, cc] = True
        for hole in p.interiors:
            hc = np.asarray(hole.coords)
            rr, cc = draw_polygon((hc[:, 1] - miny) / res + 1, (hc[:, 0] - minx) / res + 1, img.shape)
            img[rr, cc] = False
    skel = skeletonize(binary_closing(img, disk(2)))
    graph = nx.Graph()
    pts = set(zip(*np.nonzero(skel), strict=True))
    for y, x in pts:
        for dy in (-1, 0, 1):
            for dx in (-1, 0, 1):
                if (dy or dx) and (y + dy, x + dx) in pts:
                    graph.add_edge((y, x), (y + dy, x + dx), weight=(dx * dx + dy * dy) ** 0.5)
    lines: list[LineString] = []
    for comp in sorted(nx.connected_components(graph), key=len, reverse=True)[:max_paths]:
        sub = graph.subgraph(comp)
        start = next(iter(comp))
        dist = nx.single_source_dijkstra_path_length(sub, start)
        a = max(dist, key=dist.__getitem__)
        dist, paths = nx.single_source_dijkstra(sub, a)
        b = max(dist, key=dist.__getitem__)
        if dist[b] * res < min_len:
            continue
        coords = [((x - 1) * res + minx, (y - 1) * res + miny) for y, x in paths[b]]
        lines.append(LineString(coords).simplify(res))
    return lines


def to_lnglat_coords(geom: BaseGeometry, decimals: int = 6) -> list[list[float]]:
    """Convert a LineString in metres to [[lng, lat], ...]."""
    ll = to_ll(geom)
    return [[round(x, decimals), round(y, decimals)] for x, y in ll.coords]


def buffer_polygon_coords(geom: BaseGeometry, width: float = 18) -> list[list[list[float]]]:
    """Work-area polygon (lng/lat rings) as a buffer around a line in metres."""
    poly = geom.buffer(width, cap_style="flat").simplify(2)
    if poly.geom_type == "MultiPolygon":
        poly = max(poly.geoms, key=lambda g: g.area)
    ll = to_ll(poly)
    return [[[round(x, 6), round(y, 6)] for x, y in ll.exterior.coords]]


__all__ = ["MultiLineString"]
