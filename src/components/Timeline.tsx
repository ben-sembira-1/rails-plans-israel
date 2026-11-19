import { useEffect, useId, useState, type JSX } from 'react'

import { toIsoDate } from '../domain/dates.ts'
import { TODAY } from '../domain/today.ts'

const DAY_MS = 24 * 60 * 60 * 1000
const SPEEDS = [
  { label: '1 month/s', daysPerSecond: 30 },
  { label: '6 months/s', daysPerSecond: 182 },
  { label: '1 year/s', daysPerSecond: 365 },
] as const
const TICK_MS = 100

interface TimelineProps {
  min: number
  max: number
  value: number
  onChange: (time: number) => void
}

export function Timeline({ min, max, value, onChange }: TimelineProps): JSX.Element {
  const [playing, setPlaying] = useState(false)
  const [speedIndex, setSpeedIndex] = useState(1)
  const sliderId = useId()
  const speed = SPEEDS[speedIndex] ?? SPEEDS[0]

  useEffect(() => {
    if (!playing) {
      return
    }
    const timer = globalThis.setInterval(() => {
      const next = value + (speed.daysPerSecond * DAY_MS * TICK_MS) / 1000
      if (next >= max) {
        onChange(max)
        setPlaying(false)
      } else {
        onChange(next)
      }
    }, TICK_MS)
    return () => {
      globalThis.clearInterval(timer)
    }
  }, [playing, value, max, speed, onChange])

  const togglePlay = (): void => {
    if (!playing && value >= max) {
      onChange(min)
    }
    setPlaying(!playing)
  }

  return (
    <div className="timeline">
      <button type="button" className="timeline__play" onClick={togglePlay} aria-pressed={playing}>
        {playing ? 'Pause' : 'Play'}
      </button>
      <label htmlFor={sliderId} className="timeline__date">
        {toIsoDate(value)}
      </label>
      <input
        id={sliderId}
        className="timeline__slider"
        type="range"
        min={min}
        max={max}
        step={DAY_MS}
        value={value}
        onChange={(event) => {
          onChange(Number(event.target.value))
        }}
        list={`${sliderId}-ticks`}
      />
      <datalist id={`${sliderId}-ticks`}>
        {TODAY >= min && TODAY <= max ? <option value={TODAY} label="Today" /> : null}
      </datalist>
      <button
        type="button"
        className="timeline__today"
        onClick={() => {
          onChange(Math.min(max, Math.max(min, TODAY)))
        }}
      >
        Today
      </button>
      <select
        className="timeline__speed"
        aria-label="Playback speed"
        value={speedIndex}
        onChange={(event) => {
          setSpeedIndex(Number(event.target.value))
        }}
      >
        {SPEEDS.map((s, index) => (
          <option key={s.label} value={index}>
            {s.label}
          </option>
        ))}
      </select>
    </div>
  )
}
