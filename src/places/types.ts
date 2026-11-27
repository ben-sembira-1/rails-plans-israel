/** A place of interest a user saved from the map search. */
export interface SavedPlace {
  readonly id: string;
  /** Google place ID, used for the Google details panel. */
  readonly googlePlaceId: string;
  readonly name: string;
  readonly address: string;
  readonly lat: number;
  readonly lng: number;
  readonly createdAt: Date | null;
}

export type NewPlace = Omit<SavedPlace, 'id' | 'createdAt'>;

export interface PlaceComment {
  readonly id: string;
  readonly text: string;
  readonly createdAt: Date | null;
}

export const MAX_COMMENT_LENGTH = 2000;

type Unsubscribe = () => void;
type OnError = (message: string) => void;

/** Per-user storage of places and their comments (Firestore when signed in, memory in local development). */
export interface PlacesStore {
  /** Calls `onChange` with all places, newest first, now and on every change. */
  watchPlaces(onChange: (places: readonly SavedPlace[]) => void, onError: OnError): Unsubscribe;
  addPlace(place: NewPlace): Promise<string>;
  /** Removes the place and its comments. */
  removePlace(id: string): Promise<void>;
  /** Calls `onChange` with the place's comments, oldest first. */
  watchComments(
    placeId: string,
    onChange: (comments: readonly PlaceComment[]) => void,
    onError: OnError,
  ): Unsubscribe;
  addComment(placeId: string, text: string): Promise<void>;
  removeComment(placeId: string, commentId: string): Promise<void>;
}

function finite(v: unknown): v is number {
  return typeof v === 'number' && Number.isFinite(v);
}

/** Validates a stored place document; `null` if it is malformed. */
export function parsePlace(
  id: string,
  data: Record<string, unknown>,
  createdAt: Date | null,
): SavedPlace | null {
  const { googlePlaceId, name, address, lat, lng } = data;
  if (typeof googlePlaceId !== 'string' || typeof name !== 'string' || !finite(lat) || !finite(lng))
    return null;
  return {
    id,
    googlePlaceId,
    name,
    address: typeof address === 'string' ? address : '',
    lat,
    lng,
    createdAt,
  };
}

/** Trims a comment; `null` if it is empty or too long. */
export function cleanComment(text: string): string | null {
  const t = text.trim();
  return t === '' || t.length > MAX_COMMENT_LENGTH ? null : t;
}
