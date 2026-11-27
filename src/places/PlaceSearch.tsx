import { useMapsLibrary } from '@vis.gl/react-google-maps';
import { useEffect, useRef } from 'react';
import { placeFromGoogle } from './google.ts';
import type { NewPlace } from './types.ts';

/** Gush Dan, to rank nearby results first. */
const BIAS = { north: 32.25, south: 31.9, east: 35.0, west: 34.65 };

/**
 * Google's place search box (Place Autocomplete element). Calls `onPick` with the chosen place, which is then shown
 * on the map to be saved.
 */
export function PlaceSearch({
  onPick,
  onError,
}: {
  onPick: (place: NewPlace) => void;
  onError: (message: string) => void;
}) {
  const places = useMapsLibrary('places');
  const host = useRef<HTMLDivElement>(null);
  // The element is created once; keep the handlers current.
  const handlers = useRef({ onPick, onError });
  useEffect(() => {
    handlers.current = { onPick, onError };
  }, [onPick, onError]);

  useEffect(() => {
    const parent = host.current;
    if (places === null || parent === null) return;
    const el = new places.PlaceAutocompleteElement({
      includedRegionCodes: ['il'],
      locationBias: BIAS,
      requestedLanguage: 'he',
      placeholder: 'חיפוש מקום לסימון…',
    });
    const onSelect = (e: google.maps.places.PlacePredictionSelectEvent) => {
      placeFromGoogle(e.placePrediction.toPlace())
        .then((p) => {
          if (p === null) handlers.current.onError('למקום הזה אין מיקום על המפה');
          else handlers.current.onPick(p);
        })
        .catch((err: unknown) => {
          handlers.current.onError(err instanceof Error ? err.message : String(err));
        });
    };
    el.addEventListener('gmp-select', onSelect);
    parent.append(el);
    return () => {
      el.removeEventListener('gmp-select', onSelect);
      el.remove();
    };
  }, [places]);

  return <div className="place-search" ref={host} role="search" aria-label="חיפוש מקום" />;
}
