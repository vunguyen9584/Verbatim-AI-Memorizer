import { collection, doc, getDoc, getDocs, query, where, orderBy, setDoc, updateDoc, deleteDoc, serverTimestamp, Timestamp, limit, writeBatch } from 'firebase/firestore';
import { db } from './firebaseClient';
import { authService } from './authService';
import { Lesson, LessonStorage } from '../types';

class FirestoreLessonService implements LessonStorage {
  private readonly USERS_COLLECTION = 'users';
  private readonly LESSONS_SUBCOLLECTION = 'lessons';
  private readonly FOLDERS_SUBCOLLECTION = 'folders';
  private readonly LOCAL_STORAGE_KEY = 'verbatim_lessons';

  private getUid(): string {
    const user = authService.getUser();
    if (!user?.uid) throw new Error('Not authenticated');
    return user.uid;
  }

  private lessonsColRef(uid: string) {
    return collection(db, this.USERS_COLLECTION, uid, this.LESSONS_SUBCOLLECTION);
  }

  private toDate(value: any): Date {
    if (value instanceof Timestamp) return value.toDate();
    if (value instanceof Date) return value;
    if (typeof value === 'string' || typeof value === 'number') return new Date(value);
    return new Date();
  }

  private mapToLesson(id: string, data: any): Lesson {
    return {
      id,
      title: data.title || '',
      content: data.content || '',
      folderId: data.folderId || 'default',
      createdAt: this.toDate(data.createdAt),
      updatedAt: this.toDate(data.updatedAt),
    };
  }

  private async ensureDefaultFolder(uid: string): Promise<void> {
    const defaultRef = doc(db, this.USERS_COLLECTION, uid, this.FOLDERS_SUBCOLLECTION, 'default');
    const snap = await getDoc(defaultRef);
    if (!snap.exists()) {
      await setDoc(defaultRef, {
        name: 'folderManagement.default',
        displayOrder: 0,
        isDefault: true,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }
  }

  private async migrateLocalIfNeeded(uid: string): Promise<void> {
    try {
      const anySnap = await getDocs(query(this.lessonsColRef(uid), limit(1)));
      if (!anySnap.empty) return;

      const raw = localStorage.getItem(this.LOCAL_STORAGE_KEY);
      if (!raw) return;
      await this.ensureDefaultFolder(uid);

      const localLessons: any[] = JSON.parse(raw);
      const batch = writeBatch(db);
      for (const l of localLessons) {
        const id = l.id || undefined;
        if (!id) continue;
        const ref = doc(db, this.USERS_COLLECTION, uid, this.LESSONS_SUBCOLLECTION, id);
        batch.set(ref, {
          title: l.title || '',
          content: l.content || '',
          folderId: l.folderId || 'default',
          createdAt: l.createdAt ? new Date(l.createdAt) : serverTimestamp(),
          updatedAt: l.updatedAt ? new Date(l.updatedAt) : serverTimestamp(),
        }, { merge: true });
      }

      await batch.commit();
      localStorage.removeItem(this.LOCAL_STORAGE_KEY);
    } catch (e) {
      console.warn('Lesson migration skipped:', e);
    }
  }

  async saveLesson(lessonData: Omit<Lesson, 'id' | 'createdAt' | 'updatedAt'>): Promise<Lesson> {
    const uid = this.getUid();
    await this.ensureDefaultFolder(uid);
    // Create with auto-id
    const ref = doc(this.lessonsColRef(uid));
    const payload = {
      title: lessonData.title,
      content: lessonData.content,
      folderId: lessonData.folderId || 'default',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };
    await setDoc(ref, payload);
    return this.mapToLesson(ref.id, payload);
  }

  async updateLesson(id: string, updates: Partial<Lesson>): Promise<Lesson> {
    const uid = this.getUid();
    const ref = doc(db, this.USERS_COLLECTION, uid, this.LESSONS_SUBCOLLECTION, id);
    const snap = await getDoc(ref);
    if (!snap.exists()) throw new Error(`Lesson with id ${id} not found`);
    const current = this.mapToLesson(snap.id, snap.data());

    const allowed: any = {};
    if (typeof updates.title === 'string') allowed.title = updates.title;
    if (typeof updates.content === 'string') allowed.content = updates.content;
    if (typeof updates.folderId === 'string') allowed.folderId = updates.folderId;
    allowed.updatedAt = serverTimestamp();
    await updateDoc(ref, allowed);
    return { ...current, ...allowed, updatedAt: new Date() } as Lesson;
  }

  async deleteLesson(id: string): Promise<void> {
    const uid = this.getUid();
    const ref = doc(db, this.USERS_COLLECTION, uid, this.LESSONS_SUBCOLLECTION, id);
    await deleteDoc(ref);
  }

  async getLesson(id: string): Promise<Lesson | null> {
    const uid = this.getUid();
    await this.migrateLocalIfNeeded(uid);
    const ref = doc(db, this.USERS_COLLECTION, uid, this.LESSONS_SUBCOLLECTION, id);
    const snap = await getDoc(ref);
    if (!snap.exists()) return null;
    return this.mapToLesson(snap.id, snap.data());
  }

  // Backward-compatible alias used by App.tsx
  async getLessonById(id: string): Promise<Lesson | null> {
    return this.getLesson(id);
  }

  async getAllLessons(): Promise<Lesson[]> {
    const uid = this.getUid();
    await this.migrateLocalIfNeeded(uid);
    const snap = await getDocs(this.lessonsColRef(uid));
    const items = snap.docs.map((d) => this.mapToLesson(d.id, d.data()));
    return items.sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());
  }

  async getLessonsByFolder(folderId: string): Promise<Lesson[]> {
    const uid = this.getUid();
    await this.migrateLocalIfNeeded(uid);
    // Avoid composite index requirement: filter only, sort in memory
    const qByFolder = query(this.lessonsColRef(uid), where('folderId', '==', folderId));
    const snap = await getDocs(qByFolder);
    const items = snap.docs.map((d) => this.mapToLesson(d.id, d.data()));
    return items.sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());
  }

  get lessons(): Lesson[] {
    return [];
  }
}

export const lessonStorageService = new FirestoreLessonService();