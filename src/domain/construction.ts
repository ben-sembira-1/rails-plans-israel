import type { ConstructionData, Project, ProjectStatus } from '../data/construction.ts';
import { NO_DATE } from './time.ts';

/** The decimal year of the quarter that contains `date` (2026-05-12 -> 2026.25). */
export function quarterOf(date: Date): number {
  return date.getUTCFullYear() + Math.floor(date.getUTCMonth() / 3) / 4;
}

/** The quarter after the one that contains `date`: when something that ended on `date` stops showing. */
export function quarterAfter(date: Date): number {
  return quarterOf(date) + 0.25;
}

/**
 * A project's status at time `t`, or `undefined` when it isn't shown (not requested yet, or its works are over).
 * At the "no date" step only what still waits at the snapshot is shown: the upcoming projects.
 */
export function projectStatusAt(p: Project, t: number, snapshot: number): ProjectStatus | undefined {
  if (t >= NO_DATE) {
    const now = projectStatusAt(p, snapshot, snapshot);
    return now === 'requested' || now === 'permitted' ? now : undefined;
  }
  if (p.until !== null && t >= p.until) return undefined;
  let status: ProjectStatus | undefined;
  for (const ph of p.phases) {
    if (ph.since <= t) status = ph.status;
  }
  return status;
}

/** Toggles in the legend: building works, permits waiting to start, requests, road works. */
export const CONSTRUCTION_LAYERS = ['construction', 'permitted', 'requested', 'road'] as const;
export type ConstructionLayer = (typeof CONSTRUCTION_LAYERS)[number];

export const CONSTRUCTION_LAYER_LABEL: Readonly<Record<ConstructionLayer, string>> = {
  construction: 'בנייה פעילה',
  permitted: 'היתר בתוקף, טרם החלה בנייה',
  requested: 'בקשה להיתר בטיפול',
  road: 'עבודות כביש',
};

/** Requests are many and uncertain, so they start hidden. */
export const CONSTRUCTION_HIDDEN_BY_DEFAULT: readonly ConstructionLayer[] = ['requested'];

export function layerOf(p: Project, status: ProjectStatus): ConstructionLayer {
  return p.kind === 'road' ? 'road' : status;
}

export interface ShownProject {
  readonly project: Project;
  readonly status: ProjectStatus;
  readonly layer: ConstructionLayer;
}

export function projectsAt(data: ConstructionData, t: number): readonly ShownProject[] {
  return data.projects.flatMap((project) => {
    const status = projectStatusAt(project, t, data.snapshot);
    return status === undefined ? [] : [{ project, status, layer: layerOf(project, status) }];
  });
}

export function countsAt(shown: readonly ShownProject[]): Readonly<Record<ConstructionLayer, number>> {
  const counts: Record<ConstructionLayer, number> = { construction: 0, permitted: 0, requested: 0, road: 0 };
  for (const s of shown) counts[s.layer]++;
  return counts;
}

/**
 * How far a building site is through its works at time `t`, 0..1, by time: from the start of its construction
 * phase to its end (published, or estimated). Counted to the end of the quarter shown, so the last quarter of
 * works reads 100%. `undefined` when the project isn't a building under construction at `t`.
 */
export function buildProgressAt(p: Project, t: number): number | undefined {
  if (p.kind === 'road' || p.until === null || t >= p.until) return undefined;
  const start = p.phases.find((ph) => ph.status === 'construction')?.since;
  if (start === undefined || t < start || p.until <= start) return undefined;
  return Math.min(1, (t - start + 0.25) / (p.until - start));
}
