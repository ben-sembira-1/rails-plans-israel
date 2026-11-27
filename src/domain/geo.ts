import type { LatLng } from '../data/schema.ts';

const M_PER_DEG_LAT = 110_574;
const M_PER_DEG_LNG_AT_EQUATOR = 111_320;
/** Points per vertex cap: smooth enough at street zoom. */
const CAP_POINTS = 16;

interface Xy {
  readonly x: number;
  readonly y: number;
}

/** Signed area (shoelace); positive = counter-clockwise. */
function area(ring: readonly Xy[]): number {
  let a = 0;
  for (let i = 0; i < ring.length; i++) {
    const p = ring[i];
    const q = ring[(i + 1) % ring.length];
    if (p && q) a += p.x * q.y - q.x * p.y;
  }
  return a / 2;
}

/**
 * The area within `meters` of a polyline, at real scale, as rings: a rectangle around each segment and a circle
 * around each vertex. Every ring winds counter-clockwise, so drawn together as one polygon (non-zero fill) they
 * cover the union without overlaps showing darker.
 *
 * Uses a local flat projection around the path, which is exact enough for a few kilometres.
 */
export function bufferRings(path: readonly LatLng[], meters: number): LatLng[][] {
  const first = path[0];
  if (!first || meters <= 0) return [];
  const kx = M_PER_DEG_LNG_AT_EQUATOR * Math.cos((first[0] * Math.PI) / 180);
  const toXy = ([lat, lng]: LatLng): Xy => ({
    x: (lng - first[1]) * kx,
    y: (lat - first[0]) * M_PER_DEG_LAT,
  });
  const toLatLng = ({ x, y }: Xy): LatLng => [first[0] + y / M_PER_DEG_LAT, first[1] + x / kx];
  const pts = path.map(toXy);
  const rings: Xy[][] = [];

  for (const c of pts) {
    rings.push(
      Array.from({ length: CAP_POINTS }, (_, i) => {
        const t = (2 * Math.PI * i) / CAP_POINTS;
        return { x: c.x + meters * Math.cos(t), y: c.y + meters * Math.sin(t) };
      }),
    );
  }
  for (let i = 0; i + 1 < pts.length; i++) {
    const a = pts[i];
    const b = pts[i + 1];
    if (!a || !b) continue;
    const len = Math.hypot(b.x - a.x, b.y - a.y);
    if (len === 0) continue;
    const nx = (-(b.y - a.y) / len) * meters;
    const ny = ((b.x - a.x) / len) * meters;
    rings.push([
      { x: a.x + nx, y: a.y + ny },
      { x: a.x - nx, y: a.y - ny },
      { x: b.x - nx, y: b.y - ny },
      { x: b.x + nx, y: b.y + ny },
    ]);
  }
  return rings.map((r) => (area(r) < 0 ? [...r].reverse() : r).map(toLatLng));
}
