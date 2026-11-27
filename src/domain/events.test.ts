import { NETWORK } from '../data/network.ts';
import { eventLabel, MILESTONES, worksEvents } from './events.ts';
import { NO_DATE, STEPS, TODAY } from './time.ts';

describe('worksEvents', () => {
  const events = worksEvents(NETWORK.sections, NETWORK.sites);

  it('includes today, the openings and the metro works changes', () => {
    for (const t of [TODAY, 2024.5, 2028.25, 2028.75, 2029, 2030, 2034, 2037, NO_DATE]) {
      expect(events).toContain(t);
    }
  });

  it('is sorted, unique and on the timeline grid', () => {
    expect([...events].sort((a, b) => a - b)).toEqual(events);
    expect(new Set(events).size).toBe(events.length);
    for (const t of events) expect(STEPS).toContain(t);
  });

  it('has a label for every event', () => {
    for (const t of events) expect(eventLabel(t)).toBeDefined();
  });
});

describe('MILESTONES', () => {
  it('are on the timeline grid and end with the full network', () => {
    for (const m of MILESTONES) expect(STEPS).toContain(m.time);
    expect(MILESTONES.at(-1)?.time).toBe(NO_DATE);
  });
});
