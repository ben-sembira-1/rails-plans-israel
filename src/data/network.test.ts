import raw from './network.json';
import { NETWORK } from './network.ts';
import { parseNetwork } from './schema.ts';
import { LINE_IDS } from '../domain/lines.ts';
import { statusAt } from '../domain/status.ts';
import { NO_DATE } from '../domain/time.ts';

describe('network.json', () => {
  it('passes the schema', () => {
    expect(() => parseNetwork(raw)).not.toThrow();
  });

  it('has sections and stations for every line', () => {
    for (const id of LINE_IDS) {
      expect(NETWORK.sections.some((s) => s.line === id)).toBe(true);
      expect(NETWORK.stations.some((s) => s.line === id)).toBe(true);
    }
  });

  it('shows the full network as open on the final "no date" step', () => {
    for (const s of NETWORK.sections) expect(statusAt(s, NO_DATE)).toBe('open');
  });

  it('only the red line is in service today (2026Q4)', () => {
    const open = NETWORK.sections.filter((s) => statusAt(s, 2026.75) === 'open').map((s) => s.line);
    expect(new Set(open)).toEqual(new Set(['red']));
  });

  it('does not mark the metro lines as works before 2029', () => {
    const metro = NETWORK.sections.filter((s) => s.line.startsWith('M'));
    for (const s of metro) expect(statusAt(s, 2028.75)).toBe('none');
  });
});

describe('parseNetwork', () => {
  it('rejects bad data with the offending path', () => {
    const bad = structuredClone(raw) as { stations: { line: string }[] };
    const first = bad.stations[0];
    if (first) first.line = 'blue';
    expect(() => parseNetwork(bad)).toThrow(/stations\[0\]\.line/);
  });

  it('rejects phases out of order', () => {
    const bad = structuredClone(raw) as { sections: { phases: { since: number | null }[] }[] };
    const phases = bad.sections[3]?.phases; // Allenby: null, 2024.5, 2028.25
    if (phases?.[2]) phases[2].since = 2020;
    expect(() => parseNetwork(bad)).toThrow(/sections\[3\]\.phases\[2\]\.since/);
  });
});
