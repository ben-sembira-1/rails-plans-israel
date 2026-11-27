import type { ProjectStatus } from '../data/construction.ts';
import type { ConstructionLayer } from '../domain/construction.ts';

/** Brown for building works and gray-teal for roads: apart from the orange and yellow rail work zones. */
export const LAYER_COLOR: Readonly<Record<ConstructionLayer, string>> = {
  construction: '#8D4A1F',
  permitted: '#8D4A1F',
  requested: '#80868B',
  road: '#00796B',
};

/** [high-noise band (to 20 m), low-noise band (20–50 m)]. */
export const NOISE_COLORS = ['#A0522D', '#E3B58C'] as const;

export const STATUS_TEXT: Readonly<Record<ProjectStatus, string>> = {
  requested: 'בקשה להיתר',
  permitted: 'היתר בנייה',
  construction: 'עבודות',
};

/** Outlines and road works are drawn from this zoom; below it, every project is a dot. */
export const DETAIL_ZOOM = 15;
/** More shapes than this in view fall back to dots, to keep the map smooth. */
export const MAX_SHAPES = 600;
