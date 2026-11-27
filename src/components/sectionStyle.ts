import type { WorksStatus } from '../data/schema.ts';

/** A repeated symbol along a Google Maps polyline (structurally `google.maps.IconSequence`). */
export interface LineIcon {
  readonly icon: {
    readonly path: string;
    readonly scale: number;
    readonly strokeOpacity: number;
    readonly strokeWeight: number;
    readonly fillOpacity: number;
    readonly fillColor?: string;
  };
  readonly offset: string;
  readonly repeat: string;
}

export interface LineStyle {
  readonly strokeOpacity: number;
  readonly strokeWeight: number;
  readonly icons: LineIcon[];
}

/** A vertical segment from -1 to 1: scaled to a dash. */
const DASH = 'M 0,-1 0,1';
/** A unit circle: scaled to a dot. */
const DOT = 'M 0,0 m -1,0 a 1,1 0 1,0 2,0 a 1,1 0 1,0 -2,0';

/**
 * Style of a section's colored line for its status. Google Maps has no dash pattern for polylines, so dashed and
 * dotted lines are a transparent stroke with repeated symbols.
 *
 * Polylines are updated with `setOptions`, which merges options into the old ones. Every style therefore sets
 * `icons` explicitly (`[]` = solid), or a line that was dashed stays dashed after it opens.
 */
export function sectionLineStyle(status: WorksStatus, weight: number, color: string): LineStyle {
  switch (status) {
    case 'open':
      return { strokeOpacity: 1, strokeWeight: weight, icons: [] };
    case 'none':
      return {
        strokeOpacity: 0,
        strokeWeight: weight - 1,
        icons: [
          {
            icon: {
              path: DOT,
              scale: (weight - 1) / 2,
              strokeOpacity: 0,
              strokeWeight: 0,
              fillOpacity: 0.45,
              fillColor: color,
            },
            offset: '0',
            repeat: `${String(weight + 6)}px`,
          },
        ],
      };
    case 'minor':
    case 'major':
      return {
        strokeOpacity: 0,
        strokeWeight: weight,
        icons: [
          {
            icon: { path: DASH, scale: 5, strokeOpacity: 1, strokeWeight: weight, fillOpacity: 0 },
            offset: '0',
            repeat: '17px',
          },
        ],
      };
  }
}

/** Stacking order of the map's layers (higher is on top). */
export const Z = {
  rail: 1,
  zoneOuter: 2,
  zoneInner: 3,
  future: 4,
  casing: 5,
  line: 6,
} as const;

/** Planned lines are drawn under the lines in works or open. */
export function sectionZ(status: WorksStatus): { casing: number; line: number } {
  return status === 'none' ? { casing: Z.future, line: Z.future } : { casing: Z.casing, line: Z.line };
}
