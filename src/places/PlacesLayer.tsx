import { AdvancedMarker, InfoWindow, Pin, useMap } from '@vis.gl/react-google-maps';
import { useEffect } from 'react';
import type { NewPlace, SavedPlace } from './types.ts';

const STAR_ZOOM = 16;

/** Saved places (and the place being added) as pins on the map; the open card shows in an info window. */
export function PlacesLayer({
  places,
  candidate,
  selectedId,
  onSelect,
  card,
  onCloseCard,
}: {
  places: readonly SavedPlace[];
  candidate: NewPlace | null;
  selectedId: string | null;
  onSelect: (id: string) => void;
  /** The card of the selected place or the candidate. */
  card: React.ReactNode;
  onCloseCard: () => void;
}) {
  const map = useMap();
  const selected = places.find((p) => p.id === selectedId) ?? null;
  const focus = candidate ?? selected;

  // Bring the place in focus into view when it changes (by position, not on every render).
  const lat = focus?.lat;
  const lng = focus?.lng;
  useEffect(() => {
    if (map === null || lat === undefined || lng === undefined) return;
    map.panTo({ lat, lng });
    if ((map.getZoom() ?? 0) < STAR_ZOOM) map.setZoom(STAR_ZOOM);
  }, [map, lat, lng]);

  return (
    <>
      {places.map((p) => (
        <AdvancedMarker
          key={p.id}
          position={{ lat: p.lat, lng: p.lng }}
          title={p.name}
          zIndex={p.id === selectedId ? 1000 : 900}
          onClick={() => {
            onSelect(p.id);
          }}
        >
          <Pin background="#7b2ff7" borderColor="#4b1aa0" glyphColor="#fff" glyphText="★" />
        </AdvancedMarker>
      ))}
      {candidate && (
        <AdvancedMarker
          position={{ lat: candidate.lat, lng: candidate.lng }}
          title={candidate.name}
          zIndex={1001}
        >
          <Pin background="#e8590c" borderColor="#a33d05" glyphColor="#fff" />
        </AdvancedMarker>
      )}
      {focus && card !== null && (
        <InfoWindow
          position={{ lat: focus.lat, lng: focus.lng }}
          pixelOffset={[0, -40]}
          maxWidth={320}
          onClose={onCloseCard}
        >
          <div dir="rtl">{card}</div>
        </InfoWindow>
      )}
    </>
  );
}
