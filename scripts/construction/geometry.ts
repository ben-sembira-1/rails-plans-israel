import type { LatLng } from '../../src/data/validate.ts';
import type { Geometry, Position } from './arcgis.ts';

/** ~1 m: enough for a site outline, and keeps the file small. */
const round = (x: number) => Math.round(x * 1e5) / 1e5;

function toPath(coords: readonly Position[], closed: boolean): LatLng[] {
  const out: LatLng[] = [];
  for (const [lng, lat] of coords) {
    const p: LatLng = [round(lat), round(lng)];
    const prev = out[out.length - 1];
    if (prev?.[0] !== p[0] || prev[1] !== p[1]) out.push(p);
  }
  // GeoJSON rings repeat the first point at the end; we close rings when drawing.
  const first = out[0];
  const last = out[out.length - 1];
  if (closed && out.length > 1 && first && first[0] === last?.[0] && first[1] === last[1]) out.pop();
  return out;
}

/** Outer rings of (multi)polygons, at least 3 points each. */
export function rings(g: Geometry | null): LatLng[][] {
  if (g === null) return [];
  const polys = g.type === 'Polygon' ? [g.coordinates] : g.type === 'MultiPolygon' ? g.coordinates : [];
  return polys.flatMap((poly) => {
    const outer = poly[0];
    if (!outer) return [];
    const r = toPath(outer, true);
    return r.length >= 3 ? [r] : [];
  });
}

/** Paths of (multi)line strings, at least 2 points each. */
export function lines(g: Geometry | null): LatLng[][] {
  if (g === null) return [];
  const parts = g.type === 'LineString' ? [g.coordinates] : g.type === 'MultiLineString' ? g.coordinates : [];
  return parts.map((p) => toPath(p, false)).filter((p) => p.length >= 2);
}

function ringArea(r: readonly LatLng[]): number {
  let a = 0;
  for (let i = 0; i < r.length; i++) {
    const p = r[i];
    const q = r[(i + 1) % r.length];
    if (p && q) a += p[1] * q[0] - q[1] * p[0];
  }
  return a / 2;
}

/** A representative point: the centroid of the largest ring, or the middle vertex of the first path. */
export function representativePoint(shapes: readonly (readonly LatLng[])[], closed: boolean): LatLng | null {
  if (!closed) {
    const first = shapes[0];
    return first?.[Math.floor(first.length / 2)] ?? null;
  }
  let best: readonly LatLng[] | undefined;
  for (const s of shapes) if (!best || Math.abs(ringArea(s)) > Math.abs(ringArea(best))) best = s;
  if (!best) return null;
  const a = ringArea(best);
  if (a === 0) {
    const lat = best.reduce((s, p) => s + p[0], 0) / best.length;
    const lng = best.reduce((s, p) => s + p[1], 0) / best.length;
    return [round(lat), round(lng)];
  }
  let cx = 0;
  let cy = 0;
  for (let i = 0; i < best.length; i++) {
    const p = best[i];
    const q = best[(i + 1) % best.length];
    if (!p || !q) continue;
    const f = p[1] * q[0] - q[1] * p[0];
    cx += (p[1] + q[1]) * f;
    cy += (p[0] + q[0]) * f;
  }
  return [round(cy / (6 * a)), round(cx / (6 * a))];
}
