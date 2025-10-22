import { initializeApp, getApps } from 'firebase/app';
import {
  getAuth,
  onAuthStateChanged as fbOnAuthStateChanged,
  GoogleAuthProvider,
  signInWithPopup,
  isSignInWithEmailLink,
  sendSignInLinkToEmail,
  signInWithEmailLink,
  signOut as fbSignOut
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
  return app ? getAuth(app) : null;
}

export const authHelpers = {
  onAuthStateChanged(cb: (user: { uid: string; email: string | null } | null) => void) {
    const auth = getAuthInstance();
    if (!auth) return () => {};
    return fbOnAuthStateChanged(auth, (user) => cb(user ? { uid: user.uid, email: user.email } : null));
  },
  async signInWithGoogle() {
    const auth = getAuthInstance();
    if (!auth) throw new Error('Firebase not configured');
    const provider = new GoogleAuthProvider();
    await signInWithPopup(auth, provider);
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
