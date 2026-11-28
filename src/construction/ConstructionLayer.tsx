import { AdvancedMarker, Polygon, Polyline, useMap } from '@vis.gl/react-google-maps';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { clickPosition, type OpenPopup } from '../components/popup.ts';
import { Z } from '../components/sectionStyle.ts';
import type { ConstructionData, Project } from '../data/construction.ts';
import type { LatLng } from '../data/validate.ts';
import { clusterByGrid, worldPx, type Cluster } from '../domain/cluster.ts';
import {
  buildProgressAt,
  CONSTRUCTION_LAYERS,
  projectsAt,
  type ConstructionLayer as Layer,
  type ShownProject,
} from '../domain/construction.ts';
import { areaBufferRings, risingFill } from '../domain/geo.ts';
import { SITE_HIGH_NOISE_M, SITE_LOW_NOISE_M } from '../domain/zones.ts';
import { ProjectPopup } from './ProjectPopup.tsx';
import { CLUSTER_COLOR, DETAIL_ZOOM, LAYER_COLOR, MAX_SHAPES, NOISE_COLORS } from './style.ts';

const toLatLng = ([lat, lng]: LatLng): google.maps.LatLngLiteral => ({ lat, lng });

const ROAD_DASH = [
  { icon: { path: 'M 0,-1 0,1', scale: 3, strokeOpacity: 1, strokeWeight: 4 }, offset: '0', repeat: '14px' },
];

/** The high-noise (20 m) and low-noise (50 m) bands around a site, at real scale. */
function NoiseZones({
  project,
  onClick,
}: {
  project: Project;
  onClick: (e: google.maps.MapMouseEvent) => void;
}) {
  const zones = useMemo(() => {
    const band = (m: number) =>
      project.shapes.flatMap((r) => areaBufferRings(r, m)).map((r) => r.map(toLatLng));
    return { high: band(SITE_HIGH_NOISE_M), low: band(SITE_LOW_NOISE_M) };
  }, [project]);
  return (
    <>
      <Polygon
        paths={zones.low}
        fillColor={NOISE_COLORS[1]}
        fillOpacity={0.45}
        strokeWeight={0}
        strokeOpacity={0}
        zIndex={Z.zoneOuter}
        clickable
        onClick={onClick}
      />
      <Polygon
        paths={zones.high}
        fillColor={NOISE_COLORS[0]}
        fillOpacity={0.5}
        strokeWeight={0}
        strokeOpacity={0}
        zIndex={Z.zoneInner}
        clickable
        onClick={onClick}
      />
    </>
  );
}

/** A building's fill rises from its southern edge as its works go on: above the outline, under the rail lines. */
const RISING_Z = Z.future + 0.5;

function ProjectShape({
  item,
  time,
  onPopup,
  fetchedAt,
}: {
  item: ShownProject;
  time: number;
  onPopup: OpenPopup;
  fetchedAt: string;
}) {
  const { project: p, layer } = item;
  const paths = useMemo(() => p.shapes.map((s) => s.map(toLatLng)), [p]);
  const progress = layer === 'construction' ? buildProgressAt(p, time) : undefined;
  const risen = useMemo(
    () => (progress === undefined ? [] : risingFill(p.shapes, progress).map((r) => r.map(toLatLng))),
    [p, progress],
  );
  const onClick = useCallback(
    (e: google.maps.MapMouseEvent) => {
      onPopup({
        position: clickPosition(e) ?? toLatLng(p.position),
        content: <ProjectPopup project={p} fetchedAt={fetchedAt} progress={progress} />,
      });
    },
    [p, fetchedAt, onPopup, progress],
  );
  const color = LAYER_COLOR[layer];
  if (p.kind === 'road') {
    return (
      <>
        {paths.map((path, i) => (
          <Polyline
            // Paths never reorder, so the index is a stable key.
            key={i}
            path={path}
            strokeColor={color}
            strokeOpacity={0}
            strokeWeight={4}
            icons={ROAD_DASH}
            zIndex={Z.casing}
            onClick={onClick}
          />
        ))}
      </>
    );
  }
  const building = layer === 'construction';
  // A building with a known span is drawn empty (pale) and filled as it rises; without one, filled as before.
  const rising = progress !== undefined;
  return (
    <>
      {building && <NoiseZones project={p} onClick={onClick} />}
      <Polygon
        paths={paths}
        strokeColor={color}
        strokeOpacity={building ? 1 : 0.9}
        strokeWeight={building ? 1.5 : layer === 'permitted' ? 2 : 1}
        fillColor={building && !rising ? NOISE_COLORS[0] : '#ffffff'}
        fillOpacity={building ? (rising ? 0.7 : 0.75) : 0.35}
        zIndex={Z.future}
        clickable
        onClick={onClick}
      />
      {risen.length > 0 && (
        <Polygon
          paths={risen}
          strokeOpacity={0}
          strokeWeight={0}
          fillColor={color}
          fillOpacity={0.85}
          zIndex={RISING_Z}
          clickable
          onClick={onClick}
        />
      )}
    </>
  );
}

/** A single project when zoomed out: a dot in its layer's style; clicking it opens its popup. */
function ProjectDot({
  item,
  onPopup,
  fetchedAt,
}: {
  item: ShownProject;
  onPopup: OpenPopup;
  fetchedAt: string;
}) {
  const { project: p, layer } = item;
  const position = toLatLng(p.position);
  return (
    <AdvancedMarker
      position={position}
      anchorLeft="-50%"
      anchorTop="-50%"
      title={p.title}
      zIndex={layer === 'requested' ? 1 : 2}
      onClick={() => {
        onPopup({ position, content: <ProjectPopup project={p} fetchedAt={fetchedAt} /> });
      }}
    >
      <span className={`build-dot build-dot-${layer}`} />
    </AdvancedMarker>
  );
}

