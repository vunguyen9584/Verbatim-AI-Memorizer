import { getDb, firestoreHelpers } from './firebaseClient';

export interface PendingProfileData {
  firstName: string;
  lastName: string;
  dateOfBirth: string; // ISO YYYY-MM-DD
}

export interface EnsureUserArgs {
  uid: string;
  email: string | null;
  provider: 'google' | 'email-link' | 'unknown';
}

class UserProfileService {
  async ensureUserDocument(user: EnsureUserArgs, pending?: PendingProfileData): Promise<void> {
    const db = getDb();
    if (!db) return;
    const usersCol = firestoreHelpers.collection(db, 'users');
    const ref = firestoreHelpers.doc(usersCol, user.uid);
    const snap = await firestoreHelpers.getDoc(ref);

    const nowTs = firestoreHelpers.serverTimestamp();

    if (snap.exists()) {
      const data: any = snap.data();
      const patch: any = { updatedAt: nowTs };
      // Patch missing fields if available
      if (!data.email && user.email) patch.email = user.email;
      if (!data.provider && user.provider) patch.provider = user.provider;
      if (pending) {
        if (!data.firstName && pending.firstName) patch.firstName = pending.firstName;
        if (!data.lastName && pending.lastName) patch.lastName = pending.lastName;
        if (!data.dateOfBirth && pending.dateOfBirth) patch.dateOfBirth = pending.dateOfBirth;
      }
      if (Object.keys(patch).length > 0) {
        await firestoreHelpers.setDoc(ref, patch, { merge: true });
      }
      return;
    }

    const docData = {
      email: user.email || null,
      firstName: pending?.firstName || '',
      lastName: pending?.lastName || '',
      dateOfBirth: pending?.dateOfBirth || '',
      provider: user.provider,
      createdAt: nowTs,
      updatedAt: nowTs
    };
    await firestoreHelpers.setDoc(ref, docData, { merge: true });
  }
}

export const userProfileService = new UserProfileService();


