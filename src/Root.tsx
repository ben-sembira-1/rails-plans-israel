import { useMemo } from 'react';
import { App } from './App.tsx';
import { AuthGate, Screen } from './auth/AuthGate.tsx';
import { firebaseConfig, googleClientId, initFirebase } from './auth/firebase.ts';
import { NETWORK } from './data/network.ts';
import { mapsConfig } from './map/config.ts';
import { createMemoryStore } from './places/memoryStore.ts';

export function Root() {
  const fb = useMemo(() => {
    const config = firebaseConfig();
    return config === null ? null : initFirebase(config);
  }, []);

  const maps = useMemo(() => mapsConfig(), []);
  // Local development without Firebase keeps places in memory only.
  const devPlaces = useMemo(() => createMemoryStore(), []);

  if (fb !== null) return <AuthGate fb={fb} network={NETWORK} maps={maps} clientId={googleClientId()} />;
  // Local development without Firebase: open map, no sign-in.
  if (import.meta.env.DEV) return <App network={NETWORK} maps={maps} places={devPlaces} />;
  return (
    <Screen title="האתר עדיין לא הוגדר">
      <p>חסרות הגדרות ההתחברות (Firebase) בבנייה הזו.</p>
    </Screen>
  );
}
