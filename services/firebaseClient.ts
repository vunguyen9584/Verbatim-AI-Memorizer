import { initializeApp, getApps } from 'firebase/app';
import {
  getAuth,
  onAuthStateChanged as fbOnAuthStateChanged,
  GoogleAuthProvider,
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult,
  isSignInWithEmailLink,
  sendSignInLinkToEmail,
  signInWithEmailLink,
  signOut as fbSignOut,
  setPersistence,
  browserLocalPersistence
} from 'firebase/auth';
import {
  getFirestore,
  serverTimestamp,
  collection,
  doc,
  writeBatch,
  getDoc,
  getDocs,
  query,
  where,
  onSnapshot,
  setDoc
} from 'firebase/firestore';

export const firebaseEnv = {
  apiKey: (import.meta as any).env?.VITE_FIREBASE_API_KEY,
  authDomain: (import.meta as any).env?.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: (import.meta as any).env?.VITE_FIREBASE_PROJECT_ID,
  appId: (import.meta as any).env?.VITE_FIREBASE_APP_ID
};

export function isFirebaseConfigured(): boolean {
  return !!(firebaseEnv.apiKey && firebaseEnv.authDomain && firebaseEnv.projectId && firebaseEnv.appId);
}

export function getFirebaseApp() {
  if (!isFirebaseConfigured()) return null;
  if (getApps().length) return getApps()[0];
  return initializeApp({
    apiKey: firebaseEnv.apiKey,
    authDomain: firebaseEnv.authDomain,
    projectId: firebaseEnv.projectId,
    appId: firebaseEnv.appId
  });
}

export function getDb() {
  const app = getFirebaseApp();
  return app ? getFirestore(app) : null;
}

export function getAuthInstance() {
  const app = getFirebaseApp();
  if (!app) return null;
  const auth = getAuth(app);
  // Ensure stable local persistence once
  try {
    // setPersistence is idempotent for the same mode; ignore errors
    void setPersistence(auth, browserLocalPersistence);
    // optional: use device language
    (auth as any).useDeviceLanguage?.();
    // Avoid automatic redirect handling interfering with SPA state; we call getRedirectResult manually
    (auth as any).skipNavigation = true;
  } catch {}
  return auth;
}

export const authHelpers = {
  onAuthStateChanged(cb: (user: { uid: string; email: string | null; providerId?: string } | null) => void) {
    const auth = getAuthInstance();
    if (!auth) return () => {};
    return fbOnAuthStateChanged(auth, (user) => {
      if (!user) return cb(null);
      const providerId = user.providerData?.[0]?.providerId || undefined;
      cb({ uid: user.uid, email: user.email, providerId });
    });
  },
  async signInWithGoogle() {
    const auth = getAuthInstance();
    if (!auth) throw new Error('Firebase not configured');
    const provider = new GoogleAuthProvider();
    const preferPopup = ((import.meta as any).env?.VITE_AUTH_GOOGLE_POPUP === 'true');
    if (preferPopup) {
      try {
        await signInWithPopup(auth, provider);
      } catch (e: any) {
        const code = e?.code || e?.message || '';
        const popupIssues = typeof code === 'string' && (code.includes('popup') || code.includes('blocked') || code.includes('cancelled') || code.includes('canceled'));
        if (popupIssues) {
          await signInWithRedirect(auth, provider);
          return;
        }
        throw e;
      }
    } else {
      await signInWithRedirect(auth, provider);
    }
  },
  async sendEmailLink(email: string) {
    const auth = getAuthInstance();
    if (!auth) throw new Error('Firebase not configured');
    const actionCodeSettings = {
      url: window.location.origin,
      handleCodeInApp: true
    } as const;
    await sendSignInLinkToEmail(auth, email, actionCodeSettings);
    window.localStorage.setItem('verbatim_email_for_signin', email);
  },
  async completeEmailLinkSignIn() {
    const auth = getAuthInstance();
    if (!auth) return;
    // finalize redirect login if popup was blocked
    try { await getRedirectResult(auth); } catch {}
    if (isSignInWithEmailLink(auth, window.location.href)) {
      let email = window.localStorage.getItem('verbatim_email_for_signin');
      if (!email) {
        email = window.prompt('Please provide your email for confirmation') || '';
      }
      await signInWithEmailLink(auth, email, window.location.href);
      window.localStorage.removeItem('verbatim_email_for_signin');
    }
  },
  async signOut() {
    const auth = getAuthInstance();
    if (!auth) return;
    await fbSignOut(auth);
  }
};

export const firestoreHelpers = {
  serverTimestamp,
  collection,
  doc,
  writeBatch,
  getDoc,
  getDocs,
  query,
  where,
  onSnapshot,
  setDoc,
  getDb
};
