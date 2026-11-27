import type { LatLng } from '../data/schema.ts';

const QUERY = '[out:json][timeout:60];way["railway"="rail"][!"service"](31.86,34.70,32.24,35.00);out geom;';
const ENDPOINTS = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.private.coffee/api/interpreter',
  'https://maps.mail.ru/osm/tools/overpass/api/interpreter',
];
/** Fewer ways than this means a partial answer; keep the fallback layer. */
const MIN_WAYS = 50;

interface OverpassWay {
  geometry?: { lat: number; lon: number }[];
}

export function parseOverpassRail(json: unknown): readonly (readonly LatLng[])[] | null {
  if (typeof json !== 'object' || json === null || !('elements' in json) || !Array.isArray(json.elements)) {
    return null;
  }
  const ways = (json.elements as OverpassWay[])
    .map((e) => e.geometry?.map((g): LatLng => [g.lat, g.lon]) ?? [])
    .filter((p) => p.length >= 2);
  return ways.length >= MIN_WAYS ? ways : null;
}

/** Israel Railways tracks from OpenStreetMap, or `null` if no mirror answered in time. */
export async function loadLiveRail(signal: AbortSignal): Promise<readonly (readonly LatLng[])[] | null> {
  for (const url of ENDPOINTS) {
    if (signal.aborted) return null;
    try {
      const timeout = AbortSignal.timeout(25_000);
      const r = await fetch(url, {
        method: 'POST',
        body: `data=${encodeURIComponent(QUERY)}`,
        signal: AbortSignal.any([signal, timeout]),
      });
      if (!r.ok) continue;
      const ways = parseOverpassRail(await r.json());
      if (ways !== null) return ways;
    } catch {
      // Try the next mirror.
    }
  }
  return null;
}
