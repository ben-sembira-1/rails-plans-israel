import { parseOverpassRail } from './rail.ts';

describe('parseOverpassRail', () => {
  const way = {
    geometry: [
      { lat: 32, lon: 34.8 },
      { lat: 32.1, lon: 34.81 },
    ],
  };

  it('returns null for partial or malformed answers', () => {
    expect(parseOverpassRail(null)).toBeNull();
    expect(parseOverpassRail({ elements: [way] })).toBeNull();
  });

  it('converts ways to [lat, lng] paths', () => {
    const out = parseOverpassRail({ elements: Array.from({ length: 60 }, () => way) });
    expect(out?.length).toBe(60);
    expect(out?.[0]).toEqual([
      [32, 34.8],
      [32.1, 34.81],
    ]);
  });
});
