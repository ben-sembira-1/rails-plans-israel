import { parsePlace, type SavedPlace } from './types.ts';

/**
 * Local development only: `?seed-place=<JSON>` starts the in-memory store with one saved place, so the regression
 * screenshots can show places without typing into Google's search (which spends the Autocomplete quota on every
 * keystroke). The JSON is a place without `id` and `createdAt`.
 */
export function seedPlaces(search: string): SavedPlace[] {
  const raw = new URLSearchParams(search).get('seed-place');
  if (raw === null) return [];
  try {
    const data: unknown = JSON.parse(raw);
    if (typeof data !== 'object' || data === null) return [];
    const place = parsePlace('seed-1', data as Record<string, unknown>, null);
    return place ? [place] : [];
  } catch {
    return [];
  }
}
