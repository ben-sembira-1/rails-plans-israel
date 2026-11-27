/**
 * Time is a decimal year: 2026 = 2026Q1, 2026.25 = Q2, 2026.5 = Q3, 2026.75 = Q4.
 * Before 2030 the timeline moves by quarter; from 2030 by full year (later dates are too uncertain).
 */

/** "No announced date": the final step, where the full network is shown. */
export const NO_DATE = 9999;
export const TIMELINE_START = 2023.5;
/** First year shown in full years only. */
export const YEARLY_FROM = 2030;
export const LAST_YEAR = 2037;
/** The data snapshot date (late November 2026). */
export const TODAY = 2026.75;

function round2(x: number): number {
  return Math.round(x * 100) / 100;
}

export function timelineSteps(): readonly number[] {
  const steps: number[] = [];
  for (let t = TIMELINE_START; t < YEARLY_FROM; t = round2(t + 0.25)) steps.push(t);
  for (let y = YEARLY_FROM; y <= LAST_YEAR; y++) steps.push(y);
  steps.push(NO_DATE);
  return steps;
}

export const STEPS: readonly number[] = timelineSteps();

/** Rounds a time onto the timeline grid: quarters before 2030, full years from 2030. */
export function snap(t: number): number {
  if (t >= NO_DATE) return NO_DATE;
  if (t >= YEARLY_FROM - 0.125) return Math.max(YEARLY_FROM, Math.round(t));
  return round2(Math.round(t * 4) / 4);
}

/** `2026Q4` before 2030, `2031` from 2030, and "no date" for `NO_DATE`. */
export function formatTime(t: number): string {
  if (t >= NO_DATE) return 'ללא מועד';
  const s = snap(t);
  if (s >= YEARLY_FROM) return String(s);
  const year = Math.floor(s);
  const quarter = Math.round((s - year) * 4) + 1;
  return `${year}Q${quarter}`;
}

/** The last grid step strictly before `t` (used to print "until" ends of ranges). */
export function stepBefore(t: number): number {
  const s = snap(t);
  const i = STEPS.indexOf(s);
  if (i > 0) return STEPS[i - 1] ?? s;
  return s >= YEARLY_FROM ? s - 1 : round2(s - 0.25);
}

/** The step index nearest to `t` (for the slider). */
export function nearestStepIndex(t: number): number {
  let best = 0;
  STEPS.forEach((s, i) => {
    const b = STEPS[best] ?? 0;
    if (Math.abs(s - t) < Math.abs(b - t)) best = i;
  });
  return best;
}
