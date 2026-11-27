export interface MapsEnv {
  readonly VITE_GOOGLE_MAPS_API_KEY?: string;
  readonly VITE_GOOGLE_MAP_ID?: string;
}

export interface MapsConfig {
  readonly apiKey: string;
  /** Needed for advanced markers. */
  readonly mapId: string;
}

/**
 * Google's demo map ID: enough for advanced markers, but meant for development. Production should set its own map
 * ID (Google Cloud console -> Map Management).
 */
export const DEMO_MAP_ID = 'DEMO_MAP_ID';

/** The Google Maps config from the build environment, or `null` without an API key. */
export function mapsConfig(env: MapsEnv = import.meta.env): MapsConfig | null {
  const apiKey = env.VITE_GOOGLE_MAPS_API_KEY?.trim() ?? '';
  if (apiKey === '') return null;
  const mapId = env.VITE_GOOGLE_MAP_ID?.trim() ?? '';
  return { apiKey, mapId: mapId === '' ? DEMO_MAP_ID : mapId };
}
