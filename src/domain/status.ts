import type { Line, Phase, Segment, WorkArea } from '../data/schema.ts'

import { dateSpecToTime } from './dates.ts'

export type SegmentStatus = 'planned' | 'construction' | 'operational'

function phaseStarted(phase: Phase, time: number): boolean {
  return dateSpecToTime(phase.start, 'start') <= time
}

/**
 * Status of a segment at a moment in time:
 * - `operational` once any operational phase has started;
 * - `construction` once any construction phase has started (and it is not yet operational);
 * - otherwise `planned` (shown in the "disabled" style on the map).
 */
export function segmentStatusAt(segment: Segment, time: number): SegmentStatus {
  if (segment.phases.some((p) => p.kind === 'operational' && phaseStarted(p, time))) {
    return 'operational'
  }
  if (segment.phases.some((p) => p.kind === 'construction' && phaseStarted(p, time))) {
    return 'construction'
  }
  return 'planned'
}

/** Work areas that are closed for construction at the given time. */
export function activeWorkAreas(segment: Segment, time: number): WorkArea[] {
  return segment.workAreas.filter((area) => {
    const start = dateSpecToTime(area.start, 'start')
    const end = area.end === undefined ? Number.POSITIVE_INFINITY : dateSpecToTime(area.end, 'end')
    return start <= time && time <= end
  })
}

/** Earliest and latest dates mentioned anywhere in the data, used as the timeline range. */
export function timelineBounds(lines: readonly Line[]): { min: number; max: number } | undefined {
  const times: number[] = []
  for (const line of lines) {
    for (const segment of line.segments) {
      for (const phase of segment.phases) {
        times.push(dateSpecToTime(phase.start, 'start'))
        if (phase.end !== undefined) {
          times.push(dateSpecToTime(phase.end, 'end'))
        }
      }
      for (const milestone of segment.milestones) {
        times.push(dateSpecToTime(milestone.date, 'start'))
      }
      for (const area of segment.workAreas) {
        times.push(dateSpecToTime(area.start, 'start'))
        if (area.end !== undefined) {
          times.push(dateSpecToTime(area.end, 'end'))
        }
      }
    }
  }
  if (times.length === 0) {
    return undefined
  }
  return { min: Math.min(...times), max: Math.max(...times) }
}
