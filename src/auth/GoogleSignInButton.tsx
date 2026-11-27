import { useEffect, useRef, useState } from 'react';
import { loadGis } from './gis.ts';

/**
 * Google Identity Services (GIS) sign-in button.
 *
 * Firebase's `signInWithPopup`/`signInWithRedirect` run part of the flow on `<project>.firebaseapp.com`. Mobile
 * browsers partition that cross-site storage, which fails with "missing initial state". GIS runs the Google step
 * on this page and returns an ID token, which is then exchanged with `signInWithCredential`, so no cross-site
 * storage is needed.
 */

export interface GoogleSignInButtonProps {
  readonly clientId: string;
  /** Receives the Google ID token. */
  readonly onCredential: (idToken: string) => void;
  readonly onError: (message: string) => void;
}

export function GoogleSignInButton({ clientId, onCredential, onError }: GoogleSignInButtonProps) {
  const el = useRef<HTMLDivElement>(null);
  const [ready, setReady] = useState(false);
  // The GIS callback is registered once; keep it pointing at the latest handler.
  const handler = useRef(onCredential);
  useEffect(() => {
    handler.current = onCredential;
  }, [onCredential]);

  useEffect(() => {
    let active = true;
    loadGis()
      .then((gis) => {
        const parent = el.current;
        if (!active || parent === null) return;
        gis.initialize({
          client_id: clientId,
          callback: (r) => {
            handler.current(r.credential);
          },
          ux_mode: 'popup',
          use_fedcm_for_button: true,
        });
        gis.renderButton(parent, {
          type: 'standard',
          theme: 'filled_blue',
          size: 'large',
          text: 'signin_with',
          shape: 'pill',
          locale: 'he',
        });
        setReady(true);
      })
      .catch((e: unknown) => {
        if (active) onError(e instanceof Error ? e.message : String(e));
      });
    return () => {
      active = false;
    };
  }, [clientId, onError]);

  return (
    <div className="gis-button" aria-busy={!ready}>
      {/* GIS owns this element's children, so React never renders into it. */}
      <div ref={el} />
      {!ready && <span className="muted">טוען את כפתור ההתחברות…</span>}
    </div>
  );
}
