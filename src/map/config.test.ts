import { describe, expect, it } from 'vitest';
import { DEMO_MAP_ID, mapsConfig } from './config.ts';

describe('mapsConfig', () => {
  it('is null without an API key', () => {
    expect(mapsConfig({})).toBeNull();
    expect(mapsConfig({ VITE_GOOGLE_MAPS_API_KEY: '  ', VITE_GOOGLE_MAP_ID: 'abc' })).toBeNull();
  });

  it('falls back to the demo map ID', () => {
    expect(mapsConfig({ VITE_GOOGLE_MAPS_API_KEY: 'k' })).toEqual({ apiKey: 'k', mapId: DEMO_MAP_ID });
    expect(mapsConfig({ VITE_GOOGLE_MAPS_API_KEY: 'k', VITE_GOOGLE_MAP_ID: ' m ' })).toEqual({
      apiKey: 'k',
      mapId: 'm',
    });
  });
});
