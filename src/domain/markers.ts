import { eventLabel, MILESTONES, milestoneAt } from './events.ts';
import { formatTime, nearestStepIndex, STEPS, TODAY } from './time.ts';

export type MarkerKind = 'milestone' | 'today' | 'event';

export interface Marker {
  readonly time: number;
  /** Milestones are bigger and labelled; "today" has its own style and label; other events are small stops. */
  readonly kind: MarkerKind;
  readonly label: string;
  /** Which side of the bar the label sits on, chosen so that labels on the same side don't overlap. */
  readonly side: 'above' | 'below' | null;
  /** Labels at the ends of the bar are anchored inwards so they don't overflow it. */
  readonly edge: 'start' | 'end' | null;
}

/**
 * "No date" isn't a point in time, so the bar leaves a gap before it, as an axis break: this many extra steps. It
 * also keeps its stop clear of the last year's (they were about 9px apart).
 */
export const NO_DATE_GAP = 2;
const LAST_INDEX = STEPS.length - 1;
/** The slider's range: one unit per step, plus the gap before "no date". */
export const SLOT_COUNT = LAST_INDEX + NO_DATE_GAP;

/** A step's place on the bar, in slider units. */
export function slotOf(index: number): number {
  return index >= LAST_INDEX ? SLOT_COUNT : index;
}

/**
 * The step for a slider value. A value in the gap before "no date" goes on in the direction it moved from the
 * current step: on to "no date", or back to the last year.
 */
export function indexOfSlot(slot: number, currentIndex: number): number {
  if (slot < LAST_INDEX) return Math.max(0, slot);
  if (slot >= SLOT_COUNT) return LAST_INDEX;
  return slot > slotOf(currentIndex) ? LAST_INDEX : LAST_INDEX - 1;
}

/** Position along the bar, 0..1, by step (the slider moves by step, not by calendar time). */
export function markerPosition(t: number): number {
  return slotOf(nearestStepIndex(t)) / SLOT_COUNT;
}

const EDGE = 0.08;
/** The desktop bar's width in pixels, for the label layout. */
export const TRACK_PX = 340;
/** Space kept between two labels on the same side. */
const LABEL_GAP_PX = 8;
/** Width of a label's character at the bar's label size (12px): a generous estimate. */
const CHAR_PX = 6.6;

/** The pixel extent of a label along the bar, measured from the bar's start. */
export function labelExtent(
  pos: number,
  label: string,
  edge: Marker['edge'],
  trackPx: number = TRACK_PX,
): readonly [number, number] {
  const x = pos * trackPx;
  const w = label.length * CHAR_PX;
  if (edge === 'start') return [x - 6, x - 6 + w];
  if (edge === 'end') return [x + 6 - w, x + 6];
  return [x - w / 2, x + w / 2];
}

/** How much two extents overlap, counting the gap kept between labels (0 = clear). */
export function overlap(a: readonly [number, number] | undefined, b: readonly [number, number]): number {
  if (a === undefined) return 0;
  return Math.max(0, Math.min(a[1], b[1]) - Math.max(a[0], b[0]) + LABEL_GAP_PX);
}

/**
 * Every event as a marker. Labelled markers (milestones and today) alternate above and below the bar, but a label
 * that would overlap the previous label on its side moves to the other side (or to the side where it overlaps
 * least).
 */
export function markersFor(events: readonly number[], trackPx: number = TRACK_PX): readonly Marker[] {
  const times = [...new Set([...events, TODAY, ...MILESTONES.map((m) => m.time)])].sort((a, b) => a - b);
  const last: Record<'above' | 'below', readonly [number, number] | undefined> = {
    above: undefined,
    below: undefined,
  };
  let preferred: 'above' | 'below' = 'above';
  return times.map((time): Marker => {
    const m = milestoneAt(time);
    const kind: MarkerKind = m !== undefined ? 'milestone' : time === TODAY ? 'today' : 'event';
    if (kind === 'event') {
      return { time, kind, label: eventLabel(time) ?? formatTime(time), side: null, edge: null };
    }
    const label = m?.label ?? 'היום';
    const pos = markerPosition(time);
    const edge = pos < EDGE ? 'start' : pos > 1 - EDGE ? 'end' : null;
    const extent = labelExtent(pos, label, edge, trackPx);
    const other = preferred === 'above' ? 'below' : 'above';
    const side = overlap(last[preferred], extent) <= overlap(last[other], extent) ? preferred : other;
    last[side] = extent;
    preferred = side === 'above' ? 'below' : 'above';
    return { time, kind, label, side, edge };
  });
}
