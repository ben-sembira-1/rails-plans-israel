import type { DateSpec } from '../data/schema.ts'

const DAY_MS = 24 * 60 * 60 * 1000

/** Which end of the period a DateSpec covers should be used. */
export type Bound = 'start' | 'end'

/**
 * Converts a DateSpec to a UTC timestamp (ms). For `end`, returns the last
 * millisecond of the period, so `2027` as an end covers the whole year.
 */
export function dateSpecToTime(spec: DateSpec, bound: Bound): number {
  const [yearPart = '', second, dayPart] = spec.split('-')
  const year = Number(yearPart)
  let startMonth = 0
  let monthSpan = 12
  let day: number | undefined

  if (second?.startsWith('Q') === true) {
    startMonth = (Number(second.slice(1)) - 1) * 3
    monthSpan = 3
  } else if (second !== undefined) {
    startMonth = Number(second) - 1
    monthSpan = 1
    if (dayPart !== undefined) {
      day = Number(dayPart)
    }
  }

  if (day !== undefined) {
    const start = Date.UTC(year, startMonth, day)
    return bound === 'start' ? start : start + DAY_MS - 1
  }
  return bound === 'start'
    ? Date.UTC(year, startMonth, 1)
    : Date.UTC(year, startMonth + monthSpan, 1) - 1
}

/** Formats a DateSpec for display keeping its original precision. */
export function formatDateSpec(spec: DateSpec): string {
  const parts = spec.split('-')
  const [year = '', second, day] = parts
  if (second === undefined) {
    return year
  }
  if (second.startsWith('Q')) {
    return `${second} ${year}`
  }
  const month = new Date(Date.UTC(Number(year), Number(second) - 1, 1)).toLocaleString('en-GB', {
    month: 'short',
    timeZone: 'UTC',
  })
  return day === undefined ? `${month} ${year}` : `${String(Number(day))} ${month} ${year}`
}

/** Formats a timestamp as YYYY-MM-DD (UTC). */
export function toIsoDate(time: number): string {
  return new Date(time).toISOString().slice(0, 10)
}
