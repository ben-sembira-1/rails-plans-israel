import { GoogleAuthProvider, signInWithCredential, signInWithPopup, signOut } from 'firebase/auth';
import { useCallback, useEffect, useRef, useState } from 'react';
import { App } from '../App.tsx';
import { Logo } from '../components/Logo.tsx';
import { APP_NAME } from '../components/TopBar.tsx';
import type { Network } from '../data/schema.ts';
import type { MapsConfig } from '../map/config.ts';
import { AdminCenter } from './AdminPanel.tsx';
import { useAllUsers } from './useAllUsers.ts';
import type { FirebaseServices } from './firebase.ts';
import { GoogleSignInButton } from './GoogleSignInButton.tsx';
import { HeaderActions } from './HeaderActions.tsx';
import { useAccess, type Access } from './useAccess.ts';
import { useHashRoute } from './useHashRoute.ts';
import { saveTimelinePosition } from './users.ts';

/** Saving the timeline position waits for the user to settle on a time. */
export const SAVE_DELAY_MS = 1000;

export function Screen({ title, children }: { title: string; children?: React.ReactNode }) {
  return (
    <main className="screen" dir="rtl">
      <div className="card">
        <div className="card-brand">
          <Logo size={44} />
          <span>{APP_NAME}</span>
        </div>
        <h1>{title}</h1>
        {children}
      </div>
    </main>
  );
}

export interface AccessScreenProps {
  readonly access: Exclude<Access, { kind: 'approved' }>;
  /** The sign-in control shown to signed-out visitors. */
  readonly signIn: React.ReactNode;
  readonly onSignOut: () => void;
  readonly signInError: string | null;
}

/** Everything a visitor sees before they are approved. */
export function AccessScreen({ access, signIn, onSignOut, signInError }: AccessScreenProps) {
  switch (access.kind) {
    case 'loading':
      return <Screen title="טוען…" />;
    case 'signedOut':
      return (
        <Screen title="הרכבת הקלה והמטרו בגוש דן">
          <p>הגישה לאתר מוגבלת. התחברו עם חשבון Google כדי לבקש גישה.</p>
          {signIn}
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
  maps,
  access,
  onSignOut,
}: {
  fb: FirebaseServices;
  network: Network;
  maps: MapsConfig | null;
  access: Extract<Access, { kind: 'approved' }>;
  onSignOut: () => void;
}) {
  const save = useSavePosition(fb, access.user.uid);
  // Restore the position once, when the map first opens.
  const [initialTime] = useState(access.savedTime);
  const [route, navigate] = useHashRoute();
  const all = useAllUsers(fb, access.isAdmin);
  const adminOpen = access.isAdmin && route === 'admin';
  const pendingCount = all.users.filter((u) => !u.approved).length;
  return (
    <App
      network={network}
      maps={maps}
      {...(initialTime === null ? {} : { initialTime })}
      onTimeChange={save}
      headerActions={
        <HeaderActions
          email={access.user.email ?? ''}
          isAdmin={access.isAdmin}
          adminOpen={adminOpen}
          pendingCount={pendingCount}
          onAdmin={() => {
            navigate(adminOpen ? 'map' : 'admin');
          }}
          onSignOut={onSignOut}
        />
      }
      page={
        adminOpen ? (
          <AdminCenter
            fb={fb}
            selfUid={access.user.uid}
            all={all}
            onBack={() => {
              navigate('map');
            }}
          />
        ) : undefined
      }
    />
  );
}

function PopupSignInButton({ onClick }: { onClick: () => void }) {
  return (
    <button type="button" className="btn primary" onClick={onClick}>
      התחברות עם Google
    </button>
  );
}

export interface AuthGateProps {
  readonly fb: FirebaseServices;
  readonly network: Network;
  readonly maps: MapsConfig | null;
  /** OAuth web client ID for Google Identity Services; `null` falls back to Firebase's popup. */
  readonly clientId: string | null;
}

export function AuthGate({ fb, network, maps, clientId }: AuthGateProps) {
  const access = useAccess(fb);
  const [signInError, setSignInError] = useState<string | null>(null);
  const fail = useCallback((e: unknown) => {
    setSignInError(e instanceof Error ? e.message : String(e));
  }, []);
  const onPopup = useCallback(() => {
    setSignInError(null);
    signInWithPopup(fb.auth, fb.provider).catch(fail);
  }, [fb, fail]);
  const onCredential = useCallback(
    (idToken: string) => {
      setSignInError(null);
      signInWithCredential(fb.auth, GoogleAuthProvider.credential(idToken)).catch(fail);
    },
    [fb, fail],
  );
  const onSignOut = useCallback(() => {
    void signOut(fb.auth);
  }, [fb]);

  if (access.kind !== 'approved') {
    const signIn =
      clientId === null ? (
        <PopupSignInButton onClick={onPopup} />
      ) : (
        <GoogleSignInButton clientId={clientId} onCredential={onCredential} onError={fail} />
      );
    return <AccessScreen access={access} signIn={signIn} onSignOut={onSignOut} signInError={signInError} />;
  }
  return (
    <SignedInApp
      key={access.user.uid}
      fb={fb}
      network={network}
      maps={maps}
      access={access}
      onSignOut={onSignOut}
    />
  );
}
