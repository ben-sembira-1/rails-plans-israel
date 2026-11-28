import { describe, expect, it } from 'vitest';
import type { LatLng } from '../data/schema.ts';
import { areaBufferRings, bufferRings, clipBelow, risingFill } from './geo.ts';

const M_PER_DEG_LAT = 110_574;

/** Shoelace area in degree units; positive = counter-clockwise (x = lng, y = lat). */
function signedArea(ring: readonly LatLng[]): number {
  let a = 0;
  for (let i = 0; i < ring.length; i++) {
    const p = ring[i];
    const q = ring[(i + 1) % ring.length];
    if (p && q) a += p[1] * q[0] - q[1] * p[0];
  }
  return a / 2;
}

describe('bufferRings', () => {
  // A north-south line on Allenby, about 333 m long.
  const path: LatLng[] = [
    [32.065, 34.772],
    [32.068, 34.772],
  ];

  it('makes a circle per vertex and a rectangle per segment', () => {
    const rings = bufferRings(path, 100);
    expect(rings).toHaveLength(3);
    expect(rings.filter((r) => r.length === 4)).toHaveLength(1);
  });

  it('reaches exactly the given distance from the line, at real scale', () => {
    const rect = bufferRings(path, 100).find((r) => r.length === 4) ?? [];
    const kx = 111_320 * Math.cos((32.065 * Math.PI) / 180);
    const widths = rect.map((p) => Math.abs(p[1] - 34.772) * kx);
    for (const w of widths) expect(w).toBeCloseTo(100, 6);
    const circle = bufferRings(path, 20)[0] ?? [];
    const top = Math.max(...circle.map((p) => (p[0] - 32.065) * M_PER_DEG_LAT));
    expect(top).toBeCloseTo(20, 6);
  });

  it('winds every ring the same way, so the union fills without darker overlaps', () => {
    const rings = bufferRings(
      [
        [32.065, 34.772],
        [32.066, 34.775],
        [32.064, 34.776],
      ],
      100,
    );
    expect(rings.every((r) => signedArea(r) > 0)).toBe(true);
  });

  it('is empty for an empty path or a zero distance', () => {
    expect(bufferRings([], 100)).toEqual([]);
    expect(bufferRings(path, 0)).toEqual([]);
  });
});

/** Non-zero winding test of a point against rings drawn together as one polygon. */
function covered(rings: readonly (readonly LatLng[])[], [lat, lng]: LatLng): boolean {
  let winding = 0;
  for (const r of rings) {
    for (let i = 0; i < r.length; i++) {
      const a = r[i];
      const b = r[(i + 1) % r.length];
      if (!a || !b) continue;
      const cross = (b[1] - a[1]) * (lat - a[0]) - (lng - a[1]) * (b[0] - a[0]);
      if (a[0] <= lat && b[0] > lat && cross > 0) winding++;
      else if (a[0] > lat && b[0] <= lat && cross < 0) winding--;
    }
  }
  return winding !== 0;
}

describe('areaBufferRings', () => {
  // A 40 m × 40 m site, drawn clockwise on purpose.
  const lat0 = 32.07;
  const lng0 = 34.78;
  const kx = 111_320 * Math.cos((lat0 * Math.PI) / 180);
  const dLat = 40 / M_PER_DEG_LAT;
  const dLng = 40 / kx;
  const site: LatLng[] = [
    [lat0, lng0],
    [lat0 + dLat, lng0],
    [lat0 + dLat, lng0 + dLng],
    [lat0, lng0 + dLng],
  ];
  // Points due east of the site's east edge, at its middle.
  const east = (m: number): LatLng => [lat0 + dLat / 2, lng0 + dLng + m / kx];

  it('covers the site and the bands at 20 m and 50 m', () => {
    const high = areaBufferRings(site, 20);
    const low = areaBufferRings(site, 50);
    expect(covered(high, [lat0 + dLat / 2, lng0 + dLng / 2])).toBe(true);
    expect(covered(high, east(15))).toBe(true);
    expect(covered(high, east(35))).toBe(false);
    expect(covered(low, east(35))).toBe(true);
    expect(covered(low, east(60))).toBe(false);
  });

  it('winds every ring counter-clockwise', () => {
    expect(areaBufferRings(site, 20).every((r) => signedArea(r) > 0)).toBe(true);
  });
});

describe('clipBelow and risingFill', () => {
  // A square from latitude 0 to 1 and longitude 0 to 1.
  const square: LatLng[] = [
    [0, 0],
    [0, 1],
    [1, 1],
    [1, 0],
  ];

  it('keeps the part of a ring south of the line', () => {
    const half = clipBelow(square, 0.5);
    expect(half).toHaveLength(4);
    expect(Math.max(...half.map((p) => p[0]))).toBe(0.5);
    expect(Math.min(...half.map((p) => p[0]))).toBe(0);
  });

  it('keeps all of a ring under the line and none of one above it', () => {
    expect(clipBelow(square, 2)).toEqual(square);
    expect(clipBelow(square, -1)).toEqual([]);
  });

  it('fills the shapes from the south up to the given share of their height', () => {
    const second: LatLng[] = square.map(([lat, lng]) => [lat + 1, lng]);
    expect(risingFill([square, second], 0)).toEqual([]);
    // Up to latitude 1: all of the first square, nothing of the second (a degenerate sliver is dropped or flat).
    const half = risingFill([square, second], 0.5);
    expect(Math.max(...half.flat().map((p) => p[0]))).toBe(1);
    expect(risingFill([square, second], 1)).toEqual([square, second]);
  });
});
