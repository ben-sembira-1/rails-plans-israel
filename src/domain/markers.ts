import { eventLabel, MILESTONES, milestoneAt } from './events.ts';
import { formatTime, nearestStepIndex, STEPS, TODAY } from './time.ts';

export type MarkerKind = 'milestone' | 'today' | 'event';

export interface Marker {
  readonly time: number;
  /** Milestones are bigger and labelled; "today" has its own style and label; other events are small dots. */
  readonly kind: MarkerKind;
  readonly label: string;
  /** Labelled markers alternate above/below the bar so neighbours don't overlap. */
  readonly side: 'above' | 'below' | null;
  /** Labels at the ends of the bar are anchored inwards so they don't overflow it. */
  readonly edge: 'start' | 'end' | null;
}

/** Position along the bar, 0..1, by step index (the slider moves by step, not by calendar time). */
export function markerPosition(t: number): number {
  return nearestStepIndex(t) / (STEPS.length - 1);
}

const EDGE = 0.08;

export function markersFor(events: readonly number[]): readonly Marker[] {
  const times = [...new Set([...events, TODAY, ...MILESTONES.map((m) => m.time)])].sort((a, b) => a - b);
  let labelled = 0;
  return times.map((time): Marker => {
    const m = milestoneAt(time);
    const kind: MarkerKind = m !== undefined ? 'milestone' : time === TODAY ? 'today' : 'event';
    if (kind === 'event') {
      return { time, kind, label: eventLabel(time) ?? formatTime(time), side: null, edge: null };
    }
    const label = m?.label ?? 'היום';
    const side = labelled % 2 === 0 ? 'above' : 'below';
    labelled++;
    const pos = markerPosition(time);
    const edge = pos < EDGE ? 'start' : pos > 1 - EDGE ? 'end' : null;
    return { time, kind, label, side, edge };
  });
}