/** "conic-gradient(...)": the ring of a count bubble, one arc per layer in proportion to its projects. */
function ringOf(members: readonly ShownProject[]): string {
  const counts = new Map<Layer, number>();
  for (const m of members) counts.set(m.layer, (counts.get(m.layer) ?? 0) + 1);
  let from = 0;
  const stops = CONSTRUCTION_LAYERS.flatMap((layer) => {
    const n = counts.get(layer) ?? 0;
    if (n === 0) return [];
    const to = from + (n / members.length) * 100;
    const stop = `${CLUSTER_COLOR[layer]} ${from.toFixed(1)}% ${to.toFixed(1)}%`;
    from = to;
    return [stop];
  });
  return `conic-gradient(${stops.join(', ')})`;
}

/** Zooms so that a bubble's projects fill the view; a small area goes straight to the detail zoom. */
function zoomTo(map: google.maps.Map, c: Cluster<ShownProject>) {
  const [[south, west], [north, east]] = c.bounds;
  const target = DETAIL_ZOOM + 1;
  const sw = worldPx([south, west], target);
  const ne = worldPx([north, east], target);
  const div = map.getDiv();
  if (ne.x - sw.x < div.clientWidth * 0.7 && sw.y - ne.y < div.clientHeight * 0.7) {
    map.setCenter(toLatLng(c.position));
    map.setZoom(target);
  } else {
    map.fitBounds({ south, west, north, east }, 60);
  }
}

/** Several projects close together when zoomed out: a bubble with their number; clicking it zooms in. */
function CountBubble({ cluster }: { cluster: Cluster<ShownProject> }) {
  const map = useMap();
  const n = cluster.members.length;
  const size = Math.round(26 + 7 * Math.log10(n));
  return (
    <AdvancedMarker
      position={toLatLng(cluster.position)}
      anchorLeft="-50%"
      anchorTop="-50%"
      title={`${n.toLocaleString('he-IL')} פרויקטי בנייה באזור. לחיצה מגדילה את המפה.`}
      zIndex={3}
      onClick={() => {
        if (map) zoomTo(map, cluster);
      }}
    >
      <span
        className="build-cluster"
        style={{ width: size, height: size, background: ringOf(cluster.members) }}
      >
        <span>{n.toLocaleString('he-IL')}</span>
      </span>
    </AdvancedMarker>
  );
}

/**
 * When zoomed out (or with too many projects in view): projects close together are counted in one bubble, so the
 * map draws a few dozen markers instead of thousands of shapes.
 */
function Counts({
  items,
  zoom,
  onPopup,
  fetchedAt,
}: {
  items: readonly ShownProject[];
  zoom: number;
  onPopup: OpenPopup;
  fetchedAt: string;
}) {
  const clusters = useMemo(() => clusterByGrid(items, (s) => s.project.position, zoom), [items, zoom]);
  return (
    <>
      {clusters.map((c) =>
        c.members.length === 1 && c.members[0] ? (
          <ProjectDot key={c.key} item={c.members[0]} onPopup={onPopup} fetchedAt={fetchedAt} />
        ) : (
          <CountBubble key={c.key} cluster={c} />
        ),
      )}
    </>
  );
}

interface View {
  readonly bounds: google.maps.LatLngBounds;
  readonly zoom: number;
}

/** The map's bounds and zoom, updated only when the map stops moving (never on every animation frame). */
function useView(): View | null {
  const map = useMap();
  const [view, setView] = useState<View | null>(null);
  useEffect(() => {
    if (!map) return undefined;
    // 'idle' fires once the map is ready and after every move, so it also gives the first view.
    const l = map.addListener('idle', () => {
      const bounds = map.getBounds();
      const zoom = map.getZoom();
      setView(bounds && zoom !== undefined ? { bounds, zoom: Math.round(zoom) } : null);
    });
    return () => {
      l.remove();
    };
  }, [map]);
  return view;
}

/** About 150 m around the view, so shapes don't pop in at the edges. */
function inView(bounds: google.maps.LatLngBounds, [lat, lng]: LatLng): boolean {
  const ne = bounds.getNorthEast();
  const sw = bounds.getSouthWest();
  const m = 0.0015;
  return lat >= sw.lat() - m && lat <= ne.lat() + m && lng >= sw.lng() - m && lng <= ne.lng() + m;
}

export interface ConstructionLayerProps {
  readonly data: ConstructionData;
  readonly time: number;
  readonly hidden: ReadonlySet<Layer>;
  readonly onPopup: OpenPopup;
}

/**
 * City construction projects at the selected time: counted per area when zoomed out; outlines and noise zones when
 * close.
 */
export function ConstructionLayer({ data, time, hidden, onPopup }: ConstructionLayerProps) {
  const shown = useMemo(
    () => projectsAt(data, time).filter((s) => !hidden.has(s.layer)),
    [data, time, hidden],
  );
  const view = useView();
  const visible = useMemo(
    () => (view === null ? [] : shown.filter((s) => inView(view.bounds, s.project.position))),
    [view, shown],
  );
  if (view === null) return null;
  if (view.zoom < DETAIL_ZOOM || visible.length > MAX_SHAPES) {
    return <Counts items={visible} zoom={view.zoom} onPopup={onPopup} fetchedAt={data.fetchedAt} />;
  }
  return (
    <>
      {visible.map((s) => (
        <ProjectShape key={s.project.id} item={s} time={time} onPopup={onPopup} fetchedAt={data.fetchedAt} />
      ))}
    </>
  );
}
