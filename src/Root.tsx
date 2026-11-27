import { useMemo } from 'react';
import { App } from './App.tsx';
import { AuthGate, Screen } from './auth/AuthGate.tsx';
import { firebaseConfig, googleClientId, initFirebase } from './auth/firebase.ts';
import { NETWORK } from './data/network.ts';

export function Root() {
  const fb = useMemo(() => {
    const config = firebaseConfig();
    return config === null ? null : initFirebase(config);
  }, []);

  if (fb !== null) return <AuthGate fb={fb} network={NETWORK} clientId={googleClientId()} />;
  // Local development without Firebase: open map, no sign-in.
  if (import.meta.env.DEV) return <App network={NETWORK} />;
  return (
    <Screen title="האתר עדיין לא הוגדר">
      <p>חסרות הגדרות ההתחברות (Firebase) בבנייה הזו.</p>
    </Screen>
  );
}
