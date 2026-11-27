import { describe, expect, it } from 'vitest';
import { MILESTONES } from './events.ts';
import { markersFor } from './markers.ts';
import { NO_DATE, TODAY } from './time.ts';

describe('markersFor', () => {
  const markers = markersFor([2024.25, TODAY, 2029]);

  it('has one "today" marker, labelled', () => {
    const today = markers.filter((m) => m.kind === 'today');
    expect(today).toEqual([expect.objectContaining({ time: TODAY, label: 'היום' })]);
  });

  it('adds "today" even when it is not a works event', () => {
    expect(markersFor([]).some((m) => m.kind === 'today')).toBe(true);
  });

  it('marks every milestone and alternates the labels above and below', () => {
    const labelled = markers.filter((m) => m.kind !== 'event');
    expect(labelled.filter((m) => m.kind === 'milestone')).toHaveLength(MILESTONES.length);
    labelled.forEach((m, i) => {
      expect(m.side).toBe(i % 2 === 0 ? 'above' : 'below');
    });
  });

  it('anchors the labels at the ends of the bar inwards', () => {
    expect(markers[0]?.edge).toBe('start');
    expect(markers.find((m) => m.time === NO_DATE)?.edge).toBe('end');
    expect(markers.find((m) => m.time === TODAY)?.edge).toBeNull();
    expect(markers.find((m) => m.time === 2029)).toMatchObject({ kind: 'event', side: null, edge: null });
  });
});
