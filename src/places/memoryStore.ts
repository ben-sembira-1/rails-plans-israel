import {
  cleanComment,
  type NewPlace,
  type PlaceComment,
  type PlacesStore,
  type SavedPlace,
} from './types.ts';

/** An in-memory store: local development without Firebase, and tests. Nothing is persisted. */
export function createMemoryStore(initial: readonly SavedPlace[] = []): PlacesStore {
  let places = [...initial];
  const comments = new Map<string, PlaceComment[]>();
  const placeWatchers = new Set<(p: readonly SavedPlace[]) => void>();
  const commentWatchers = new Map<string, Set<(c: readonly PlaceComment[]) => void>>();
  let seq = 0;
  const nextId = () => `local-${String(++seq)}`;

  const emitPlaces = () => {
    for (const w of placeWatchers) w(places);
  };
  const emitComments = (placeId: string) => {
    const list = comments.get(placeId) ?? [];
    for (const w of commentWatchers.get(placeId) ?? []) w(list);
  };

  return {
    watchPlaces(onChange) {
      placeWatchers.add(onChange);
      onChange(places);
      return () => {
        placeWatchers.delete(onChange);
      };
    },
    addPlace(place: NewPlace) {
      const id = nextId();
      places = [{ ...place, id, createdAt: new Date() }, ...places];
      emitPlaces();
      return Promise.resolve(id);
    },
    removePlace(id) {
      places = places.filter((p) => p.id !== id);
      comments.delete(id);
      emitPlaces();
      emitComments(id);
      return Promise.resolve();
    },
    watchComments(placeId, onChange) {
      const set = commentWatchers.get(placeId) ?? new Set();
      commentWatchers.set(placeId, set);
      set.add(onChange);
      onChange(comments.get(placeId) ?? []);
      return () => {
        set.delete(onChange);
      };
    },
    addComment(placeId, text) {
      const clean = cleanComment(text);
      if (clean === null) return Promise.reject(new Error('הערה ריקה או ארוכה מדי'));
      comments.set(placeId, [
        ...(comments.get(placeId) ?? []),
        { id: nextId(), text: clean, createdAt: new Date() },
      ]);
      emitComments(placeId);
      return Promise.resolve();
    },
    removeComment(placeId, commentId) {
      comments.set(
        placeId,
        (comments.get(placeId) ?? []).filter((c) => c.id !== commentId),
      );
      emitComments(placeId);
      return Promise.resolve();
    },
  };
}
