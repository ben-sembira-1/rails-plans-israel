import { useMapsLibrary } from '@vis.gl/react-google-maps';
import { useEffect, useRef, useState } from 'react';
import { SNAP_PX, useSheetDrag } from '../components/useSheetDrag.ts';

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

  // On a phone the panel is a bottom sheet: half or full height; dragging it down from half closes it.
  const [full, setFull] = useState(false);
  const { dy, handlers } = useSheetDrag(
    (d) => {
      if (d < -SNAP_PX) setFull(true);
      else if (d > SNAP_PX) {
        if (full) setFull(false);
        else onClose();
      }
    },
    () => {
      setFull((f) => !f);
    },
  );

  return (
    <aside
      className={`details-panel${full ? ' sheet-full' : ''}${dy !== 0 ? ' dragging' : ''}`}
      style={{ '--drag': `${String(dy)}px` } as React.CSSProperties}
      aria-label={`פרטים מגוגל: ${name}`}
    >
      <button
        type="button"
        className="sheet-handle"
        aria-label={full ? 'הקטנת הפרטים' : 'הגדלת הפרטים'}
        aria-expanded={full}
        {...handlers}
      >
        <span aria-hidden="true" />
      </button>
      <div className="details-head">
        <b dir="auto">{name}</b>
        <button type="button" className="icon-btn" aria-label="סגירת הפרטים" onClick={onClose}>
          ✕
        </button>
      </div>
      <div className="details-body" ref={host}>
        {places === null && <p className="muted">טוען…</p>}
      </div>
    </aside>
  );
}
