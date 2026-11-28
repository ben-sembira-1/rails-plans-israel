import type { Section, Site } from '../data/schema.ts';
import { isSiteActive, lineStatusAt, pathLength, phaseAt, phaseRange, statusAt, worksAt } from './status.ts';

const allenby: Section = {
  id: 'allenby',
  name: 'אלנבי',
  line: 'purple',
  paths: [
    [
      [32.06, 34.77],
      [32.07, 34.78],
    ],
  ],
  phases: [
    { since: null, status: 'minor', note: 'a' },
    { since: 2024.5, status: 'major', note: 'b' },
    { since: 2028.25, status: 'open', note: 'c' },
  ],
};

const site: Site = {
  id: 'habima',
  name: 'הבימה',
  line: 'M2',
  position: [32.07, 34.78],
  approximate: false,
  since: 2026.75,
  note: 'n',
};

describe('phaseAt / statusAt', () => {
  it('uses the first phase before any dated phase', () => {
    expect(statusAt(allenby, 2023.5)).toBe('minor');
  });
  it('switches exactly at the phase start', () => {
    expect(statusAt(allenby, 2024.25)).toBe('minor');
    expect(statusAt(allenby, 2024.5)).toBe('major');
    expect(phaseAt(allenby, 2028.25).note).toBe('c');
    expect(statusAt(allenby, 9999)).toBe('open');
  });
});

describe('phaseRange', () => {
  it('prints open-start, closed and open-ended ranges', () => {
    expect(phaseRange(allenby.phases, 0)).toBe('עד 2024Q2');
    expect(phaseRange(allenby.phases, 1)).toBe('2024Q3–2028Q1');
    expect(phaseRange(allenby.phases, 2)).toBe('2028Q2 ואילך');
  });
});

describe('sites', () => {
  it('are active from their start until the line-wide heavy works', () => {
    expect(isSiteActive(site, 2026.5)).toBe(false);
    expect(isSiteActive(site, 2026.75)).toBe(true);
    expect(isSiteActive(site, 2028.75)).toBe(true);
    expect(isSiteActive(site, 2029)).toBe(false);
  });
});

describe('worksAt', () => {
  it('lists sections and active sites by works intensity', () => {
    expect(worksAt([allenby], [site], 2027)).toEqual({ major: ['אלנבי'], minor: ['אתר הבימה'] });
    expect(worksAt([allenby], [site], 2030)).toEqual({ major: [], minor: [] });
  });
});

describe('lineStatusAt', () => {
  const open: Section = {
    ...allenby,
    id: 'open',
    name: 'פתוח',
    phases: [{ since: null, status: 'open', note: '' }],
  };

  it('headlines the worst works status and lists the names', () => {
    const s = lineStatusAt([allenby, open], [], 'purple', 2025);
    expect(s.state).toBe('major');
    expect(s.major).toEqual(['אלנבי']);
    expect(s.share.major).toBeCloseTo(0.5, 5);
    expect(s.share.open).toBeCloseTo(0.5, 5);
  });

  it('says "open" when nothing is under works, and "planned" before anything', () => {
    expect(lineStatusAt([allenby], [], 'purple', 2029).state).toBe('open');
    expect(lineStatusAt([allenby], [], 'red', 2029).state).toBe('planned');
  });

  it('counts active preparatory sites as light works of the line', () => {
    const s = lineStatusAt([], [site], 'M2', 2027);
    expect(s.state).toBe('prep');
    expect(s.minor).toEqual(['אתר הבימה']);
    expect(lineStatusAt([], [site], 'M2', 2029).state).toBe('planned');
  });
});

describe('pathLength', () => {
  it('measures about 1.1 km for 0.01° of latitude', () => {
    expect(
      pathLength([
        [32.06, 34.77],
        [32.07, 34.77],
      ]),
    ).toBeCloseTo(1105.74, 1);
  });
});
