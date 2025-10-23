import { collection, doc, getDoc, getDocs, query, where, orderBy, setDoc, updateDoc, deleteDoc, serverTimestamp, writeBatch, Timestamp, limit } from 'firebase/firestore';
import { db } from './firebaseClient';
import { authService } from './authService';
import { Folder, FolderStorage } from '../types';

class FirestoreFolderService implements FolderStorage {
  private readonly USERS_COLLECTION = 'users';
  private readonly FOLDERS_SUBCOLLECTION = 'folders';
  private readonly DEFAULT_FOLDER_ID = 'default';
  private readonly LOCAL_STORAGE_KEY = 'verbatim_folders';

  private getUid(): string {
    const user = authService.getUser();
    if (!user?.uid) throw new Error('Not authenticated');
    return user.uid;
  }

  private foldersColRef(uid: string) {
    return collection(db, this.USERS_COLLECTION, uid, this.FOLDERS_SUBCOLLECTION);
  }

  private mapToFolder(id: string, data: any): Folder {
    return {
      id,
      name: data.name || '',
      displayOrder: typeof data.displayOrder === 'number' ? data.displayOrder : 0,
      createdAt: this.toDate(data.createdAt),
      updatedAt: this.toDate(data.updatedAt),
      isDefault: !!data.isDefault,
    };
  }

  private toDate(value: any): Date {
    if (value instanceof Timestamp) return value.toDate();
    if (value instanceof Date) return value;
    if (typeof value === 'string' || typeof value === 'number') return new Date(value);
    return new Date();
  }

  private async ensureDefaultFolder(uid: string): Promise<Folder> {
    // Try known id first for consistency
    const defaultRef = doc(db, this.USERS_COLLECTION, uid, this.FOLDERS_SUBCOLLECTION, this.DEFAULT_FOLDER_ID);
    const snap = await getDoc(defaultRef);
    if (snap.exists()) {
      return this.mapToFolder(snap.id, snap.data());
    }

    // Fallback: query any folder marked isDefault
    const q = query(this.foldersColRef(uid), where('isDefault', '==', true), limit(1));
    const qSnap = await getDocs(q);
    if (!qSnap.empty) {
      const d = qSnap.docs[0];
      return this.mapToFolder(d.id, d.data());
    }

    // Create if not exists
    const payload = {
      name: 'folderManagement.default',
      displayOrder: 0,
      isDefault: true,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };
    await setDoc(defaultRef, payload);
    return this.mapToFolder(this.DEFAULT_FOLDER_ID, payload);
  }

