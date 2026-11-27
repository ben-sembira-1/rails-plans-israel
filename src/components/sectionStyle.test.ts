import { describe, expect, it } from 'vitest';
import { WORKS_STATUSES } from '../data/schema.ts';
import { sectionLineStyle, sectionPane } from './sectionStyle.ts';

describe('sectionLineStyle', () => {
  it('sets dashArray for every status, so setStyle clears an old dash', () => {
    for (const status of WORKS_STATUSES) {
      expect(Object.keys(sectionLineStyle(status, 6))).toContain('dashArray');
    }
  });

  it('draws open lines solid and the rest dashed', () => {
    expect(sectionLineStyle('open', 6).dashArray).toBeUndefined();
    expect(sectionLineStyle('none', 6).dashArray).toBe('2 9');
    expect(sectionLineStyle('minor', 6).dashArray).toBe('10 7');
    expect(sectionLineStyle('major', 6).dashArray).toBe('10 7');
  });

  it('puts planned lines in their own pane', () => {
    expect(sectionPane('none')).toBe('future');
    expect(sectionPane('open')).toBe('lines');
  });
});
