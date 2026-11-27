import { onAuthStateChanged, type User } from 'firebase/auth';
import { useEffect, useState } from 'react';
import type { FirebaseServices } from './firebase.ts';
import { ensureUserDoc, isAdmin, watchProfile } from './users.ts';

export type Access =
  | { readonly kind: 'loading' }
  | { readonly kind: 'signedOut' }
  | { readonly kind: 'pending'; readonly user: User }
  | {
      readonly kind: 'approved';
      readonly user: User;
      readonly isAdmin: boolean;
      readonly savedTime: number | null;
    }
  | { readonly kind: 'error'; readonly message: string };

interface UserAccess {
  readonly uid: string;
  readonly access: Access;
}

/** Tracks the signed-in user and whether the admin has approved them (live). */
export function useAccess(fb: FirebaseServices): Access {
  const [user, setUser] = useState<User | null | undefined>(undefined);
  const [userAccess, setUserAccess] = useState<UserAccess | null>(null);

  useEffect(() => onAuthStateChanged(fb.auth, setUser), [fb]);

  useEffect(() => {
    if (!user) return undefined;
    const effect = { cancelled: false };
    let unsubscribe: (() => void) | undefined;
    const set = (access: Access) => {
      if (!effect.cancelled) setUserAccess({ uid: user.uid, access });
    };
    const fail = (e: unknown) => {
      set({ kind: 'error', message: e instanceof Error ? e.message : String(e) });
    };
    void (async () => {
      try {
        const admin = await isAdmin(fb);
        await ensureUserDoc(fb, user);
        if (effect.cancelled) return;
        unsubscribe = watchProfile(
          fb,
          user.uid,
          (p) => {
            set(
              admin || p?.approved === true
                ? { kind: 'approved', user, isAdmin: admin, savedTime: p?.timelinePosition ?? null }
                : { kind: 'pending', user },
            );
          },
          fail,
        );
      } catch (e) {
        fail(e);
      }
    })();
    return () => {
      effect.cancelled = true;
      unsubscribe?.();
    };
  }, [fb, user]);

  if (user === undefined) return { kind: 'loading' };
  if (user === null) return { kind: 'signedOut' };
  if (userAccess?.uid !== user.uid) return { kind: 'loading' };
  return userAccess.access;
}
