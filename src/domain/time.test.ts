import {
  adjacentSteps,
  formatTime,
  nearestStepIndex,
  NO_DATE,
  snap,
  STEPS,
  stepBefore,
  TODAY,
  YEARLY_FROM,
} from './time.ts';

describe('timeline steps', () => {
  it('moves by quarter until 3 years from today (2029Q4), then by full year, then "no date"', () => {
    expect(TODAY).toBe(2026.75);
    expect(YEARLY_FROM).toBe(2030);
    expect(STEPS[0]).toBe(2023.5);
    expect(STEPS).toContain(2029.75);
    expect(STEPS).not.toContain(2030.25);
    expect(STEPS.filter((t) => t >= 2030 && t < NO_DATE)).toEqual([
      2030, 2031, 2032, 2033, 2034, 2035, 2036, 2037,
    ]);
    expect(STEPS.at(-1)).toBe(NO_DATE);
  });

  it('is strictly increasing', () => {
    STEPS.slice(1).forEach((t, i) => {
      expect(t).toBeGreaterThan(STEPS[i] ?? Infinity);
    });
  });
});

describe('formatTime', () => {
  it.each([
    [2023.5, '2023Q3'],
    [2026.75, '2026Q4'],
    [2028, '2028Q1'],
    [2030, '2030'],
    [2034.5, '2035'],
    [NO_DATE, 'ללא מועד'],
  ])('%s -> %s', (t, s) => {
    expect(formatTime(t)).toBe(s);
  });
});

describe('snap', () => {
  it('rounds to quarters before 2030 and to full years after', () => {
    expect(snap(2026.7)).toBe(2026.75);
    expect(snap(2031.4)).toBe(2031);
    expect(snap(2029.9)).toBe(2030);
  });
});

describe('stepBefore', () => {
  it('returns the previous grid step', () => {
    expect(stepBefore(2028.25)).toBe(2028);
    expect(stepBefore(2030)).toBe(2029.75);
    expect(stepBefore(2034)).toBe(2033);
  });
});

describe('nearestStepIndex', () => {
  it('finds the closest step', () => {
    expect(STEPS[nearestStepIndex(2026.8)]).toBe(2026.75);
    expect(STEPS[nearestStepIndex(NO_DATE)]).toBe(NO_DATE);
  });
});

describe('adjacentSteps', () => {
  it('moves one quarter, then one year, and stops at the ends', () => {
    expect(adjacentSteps(TODAY)).toEqual({ prev: 2026.5, next: 2027 });
    expect(adjacentSteps(2029.75)).toEqual({ prev: 2029.5, next: 2030 });
    expect(adjacentSteps(2030)).toEqual({ prev: 2029.75, next: 2031 });
    expect(adjacentSteps(STEPS[0] ?? 0).prev).toBeUndefined();
    expect(adjacentSteps(NO_DATE)).toEqual({ prev: 2037, next: undefined });
  });
});
