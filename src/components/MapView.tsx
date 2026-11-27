import { AdvancedMarker, Circle, useApiIsLoaded, InfoWindow, Map, Polyline } from '@vis.gl/react-google-maps';
import { Fragment, useEffect, useState } from 'react';
import type { LatLng, Network, Section, Site, Station, WorksStatus } from '../data/schema.ts';
import { bandWidthPx } from '../domain/geo.ts';
import { LINES, type LayerId } from '../domain/lines.ts';
import { loadLiveRail } from '../domain/rail.ts';
import {
  isSiteActive,
  METRO_HEAVY_WORKS_FROM,
  phaseRange,
  STATUS_LABEL,
  statusAt,
} from '../domain/status.ts';
import { formatTime, stepBefore } from '../domain/time.ts';
import { sectionLineStyle, sectionZ, Z } from './sectionStyle.ts';

const CENTER_LAT = 32.07;
const LABEL_ZOOM = 15;
const INNER_M = 20;
const OUTER_M = 100;
const INITIAL_BOUNDS = { south: 31.98, west: 34.74, north: 32.17, east: 34.92 };

/** [inner band, outer band] colors. */
const ZONE_COLORS: Readonly<Partial<Record<WorksStatus, readonly [string, string]>>> = {
  major: ['#E8590C', '#FFB27A'],
  minor: ['#E0A800', '#FFE38A'],
};

function lineWeight(section: { line: Section['line'] }): number {
  return LINES[section.line].metro ? 6 : 5;
}

const toLatLng = ([lat, lng]: LatLng): google.maps.LatLngLiteral => ({ lat, lng });

/** A popup anchored at a map position. */
interface Popup {
  readonly position: google.maps.LatLngLiteral;
  readonly content: React.ReactNode;
}
type OpenPopup = (popup: Popup) => void;

function clickPosition(e: google.maps.MapMouseEvent): google.maps.LatLngLiteral | null {
  return e.latLng?.toJSON() ?? null;
}

