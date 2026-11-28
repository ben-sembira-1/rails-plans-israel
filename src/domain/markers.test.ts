import { describe, expect, it } from 'vitest';
import { MILESTONES } from './events.ts';
import {
  indexOfSlot,
  labelExtent,
  markerPosition,
  markersFor,
  overlap,
  slotOf,
  SLOT_COUNT,
  TRACK_PX,
} from './markers.ts';
import { NO_DATE, STEPS, TODAY } from './time.ts';

describe('markersFor', () => {
  const markers = markersFor([2024.25, TODAY, 2029]);

  it('has one "today" marker, labelled', () => {
    const today = markers.filter((m) => m.kind === 'today');
    expect(today).toEqual([expect.objectContaining({ time: TODAY, label: 'היום' })]);
  });

  it('adds "today" even when it is not a works event', () => {
    expect(markersFor([]).some((m) => m.kind === 'today')).toBe(true);
  });

  it('marks every milestone and puts every label above or below the bar', () => {
    const labelled = markers.filter((m) => m.kind !== 'event');
    expect(labelled.filter((m) => m.kind === 'milestone')).toHaveLength(MILESTONES.length);
    expect(labelled.every((m) => m.side === 'above' || m.side === 'below')).toBe(true);
    expect(labelled[0]?.side).toBe('above');
  });

  it.each([TRACK_PX, 300])('keeps labels on the same side apart (bar of %d px)', (px) => {
    const placed = markersFor([2024.25, TODAY, 2029], px).filter((m) => m.side !== null);
    for (const side of ['above', 'below'] as const) {
      const extents = placed
        .filter((m) => m.side === side)
        .map((m) => labelExtent(markerPosition(m.time), m.label, m.edge, px));
      for (let i = 1; i < extents.length; i++) {
        const cur = extents[i];
        if (cur) expect(overlap(extents[i - 1], cur)).toBe(0);
      }
    }
  });

  it('anchors the labels at the ends of the bar inwards', () => {
    expect(markers[0]?.edge).toBe('start');
    expect(markers.find((m) => m.time === NO_DATE)?.edge).toBe('end');
    expect(markers.find((m) => m.time === TODAY)?.edge).toBeNull();
    expect(markers.find((m) => m.time === 2029)).toMatchObject({ kind: 'event', side: null, edge: null });
  });
});

describe('the gap before "no date"', () => {
  const last = STEPS.length - 1;

  it('keeps the "no date" stop clear of the last year (12px circles, 8px apart on the desktop bar)', () => {
    const px = (markerPosition(NO_DATE) - markerPosition(STEPS[last - 1] ?? 0)) * TRACK_PX;
    expect(px).toBeGreaterThanOrEqual(12 + 8);
  });

  it('moves from the gap on to "no date" or back to the last year, the way the slider moved', () => {
    expect(indexOfSlot(slotOf(last - 1) + 1, last - 1)).toBe(last);
    expect(indexOfSlot(slotOf(last) - 1, last)).toBe(last - 1);
    expect(indexOfSlot(SLOT_COUNT, 0)).toBe(last);
    expect(indexOfSlot(3, 0)).toBe(3);
  });
});
