import { signInWithPopup, signOut } from 'firebase/auth';
import { useCallback, useEffect, useRef, useState } from 'react';
import { App } from '../App.tsx';
import type { Network } from '../data/schema.ts';
import { AdminPanel } from './AdminPanel.tsx';
import type { FirebaseServices } from './firebase.ts';
import { useAccess, type Access } from './useAccess.ts';
import { saveTimelinePosition } from './users.ts';

/** Saving the timeline position waits for the user to settle on a time. */
export const SAVE_DELAY_MS = 1000;

export function Screen({ title, children }: { title: string; children?: React.ReactNode }) {
  return (
    <main className="screen" dir="rtl">
      <div className="card">
        <h1>{title}</h1>
        {children}
      </div>
    </main>
  );
}

export interface AccessScreenProps {
  readonly access: Exclude<Access, { kind: 'approved' }>;
  readonly onSignIn: () => void;
  readonly onSignOut: () => void;
  readonly signInError: string | null;
}

/** Everything a visitor sees before they are approved. */
export function AccessScreen({ access, onSignIn, onSignOut, signInError }: AccessScreenProps) {
  switch (access.kind) {
    case 'loading':
      return <Screen title="טוען…" />;
    case 'signedOut':
      return (
        <Screen title="הרכבת הקלה והמטרו בגוש דן">
          <p>הגישה לאתר מוגבלת. התחברו עם חשבון Google כדי לבקש גישה.</p>
          <button type="button" className="btn primary" onClick={onSignIn}>
            התחברות עם Google
          </button>
          {signInError !== null && <p role="alert">{signInError}</p>}
        </Screen>
      );
    case 'pending':
      return (
        <Screen title="הבקשה נשלחה">
          <p>הבקשה שלך לגישה ({access.user.email}) הועברה למנהל האתר. אחרי שתאושר, הדף ייפתח כאן אוטומטית.</p>
          <button type="button" className="btn" onClick={onSignOut}>
            התנתקות
          </button>
        </Screen>
      );
    case 'error':
      return (
        <Screen title="שגיאה">
          <p dir="auto">{access.message}</p>
          <button type="button" className="btn" onClick={onSignOut}>
            התנתקות
          </button>
        </Screen>
      );
  }
}

function useSavePosition(fb: FirebaseServices, uid: string): (t: number) => void {
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const last = useRef<number | null>(null);
  useEffect(
    () => () => {
      clearTimeout(timer.current);
    },
    [],
  );
  return useCallback(
    (t: number) => {
      if (last.current === null) {
        // The first call is the restored position itself; nothing to save.
        last.current = t;
        return;
      }
      clearTimeout(timer.current);
      timer.current = setTimeout(() => {
        if (last.current === t) return;
        last.current = t;
        saveTimelinePosition(fb, uid, t).catch((e: unknown) => {
          console.warn('Could not save the timeline position', e);
        });
      }, SAVE_DELAY_MS);
    },
    [fb, uid],
  );
}

function SignedInApp({
  fb,
  network,
  access,
  onSignOut,
}: {
  fb: FirebaseServices;
  network: Network;
  access: Extract<Access, { kind: 'approved' }>;
  onSignOut: () => void;
}) {
  const save = useSavePosition(fb, access.user.uid);
  // Restore the position once, when the map first opens.
  const [initialTime] = useState(access.savedTime);
  return (
    <App
      network={network}
      {...(initialTime === null ? {} : { initialTime })}
      onTimeChange={save}
      panelFooter={
        <>
          <div className="account">
            <span dir="auto">{access.user.email}</span>
            <button type="button" className="btn small" onClick={onSignOut}>
              התנתקות
            </button>
          </div>
          {access.isAdmin && <AdminPanel fb={fb} selfUid={access.user.uid} />}
        </>
      }
    />
  );
}

export function AuthGate({ fb, network }: { fb: FirebaseServices; network: Network }) {
  const access = useAccess(fb);
  const [signInError, setSignInError] = useState<string | null>(null);
  const onSignIn = useCallback(() => {
    setSignInError(null);
    signInWithPopup(fb.auth, fb.provider).catch((e: unknown) => {
      setSignInError(e instanceof Error ? e.message : String(e));
    });
  }, [fb]);
  const onSignOut = useCallback(() => {
    void signOut(fb.auth);
  }, [fb]);

  if (access.kind !== 'approved') {
    return (
      <AccessScreen access={access} onSignIn={onSignIn} onSignOut={onSignOut} signInError={signInError} />
    );
  }
  return (
    <SignedInApp key={access.user.uid} fb={fb} network={network} access={access} onSignOut={onSignOut} />
  );
}
