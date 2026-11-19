import type { Segment } from '../data/schema.ts'

import { dateSpecToTime } from './dates.ts'
import { activeWorkAreas, segmentStatusAt, timelineBounds } from './status.ts'

const src = [{ docId: 'doc' }]

const segment: Segment = {
  id: 'seg',
  name: 'Segment',
  geometry: {
    type: 'LineString',
    coordinates: [
      [34.78, 32.08],
      [34.79, 32.09],
    ],
  },
  geometrySource: { kind: 'approximate', ref: 'test', sources: src },
  stations: [],
  phases: [
    { kind: 'planning', label: 'Planning', start: '2020', end: '2024', sources: src },
    { kind: 'construction', label: 'Works', start: '2025-03', end: '2029', sources: src },
    { kind: 'operational', label: 'Opening', start: '2030-Q2', sources: src },
  ],
  milestones: [],
  workAreas: [
    {
      id: 'wa',
      name: 'Station box',
      geometry: {
        type: 'Polygon',
        coordinates: [
          [
            [34.78, 32.08],
            [34.781, 32.08],
            [34.781, 32.081],
            [34.78, 32.08],
          ],
        ],
      },
      start: '2025-06',
      end: '2028',
      sources: src,
    },
  ],
  materials: [],
}

const at = (spec: string): number => dateSpecToTime(spec, 'start')

describe('segmentStatusAt', () => {
  it('is planned before construction starts', () => {
    expect(segmentStatusAt(segment, at('2025-02'))).toBe('planned')
  })
  it('is under construction once works start', () => {
    expect(segmentStatusAt(segment, at('2025-03'))).toBe('construction')
  })
  it('is operational once opened', () => {
    expect(segmentStatusAt(segment, at('2030-04'))).toBe('operational')
  })
  it('is planned when no phases exist', () => {
    expect(segmentStatusAt({ ...segment, phases: [] }, at('2040'))).toBe('planned')
  })
})

describe('activeWorkAreas', () => {
  it('returns areas only inside their date range', () => {
    expect(activeWorkAreas(segment, at('2025-05'))).toHaveLength(0)
    expect(activeWorkAreas(segment, at('2026'))).toHaveLength(1)
    expect(activeWorkAreas(segment, dateSpecToTime('2028', 'end'))).toHaveLength(1)
    expect(activeWorkAreas(segment, at('2029'))).toHaveLength(0)
  })
})

describe('timelineBounds', () => {
  it('spans all dated items', () => {
    const line = {
      id: 'l',
      name: 'L',
      nameHe: 'ל',
      mode: 'lrt' as const,
      color: '#ff0000',
      description: 'd',
      sources: src,
      segments: [segment],
    }
    expect(timelineBounds([line])).toEqual({
      min: at('2020'),
      max: dateSpecToTime('2030-Q2', 'start'),
    })
    expect(timelineBounds([])).toBeUndefined()
  })
})
