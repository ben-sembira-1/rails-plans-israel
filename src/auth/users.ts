import type { User } from 'firebase/auth';
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  type Timestamp,
  type Unsubscribe,
} from 'firebase/firestore';
import type { FirebaseServices } from './firebase.ts';

/**
 * Firestore layout (enforced by firestore.rules):
 *   users/{uid}    – { email, displayName, approved, requestedAt, timelinePosition? }
 *   config/access  – { adminEmails: string[] }  (readable by admins only; edited in the Firebase console)
 */

export interface UserProfile {
  readonly uid: string;
  readonly email: string;
  readonly displayName: string;
  readonly approved: boolean;
  readonly requestedAt: Date | null;
  readonly timelinePosition: number | null;
}

export function parseProfile(uid: string, data: Record<string, unknown> | undefined): UserProfile | null {
  if (data === undefined) return null;
  const requestedAt = data['requestedAt'] as Timestamp | null | undefined;
  const position = data['timelinePosition'];
  return {
    uid,
    email: typeof data['email'] === 'string' ? data['email'] : '',
    displayName: typeof data['displayName'] === 'string' ? data['displayName'] : '',
    approved: data['approved'] === true,
    requestedAt: requestedAt?.toDate() ?? null,
    timelinePosition: typeof position === 'number' && Number.isFinite(position) ? position : null,
  };
}

/** Files an access request for a user signing in for the first time. */
export async function ensureUserDoc({ db }: FirebaseServices, user: User): Promise<void> {
  const ref = doc(db, 'users', user.uid);
  const snap = await getDoc(ref);
  if (snap.exists()) return;
  await setDoc(ref, {
    email: user.email ?? '',
    displayName: user.displayName ?? '',
    approved: false,
    requestedAt: serverTimestamp(),
  });
}

/** Only admins can read config/access, so a successful read means the user is an admin. */
export async function isAdmin({ db }: FirebaseServices): Promise<boolean> {
  try {
    const snap = await getDoc(doc(db, 'config', 'access'));
    return snap.exists();
  } catch {
    return false;
  }
}

export function watchProfile(
  { db }: FirebaseServices,
  uid: string,
  onProfile: (p: UserProfile | null) => void,
  onError: (e: Error) => void,
): Unsubscribe {
  return onSnapshot(
    doc(db, 'users', uid),
    (snap) => {
      onProfile(parseProfile(uid, snap.data()));
    },
    onError,
  );
}

export async function saveTimelinePosition({ db }: FirebaseServices, uid: string, t: number): Promise<void> {
  await updateDoc(doc(db, 'users', uid), { timelinePosition: t });
}

export function watchAllUsers(
  { db }: FirebaseServices,
  onUsers: (users: readonly UserProfile[]) => void,
  onError: (e: Error) => void,
): Unsubscribe {
  return onSnapshot(
    query(collection(db, 'users'), orderBy('requestedAt', 'desc')),
    (snap) => {
      onUsers(snap.docs.flatMap((d) => parseProfile(d.id, d.data()) ?? []));
    },
    onError,
  );
}

export async function setApproved({ db }: FirebaseServices, uid: string, approved: boolean): Promise<void> {
  await updateDoc(doc(db, 'users', uid), { approved });
}

export async function deleteUser({ db }: FirebaseServices, uid: string): Promise<void> {
  await deleteDoc(doc(db, 'users', uid));
}
