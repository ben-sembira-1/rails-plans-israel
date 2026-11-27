import { describe, expect, it } from 'vitest';
import { seedPlaces } from './devSeed.ts';

const place = { googlePlaceId: 'g1', name: 'Café', address: 'Dizengoff 1', lat: 32.08, lng: 34.77 };

describe('seedPlaces', () => {
  it('reads one place from ?seed-place', () => {
    const search = `?seed-place=${encodeURIComponent(JSON.stringify(place))}`;
    expect(seedPlaces(search)).toEqual([{ id: 'seed-1', ...place, createdAt: null }]);
  });

  it('ignores a missing, malformed or invalid parameter', () => {
    expect(seedPlaces('')).toEqual([]);
    expect(seedPlaces('?seed-place=%7Bnot-json')).toEqual([]);
    expect(seedPlaces(`?seed-place=${encodeURIComponent(JSON.stringify({ ...place, lat: 'x' }))}`)).toEqual(
      [],
    );
    expect(seedPlaces('?seed-place=null')).toEqual([]);
  });
});
