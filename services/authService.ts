import { AuthUser } from '../types';
import { authHelpers } from './firebaseClient';

type AuthStateListener = (user: AuthUser | null) => void;

class AuthService {
  private currentUser: AuthUser | null = null;
  private listeners: Set<AuthStateListener> = new Set();

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
    authHelpers.completeEmailLinkSignIn().catch(() => {});
    authHelpers.onAuthStateChanged((user) => {
      if (user) {
        this.currentUser = { id: user.uid, email: user.email };
      } else {
        this.currentUser = null;
      }
      this.emit();
    });
  }

  private emit() {
    for (const l of this.listeners) l(this.currentUser);
  }
}

export const authService = new AuthService();



