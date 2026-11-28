import { describe, expect, it } from 'vitest';
import { formatCount, formatDate } from './format.ts';

describe('format', () => {
  it('formats dates as day/month/year', () => {
    expect(formatDate('2026-11-27')).toBe('27/11/2026');
    expect(formatDate('2026-03-05T10:00:00')).toBe('05/03/2026');
  });
  it('groups digits', () => {
    expect(formatCount(1234)).toMatch(/1.234/);
  });
});
