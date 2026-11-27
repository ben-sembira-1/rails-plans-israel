import 'leaflet/dist/leaflet.css';
import type { PathOptions } from 'leaflet';
import { useEffect, useState } from 'react';
import {
  Circle,
  CircleMarker,
  LayersControl,
  MapContainer,
  Pane,
  Polyline,
  Popup,
  TileLayer,
  Tooltip,
  useMap,
  useMapEvents,
} from 'react-leaflet';
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

const CENTER_LAT = 32.07;
const LABEL_ZOOM = 15;
const INNER_M = 20;
const OUTER_M = 100;

/** [inner band, outer band] colors. */
const ZONE_COLORS: Readonly<Partial<Record<WorksStatus, readonly [string, string]>>> = {
  major: ['#E8590C', '#FFB27A'],
  minor: ['#E0A800', '#FFE38A'],
};

const ESRI = 'https://server.arcgisonline.com/ArcGIS/rest/services';
const ESRI_ATTR = 'Tiles &copy; Esri';

function lineWeight(section: { line: Section['line'] }): number {
  return LINES[section.line].metro ? 6 : 5;
}

function useZoom(initial: number): number {
  const [zoom, setZoom] = useState(initial);
  const map = useMapEvents({
    zoomend: () => {
      setZoom(map.getZoom());
    },
  });
  return zoom;
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

function SectionLayer({ section, time, zoom }: { section: Section; time: number; zoom: number }) {
  const status = statusAt(section, time);
  const zone = ZONE_COLORS[status];
  const w = lineWeight(section);
  const outer = bandWidthPx(OUTER_M, zoom, CENTER_LAT, 5);
  const inner = bandWidthPx(INNER_M, zoom, CENTER_LAT, 2);
  const lineStyle =
    status === 'open'
      ? { opacity: 1, weight: w }
      : status === 'none'
        ? { opacity: 0.45, weight: w - 1, dashArray: '2 9' }
        : { opacity: 1, weight: w, dashArray: '10 7' };
  const round = { lineCap: 'round', lineJoin: 'round' } as const;
  return (
    <>
      {section.paths.map((p, i) => (
        // Paths never reorder, so the index is a stable key.
        <SectionPath
          key={i}
          path={p}
          zone={zone}
          outer={outer}
          inner={inner}
          section={section}
          status={status}
          lineStyle={{ ...round, ...lineStyle }}
          casing={{ ...round, weight: w + 3, opacity: status === 'none' ? 0 : status === 'open' ? 1 : 0.9 }}
        />
      ))}
    </>
  );
}

interface SectionPathProps {
  path: readonly LatLng[];
  zone: readonly [string, string] | undefined;
  outer: number;
  inner: number;
  section: Section;
  status: WorksStatus;
  lineStyle: PathOptions;
  casing: PathOptions;
}

function SectionPath({ path, zone, outer, inner, section, status, lineStyle, casing }: SectionPathProps) {
  const positions = path as [number, number][];
  const round = { lineCap: 'round', lineJoin: 'round', interactive: false } as const;
  return (
    <>
      {zone !== undefined && (
        <>
          <Polyline
            pane="zoneOuter"
            positions={positions}
            pathOptions={{ ...round, color: zone[1], weight: outer, opacity: 1 }}
          />
          <Polyline
            pane="zoneInner"
            positions={positions}
            pathOptions={{ ...round, color: zone[0], weight: inner, opacity: 1 }}
          />
        </>
      )}
      <Polyline
        pane={status === 'none' ? 'future' : 'lines'}
        positions={positions}
        pathOptions={{ ...casing, color: '#fff', interactive: false }}
      />
      <Polyline
        pane={status === 'none' ? 'future' : 'lines'}
        positions={positions}
        pathOptions={{ ...lineStyle, color: LINES[section.line].color }}
      >
        <Tooltip sticky>
          {section.name} · {STATUS_LABEL[status]}
        </Tooltip>
        <Popup maxWidth={360}>
          <SectionPopup section={section} />
        </Popup>
      </Polyline>
    </>
  );
}

function SiteLayer({ site, time }: { site: Site; time: number }) {
  if (!isSiteActive(site, time)) return null;
  const [inner, outer] = ZONE_COLORS.minor ?? ['#E0A800', '#FFE38A'];
  const center: [number, number] = [site.position[0], site.position[1]];
  return (
    <>
      <Circle
        pane="zoneOuter"
        center={center}
        radius={OUTER_M}
        pathOptions={{ stroke: false, fillColor: outer, fillOpacity: 1, interactive: false }}
      />
      <Circle
        pane="zoneInner"
        center={center}
        radius={INNER_M}
        pathOptions={{ stroke: false, fillColor: inner, fillOpacity: 1, interactive: false }}
      />
      <Circle
        pane="zoneInner"
        center={center}
        radius={OUTER_M}
        pathOptions={{ stroke: false, fillOpacity: 0 }}
      >
        <Popup>
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
        </Popup>
      </Circle>
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

function StationMarker({ station, time, label }: { station: Station; time: number; label: boolean }) {
  const open = station.opens <= time;
  const metro = LINES[station.line].metro;
  return (
    <CircleMarker
      pane="stations"
      center={[station.position[0], station.position[1]]}
      radius={metro ? 5.5 : 4.5}
      pathOptions={{
        color: LINES[station.line].color,
        weight: metro ? 3 : 2.5,
        fillColor: '#fff',
        opacity: open ? 1 : 0.45,
        fillOpacity: open ? 1 : 0.45,
      }}
    >
      <Popup>
        <div className="pop">
          <b>{station.name}</b>
          <div>
            <span className="dot" style={{ background: LINES[station.line].color }} />
            {LINES[station.line].name}
          </div>
          <div>
            פתיחה: {formatTime(station.opens)}
            {station.opens === 2037 ? ' (יעד רשמי 2034–2037)' : ''}
          </div>
          {station.approximate && <div>מיקום משוער</div>}
        </div>
      </Popup>
      {label && (
        <Tooltip permanent direction="right" offset={[9, 0]} className={`lbl${open ? '' : ' fut'}`}>
          {station.name}
        </Tooltip>
      )}
    </CircleMarker>
  );
}

function RailLayer({ network }: { network: Network }) {
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
      {paths.map((p, i) => (
        <RailPath key={i} path={p} />
      ))}
      {network.railStations.map((s) => (
        <CircleMarker
          key={s.name}
          pane="stations"
          center={[s.position[0], s.position[1]]}
          radius={4}
          pathOptions={{ color: '#333', weight: 2, fillColor: '#fff', fillOpacity: 1 }}
        >
          <Popup>
            <div className="pop">
              <b>{s.name}</b>
              <div>רכבת ישראל · פועלת</div>
            </div>
          </Popup>
          <Tooltip permanent direction="left" offset={[-9, 0]} className="lbl">
            {s.name}
          </Tooltip>
        </CircleMarker>
      ))}
    </>
  );
}

function RailPath({ path }: { path: readonly LatLng[] }) {
  const positions = path as [number, number][];
  return (
    <>
      <Polyline
        pane="rail"
        positions={positions}
        pathOptions={{ color: '#4a4a4a', weight: 4, interactive: false }}
      />
      <Polyline
        pane="rail"
        positions={positions}
        pathOptions={{ color: '#fff', weight: 1.6, dashArray: '6 6', interactive: false }}
      />
    </>
  );
}

function Layers({ network, time, hidden }: MapViewProps) {
  const zoom = useZoom(12);
  const [labels] = useState(() => labelledStations(network.stations));
  const visible = (id: LayerId) => !hidden.has(id);
  return (
    <>
      <LabelToggle show={zoom >= LABEL_ZOOM} />
      {visible('rail') && <RailLayer network={network} />}
      {network.sections
        .filter((s) => visible(s.line))
        .map((s) => (
          <SectionLayer key={s.id} section={s} time={time} zoom={zoom} />
        ))}
      {network.sites
        .filter((s) => visible(s.line))
        .map((s) => (
          <SiteLayer key={s.id} site={s} time={time} />
        ))}
      {network.stations
        .filter((s) => visible(s.line))
        .map((s) => (
          <StationMarker
            key={`${s.line}-${s.name}-${s.position.join(',')}`}
            station={s}
            time={time}
            label={labels.has(s)}
          />
        ))}
    </>
  );
}

/** Station names are permanent tooltips, hidden by CSS until zoomed in close. */
function LabelToggle({ show }: { show: boolean }) {
  const map = useMapEvents({});
  useEffect(() => {
    map.getContainer().classList.toggle('show-labels', show);
  }, [map, show]);
  return null;
}

/** Keeps Leaflet's size in sync when the layout around the map changes (e.g. the timeline dock opens). */
function AutoResize() {
  const map = useMap();
  useEffect(() => {
    const observer = new ResizeObserver(() => {
      map.invalidateSize();
    });
    observer.observe(map.getContainer());
    return () => {
      observer.disconnect();
    };
  }, [map]);
  return null;
}

export interface MapViewProps {
  readonly network: Network;
  readonly time: number;
  readonly hidden: ReadonlySet<LayerId>;
}

export function MapView(props: MapViewProps) {
  return (
    <MapContainer
      className="map"
      bounds={[
        [31.98, 34.74],
        [32.17, 34.92],
      ]}
      boundsOptions={{ padding: [20, 20] }}
      zoomControl
    >
      <LayersControl position="topleft">
        <LayersControl.BaseLayer checked name="מפת רחובות">
          <TileLayer
            url={`${ESRI}/World_Street_Map/MapServer/tile/{z}/{y}/{x}`}
            attribution={ESRI_ATTR}
            maxZoom={19}
          />
        </LayersControl.BaseLayer>
        <LayersControl.BaseLayer name="טופוגרפית">
          <TileLayer
            url={`${ESRI}/World_Topo_Map/MapServer/tile/{z}/{y}/{x}`}
            attribution={ESRI_ATTR}
            maxZoom={19}
          />
        </LayersControl.BaseLayer>
        <LayersControl.BaseLayer name="לוויין">
          <TileLayer
            url={`${ESRI}/World_Imagery/MapServer/tile/{z}/{y}/{x}`}
            attribution={ESRI_ATTR}
            maxZoom={19}
          />
        </LayersControl.BaseLayer>
      </LayersControl>
      <Pane name="rail" style={{ zIndex: 410 }} />
      <Pane name="zoneOuter" style={{ zIndex: 415, opacity: 0.5 }} />
      <Pane name="zoneInner" style={{ zIndex: 416, opacity: 0.6 }} />
      <Pane name="future" style={{ zIndex: 420 }} />
      <Pane name="lines" style={{ zIndex: 430 }} />
      <Pane name="stations" style={{ zIndex: 640 }} />
      <AutoResize />
      <Layers {...props} />
    </MapContainer>
  );
}
