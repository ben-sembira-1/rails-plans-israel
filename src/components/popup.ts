/** A popup anchored at a map position. */
export interface Popup {
  readonly position: google.maps.LatLngLiteral;
  readonly content: React.ReactNode;
}

export type OpenPopup = (popup: Popup) => void;

export function clickPosition(e: google.maps.MapMouseEvent): google.maps.LatLngLiteral | null {
  return e.latLng?.toJSON() ?? null;
}
