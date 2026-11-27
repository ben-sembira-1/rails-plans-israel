import { describe, expect, it } from 'vitest';
import type { LatLng } from '../data/schema.ts';
import { bufferRings } from './geo.ts';

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
