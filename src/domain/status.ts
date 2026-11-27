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
