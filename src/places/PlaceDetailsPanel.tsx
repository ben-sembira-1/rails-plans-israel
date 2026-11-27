import { useMapsLibrary } from '@vis.gl/react-google-maps';
import { useEffect, useRef } from 'react';

/**
 * Google's own view of a place (photos, opening hours, rating, reviews, website…) in a panel beside the map, via
 * the Places UI Kit's Place Details element.
 */
export function PlaceDetailsPanel({
  googlePlaceId,
  name,
  onClose,
}: {
  googlePlaceId: string;
  name: string;
  onClose: () => void;
}) {
  const places = useMapsLibrary('places');
  const host = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const parent = host.current;
    if (places === null || parent === null) return;
    const details = new places.PlaceDetailsElement();
    details.append(
      new places.PlaceDetailsPlaceRequestElement({ place: googlePlaceId }),
      new places.PlaceAllContentElement(),
    );
    parent.append(details);
    return () => {
      details.remove();
    };
  }, [places, googlePlaceId]);

  return (
    <aside className="details-panel" aria-label={`פרטים מגוגל: ${name}`}>
      <div className="details-head">
        <b dir="auto">{name}</b>
        <button type="button" className="btn small" aria-label="סגירת הפרטים" onClick={onClose}>
          ✕
        </button>
      </div>
      <div className="details-body" ref={host}>
        {places === null && <p className="muted">טוען…</p>}
      </div>
    </aside>
  );
}
