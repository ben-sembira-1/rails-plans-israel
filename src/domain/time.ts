/**
 * Time is a decimal year: 2026 = 2026Q1, 2026.25 = Q2, 2026.5 = Q3, 2026.75 = Q4.
 * The timeline moves by quarter until 3 years from today, then by full year (later dates are too uncertain).
 */

/** "No announced date": the final step, where the full network is shown. */
export const NO_DATE = 9999;
export const TIMELINE_START = 2023.5;
/** The data snapshot date (late November 2026). */
export const TODAY = 2026.75;
/** How far ahead of today the timeline still moves by quarter. */
export const QUARTERLY_YEARS = 3;
/** First year shown in full years only: the year after the last quarter (today + 3 years). */
export const YEARLY_FROM = Math.floor(TODAY + QUARTERLY_YEARS) + 1;
export const LAST_YEAR = 2037;

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

/** Rounds a time onto the timeline grid: quarters before `YEARLY_FROM`, full years from it. */
export function snap(t: number): number {
  if (t >= NO_DATE) return NO_DATE;
  if (t >= YEARLY_FROM - 0.125) return Math.max(YEARLY_FROM, Math.round(t));
  return round2(Math.round(t * 4) / 4);
}

/** `2026Q4` before `YEARLY_FROM`, `2031` from it, and "no date" for `NO_DATE`. */
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

/** The grid step just before `t` and just after it (the previous / next buttons); `undefined` at the ends. */
export function adjacentSteps(t: number): {
  readonly prev: number | undefined;
  readonly next: number | undefined;
} {
  const i = nearestStepIndex(t);
  return { prev: STEPS[i - 1], next: STEPS[i + 1] };
}

/** The time in a shared link (`?t=2028.25`), snapped onto the grid; `null` when missing or invalid. */
export function timeFromSearch(search: string): number | null {
  const raw = new URLSearchParams(search).get('t');
  if (raw === null || raw.trim() === '') return null;
  const t = Number(raw);
  if (!Number.isFinite(t) || t < TIMELINE_START) return null;
  return STEPS[nearestStepIndex(snap(t))] ?? null;
}

/** `href` with its `t` parameter set to `t`, keeping every other part of the address. */
export function withTime(href: string, t: number): string {
  const url = new URL(href);
  url.searchParams.set('t', String(t));
  return url.toString();
}
