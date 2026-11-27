import { Polygon, Polyline, useMap } from '@vis.gl/react-google-maps';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { clickPosition, type OpenPopup } from '../components/popup.ts';
import { Z } from '../components/sectionStyle.ts';
import type { ConstructionData, Project } from '../data/construction.ts';
import type { LatLng } from '../data/validate.ts';
import { projectsAt, type ConstructionLayer as Layer, type ShownProject } from '../domain/construction.ts';
import { areaBufferRings } from '../domain/geo.ts';
import { SITE_HIGH_NOISE_M, SITE_LOW_NOISE_M } from '../domain/zones.ts';
import { ProjectPopup } from './ProjectPopup.tsx';
import { DETAIL_ZOOM, LAYER_COLOR, MAX_SHAPES, NOISE_COLORS } from './style.ts';

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

function ProjectShape({
  item,
  onPopup,
  fetchedAt,
}: {
  item: ShownProject;
  onPopup: OpenPopup;
  fetchedAt: string;
}) {
  const { project: p, layer } = item;
  const paths = useMemo(() => p.shapes.map((s) => s.map(toLatLng)), [p]);
  const onClick = useCallback(
    (e: google.maps.MapMouseEvent) => {
      onPopup({
        position: clickPosition(e) ?? toLatLng(p.position),
        content: <ProjectPopup project={p} fetchedAt={fetchedAt} />,
      });
    },
    [p, fetchedAt, onPopup],
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
  return (
    <>
      {building && <NoiseZones project={p} onClick={onClick} />}
      <Polygon
        paths={paths}
        strokeColor={color}
        strokeOpacity={building ? 1 : 0.9}
        strokeWeight={building ? 1.5 : layer === 'permitted' ? 2 : 1}
        fillColor={building ? NOISE_COLORS[0] : '#ffffff'}
        fillOpacity={building ? 0.75 : 0.35}
        zIndex={Z.future}
        clickable
        onClick={onClick}
      />
    </>
  );
}

const DOT_SCALE: Readonly<Record<Layer, number>> = {
  construction: 4,
  permitted: 3.5,
  requested: 2.5,
  road: 4,
};

/** Below the detail zoom: one `google.maps.Data` layer of dots, which stays fast with thousands of projects. */
function Dots({
  items,
  onPopup,
  fetchedAt,
}: {
  items: readonly ShownProject[];
  onPopup: OpenPopup;
  fetchedAt: string;
}) {
  const map = useMap();
  useEffect(() => {
    if (!map) return undefined;
    const byId = new Map(items.map((s) => [s.project.id, s]));
    const data = new google.maps.Data({ map });
    for (const s of items) {
      data.add(
        new google.maps.Data.Feature({
          id: s.project.id,
          geometry: new google.maps.Data.Point(toLatLng(s.project.position)),
          properties: { layer: s.layer },
        }),
      );
    }
    data.setStyle((f) => {
      const layer = f.getProperty('layer') as Layer;
      const hollow = layer === 'permitted' || layer === 'requested';
      return {
        icon: {
          path: google.maps.SymbolPath.CIRCLE,
          scale: DOT_SCALE[layer],
          fillColor: hollow ? '#ffffff' : LAYER_COLOR[layer],
          fillOpacity: 1,
          strokeColor: hollow ? LAYER_COLOR[layer] : '#ffffff',
          strokeWeight: hollow ? 1.5 : 1,
        },
        zIndex: layer === 'requested' ? 1 : 2,
      };
    });
    const click = data.addListener('click', (e: google.maps.Data.MouseEvent) => {
      const s = byId.get(String(e.feature.getId()));
      if (!s) return;
      onPopup({
        position: e.latLng?.toJSON() ?? toLatLng(s.project.position),
        content: <ProjectPopup project={s.project} fetchedAt={fetchedAt} />,
      });
    });
    return () => {
      click.remove();
      data.setMap(null);
    };
  }, [map, items, onPopup, fetchedAt]);
  return null;
}

/** The map's bounds, updated whenever the map stops moving. */
function useBounds(): google.maps.LatLngBounds | null {
  const map = useMap();
  const [bounds, setBounds] = useState<google.maps.LatLngBounds | null>(null);
  useEffect(() => {
    if (!map) return undefined;
    // 'idle' fires once the map is ready and after every move, so it also gives the first bounds.
    const l = map.addListener('idle', () => {
      setBounds(map.getBounds() ?? null);
    });
    return () => {
      l.remove();
    };
  }, [map]);
  return bounds;
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
  readonly zoom: number;
  readonly onPopup: OpenPopup;
}

/** City construction projects at the selected time: dots when zoomed out; outlines and noise zones when close. */
export function ConstructionLayer({ data, time, hidden, zoom, onPopup }: ConstructionLayerProps) {
  const shown = useMemo(
    () => projectsAt(data, time).filter((s) => !hidden.has(s.layer)),
    [data, time, hidden],
  );
  const bounds = useBounds();
  const visible = useMemo(
    () => (bounds === null ? [] : shown.filter((s) => inView(bounds, s.project.position))),
    [bounds, shown],
  );
  const detailed = zoom >= DETAIL_ZOOM && bounds !== null && visible.length <= MAX_SHAPES;
  if (!detailed) return <Dots items={shown} onPopup={onPopup} fetchedAt={data.fetchedAt} />;
  return (
    <>
      {visible.map((s) => (
        <ProjectShape key={s.project.id} item={s} onPopup={onPopup} fetchedAt={data.fetchedAt} />
      ))}
    </>
  );
}
