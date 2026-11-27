import { initializeApp, type FirebaseOptions } from 'firebase/app';
import { getAuth, GoogleAuthProvider, type Auth } from 'firebase/auth';
import { getFirestore, type Firestore } from 'firebase/firestore';

export interface FirebaseServices {
  readonly auth: Auth;
  readonly db: Firestore;
  readonly provider: GoogleAuthProvider;
}

export interface FirebaseEnv {
  readonly VITE_FIREBASE_API_KEY?: string;
  readonly VITE_FIREBASE_AUTH_DOMAIN?: string;
  readonly VITE_FIREBASE_PROJECT_ID?: string;
  readonly VITE_FIREBASE_APP_ID?: string;
  readonly VITE_GOOGLE_CLIENT_ID?: string;
}

/** The web-app config from the build environment, or `null` if it is incomplete. */
export function firebaseConfig(env: FirebaseEnv = import.meta.env): FirebaseOptions | null {
  const apiKey = env.VITE_FIREBASE_API_KEY;
  const authDomain = env.VITE_FIREBASE_AUTH_DOMAIN;
  const projectId = env.VITE_FIREBASE_PROJECT_ID;
  const appId = env.VITE_FIREBASE_APP_ID;
  if (!apiKey || !authDomain || !projectId || !appId) return null;
  return { apiKey, authDomain, projectId, appId };
}

/**
 * The OAuth web client ID for Google Identity Services, or `null` to fall back to Firebase's popup flow
 * (which fails on mobile browsers that partition cross-site storage).
 */
export function googleClientId(env: FirebaseEnv = import.meta.env): string | null {
  const id = env.VITE_GOOGLE_CLIENT_ID?.trim() ?? '';
  return id === '' ? null : id;
}

let services: FirebaseServices | null = null;

export function initFirebase(config: FirebaseOptions): FirebaseServices {
  if (services === null) {
    const app = initializeApp(config);
    const provider = new GoogleAuthProvider();
    provider.setCustomParameters({ prompt: 'select_account' });
    services = { auth: getAuth(app), db: getFirestore(app), provider };
  }
  return services;
}
