import type { Phase, Section, Site, WorksStatus } from '../data/schema.ts';
import { formatTime, stepBefore } from './time.ts';

/** Metro preparatory sites are shown until the line-wide heavy works start and absorb them. */
export const METRO_HEAVY_WORKS_FROM = 2029;

export const STATUS_LABEL: Readonly<Record<WorksStatus, string>> = {
  open: 'פועל',
  major: 'עבודות כבדות',
  minor: 'עבודות קלות',
  none: 'בתכנון, ללא עבודות',
};

/** The phase a section is in at time `t`. Before its first dated phase, the first phase applies. */
export function phaseAt(section: Section, t: number): Phase {
  const [first, ...rest] = section.phases;
  if (first === undefined) throw new Error(`section ${section.id} has no phases`);
  let current = first;
  for (const p of rest) if (p.since !== null && p.since <= t) current = p;
  return current;
}

export function statusAt(section: Section, t: number): WorksStatus {
  return phaseAt(section, t).status;
}

export function isSiteActive(site: Site, t: number): boolean {
  return t >= site.since && t < METRO_HEAVY_WORKS_FROM;
}

/** Human-readable date range of phase `i`, e.g. `2024Q3–2028Q1`, `עד 2028Q1`, `2028Q2 ואילך`. */
export function phaseRange(phases: readonly Phase[], i: number): string {
  const p = phases[i];
  if (p === undefined) return '';
  const next = phases[i + 1];
  const nextSince = next?.since ?? null;
  const end = nextSince === null ? null : formatTime(stepBefore(nextSince));
  if (p.since === null) return end === null ? 'כעת' : `עד ${end}`;
  const start = formatTime(p.since);
  if (end === null) return `${start} ואילך`;
  return start === end ? start : `${start}–${end}`;
}

export interface WorksSummary {
  readonly major: readonly string[];
  readonly minor: readonly string[];
}

/** Names of the sections (and active sites) under heavy and light works at `t`. */
export function worksAt(sections: readonly Section[], sites: readonly Site[], t: number): WorksSummary {
  return {
    major: sections.filter((s) => statusAt(s, t) === 'major').map((s) => s.name),
    minor: [
      ...sections.filter((s) => statusAt(s, t) === 'minor').map((s) => s.name),
      ...sites.filter((s) => isSiteActive(s, t)).map((s) => `אתר ${s.name}`),
    ],
  };
}

/** A line's headline state at a time: its worst works status, else whether it runs. */
export type LineState = 'major' | 'minor' | 'prep' | 'open' | 'planned';

export const LINE_STATE_LABEL: Readonly<Record<LineState, string>> = {
  major: 'עבודות כבדות',
  minor: 'עבודות קלות',
  prep: 'אתרי הכנה',
  open: 'פועל',
  planned: 'בתכנון',
};

export interface LineStatus {
  readonly state: LineState;
  /** Share of the line's length in each status, 0..1 (sums to 1 when the line has sections). */
  readonly share: Readonly<Record<WorksStatus, number>>;
  /** Sections under heavy works, and sections under light works plus active preparatory sites. */
  readonly major: readonly string[];
  readonly minor: readonly string[];
}

/** Approximate length of a path in meters (fine at Gush Dan's scale). */
export function pathLength(path: readonly (readonly [number, number])[]): number {
  let m = 0;
  for (let i = 1; i < path.length; i++) {
    const a = path[i - 1];
    const b = path[i];
    if (!a || !b) continue;
    const dy = (b[0] - a[0]) * 110_574;
    const dx = (b[1] - a[1]) * 111_320 * Math.cos((((a[0] + b[0]) / 2) * Math.PI) / 180);
    m += Math.hypot(dx, dy);
  }
  return m;
}

/** One line's status at `t`, for the status rows of the side panel. */
export function lineStatusAt(
  sections: readonly Section[],
  sites: readonly Site[],
  line: Section['line'],
  t: number,
): LineStatus {
  const own = sections.filter((s) => s.line === line);
  const length: Record<WorksStatus, number> = { open: 0, major: 0, minor: 0, none: 0 };
  const major: string[] = [];
  const minor: string[] = [];
  for (const s of own) {
    const status = statusAt(s, t);
    length[status] += s.paths.reduce((sum, p) => sum + pathLength(p), 0);
    if (status === 'major') major.push(s.name);
    if (status === 'minor') minor.push(s.name);
  }
  const activeSites = sites.filter((s) => s.line === line && isSiteActive(s, t));
  minor.push(...activeSites.map((s) => `אתר ${s.name}`));
  const total = length.open + length.major + length.minor + length.none;
  const share = (x: number) => (total === 0 ? 0 : x / total);
  let state: LineState = 'planned';
  if (major.length > 0) state = 'major';
  else if (own.some((s) => statusAt(s, t) === 'minor')) state = 'minor';
  else if (activeSites.length > 0) state = 'prep';
  else if (length.open > 0) state = 'open';
  return {
    state,
    share: {
      open: share(length.open),
      major: share(length.major),
      minor: share(length.minor),
      none: share(length.none),
    },
    major,
    minor,
  };
}
