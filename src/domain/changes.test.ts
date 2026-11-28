import { describe, expect, it } from 'vitest';
import type { Section, Site } from '../data/schema.ts';
import { boundsOf, changesBetween, changeText } from './changes.ts';

const section = (id: string, line: Section['line'], phases: Section['phases']): Section => ({
  id,
  name: id,
  line,
  paths: [
    [
      [32.06, 34.77],
      [32.07, 34.78],
    ],
  ],
  phases,
});

const allenby = section('allenby', 'purple', [
  { since: null, status: 'minor', note: '' },
  { since: 2024.5, status: 'major', note: '' },
  { since: 2028.25, status: 'open', note: '' },
]);
const ehud = section('yehud', 'purple', [
  { since: null, status: 'major', note: '' },
  { since: 2028.25, status: 'open', note: '' },
]);
const south = section('south', 'green', [
  { since: null, status: 'major', note: '' },
  { since: 2028.75, status: 'open', note: '' },
]);
const habima: Site = {
  id: 'habima',
  name: 'הבימה',
  line: 'M2',
  position: [32.072, 34.779],
  approximate: false,
  since: 2026.75,
  note: '',
};

describe('changesBetween', () => {
  it('groups the sections that changed by line and new status', () => {
    const changes = changesBetween([allenby, ehud, south], [], 2028, 2028.25);
    expect(changes).toEqual([
      expect.objectContaining({ line: 'purple', kind: 'open', names: ['allenby', 'yehud'] }),
    ]);
    expect(changes[0]?.points).toHaveLength(4);
  });

  it('lists preparatory sites that started, and nothing when nothing changed', () => {
    expect(changesBetween([allenby], [habima], 2026.5, 2026.75)).toEqual([
      expect.objectContaining({ line: 'M2', kind: 'site', names: ['הבימה'] }),
    ]);
    expect(changesBetween([allenby, south], [habima], 2025, 2025.25)).toEqual([]);
  });

  it('works backwards in time too', () => {
    expect(changesBetween([allenby], [], 2024.5, 2024.25)).toEqual([
      expect.objectContaining({ kind: 'minor', names: ['allenby'] }),
    ]);
  });

  it('puts openings before works', () => {
    const later = section('later', 'red', [
      { since: null, status: 'none', note: '' },
      { since: 2028.25, status: 'major', note: '' },
    ]);
    const changes = changesBetween([later, allenby], [], 2028, 2028.25);
    expect(changes.map((c) => [c.line, c.kind])).toEqual([
      ['purple', 'open'],
      ['red', 'major'],
    ]);
  });
});

describe('boundsOf', () => {
  it('spans the points', () => {
    expect(
      boundsOf([
        [32.06, 34.78],
        [32.07, 34.77],
      ]),
    ).toEqual({ south: 32.06, west: 34.77, north: 32.07, east: 34.78 });
  });
});

describe('changeText', () => {
  it('names a single section, and counts several', () => {
    const one = changesBetween([section('הסגול – אלנבי', 'purple', allenby.phases)], [], 2028, 2028.25)[0];
    expect(one && changeText(one)).toBe('הקו הסגול: אלנבי נפתח');
    const two = changesBetween([allenby, ehud], [], 2028, 2028.25)[0];
    expect(two && changeText(two)).toBe('הקו הסגול: 2 קטעים נפתחו');
  });
});
