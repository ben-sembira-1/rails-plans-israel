import { describe, expect, it, vi } from 'vitest';
import { createMemoryStore } from './memoryStore.ts';
import { cleanComment, MAX_COMMENT_LENGTH, parsePlace } from './types.ts';

const cafe = { googlePlaceId: 'g1', name: 'Café', address: 'Dizengoff 1', lat: 32.08, lng: 34.77 };

describe('parsePlace', () => {
  it('accepts a valid document', () => {
    expect(parsePlace('p1', { ...cafe }, null)).toEqual({ id: 'p1', ...cafe, createdAt: null });
  });

  it('rejects documents without a place ID or a valid position', () => {
    expect(parsePlace('p', { ...cafe, googlePlaceId: 3 }, null)).toBeNull();
    expect(parsePlace('p', { ...cafe, lat: Number.NaN }, null)).toBeNull();
    expect(parsePlace('p', { ...cafe, lng: '34' }, null)).toBeNull();
  });

  it('defaults a missing address to empty', () => {
    expect(parsePlace('p', { ...cafe, address: undefined }, null)?.address).toBe('');
  });
});

describe('cleanComment', () => {
  it('trims and rejects empty or too long comments', () => {
    expect(cleanComment('  nice  ')).toBe('nice');
    expect(cleanComment('   ')).toBeNull();
    expect(cleanComment('x'.repeat(MAX_COMMENT_LENGTH + 1))).toBeNull();
  });
});

describe('memory store', () => {
  it('adds places newest first and notifies watchers', async () => {
    const store = createMemoryStore();
    const seen = vi.fn();
    const stop = store.watchPlaces(seen, vi.fn());
    expect(seen).toHaveBeenLastCalledWith([]);
    await store.addPlace(cafe);
    await store.addPlace({ ...cafe, googlePlaceId: 'g2', name: 'Park' });
    expect(seen.mock.lastCall?.[0]).toMatchObject([{ name: 'Park' }, { name: 'Café' }]);
    stop();
    await store.addPlace(cafe);
    expect(seen).toHaveBeenCalledTimes(3);
  });

  it('keeps comments per place and removes them with the place', async () => {
    const store = createMemoryStore();
    const id = await store.addPlace(cafe);
    const seen = vi.fn();
    store.watchComments(id, seen, vi.fn());
    await store.addComment(id, ' good coffee ');
    expect(seen.mock.lastCall?.[0]).toMatchObject([{ text: 'good coffee' }]);
    await expect(store.addComment(id, ' ')).rejects.toThrow();
    await store.removePlace(id);
    expect(seen).toHaveBeenLastCalledWith([]);
  });
});
