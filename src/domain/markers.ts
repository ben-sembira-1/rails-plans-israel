import { eventLabel, MILESTONES, milestoneAt } from './events.ts';
import { formatTime, nearestStepIndex, STEPS } from './time.ts';

export interface Marker {
  readonly time: number;
  /** Milestones are the main markers: bigger, and labelled on wide screens. */
  readonly main: boolean;
  readonly label: string;
  /** Main labels alternate above/below the bar so neighbouring milestones don't overlap. */
  readonly side: 'above' | 'below' | null;
}

/** Position along the bar, 0..1, by step index (the slider moves by step, not by calendar time). */
export function markerPosition(t: number): number {
  return nearestStepIndex(t) / (STEPS.length - 1);
}

export function markersFor(events: readonly number[]): readonly Marker[] {
  const times = [...new Set([...events, ...MILESTONES.map((m) => m.time)])].sort((a, b) => a - b);
  let mains = 0;
  return times.map((time): Marker => {
    const m = milestoneAt(time);
    const label = m?.label ?? eventLabel(time) ?? formatTime(time);
    if (m === undefined) return { time, main: false, label, side: null };
    const side = mains % 2 === 0 ? 'above' : 'below';
    mains++;
    return { time, main: true, label, side };
  });
}
