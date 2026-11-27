import { describe, expect, it } from 'vitest';
import { WORKS_STATUSES } from '../data/schema.ts';
import { sectionLineStyle, sectionZ, Z } from './sectionStyle.ts';

describe('sectionLineStyle', () => {
  it('sets icons for every status, so setOptions clears an old dash', () => {
    for (const status of WORKS_STATUSES) {
      expect(Array.isArray(sectionLineStyle(status, 6, '#8E2D9E').icons)).toBe(true);
    }
  });

  it('draws open lines solid and the rest with symbols over a hidden stroke', () => {
    expect(sectionLineStyle('open', 6, '#8E2D9E')).toMatchObject({ strokeOpacity: 1, icons: [] });
    for (const status of ['none', 'minor', 'major'] as const) {
      const style = sectionLineStyle(status, 6, '#8E2D9E');
      expect(style.strokeOpacity).toBe(0);
      expect(style.icons).toHaveLength(1);
    }
  });

  it('colors planned dots with the line color', () => {
    expect(sectionLineStyle('none', 6, '#8E2D9E').icons[0]?.icon.fillColor).toBe('#8E2D9E');
  });

  it('draws planned lines under the others', () => {
    expect(sectionZ('none').line).toBeLessThan(sectionZ('open').casing);
    expect(sectionZ('major')).toEqual({ casing: Z.casing, line: Z.line });
  });
});
