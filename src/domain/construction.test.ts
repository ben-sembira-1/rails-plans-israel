import { describe, expect, it } from 'vitest';
import type { ConstructionData, Project } from '../data/construction.ts';
import {
  buildProgressAt,
  countsAt,
  layerOf,
  projectsAt,
  projectStatusAt,
  quarterAfter,
  quarterOf,
} from './construction.ts';
import { NO_DATE } from './time.ts';

const SNAPSHOT = 2026.75;

function project(over: Partial<Project>): Project {
  return {
    id: 'p',
    city: 'tel-aviv',
    kind: 'building',
    title: 'בניה חדשה',
    address: 'דיזנגוף 1',
    position: [32.07, 34.77],
    shapes: [],
    phases: [
      { since: 2024, status: 'requested' },
      { since: 2025, status: 'permitted' },
      { since: 2026, status: 'construction' },
    ],
    until: 2028.5,
    ...over,
  };
}

describe('quarters', () => {
  it('maps a date to the start of its quarter, and to the next quarter', () => {
    expect(quarterOf(new Date('2026-05-12T00:00:00Z'))).toBe(2026.25);
    expect(quarterOf(new Date('2026-12-31T00:00:00Z'))).toBe(2026.75);
    expect(quarterAfter(new Date('2026-12-31T00:00:00Z'))).toBe(2027);
  });
});

describe('projectStatusAt', () => {
  const p = project({});

  it('is hidden before the request and after the works', () => {
    expect(projectStatusAt(p, 2023.75, SNAPSHOT)).toBeUndefined();
    expect(projectStatusAt(p, 2028.5, SNAPSHOT)).toBeUndefined();
  });

  it('follows the phases', () => {
    expect(projectStatusAt(p, 2024.25, SNAPSHOT)).toBe('requested');
    expect(projectStatusAt(p, 2025, SNAPSHOT)).toBe('permitted');
    expect(projectStatusAt(p, 2028.25, SNAPSHOT)).toBe('construction');
  });

  it('shows only what still waits at the snapshot on the "no date" step', () => {
    expect(projectStatusAt(p, NO_DATE, SNAPSHOT)).toBeUndefined();
    const waiting = project({ phases: [{ since: 2026, status: 'permitted' }], until: null });
    expect(projectStatusAt(waiting, NO_DATE, SNAPSHOT)).toBe('permitted');
  });
});

describe('projectsAt and countsAt', () => {
  it('sorts road works into their own layer', () => {
    const road = project({ id: 'r', kind: 'road', phases: [{ since: 2026, status: 'construction' }] });
    expect(layerOf(road, 'construction')).toBe('road');
    const data: ConstructionData = {
      fetchedAt: '2026-11-27T00:00:00Z',
      snapshot: SNAPSHOT,
      sources: [],
      projects: [project({}), road],
    };
    expect(countsAt(projectsAt(data, 2026.75))).toEqual({
      construction: 1,
      permitted: 0,
      requested: 0,
      road: 1,
    });
  });
});

describe('buildProgressAt', () => {
  // Construction from 2026 to 2028.5: ten quarters.
  const p = project({});

  it('counts the quarters of works done, to the end of the quarter shown', () => {
    expect(buildProgressAt(p, 2026)).toBeCloseTo(0.1, 9);
    expect(buildProgressAt(p, 2027.25)).toBeCloseTo(0.6, 9);
    expect(buildProgressAt(p, 2028.25)).toBeCloseTo(1, 9);
  });

  it('is undefined before the works start, once they end, and for permits, requests and roads', () => {
    expect(buildProgressAt(p, 2025.75)).toBeUndefined();
    expect(buildProgressAt(p, 2028.5)).toBeUndefined();
    expect(buildProgressAt(project({ until: null }), 2027)).toBeUndefined();
    expect(
      buildProgressAt(project({ phases: [{ since: 2025, status: 'permitted' }] }), 2027),
    ).toBeUndefined();
    expect(buildProgressAt(project({ kind: 'road' }), 2027)).toBeUndefined();
  });
});
