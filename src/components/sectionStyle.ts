import type { PathOptions } from 'leaflet';
import type { WorksStatus } from '../data/schema.ts';

/**
 * Style of a section's colored line for its status.
 *
 * react-leaflet updates a path with Leaflet's `setStyle`, which merges options into the old ones. Every style
 * therefore sets `dashArray` explicitly (`undefined` = solid), or a line that was dashed stays dashed after it
 * opens.
 */
export function sectionLineStyle(status: WorksStatus, weight: number): PathOptions {
  switch (status) {
    case 'open':
      return { opacity: 1, weight, dashArray: undefined };
    case 'none':
      return { opacity: 0.45, weight: weight - 1, dashArray: '2 9' };
    case 'minor':
    case 'major':
      return { opacity: 1, weight, dashArray: '10 7' };
  }
}

/** Map pane of a section's line. A Leaflet path can't change pane, so the layer must be recreated on change. */
export function sectionPane(status: WorksStatus): 'future' | 'lines' {
  return status === 'none' ? 'future' : 'lines';
}
