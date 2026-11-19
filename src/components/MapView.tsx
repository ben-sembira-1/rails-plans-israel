import 'leaflet/dist/leaflet.css'
import type { LatLngBoundsExpression, LatLngTuple, PathOptions } from 'leaflet'
import { Fragment, type JSX } from 'react'
import { MapContainer, Polygon, Polyline, TileLayer, Tooltip } from 'react-leaflet'

import type { Line, LngLat, Segment } from '../data/schema.ts'
import { activeWorkAreas, segmentStatusAt, type SegmentStatus } from '../domain/status.ts'

const GUSH_DAN_BOUNDS: LatLngBoundsExpression = [
  [31.88, 34.68],
  [32.25, 35],
]
const DISABLED_COLOR = '#9aa0a6'

const toLatLng = ([lng, lat]: LngLat): LatLngTuple => [lat, lng]

export function segmentStyle(line: Line, status: SegmentStatus, selected: boolean): PathOptions {
  const weight = selected ? 8 : 5
  switch (status) {
    case 'planned': {
      return { color: DISABLED_COLOR, weight, opacity: 0.8, dashArray: '6 8' }
    }
    case 'construction': {
      return { color: line.color, weight, opacity: 0.55, dashArray: '2 6', lineCap: 'butt' }
    }
    case 'operational': {
      return { color: line.color, weight, opacity: 1 }
    }
  }
}

const STATUS_LABEL: Record<SegmentStatus, string> = {
  planned: 'Planned – not yet under construction',
  construction: 'Under construction',
  operational: 'Operational',
}

interface MapViewProps {
  lines: readonly Line[]
  time: number
  selectedSegmentId: string | undefined
  onSelect: (segment: Segment) => void
}

export function MapView({ lines, time, selectedSegmentId, onSelect }: MapViewProps): JSX.Element {
  return (
    <MapContainer className="map" bounds={GUSH_DAN_BOUNDS} scrollWheelZoom>
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      {lines.map((line) =>
        line.segments.map((segment) => {
          const status = segmentStatusAt(segment, time)
          const selected = segment.id === selectedSegmentId
          const handlers = {
            click: () => {
              onSelect(segment)
            },
          }
          return (
            <Fragment key={segment.id}>
              {activeWorkAreas(segment, time).map((area) => (
                <Polygon
                  key={area.id}
                  positions={area.geometry.coordinates.map((ring) =>
                    ring.map((point) => toLatLng(point)),
                  )}
                  pathOptions={{
                    color: line.color,
                    weight: 2,
                    dashArray: '4 4',
                    fillColor: line.color,
                    fillOpacity: 0.35,
                  }}
                  eventHandlers={handlers}
                >
                  <Tooltip sticky>
                    Work area: {area.name} ({line.name})
                  </Tooltip>
                </Polygon>
              ))}
              <Polyline
                positions={segment.geometry.coordinates.map((point) => toLatLng(point))}
                pathOptions={segmentStyle(line, status, selected)}
                eventHandlers={handlers}
              >
                <Tooltip sticky>
                  <strong>{line.name}</strong> – {segment.name}
                  <br />
                  {STATUS_LABEL[status]}
                </Tooltip>
              </Polyline>
            </Fragment>
          )
        }),
      )}
    </MapContainer>
  )
}