  private async migrateLocalIfNeeded(uid: string): Promise<void> {
    try {
      // If remote already has folders, skip
      const anySnap = await getDocs(query(this.foldersColRef(uid), limit(1)));
      if (!anySnap.empty) return;

      const raw = localStorage.getItem(this.LOCAL_STORAGE_KEY);
      if (!raw) {
        // At least ensure default exists
        await this.ensureDefaultFolder(uid);
        return;
      }

      const localFolders: any[] = JSON.parse(raw);
      const batch = writeBatch(db);

      // Ensure default first
      const hasDefaultLocal = localFolders.some((f) => f.id === this.DEFAULT_FOLDER_ID || f.isDefault);
      if (!hasDefaultLocal) {
        const defRef = doc(db, this.USERS_COLLECTION, uid, this.FOLDERS_SUBCOLLECTION, this.DEFAULT_FOLDER_ID);
        batch.set(defRef, {
          name: 'folderManagement.default',
          displayOrder: 0,
          isDefault: true,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      }

      for (let i = 0; i < localFolders.length; i++) {
        const f = localFolders[i];
        const id = f.id || undefined;
        if (!id) continue;
        const ref = doc(db, this.USERS_COLLECTION, uid, this.FOLDERS_SUBCOLLECTION, id);
        batch.set(ref, {
          name: f.name || '',
          displayOrder: typeof f.displayOrder === 'number' ? f.displayOrder : i,
          isDefault: !!f.isDefault || id === this.DEFAULT_FOLDER_ID,
          createdAt: f.createdAt ? new Date(f.createdAt) : serverTimestamp(),
          updatedAt: f.updatedAt ? new Date(f.updatedAt) : serverTimestamp(),
        }, { merge: true });
      }

      await batch.commit();
      // Clear local cached folders after successful migration
      localStorage.removeItem(this.LOCAL_STORAGE_KEY);
    } catch (e) {
      // Non-fatal
      console.warn('Folder migration skipped:', e);
    }
  }

  private async fetchAll(uid: string): Promise<Folder[]> {
    await this.ensureDefaultFolder(uid);
    await this.migrateLocalIfNeeded(uid);
    const qAll = query(this.foldersColRef(uid), orderBy('displayOrder', 'asc'));
    const snap = await getDocs(qAll);
    const folders = snap.docs.map((d) => this.mapToFolder(d.id, d.data()));
    // Ensure default is first even if displayOrder changed incorrectly
    return folders.sort((a, b) => {
      if (a.isDefault) return -1;
      if (b.isDefault) return 1;
      return a.displayOrder - b.displayOrder;
    });
  }

  async saveFolder(folderData: Omit<Folder, 'id' | 'createdAt' | 'updatedAt' | 'displayOrder'>): Promise<Folder> {
    const uid = this.getUid();
    if (folderData.isDefault) throw new Error('Cannot create default folder');
    const existing = await this.fetchAll(uid);
    const nextOrder = existing.reduce((max, f) => Math.max(max, f.displayOrder), -1) + 1;

    // Generate id via Firestore auto id by creating a doc ref without id then setDoc; but to keep deterministic, use auto id
    const ref = doc(this.foldersColRef(uid));
    const payload = {
      name: folderData.name,
      displayOrder: nextOrder,
      isDefault: false,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };
    await setDoc(ref, payload);
    return this.mapToFolder(ref.id, payload);
  }

  async updateFolder(id: string, updates: Partial<Folder>): Promise<Folder> {
    const uid = this.getUid();
    const ref = doc(db, this.USERS_COLLECTION, uid, this.FOLDERS_SUBCOLLECTION, id);
    const snap = await getDoc(ref);
    if (!snap.exists()) throw new Error(`Folder with id ${id} not found`);
    const current = this.mapToFolder(snap.id, snap.data());
    if (current.isDefault) throw new Error('Cannot modify default folder');

    const allowed: any = {};
    if (typeof updates.name === 'string') allowed.name = updates.name;
    if (typeof updates.displayOrder === 'number') allowed.displayOrder = updates.displayOrder;
    allowed.updatedAt = serverTimestamp();
    await updateDoc(ref, allowed);
    return { ...current, ...allowed, updatedAt: new Date() } as Folder;
  }

  async deleteFolder(id: string): Promise<void> {
    const uid = this.getUid();
    const ref = doc(db, this.USERS_COLLECTION, uid, this.FOLDERS_SUBCOLLECTION, id);
    const snap = await getDoc(ref);
    if (!snap.exists()) throw new Error(`Folder with id ${id} not found`);
    const current = this.mapToFolder(snap.id, snap.data());
    if (current.isDefault) throw new Error('Cannot delete default folder');
    await deleteDoc(ref);
  }

  async getFolder(id: string): Promise<Folder | null> {
    const uid = this.getUid();
    const ref = doc(db, this.USERS_COLLECTION, uid, this.FOLDERS_SUBCOLLECTION, id);
    const snap = await getDoc(ref);
    if (!snap.exists()) return null;
    return this.mapToFolder(snap.id, snap.data());
  }

  async getAllFolders(): Promise<Folder[]> {
    const uid = this.getUid();
    return this.fetchAll(uid);
  }

  async getDefaultFolder(): Promise<Folder> {
    const uid = this.getUid();
    return this.ensureDefaultFolder(uid);
  }

  async reorderFolders(folderIds: string[]): Promise<void> {
    const uid = this.getUid();
    const batch = writeBatch(db);
    folderIds.forEach((id, index) => {
      const ref = doc(db, this.USERS_COLLECTION, uid, this.FOLDERS_SUBCOLLECTION, id);
      batch.update(ref, { displayOrder: index, updatedAt: serverTimestamp() });
    });
    await batch.commit();
  }

  get folders(): Folder[] {
    // Synchronous getter not meaningful with Firestore; return empty to satisfy interface
    return [];
  }
}

export const folderStorageService = new FirestoreFolderService();

