import { describe, expect, it } from 'vitest';
import type { LatLng } from '../data/validate.ts';
import { CELL_PX, clusterByGrid, worldPx } from './cluster.ts';

const at = (p: LatLng) => p;

describe('worldPx', () => {
  it('puts (0, 0) in the middle of the world and doubles with each zoom', () => {
    expect(worldPx([0, 0], 0)).toEqual({ x: 128, y: 128 });
    const z12 = worldPx([32.07, 34.78], 12);
    const z13 = worldPx([32.07, 34.78], 13);
    expect(z13.x).toBeCloseTo(z12.x * 2, 6);
    expect(z13.y).toBeCloseTo(z12.y * 2, 6);
  });

  it('grows y southwards', () => {
    expect(worldPx([32.0, 34.78], 12).y).toBeGreaterThan(worldPx([32.1, 34.78], 12).y);
  });
});

describe('clusterByGrid', () => {
  // Allenby and Rothschild (about 300 m apart) and Ramat Gan (about 5 km away).
  const allenby: LatLng = [32.0665, 34.7725];
  const rothschild: LatLng = [32.0638, 34.7745];
  const ramatGan: LatLng = [32.0823, 34.8131];
  const points = [allenby, rothschild, ramatGan];

  it('keeps every item exactly once', () => {
    for (const zoom of [10, 12, 14, 16]) {
      const clusters = clusterByGrid(points, at, zoom);
      expect(clusters.flatMap((c) => c.members)).toHaveLength(points.length);
    }
  });

  it('counts close points together when zoomed out and apart when zoomed in', () => {
    // At zoom 11 a 72 px cell is about 3.5 km wide.
    const out = clusterByGrid(points, at, 11);
    expect(out.map((c) => c.members.length).sort()).toEqual([1, 2]);
    // At zoom 18 a cell is about 30 m.
    expect(clusterByGrid(points, at, 18)).toHaveLength(3);
  });

  it('places a cluster at its mean position, inside its bounds', () => {
    const [c] = clusterByGrid([allenby, rothschild], at, 10);
    expect(c?.position[0]).toBeCloseTo((allenby[0] + rothschild[0]) / 2, 9);
    expect(c?.position[1]).toBeCloseTo((allenby[1] + rothschild[1]) / 2, 9);
    expect(c?.bounds).toEqual([
      [rothschild[0], allenby[1]],
      [allenby[0], rothschild[1]],
    ]);
  });

  it("doesn't depend on the other items or their order (the grid is fixed to the world)", () => {
    const a = clusterByGrid([allenby], at, 13)[0]?.key;
    const b = clusterByGrid([ramatGan, rothschild, allenby], at, 13).find((c) =>
      c.members.includes(allenby),
    )?.key;
    expect(b).toBe(a);
  });

  it('uses smaller cells when asked', () => {
    const big = clusterByGrid(points, at, 14, CELL_PX);
    const small = clusterByGrid(points, at, 14, 8);
    expect(small.length).toBeGreaterThanOrEqual(big.length);
  });

  it('returns nothing for no items', () => {
    expect(clusterByGrid([], at, 12)).toEqual([]);
  });
});
