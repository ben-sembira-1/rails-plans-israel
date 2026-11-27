import { useEffect, useState } from 'react';
import type { FirebaseServices } from './firebase.ts';
import { watchAllUsers, type UserProfile } from './users.ts';

export interface AllUsers {
  readonly users: readonly UserProfile[];
  readonly error: string | null;
}

/** Live list of all users (admins only; `enabled: false` subscribes to nothing). */
export function useAllUsers(fb: FirebaseServices, enabled: boolean): AllUsers {
  const [state, setState] = useState<AllUsers>({ users: [], error: null });
  useEffect(() => {
    if (!enabled) return undefined;
    return watchAllUsers(
      fb,
      (users) => {
        setState({ users, error: null });
      },
      (e) => {
        setState((s) => ({ ...s, error: e.message }));
      },
    );
  }, [fb, enabled]);
  return state;
}