function SectionPopup({ section }: { section: Section }) {
  return (
    <div className="pop">
      <b>{section.name}</b>
      <table>
        <tbody>
          {section.phases.map((p, i) => (
            <tr key={`${p.since ?? 'start'}-${p.status}`}>
              <td dir="ltr" className="range">
                {phaseRange(section.phases, i)}
              </td>
              <td>
                <span className={`chip chip-${p.status}`}>{STATUS_LABEL[p.status]}</span> {p.note}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function SectionLayer({
  section,
  time,
  zoom,
  onPopup,
}: {
  section: Section;
  time: number;
  zoom: number;
  onPopup: OpenPopup;
}) {
  const status = statusAt(section, time);
  const zone = ZONE_COLORS[status];
  const w = lineWeight(section);
  const outer = bandWidthPx(OUTER_M, zoom, CENTER_LAT, 5);
  const inner = bandWidthPx(INNER_M, zoom, CENTER_LAT, 2);
  const line = sectionLineStyle(status, w, LINES[section.line].color);
  const z = sectionZ(status);
  const casingOpacity = status === 'none' ? 0 : status === 'open' ? 1 : 0.9;
  const onClick = (e: google.maps.MapMouseEvent) => {
    const position = clickPosition(e);
    if (position) onPopup({ position, content: <SectionPopup section={section} /> });
  };
  return (
    <>
      {section.paths.map((p, i) => {
        const path = p.map(toLatLng);
        return (
          // Paths never reorder, so the index is a stable key.
          <Fragment key={i}>
            {zone !== undefined && (
              <>
                <Polyline
                  path={path}
                  strokeColor={zone[1]}
                  strokeOpacity={0.5}
                  strokeWeight={outer}
                  zIndex={Z.zoneOuter}
                  clickable={false}
                />
                <Polyline
                  path={path}
                  strokeColor={zone[0]}
                  strokeOpacity={0.6}
                  strokeWeight={inner}
                  zIndex={Z.zoneInner}
                  clickable={false}
                />
              </>
            )}
            <Polyline
              path={path}
              strokeColor="#fff"
              strokeOpacity={casingOpacity}
              strokeWeight={w + 3}
              zIndex={z.casing}
              clickable={false}
            />
            <Polyline
              path={path}
              strokeColor={LINES[section.line].color}
              strokeOpacity={line.strokeOpacity}
              strokeWeight={line.strokeWeight}
              icons={line.icons}
              zIndex={z.line}
              onClick={onClick}
            />
          </Fragment>
        );
      })}
    </>
  );
}

function SitePopup({ site }: { site: Site }) {
  return (
    <div className="pop">
      <b>
        {site.name}
        {site.approximate ? ' (מיקום משוער)' : ''}
      </b>
      <table>
        <tbody>
          <tr>
            <td dir="ltr" className="range">
              {formatTime(site.since)}–{formatTime(stepBefore(METRO_HEAVY_WORKS_FROM))}
            </td>
            <td>עבודות קלות: {site.note}</td>
          </tr>
          <tr>
            <td dir="ltr" className="range">
              {formatTime(METRO_HEAVY_WORKS_FROM)}–2033
            </td>
            <td>עבודות כבדות לאורך הקו</td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}

function SiteLayer({ site, time, onPopup }: { site: Site; time: number; onPopup: OpenPopup }) {
  if (!isSiteActive(site, time)) return null;
  const [inner, outer] = ZONE_COLORS.minor ?? ['#E0A800', '#FFE38A'];
  const center = toLatLng(site.position);
  return (
    <>
      <Circle
        center={center}
        radius={OUTER_M}
        strokeWeight={0}
        fillColor={outer}
        fillOpacity={0.5}
        zIndex={Z.zoneOuter}
        onClick={(e: google.maps.MapMouseEvent) => {
          onPopup({ position: clickPosition(e) ?? center, content: <SitePopup site={site} /> });
        }}
      />
      <Circle
        center={center}
        radius={INNER_M}
        strokeWeight={0}
        fillColor={inner}
        fillOpacity={0.6}
        zIndex={Z.zoneInner}
        clickable={false}
      />
    </>
  );
}

/** Interchange stations appear once per line; label each name only once per place. */
function labelledStations(stations: readonly Station[]): ReadonlySet<Station> {
  const seen: { key: string; position: LatLng }[] = [];
  const out = new Set<Station>();
  for (const s of stations) {
    const key = s.name.replace(/[\s\-–־()]/g, '');
    const dup = seen.some(
      (q) =>
        q.key === key &&
        Math.hypot(q.position[0] - s.position[0], (q.position[1] - s.position[1]) * 0.85) < 0.004,
    );
    if (!dup) {
      seen.push({ key, position: s.position });
      out.add(s);
    }
  }
  return out;
}

function StationMarker({
  station,
  time,
  label,
  onPopup,
}: {
  station: Station;
  time: number;
  label: boolean;
  onPopup: OpenPopup;
}) {
  const open = station.opens <= time;
  const line = LINES[station.line];
  const position = toLatLng(station.position);
  return (
    <AdvancedMarker
      position={position}
      anchorLeft="-50%"
      anchorTop="-50%"
      title={station.name}
      onClick={() => {
        onPopup({
          position,
          content: (
            <div className="pop">
              <b>{station.name}</b>
              <div>
                <span className="dot" style={{ background: line.color }} />
                {line.name}
              </div>
              <div>
                פתיחה: {formatTime(station.opens)}
                {station.opens === 2037 ? ' (יעד רשמי 2034–2037)' : ''}
              </div>
              {station.approximate && <div>מיקום משוער</div>}
            </div>
          ),
        });
      }}
    >
      <span
        className={`stn${line.metro ? ' metro' : ''}${open ? '' : ' fut'}`}
        style={{ borderColor: line.color }}
      >
        {label && <span className="lbl">{station.name}</span>}
      </span>
    </AdvancedMarker>
  );
}

const RAIL_DASH = [
  {
    icon: { path: 'M 0,-1 0,1', scale: 3, strokeOpacity: 1, strokeWeight: 1.6 },
    offset: '0',
    repeat: '12px',
  },
];

function RailLayer({ network, onPopup }: { network: Network; onPopup: OpenPopup }) {
  const [paths, setPaths] = useState<readonly (readonly LatLng[])[]>(network.railFallback);
  useEffect(() => {
    const ac = new AbortController();
    loadLiveRail(ac.signal)
      .then((live) => {
        if (live !== null) setPaths(live);
      })
      .catch(() => undefined);
    return () => {
      ac.abort();
    };
  }, []);
  return (
    <>
      {paths.map((p, i) => {
        const path = p.map(toLatLng);
        return (
          <Fragment key={i}>
            <Polyline path={path} strokeColor="#4a4a4a" strokeWeight={4} zIndex={Z.rail} clickable={false} />
            <Polyline
              path={path}
              strokeColor="#fff"
              strokeOpacity={0}
              strokeWeight={1.6}
              icons={RAIL_DASH}
              zIndex={Z.rail}
              clickable={false}
            />
          </Fragment>
        );
      })}
      {network.railStations.map((s) => {
        const position = toLatLng(s.position);
        return (
          <AdvancedMarker
            key={s.name}
            position={position}
            anchorLeft="-50%"
            anchorTop="-50%"
            title={s.name}
            onClick={() => {
              onPopup({
                position,
                content: (
                  <div className="pop">
                    <b>{s.name}</b>
                    <div>רכבת ישראל · פועלת</div>
                  </div>
                ),
              });
            }}
          >
            <span className="stn rail">
              <span className="lbl rail-lbl">{s.name}</span>
            </span>
          </AdvancedMarker>
        );
      })}
    </>
  );
}

export interface MapViewProps {
  readonly network: Network;
  readonly time: number;
  readonly hidden: ReadonlySet<LayerId>;
  readonly mapId: string;
  /** A click on a Google point of interest (shop, park, …). */
  readonly onPoiClick?: (placeId: string, position: google.maps.LatLngLiteral) => void;
  /** Extra layers (e.g. places of interest). */
  readonly children?: React.ReactNode;
}

export function MapView({ network, time, hidden, mapId, onPoiClick, children }: MapViewProps) {
  const [zoom, setZoom] = useState(12);
  const [popup, setPopup] = useState<Popup | null>(null);
  const [labels] = useState(() => labelledStations(network.stations));
  const visible = (id: LayerId) => !hidden.has(id);
  // The place search sits at the top of the map, so the map type switch goes to the bottom. `google` exists only
  // once the API has loaded, which is also when the map is created.
  const apiLoaded = useApiIsLoaded();
  const mapTypeOptions = apiLoaded
    ? { mapTypeControlOptions: { position: google.maps.ControlPosition.LEFT_BOTTOM } }
    : {};

  return (
    <div className={zoom >= LABEL_ZOOM ? 'map show-labels' : 'map'}>
      <Map
        mapId={mapId}
        defaultBounds={{ ...INITIAL_BOUNDS, padding: 20 }}
        gestureHandling="greedy"
        mapTypeControl
        {...mapTypeOptions}
        streetViewControl={false}
        fullscreenControl={false}
        clickableIcons
        onCameraChanged={(e) => {
          setZoom(Math.round(e.detail.zoom));
        }}
        onClick={(e) => {
          const { placeId, latLng } = e.detail;
          if (placeId && latLng && onPoiClick) {
            // Show our own card instead of Google's default info window.
            e.stop();
            onPoiClick(placeId, latLng);
          }
        }}
      >
        {visible('rail') && <RailLayer network={network} onPopup={setPopup} />}
        {network.sections
          .filter((s) => visible(s.line))
          .map((s) => (
            <SectionLayer key={s.id} section={s} time={time} zoom={zoom} onPopup={setPopup} />
          ))}
        {network.sites
          .filter((s) => visible(s.line))
          .map((s) => (
            <SiteLayer key={s.id} site={s} time={time} onPopup={setPopup} />
          ))}
        {network.stations
          .filter((s) => visible(s.line))
          .map((s) => (
            <StationMarker
              key={`${s.line}-${s.name}-${s.position.join(',')}`}
              station={s}
              time={time}
              label={labels.has(s)}
              onPopup={setPopup}
            />
          ))}
        {popup && (
          <InfoWindow
            position={popup.position}
            onClose={() => {
              setPopup(null);
            }}
          >
            <div dir="rtl">{popup.content}</div>
          </InfoWindow>
        )}
        {children}
      </Map>
    </div>
  );
}
