import { useEffect, useState } from 'react';
import type { PlaceComment, PlacesStore, SavedPlace } from './types.ts';

export interface Loaded<T> {
  readonly items: readonly T[];
  readonly error: string | null;
}

/** All the user's places, live. */
export function usePlaces(store: PlacesStore | null): Loaded<SavedPlace> {
  const [state, setState] = useState<Loaded<SavedPlace>>({ items: [], error: null });
  useEffect(() => {
    if (store === null) return;
    return store.watchPlaces(
      (items) => {
        setState({ items, error: null });
      },
      (error) => {
        setState((s) => ({ ...s, error }));
      },
    );
  }, [store]);
  return state;
}

/** A place's comments, live. */
export function useComments(store: PlacesStore, placeId: string): Loaded<PlaceComment> {
  const [state, setState] = useState<Loaded<PlaceComment>>({ items: [], error: null });
  useEffect(() => {
    return store.watchComments(
      placeId,
      (items) => {
        setState({ items, error: null });
      },
      (error) => {
        setState((s) => ({ ...s, error }));
      },
    );
  }, [store, placeId]);
  return state;
}
