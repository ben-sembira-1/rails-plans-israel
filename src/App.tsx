import { useCallback, useMemo, type JSX } from 'react'

import { Header } from './components/Header.tsx'
import { Legend } from './components/Legend.tsx'
import { MapView } from './components/MapView.tsx'
import { SegmentPanel } from './components/SegmentPanel.tsx'
import { Timeline } from './components/Timeline.tsx'
import { findSegment, lines } from './data/index.ts'
import type { Segment } from './data/schema.ts'
import { toIsoDate } from './domain/dates.ts'
import { timelineBounds } from './domain/status.ts'
import { TODAY } from './domain/today.ts'
import { useHashParam } from './hooks/useHashState.ts'

const FALLBACK_BOUNDS = { min: Date.UTC(2015, 0, 1), max: Date.UTC(2040, 0, 1) }

export function App(): JSX.Element {
  const bounds = useMemo(() => timelineBounds(lines) ?? FALLBACK_BOUNDS, [])
  const [dateParam, setDateParam] = useHashParam('date')
  const [segmentParam, setSegmentParam] = useHashParam('segment')

  const parsed = dateParam === undefined ? Number.NaN : Date.parse(dateParam)
  const time = Number.isNaN(parsed)
    ? Math.min(bounds.max, Math.max(bounds.min, TODAY))
    : Math.min(bounds.max, Math.max(bounds.min, parsed))

  const setTime = useCallback(
    (next: number) => {
      setDateParam(toIsoDate(next))
    },
    [setDateParam],
  )
  const selected = segmentParam === undefined ? undefined : findSegment(segmentParam)

  return (
    <div className="app">
      <Header />
      <main className="app__main">
        <MapView
          lines={lines}
          time={time}
          selectedSegmentId={selected?.segment.id}
          onSelect={(segment: Segment) => {
            setSegmentParam(segment.id)
          }}
        />
        <Legend lines={lines} />
        {selected === undefined ? null : (
          <SegmentPanel
            segmentRef={selected}
            time={time}
            onClose={() => {
              setSegmentParam(undefined)
            }}
          />
        )}
      </main>
      <Timeline min={bounds.min} max={bounds.max} value={time} onChange={setTime} />
    </div>
  )
}
