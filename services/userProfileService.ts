import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  serverTimestamp,
  Timestamp,
} from 'firebase/firestore';
import { db } from './firebaseClient';
import { AuthUser, UserProfile, PendingProfile } from '../types';

class UserProfileService {
  private readonly COLLECTION_NAME = 'users';

  /**
   * Ensure user profile document exists in Firestore
   * Creates new profile if missing, or updates existing if needed
   */
  async ensureUserDocument(
    authUser: AuthUser,
    pendingProfile?: PendingProfile
  ): Promise<UserProfile> {
    const userRef = doc(db, this.COLLECTION_NAME, authUser.uid);

    try {
      // Use getDoc with timeout to avoid hanging requests
      const docSnap = await Promise.race([
        getDoc(userRef),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Firestore request timeout')), 10000)
        )
      ]) as any;

      if (docSnap.exists()) {
        // Document exists, optionally update missing fields
        const existingData = docSnap.data();
        const updates: any = {};
        let needsUpdate = false;

        // Update email if changed
        if (authUser.email && existingData.email !== authUser.email) {
          updates.email = authUser.email;
          needsUpdate = true;
        }

        // Update emailVerified status
        if (existingData.emailVerified !== authUser.emailVerified) {
          updates.emailVerified = authUser.emailVerified;
          needsUpdate = true;
        }

        if (needsUpdate) {
          updates.updatedAt = serverTimestamp();
          await Promise.race([
            updateDoc(userRef, updates),
            new Promise((_, reject) => 
              setTimeout(() => reject(new Error('Firestore update timeout')), 5000)
            )
          ]);
        }

        return this.mapDocToProfile(authUser.uid, {
          ...existingData,
          ...updates,
        });
      } else {
        // Create new profile document
        const newProfile = this.createProfileData(authUser, pendingProfile);
        await Promise.race([
          setDoc(userRef, newProfile),
          new Promise((_, reject) => 
            setTimeout(() => reject(new Error('Firestore create timeout')), 5000)
          )
        ]);

        return this.mapDocToProfile(authUser.uid, newProfile);
      }
    } catch (error: any) {
      console.error('Error ensuring user document:', error);
      
      // If offline, timeout, or Firestore unavailable, return a fallback profile
      if (
        error?.code === 'unavailable' || 
        error?.message?.includes('offline') ||
        error?.message?.includes('timeout') ||
        error?.code === 'deadline-exceeded'
      ) {
        console.warn('Firestore unavailable or timeout - using fallback profile');
        return this.createFallbackProfile(authUser, pendingProfile);
      }
      
      throw error;
    }
  }

  /**
   * Create a fallback profile when Firestore is unavailable
   */
  private createFallbackProfile(
    authUser: AuthUser,
    pendingProfile?: PendingProfile
  ): UserProfile {
    return {
      uid: authUser.uid,
      email: authUser.email || '',
      firstName: pendingProfile?.firstName || authUser.displayName?.split(' ')[0] || '',
      lastName: pendingProfile?.lastName || authUser.displayName?.split(' ').slice(1).join(' ') || '',
      dateOfBirth: pendingProfile?.dateOfBirth || '',
      provider: authUser.provider || 'email-link',
      emailVerified: authUser.emailVerified,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
  }

  /**
   * Get user profile by UID
   */
  async getUserProfile(uid: string): Promise<UserProfile | null> {
    try {
      const userRef = doc(db, this.COLLECTION_NAME, uid);
      const docSnap = await getDoc(userRef);

      if (docSnap.exists()) {
        return this.mapDocToProfile(uid, docSnap.data());
      }
      return null;
    } catch (error) {
      console.error('Error getting user profile:', error);
      return null;
    }
  }

  /**
   * Update user profile
   */
  async updateUserProfile(
    uid: string,
    updates: Partial<Omit<UserProfile, 'uid' | 'createdAt'>>
  ): Promise<void> {
    try {
      const userRef = doc(db, this.COLLECTION_NAME, uid);
      await updateDoc(userRef, {
        ...updates,
        updatedAt: serverTimestamp(),
      });
    } catch (error) {
      console.error('Error updating user profile:', error);
      throw error;
    }
  }

  /**
   * Create profile data object for new user
   */
  private createProfileData(
    authUser: AuthUser,
    pendingProfile?: PendingProfile
  ): any {
    const baseProfile: any = {
      email: authUser.email || '',
      provider: authUser.provider || 'email-link',
      emailVerified: authUser.emailVerified,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };

    if (pendingProfile) {
      // Use pending profile data from email sign-up
      baseProfile.firstName = pendingProfile.firstName;
      baseProfile.lastName = pendingProfile.lastName;
      baseProfile.dateOfBirth = pendingProfile.dateOfBirth;
    } else if (authUser.provider === 'google' && authUser.displayName) {
      // Parse Google display name
      const nameParts = authUser.displayName.split(' ');
      baseProfile.firstName = nameParts[0] || '';
      baseProfile.lastName = nameParts.slice(1).join(' ') || '';
      baseProfile.dateOfBirth = ''; // Not available from Google
    } else {
      // Default empty values
      baseProfile.firstName = '';
      baseProfile.lastName = '';
      baseProfile.dateOfBirth = '';
    }

    return baseProfile;
  }

  /**
   * Map Firestore document data to UserProfile
   */
  private mapDocToProfile(uid: string, data: any): UserProfile {
    return {
      uid,
      email: data.email || '',
      firstName: data.firstName || '',
      lastName: data.lastName || '',
      dateOfBirth: data.dateOfBirth || '',
      provider: data.provider || 'email-link',
      emailVerified: data.emailVerified || false,
      createdAt: this.timestampToDate(data.createdAt),
      updatedAt: this.timestampToDate(data.updatedAt),
    };
  }

  /**
   * Convert Firestore Timestamp to Date
   */
  private timestampToDate(timestamp: any): Date {
    if (timestamp instanceof Timestamp) {
      return timestamp.toDate();
    }
    if (timestamp instanceof Date) {
      return timestamp;
    }
    return new Date();
  }
}

// Export singleton instance
export const userProfileService = new UserProfileService();

