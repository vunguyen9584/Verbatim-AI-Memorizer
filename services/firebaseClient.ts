// Firebase initialization and helpers
import { initializeApp, getApps, FirebaseApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, signInWithPopup, sendSignInLinkToEmail, isSignInWithEmailLink, signInWithEmailLink, signOut, onAuthStateChanged, User } from 'firebase/auth';
import { getFirestore, collection, doc, setDoc, deleteDoc, getDocs, query, where, serverTimestamp, orderBy, onSnapshot, Timestamp, Firestore } from 'firebase/firestore';

export interface FirebaseEnvConfig {
  apiKey?: string;
  authDomain?: string;
  projectId?: string;
  appId?: string;
}

export function getFirebaseEnv(): FirebaseEnvConfig {
  const env: any = (import.meta as any).env || {};
  return {
    apiKey: env.VITE_FIREBASE_API_KEY,
    authDomain: env.VITE_FIREBASE_AUTH_DOMAIN,
    projectId: env.VITE_FIREBASE_PROJECT_ID,
    appId: env.VITE_FIREBASE_APP_ID
  };
}

let app: FirebaseApp | null = null;
let db: Firestore | null = null;

export function ensureFirebase(): { app: FirebaseApp | null; db: Firestore | null } {
  if (getApps().length === 0) {
    const cfg = getFirebaseEnv();
    if (!cfg.apiKey || !cfg.authDomain || !cfg.projectId || !cfg.appId) {
      return { app: null, db: null };
    }
    app = initializeApp({
      apiKey: cfg.apiKey,
      authDomain: cfg.authDomain,
      projectId: cfg.projectId,
      appId: cfg.appId
    });
    db = getFirestore(app);
  }
  return { app: getApps()[0] || app, db };
}

export const firebaseAuth = () => {
  const { app } = ensureFirebase();
  return app ? getAuth(app) : null;
};

export const firebaseDb = () => {
  const { db } = ensureFirebase();
  return db;
};

export const authHelpers = {
  onAuthStateChanged(cb: (user: User | null) => void) {
    const auth = firebaseAuth();
    if (!auth) return () => {};
    return onAuthStateChanged(auth, cb);
  },
  async signInWithGoogle() {
    const auth = firebaseAuth();
    if (!auth) throw new Error('Firebase not configured');
    const provider = new GoogleAuthProvider();
    await signInWithPopup(auth, provider);
  },
  async sendEmailLink(email: string) {
    const auth = firebaseAuth();
    if (!auth) throw new Error('Firebase not configured');
    const actionCodeSettings = {
      url: window.location.origin,
      handleCodeInApp: true
    };
    await sendSignInLinkToEmail(auth, email, actionCodeSettings);
    window.localStorage.setItem('emailForSignIn', email);
  },
  async completeEmailLinkSignIn() {
    const auth = firebaseAuth();
    if (!auth) return;
    if (isSignInWithEmailLink(auth, window.location.href)) {
      let email = window.localStorage.getItem('emailForSignIn') || '';
      if (!email) {
        email = window.prompt('Please provide your email for confirmation') || '';
      }
      await signInWithEmailLink(auth, email, window.location.href);
      window.localStorage.removeItem('emailForSignIn');
    }
  },
  async signOut() {
    const auth = firebaseAuth();
    if (!auth) return;
    await signOut(auth);
  }
};

export { collection, doc, setDoc, deleteDoc, getDocs, query, where, serverTimestamp, orderBy, onSnapshot, Timestamp };


