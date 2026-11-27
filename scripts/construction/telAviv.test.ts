import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { parseConstruction } from '../../src/data/construction.ts';
import type { Feature } from './arcgis.ts';
import { sanityProblems } from './fetch.ts';
import { buildTelAviv, latestDmy, requestTitle } from './sources/telAviv.ts';

function fixture(name: string): Feature[] {
  const raw = JSON.parse(readFileSync(join(import.meta.dirname, `fixtures/${name}.json`), 'utf8')) as {
    features: Feature[];
  };
  return raw.features;
}

// Real rows recorded from the city's server on 2026-11-27.
const raw = { permits: fixture('permits'), sites: fixture('sites'), roads: fixture('roads') };
const NOW = new Date('2026-11-27T12:00:00Z');
const SNAPSHOT = 2026.75;
const projects = buildTelAviv(raw, SNAPSHOT, NOW);
const byId = (id: string) => {
  const p = projects.find((x) => x.id === id);
  if (!p) throw new Error(`${id} missing`);
  return p;
};

describe('buildTelAviv', () => {
  it('produces valid data', () => {
    expect(() =>
      parseConstruction({ fetchedAt: NOW.toISOString(), snapshot: SNAPSHOT, sources: [], projects }),
    ).not.toThrow();
  });

  it('joins a construction site to its permit and takes the start and stage from the site', () => {
    const p = byId('tlv-permit-20230524');
    expect(p.stage).toBe('תחילת עבודות');
    expect(p.phases.map((ph) => ph.status)).toEqual(['requested', 'permitted', 'construction']);
    expect(p.phases.at(-1)?.since).toBe(2025.25); // works approved May 2025
    expect(p.untilEstimated).toBe(true);
    expect(p.until).toBe(2028.25); // a new building: about three years
  });

  it('merges a request listed in several rows into one project', () => {
    expect(projects.filter((p) => p.id === 'tlv-permit-20230524')).toHaveLength(1);
  });

  it('ends a finished project in the quarter after its completion certificate', () => {
    const p = byId('tlv-permit-20230012');
    expect(p.phases.at(-1)).toEqual({ since: 2023.75, status: 'construction' });
    expect(p.until).toBe(2027);
    expect(p.untilEstimated).toBeUndefined();
  });

  it('keeps a valid permit that has not started as permitted', () => {
    const p = byId('tlv-permit-20230013');
    expect(p.phases.at(-1)?.status).toBe('permitted');
    expect(p.tama38).toBe(true);
  });

  it('keeps a request in process as requested, with no end', () => {
    const p = byId('tlv-permit-20230011');
    expect(p.phases.map((ph) => ph.status)).toEqual(['requested']);
    expect(p.until).toBeNull();
  });

  it('leaves out changes that make no construction noise', () => {
    expect(projects.find((p) => p.id === 'tlv-permit-20170503')).toBeUndefined();
  });

  it('maps road works with their dates', () => {
    const roads = projects.filter((p) => p.kind === 'road');
    expect(roads).toHaveLength(3);
    const short = roads.find((p) => p.address.includes('') && p.phases[0]?.since === 2026.75);
    expect(short?.until).toBe(2027);
    for (const r of roads) expect(r.shapes[0]?.length).toBeGreaterThanOrEqual(2);
  });

  it('puts every building inside central Israel with an outline', () => {
    for (const p of projects.filter((x) => x.kind === 'building')) {
      expect(p.shapes.length).toBeGreaterThan(0);
      expect(p.position[0]).toBeGreaterThan(32);
      expect(p.position[0]).toBeLessThan(32.15);
    }
  });
});

describe('field readers', () => {
  it('reads the latest of several dd/mm/yyyy dates', () => {
    expect(latestDmy('10/08/2025, 01/02/2026')?.toISOString()).toBe('2026-02-01T00:00:00.000Z');
    expect(latestDmy('')).toBeNull();
  });

  it('shortens request types', () => {
    expect(requestTitle("בניה חדשה/בניין דירה/קוטג' ,תוספות בניה/הריסה")).toBe(
      "בניה חדשה – בניין דירה/קוטג' · תוספות בניה – הריסה",
    );
  });
});

describe('sanityProblems', () => {
  const src = (count: number) => [{ city: 'tel-aviv', name: 'x', url: 'https://x/1', count }];
  it('fails on an empty source or a big drop', () => {
    expect(sanityProblems(src(0), null)).toHaveLength(1);
    expect(sanityProblems(src(400), src(1000))).toHaveLength(1);
    expect(sanityProblems(src(900), src(1000))).toEqual([]);
  });
});
