import { describe, expect, it } from 'vitest';
import sample from '../construction/sample.json';
import { parseConstruction } from './construction.ts';

const valid = {
  fetchedAt: '2026-11-27T01:00:00.000Z',
  snapshot: 2026.75,
  sources: [{ city: 'tel-aviv', name: 'x', url: 'https://example.org/1', count: 1 }],
  projects: [
    {
      id: 'tlv-permit-1',
      city: 'tel-aviv',
      kind: 'building',
      title: 'בניה חדשה',
      address: 'דיזנגוף 1',
      position: [32.07, 34.77],
      shapes: [
        [
          [32.07, 34.77],
          [32.0701, 34.77],
          [32.0701, 34.7701],
        ],
      ],
      phases: [
        { since: 2025, status: 'permitted' },
        { since: 2026, status: 'construction' },
      ],
      until: 2029,
    },
  ],
};

function withProject(over: Record<string, unknown>): unknown {
  return { ...valid, projects: [{ ...valid.projects[0], ...over }] };
}

describe('parseConstruction', () => {
  it('accepts the development sample', () => {
    expect(parseConstruction(sample).projects.length).toBeGreaterThan(50);
  });

  it('accepts valid data', () => {
    expect(parseConstruction(valid).projects).toHaveLength(1);
  });

  it('rejects bad input, naming the path', () => {
    expect(() => parseConstruction(withProject({ kind: 'bridge' }))).toThrow(/projects\[0\]\.kind/);
    expect(() => parseConstruction(withProject({ until: 2025 }))).toThrow(/projects\[0\]\.until/);
    expect(() =>
      parseConstruction(
        withProject({
          phases: [
            { since: 2026, status: 'permitted' },
            { since: 2026, status: 'construction' },
          ],
        }),
      ),
    ).toThrow(/phases\[1\]\.since/);
    expect(() => parseConstruction(withProject({ position: [40, 34.77] }))).toThrow(/position/);
    expect(() => parseConstruction(withProject({ link: 'http://intranet/x' }))).toThrow(/link/);
    expect(() => parseConstruction({ ...valid, projects: [valid.projects[0], valid.projects[0]] })).toThrow(
      /unique/,
    );
  });
});
