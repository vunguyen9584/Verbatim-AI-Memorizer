import { User } from 'firebase/auth';
import { authHelpers } from './firebaseClient';
import { userProfileService } from './userProfileService';
import { AuthUser, PendingProfile } from '../types';

type AuthStateListener = (user: AuthUser | null) => void;

class AuthService {
  private currentUser: AuthUser | null = null;
  private listeners: AuthStateListener[] = [];
  private unsubscribeAuth: (() => void) | null = null;

  constructor() {
    this.init();
  }

  /**
   * Initialize auth service and set up auth state listener
   */
  init(): void {
    this.unsubscribeAuth = authHelpers.onAuthStateChanged(async (firebaseUser) => {
      if (firebaseUser) {
        const authUser = this.mapFirebaseUser(firebaseUser);
        this.currentUser = authUser;

        // Notify listeners immediately to show authenticated state
        this.notifyListeners(authUser);

        // Check if this is email link sign-in completion
        const pendingProfile = this.consumePendingProfile(firebaseUser.email || '');

        // Ensure user profile document exists (non-blocking)
        // This runs in background and doesn't block the auth flow
        this.ensureUserProfileAsync(authUser, pendingProfile);
      } else {
        this.currentUser = null;
        this.notifyListeners(null);
      }
    });

    // Check if this is an email link sign-in on app load
    if (authHelpers.isSignInWithEmailLink()) {
      this.completeEmailLinkSignIn().catch((error) => {
        console.error('Email link sign-in failed on init:', error);
      });
    }
  }

  /**
   * Ensure user profile asynchronously without blocking auth flow
   */
  private async ensureUserProfileAsync(authUser: AuthUser, pendingProfile?: PendingProfile): Promise<void> {
    try {
      await userProfileService.ensureUserDocument(authUser, pendingProfile);
      console.log('User profile synced successfully');
    } catch (error: any) {
      console.error('Failed to ensure user document:', error);
      // Don't block auth flow if Firestore is unavailable
      if (
        error?.code === 'unavailable' || 
        error?.message?.includes('offline') ||
        error?.message?.includes('timeout')
      ) {
        console.warn('Firestore is offline or timeout - user profile not synced');
      }
    }
  }

  /**
   * Get current authenticated user
   */
  getUser(): AuthUser | null {
    return this.currentUser;
  }

  /**
   * Subscribe to auth state changes
   */
  subscribe(listener: AuthStateListener): () => void {
    this.listeners.push(listener);
    // Immediately notify with current state
    listener(this.currentUser);

    // Return unsubscribe function
    return () => {
      this.listeners = this.listeners.filter((l) => l !== listener);
    };
  }

  /**
   * Sign in with Google
   */
  async signInWithGoogle(): Promise<AuthUser> {
    try {
      const firebaseUser = await authHelpers.signInWithGoogle();
      return this.mapFirebaseUser(firebaseUser);
    } catch (error: any) {
      throw new Error(error.message || 'Google sign-in failed');
    }
  }

  /**
   * Send email link for passwordless sign-in
   */
  async sendEmailLink(email: string, pendingProfile: PendingProfile): Promise<void> {
    try {
      // Save pending profile data to localStorage
      this.savePendingProfile(email, pendingProfile);
      // Send the email link
      await authHelpers.sendEmailLink(email);
    } catch (error: any) {
      throw new Error(error.message || 'Failed to send activation link');
    }
  }

  /**
   * Complete email link sign-in
   */
  async completeEmailLinkSignIn(email?: string): Promise<AuthUser> {
    try {
      const firebaseUser = await authHelpers.completeEmailLinkSignIn(email);
      return this.mapFirebaseUser(firebaseUser);
    } catch (error: any) {
      throw new Error(error.message || 'Failed to complete email sign-in');
    }
  }

  /**
   * Sign out current user
   */
  async signOut(): Promise<void> {
    try {
      await authHelpers.signOut();
    } catch (error: any) {
      throw new Error(error.message || 'Sign out failed');
    }
  }

  /**
   * Save pending profile data to localStorage
   */
  savePendingProfile(email: string, profile: PendingProfile): void {
    const key = `verbatim_pending_profile:${email}`;
    try {
      localStorage.setItem(key, JSON.stringify(profile));
    } catch (error) {
      console.error('Failed to save pending profile:', error);
    }
  }

  /**
   * Consume pending profile data from localStorage
   */
  consumePendingProfile(email: string): PendingProfile | undefined {
    const key = `verbatim_pending_profile:${email}`;
    try {
      const data = localStorage.getItem(key);
      if (data) {
        localStorage.removeItem(key);
        return JSON.parse(data);
      }
    } catch (error) {
      console.error('Failed to consume pending profile:', error);
    }
    return undefined;
  }

  /**
   * Map Firebase User to AuthUser
   */
  private mapFirebaseUser(firebaseUser: User): AuthUser {
    // Determine provider
    let provider: 'google' | 'email-link' | null = null;
    if (firebaseUser.providerData.length > 0) {
      const providerId = firebaseUser.providerData[0].providerId;
      if (providerId === 'google.com') {
        provider = 'google';
      } else if (providerId === 'password' || firebaseUser.emailVerified) {
        provider = 'email-link';
      }
    }

    return {
      uid: firebaseUser.uid,
      email: firebaseUser.email,
      displayName: firebaseUser.displayName,
      emailVerified: firebaseUser.emailVerified,
      photoURL: firebaseUser.photoURL,
      provider,
    };
  }

  /**
   * Notify all listeners of auth state change
   */
  private notifyListeners(user: AuthUser | null): void {
    this.listeners.forEach((listener) => listener(user));
  }

  /**
   * Cleanup subscriptions
   */
  destroy(): void {
    if (this.unsubscribeAuth) {
      this.unsubscribeAuth();
    }
    this.listeners = [];
  }
}

// Export singleton instance
export const authService = new AuthService();

