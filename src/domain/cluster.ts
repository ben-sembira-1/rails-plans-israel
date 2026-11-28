import type { LatLng } from '../data/validate.ts';

/** Google's world is 256 px wide at zoom 0 and doubles with each zoom level (Web Mercator). */
const TILE = 256;

/** Screen size of a grid cell: projects closer than this are counted together. */
export const CELL_PX = 72;

/** A point's position in world pixels at `zoom`. */
export function worldPx([lat, lng]: LatLng, zoom: number): { x: number; y: number } {
  const size = TILE * 2 ** zoom;
  const s = Math.min(Math.max(Math.sin((lat * Math.PI) / 180), -0.9999), 0.9999);
  return {
    x: ((lng + 180) / 360) * size,
    y: (0.5 - Math.log((1 + s) / (1 - s)) / (4 * Math.PI)) * size,
  };
}

export interface Cluster<T> {
  /** The grid cell, stable while the map pans (the grid is fixed to the world, not to the view). */
  readonly key: string;
  /** The mean position of the members. */
  readonly position: LatLng;
  readonly members: readonly T[];
  /** The members' extent: [[south, west], [north, east]]. */
  readonly bounds: readonly [LatLng, LatLng];
}

/**
 * Groups items into square grid cells of `cellPx` screen pixels at `zoom`: one cluster per non-empty cell, in the
 * order the cells are first met.
 */
export function clusterByGrid<T>(
  items: readonly T[],
  position: (item: T) => LatLng,
  zoom: number,
  cellPx: number = CELL_PX,
): Cluster<T>[] {
  const cells = new Map<string, T[]>();
  for (const item of items) {
    const { x, y } = worldPx(position(item), zoom);
    const key = `${String(Math.floor(x / cellPx))}:${String(Math.floor(y / cellPx))}`;
    const members = cells.get(key);
    if (members) members.push(item);
    else cells.set(key, [item]);
  }
  return [...cells].map(([key, members]) => {
    let lat = 0;
    let lng = 0;
    let south = Infinity;
    let west = Infinity;
    let north = -Infinity;
    let east = -Infinity;
    for (const m of members) {
      const [la, ln] = position(m);
      lat += la;
      lng += ln;
      south = Math.min(south, la);
      north = Math.max(north, la);
      west = Math.min(west, ln);
      east = Math.max(east, ln);
    }
    return {
      key,
      position: [lat / members.length, lng / members.length],
      members,
      bounds: [
        [south, west],
        [north, east],
      ],
    };
  });
}
