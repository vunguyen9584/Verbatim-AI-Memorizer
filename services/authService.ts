import { AuthUser } from '../types';
import { authHelpers } from './firebaseClient';
import { userProfileService } from './userProfileService';

type AuthStateListener = (user: AuthUser | null) => void;

class AuthService {
  private currentUser: AuthUser | null = null;
  private listeners: Set<AuthStateListener> = new Set();
  private pendingKeyPrefix = 'verbatim_pending_profile:';
  private initialized = false;

  getUser(): AuthUser | null {
    return this.currentUser;
  }

  onChange(listener: AuthStateListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  async signInWithGoogle(): Promise<void> {
    await authHelpers.signInWithGoogle();
  }

  async sendEmailLink(email: string): Promise<void> {
    await authHelpers.sendEmailLink(email);
  }

  async signOut(): Promise<void> { await authHelpers.signOut(); }

  init() {
    if (this.initialized) return;
    this.initialized = true;
    authHelpers.completeEmailLinkSignIn().catch(() => {});
    authHelpers.onAuthStateChanged(async (user) => {
      if (user) {
        const provider: 'google' | 'email-link' | 'unknown' =
          user.providerId === 'google.com' ? 'google' : (user.providerId === 'password' ? 'email-link' : 'unknown');
        this.currentUser = { id: user.uid, email: user.email };
        try {
          const pending = this.consumePendingProfile(user.email || undefined);
          await userProfileService.ensureUserDocument({ uid: user.uid, email: user.email, provider }, pending || undefined);
        } catch {
          // swallow profile ensure errors to not block auth state propagation
        }
      } else {
        this.currentUser = null;
      }
      this.emit();
    });
  }

  private emit() {
    for (const l of this.listeners) l(this.currentUser);
  }

  savePendingProfile(email: string, data: { firstName: string; lastName: string; dateOfBirth: string }) {
    try {
      const key = this.pendingKeyPrefix + email.toLowerCase();
      localStorage.setItem(key, JSON.stringify(data));
    } catch {}
  }

  consumePendingProfile(email?: string) {
    try {
      const targetEmail = (email || localStorage.getItem('verbatim_email_for_signin') || '').toLowerCase();
      if (!targetEmail) return null;
      const key = this.pendingKeyPrefix + targetEmail;
      const raw = localStorage.getItem(key);
      if (!raw) return null;
      localStorage.removeItem(key);
      return JSON.parse(raw);
    } catch {
      return null;
    }
  }
}

export const authService = new AuthService();



