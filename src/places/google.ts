import type { NewPlace } from './types.ts';

/** Loads the fields we store for a Google place. */
export async function placeFromGoogle(place: google.maps.places.Place): Promise<NewPlace | null> {
  await place.fetchFields({ fields: ['id', 'displayName', 'formattedAddress', 'location'] });
  const location = place.location;
  if (location === null || location === undefined) return null;
  return {
    googlePlaceId: place.id,
    name: place.displayName ?? place.formattedAddress ?? 'מקום',
    address: place.formattedAddress ?? '',
    lat: location.lat(),
    lng: location.lng(),
  };
}
