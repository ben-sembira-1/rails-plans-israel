import type { LatLng, Section, Site, WorksStatus } from '../data/schema.ts';
import { LINES, type LineId } from './lines.ts';
import { shortName } from './names.ts';
import { isSiteActive, statusAt } from './status.ts';

/** What happened to a group of a line's sections (or sites) between two times. */
export interface Change {
  readonly line: LineId;
  /** The sections' new status, or `site` for preparatory sites that started. */
  readonly kind: WorksStatus | 'site';
  readonly names: readonly string[];
  /** Every point of the changed sections or sites, to zoom the map to them. */
  readonly points: readonly LatLng[];
}

const ORDER: readonly Change['kind'][] = ['open', 'major', 'minor', 'site', 'none'];

/**
 * The sections whose status differs between `from` and `to`, grouped by line and by new status, plus the
 * preparatory sites that became active. Ordered by line, then openings first.
 */
export function changesBetween(
  sections: readonly Section[],
  sites: readonly Site[],
  from: number,
  to: number,
): readonly Change[] {
  const groups = new Map<string, { line: LineId; kind: Change['kind']; names: string[]; points: LatLng[] }>();
  const add = (line: LineId, kind: Change['kind'], name: string, points: readonly LatLng[]) => {
    const key = `${line}:${kind}`;
    const g = groups.get(key) ?? { line, kind, names: [], points: [] };
    g.names.push(name);
    g.points.push(...points);
    groups.set(key, g);
  };
  for (const s of sections) {
    const after = statusAt(s, to);
    if (statusAt(s, from) !== after) add(s.line, after, s.name, s.paths.flat());
  }
  for (const s of sites) {
    if (isSiteActive(s, to) && !isSiteActive(s, from)) add(s.line, 'site', s.name, [s.position]);
  }
  return [...groups.values()].sort((a, b) => ORDER.indexOf(a.kind) - ORDER.indexOf(b.kind));
}

/** The south-west and north-east corners around some points. */
export function boundsOf(points: readonly LatLng[]): {
  south: number;
  west: number;
  north: number;
  east: number;
} {
  let south = Infinity;
  let west = Infinity;
  let north = -Infinity;
  let east = -Infinity;
  for (const [lat, lng] of points) {
    south = Math.min(south, lat);
    north = Math.max(north, lat);
    west = Math.min(west, lng);
    east = Math.max(east, lng);
  }
  return { south, west, north, east };
}

/** "הקו הסגול: אלנבי והעלייה נפתח" or "הקו הסגול: 3 קטעים נפתחו". */
export function changeText(c: Change): string {
  const n = c.names.length;
  const one = n === 1 ? shortName(c.names[0] ?? '') : '';
  const text: Record<Change['kind'], string> = {
    open: n === 1 ? `${one} נפתח` : `${String(n)} קטעים נפתחו`,
    major: n === 1 ? `${one} בעבודות כבדות` : `${String(n)} קטעים בעבודות כבדות`,
    minor: n === 1 ? `${one} בעבודות קלות` : `${String(n)} קטעים בעבודות קלות`,
    site: n === 1 ? `${one}: אתר הכנה החל לעבוד` : `${String(n)} אתרי הכנה החלו לעבוד`,
    none: n === 1 ? `${one} עוד לא בעבודות` : `${String(n)} קטעים עוד לא בעבודות`,
  };
  return `${LINES[c.line].name}: ${text[c.kind]}`;
}
