import { CloudAdapter, CloudFolderRow, CloudLessonRow } from '../types';
import { ensureFirebase, firebaseDb, collection, doc, setDoc, deleteDoc, getDocs, query, where, serverTimestamp, orderBy, onSnapshot, Timestamp } from './firebaseClient';

function isConfigured(): boolean {
  return !!ensureFirebase().app && !!firebaseDb();
}

const foldersCol = (userId: string) => collection(firebaseDb()!, 'users', userId, 'folders');
const lessonsCol = (userId: string) => collection(firebaseDb()!, 'users', userId, 'lessons');

export const cloudAdapterFirebase: CloudAdapter = {
  isConfigured(): boolean { return isConfigured(); },
  async getServerTime(): Promise<string> { return new Date().toISOString(); },

  async upsertFolders(rows) {
    // rows require user scoping externally; we'll assume payload already has correct fields
    const out: CloudFolderRow[] = [];
    // userId is encoded in row via a virtual prop not present in type; we expect caller to split by user
    for (const r of rows) {
      const userId = (r as any).user_id;
      if (!userId) continue;
      const id = r.id || crypto.randomUUID();
      const ref = doc(foldersCol(userId), id);
      await setDoc(ref, {
        name: r.name,
        display_order: r.display_order ?? 0,
        is_default: r.is_default ?? false,
        created_at: r.created_at ? Timestamp.fromDate(new Date(r.created_at)) : serverTimestamp(),
        updated_at: serverTimestamp(),
        deleted_at: r.deleted_at ? Timestamp.fromDate(new Date(r.deleted_at)) : null
      }, { merge: true });
      out.push({
        id,
        name: r.name!,
        display_order: r.display_order ?? 0,
        is_default: !!r.is_default,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        deleted_at: r.deleted_at ?? null
      });
    }
    return out;
  },

  async deleteFolders(ids: string[]): Promise<void> {
    // Caller must include userId per row; we cannot infer here. To keep interface stable, do soft-delete via upsert with deleted_at.
    // No-op; SyncEngine will call upsert with tombstones instead.
  },

  async listFolders(updatedAfter?: string): Promise<CloudFolderRow[]> {
    throw new Error('listFolders requires user scoping at call site');
  },

  async upsertLessons(rows) {
    const out: CloudLessonRow[] = [];
    for (const r of rows) {
      const userId = (r as any).user_id;
      if (!userId) continue;
      const id = r.id || crypto.randomUUID();
      const ref = doc(lessonsCol(userId), id);
      await setDoc(ref, {
        folder_id: r.folder_id,
        title: r.title,
        content: r.content,
        created_at: r.created_at ? Timestamp.fromDate(new Date(r.created_at)) : serverTimestamp(),
        updated_at: serverTimestamp(),
        deleted_at: r.deleted_at ? Timestamp.fromDate(new Date(r.deleted_at)) : null
      }, { merge: true });
      out.push({
        id,
        folder_id: r.folder_id!,
        title: r.title!,
        content: r.content!,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        deleted_at: r.deleted_at ?? null
      });
    }
    return out;
  },

  async deleteLessons(ids: string[]): Promise<void> {
    // No-op; handled via tombstone
  },

  async listLessons(updatedAfter?: string): Promise<CloudLessonRow[]> {
    throw new Error('listLessons requires user scoping at call site');
  },

  onFoldersChanged(userId: string, cb: (rows: CloudFolderRow[]) => void) {
    const constraints = [orderBy('updated_at', 'asc')];
    const q = query(foldersCol(userId), ...constraints as any);
    return onSnapshot(q, (snap) => {
      const rows: CloudFolderRow[] = snap.docs.map(d => {
        const data: any = d.data();
        return {
          id: d.id,
          name: data.name,
          display_order: data.display_order,
          is_default: data.is_default,
          created_at: (data.created_at?.toDate?.() || new Date()).toISOString(),
          updated_at: (data.updated_at?.toDate?.() || new Date()).toISOString(),
          deleted_at: data.deleted_at ? (data.deleted_at.toDate?.() || new Date()).toISOString() : null
        };
      });
      cb(rows);
    });
  },

  onLessonsChanged(userId: string, cb: (rows: CloudLessonRow[]) => void) {
    const constraints = [orderBy('updated_at', 'asc')];
    const q = query(lessonsCol(userId), ...constraints as any);
    return onSnapshot(q, (snap) => {
      const rows: CloudLessonRow[] = snap.docs.map(d => {
        const data: any = d.data();
        return {
          id: d.id,
          folder_id: data.folder_id,
          title: data.title,
          content: data.content,
          created_at: (data.created_at?.toDate?.() || new Date()).toISOString(),
          updated_at: (data.updated_at?.toDate?.() || new Date()).toISOString(),
          deleted_at: data.deleted_at ? (data.deleted_at.toDate?.() || new Date()).toISOString() : null
        };
      });
      cb(rows);
    });
  }
};


