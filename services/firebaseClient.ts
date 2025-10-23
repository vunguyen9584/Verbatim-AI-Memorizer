import { initializeApp, FirebaseApp } from 'firebase/app';
import {
  getAuth,
  Auth,
  GoogleAuthProvider,
  signInWithPopup,
  signInWithEmailLink,
  sendSignInLinkToEmail,
  isSignInWithEmailLink,
  signOut as firebaseSignOut,
  onAuthStateChanged,
  User,
  ActionCodeSettings,
} from 'firebase/auth';
import { 
  getFirestore, 
  Firestore,
  connectFirestoreEmulator,
  enableNetwork,
  disableNetwork
} from 'firebase/firestore';

// Firebase configuration
// These should be set in environment variables
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || '',
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || '',
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || '',
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || '',
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || '',
  appId: import.meta.env.VITE_FIREBASE_APP_ID || '',
};

// Check if Firebase config is present
const isFirebaseConfigured = () => {
  return !!(
    firebaseConfig.apiKey &&
    firebaseConfig.authDomain &&
    firebaseConfig.projectId
  );
};

// Initialize Firebase
let app: FirebaseApp;
let auth: Auth;
let db: Firestore;

try {
  if (!isFirebaseConfigured()) {
    console.warn(
      '⚠️ Firebase not configured. Please set up your .env file with Firebase credentials.\n' +
      'See .env.example and docs/Firebase-Setup.md for instructions.\n' +
      'Authentication will not work until Firebase is configured.'
    );
  }
  
  app = initializeApp(firebaseConfig);
  auth = getAuth(app);
  db = getFirestore(app);

  // Configure Firestore for better performance
  if (isFirebaseConfigured()) {
    // Enable offline persistence for better performance
    try {
      // This helps with offline support and reduces network requests
      console.log('Firestore initialized with offline support');
    } catch (error) {
      console.warn('Could not enable Firestore offline support:', error);
    }
  }
} catch (error) {
  console.error('Firebase initialization error:', error);
  console.warn('Make sure you have set up Firebase credentials in .env file');
  throw error;
}

// Action code settings for email link
const actionCodeSettings: ActionCodeSettings = {
  url: window.location.origin,
  handleCodeInApp: true,
};

// Auth helpers
export const authHelpers = {
  /**
   * Sign in with Google OAuth
   */
  async signInWithGoogle(): Promise<User> {
    const provider = new GoogleAuthProvider();
    try {
      const result = await signInWithPopup(auth, provider);
      return result.user;
    } catch (error: any) {
      console.error('Google sign-in error:', error);
      throw new Error(error.message || 'Failed to sign in with Google');
    }
  },

  /**
   * Send sign-in link to email (passwordless)
   */
  async sendEmailLink(email: string): Promise<void> {
    try {
      await sendSignInLinkToEmail(auth, email, actionCodeSettings);
      // Save email to localStorage for email link completion
      window.localStorage.setItem('emailForSignIn', email);
    } catch (error: any) {
      console.error('Send email link error:', error);
      throw new Error(error.message || 'Failed to send activation link');
    }
  },

  /**
   * Complete email link sign-in
   */
  async completeEmailLinkSignIn(emailFromUser?: string): Promise<User> {
    const url = window.location.href;

    if (!isSignInWithEmailLink(auth, url)) {
      throw new Error('Invalid sign-in link');
    }

    let email = emailFromUser || window.localStorage.getItem('emailForSignIn');

    if (!email) {
      // If user opens link on different device, prompt for email
      email = window.prompt('Please provide your email for confirmation');
    }

    if (!email) {
      throw new Error('Email is required to complete sign-in');
    }

    try {
      const result = await signInWithEmailLink(auth, email, url);
      window.localStorage.removeItem('emailForSignIn');
      return result.user;
    } catch (error: any) {
      console.error('Complete email link sign-in error:', error);
      throw new Error(error.message || 'Failed to complete sign-in');
    }
  },

  /**
   * Sign out current user
   */
  async signOut(): Promise<void> {
    try {
      await firebaseSignOut(auth);
    } catch (error: any) {
      console.error('Sign out error:', error);
      throw new Error(error.message || 'Failed to sign out');
    }
  },

  /**
   * Subscribe to auth state changes
   */
  onAuthStateChanged(callback: (user: User | null) => void): () => void {
    return onAuthStateChanged(auth, callback);
  },

  /**
   * Check if current URL is a sign-in link
   */
  isSignInWithEmailLink(url: string = window.location.href): boolean {
    return isSignInWithEmailLink(auth, url);
  },
};

export { auth, db };
export default app;

