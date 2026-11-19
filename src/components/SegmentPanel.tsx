import type { JSX } from 'react'

import type { SegmentRef } from '../data/index.ts'
import { publicUrl } from '../data/links.ts'
import type { DateSpec, SourceRef } from '../data/schema.ts'
import { dateSpecToTime, formatDateSpec } from '../domain/dates.ts'
import { segmentStatusAt } from '../domain/status.ts'

import { Citations } from './Citation.tsx'

interface TimelineEntry {
  key: string
  time: number
  when: string
  label: string
  kind: string
  sources: readonly SourceRef[]
}

function range(start: DateSpec, end: DateSpec | undefined): string {
  return end === undefined
    ? `from ${formatDateSpec(start)}`
    : `${formatDateSpec(start)} – ${formatDateSpec(end)}`
}

function buildEntries({ segment }: SegmentRef): TimelineEntry[] {
  const entries: TimelineEntry[] = [
    ...segment.phases.map((phase, index) => ({
      key: `phase-${String(index)}`,
      time: dateSpecToTime(phase.start, 'start'),
      when: range(phase.start, phase.end),
      label: phase.label,
      kind: phase.kind,
      sources: phase.sources,
    })),
    ...segment.milestones.map((milestone, index) => ({
      key: `milestone-${String(index)}`,
      time: dateSpecToTime(milestone.date, 'start'),
      when: formatDateSpec(milestone.date),
      label: milestone.label,
      kind: 'milestone',
      sources: milestone.sources,
    })),
    ...segment.workAreas.map((area) => ({
      key: `area-${area.id}`,
      time: dateSpecToTime(area.start, 'start'),
      when: range(area.start, area.end),
      label: `Work area closed: ${area.name}`,
      kind: 'work-area',
      sources: area.sources,
    })),
  ]
  return entries.toSorted((a, b) => a.time - b.time)
}

interface SegmentPanelProps {
  segmentRef: SegmentRef
  time: number
  onClose: () => void
}

export function SegmentPanel({ segmentRef, time, onClose }: SegmentPanelProps): JSX.Element {
  const { line, segment } = segmentRef
  const status = segmentStatusAt(segment, time)
  return (
    <aside className="panel" aria-label={`${line.name} – ${segment.name}`}>
      <div className="panel__header" style={{ borderColor: line.color }}>
        <div>
          <p className="panel__line" style={{ color: line.color }}>
            {line.name} · {line.nameHe}
          </p>
          <h2 className="panel__title">{segment.name}</h2>
          <p className={`panel__status panel__status--${status}`}>{status}</p>
        </div>
        <button type="button" className="panel__close" onClick={onClose} aria-label="Close panel">
          ×
        </button>
      </div>

      <section>
        <h3>Timeline</h3>
        <ol className="vtimeline">
          {buildEntries(segmentRef).map((entry) => (
            <li
              key={entry.key}
              className={`vtimeline__item vtimeline__item--${entry.kind}${entry.time <= time ? ' vtimeline__item--past' : ''}`}
            >
              <span className="vtimeline__when">{entry.when}</span>
              <span className="vtimeline__label">{entry.label}</span>
              <Citations sources={entry.sources} />
            </li>
          ))}
        </ol>
      </section>

      {segment.stations.length > 0 ? (
        <section>
          <h3>Stations</h3>
          <ul className="stations">
            {segment.stations.map((station) => (
              <li key={station.name}>
                {station.name}
                {station.nameHe === undefined ? null : <span lang="he"> · {station.nameHe}</span>}
                <Citations sources={station.sources} />
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section>
        <h3>Raw materials</h3>
        {segment.materials.length === 0 ? <p>No materials extracted yet.</p> : null}
        {segment.materials.map((material) => (
          <figure
            key={`${material.kind}-${material.title}`}
            className={`material material--${material.kind}`}
          >
            <figcaption className="material__title">{material.title}</figcaption>
            {material.image === undefined ? null : (
              <a href={publicUrl(material.image)} target="_blank" rel="noreferrer">
                <img
                  className="material__image"
                  src={publicUrl(material.image)}
                  alt={material.title}
                  loading="lazy"
                />
              </a>
            )}
            {material.body === undefined ? null : <p className="material__body">{material.body}</p>}
            <Citations sources={material.sources} />
          </figure>
        ))}
      </section>

      <section>
        <h3>Geometry</h3>
        <p>
          {segment.geometrySource.kind === 'osm' ? 'From OpenStreetMap' : null}
          {segment.geometrySource.kind === 'traced'
            ? 'Traced by hand from the plan drawings'
            : null}
          {segment.geometrySource.kind === 'approximate'
            ? 'Approximate (straight lines between stations)'
            : null}
          {' – '}
          <code>{segment.geometrySource.ref}</code>
        </p>
        <Citations sources={segment.geometrySource.sources} />
      </section>

      <section>
        <h3>About {line.name}</h3>
        <p>{line.description}</p>
        <Citations sources={line.sources} />
      </section>
    </aside>
  )
}
