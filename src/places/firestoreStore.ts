import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  writeBatch,
  type Firestore,
  type Timestamp,
} from 'firebase/firestore';
import { cleanComment, parsePlace, type PlaceComment, type PlacesStore } from './types.ts';

/**
 * Firestore layout (enforced by firestore.rules; only the approved owner can read or write):
 *   users/{uid}/places/{placeId}                      – { googlePlaceId, name, address, lat, lng, createdAt }
 *   users/{uid}/places/{placeId}/comments/{commentId} – { text, createdAt }
 */
export function createFirestoreStore(db: Firestore, uid: string): PlacesStore {
  const places = collection(db, 'users', uid, 'places');
  const comments = (placeId: string) => collection(db, 'users', uid, 'places', placeId, 'comments');
  const date = (v: unknown) => (v as Timestamp | null | undefined)?.toDate() ?? null;

  return {
    watchPlaces(onChange, onError) {
      return onSnapshot(
        query(places, orderBy('createdAt', 'desc')),
        (snap) => {
          onChange(
            snap.docs.flatMap((d) => {
              const data = d.data({ serverTimestamps: 'estimate' });
              const p = parsePlace(d.id, data, date(data['createdAt']));
              return p === null ? [] : [p];
            }),
          );
        },
        (e) => {
          onError(e.message);
        },
      );
    },
    async addPlace({ googlePlaceId, name, address, lat, lng }) {
      const ref = await addDoc(places, {
        googlePlaceId,
        name,
        address,
        lat,
        lng,
        createdAt: serverTimestamp(),
      });
      return ref.id;
    },
    async removePlace(id) {
      const batch = writeBatch(db);
      for (const c of (await getDocs(comments(id))).docs) batch.delete(c.ref);
      batch.delete(doc(places, id));
      await batch.commit();
    },
    watchComments(placeId, onChange, onError) {
      return onSnapshot(
        query(comments(placeId), orderBy('createdAt', 'asc')),
        (snap) => {
          onChange(
            snap.docs.flatMap((d): PlaceComment[] => {
              const data = d.data({ serverTimestamps: 'estimate' });
              const text: unknown = data['text'];
              return typeof text === 'string' ? [{ id: d.id, text, createdAt: date(data['createdAt']) }] : [];
            }),
          );
        },
        (e) => {
          onError(e.message);
        },
      );
    },
    async addComment(placeId, text) {
      const clean = cleanComment(text);
      if (clean === null) throw new Error('הערה ריקה או ארוכה מדי');
      await addDoc(comments(placeId), { text: clean, createdAt: serverTimestamp() });
    },
    async removeComment(placeId, commentId) {
      await deleteDoc(doc(comments(placeId), commentId));
    },
  };
}
