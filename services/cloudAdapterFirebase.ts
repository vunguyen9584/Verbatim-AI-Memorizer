import { CloudAdapter, CloudFolderRow, CloudLessonRow } from '../types';
import { firestoreHelpers, getDb, isFirebaseConfigured } from './firebaseClient';

function toFolderRow(id: string, data: any): CloudFolderRow {
  return {
    id,
    name: data.name,
    display_order: data.display_order,
    is_default: !!data.is_default,
    created_at: (data.created_at?.toDate?.() || new Date(data.created_at)).toISOString(),
    updated_at: (data.updated_at?.toDate?.() || new Date(data.updated_at)).toISOString(),
    deleted_at: data.deleted_at ? (data.deleted_at?.toDate?.() || new Date(data.deleted_at)).toISOString() : null
  };
}

function toLessonRow(id: string, data: any): CloudLessonRow {
  return {
    id,
    folder_id: data.folder_id,
    title: data.title,
    content: data.content,
    created_at: (data.created_at?.toDate?.() || new Date(data.created_at)).toISOString(),
    updated_at: (data.updated_at?.toDate?.() || new Date(data.updated_at)).toISOString(),
    deleted_at: data.deleted_at ? (data.deleted_at?.toDate?.() || new Date(data.deleted_at)).toISOString() : null
  };
}

export const cloudAdapterFirebase: CloudAdapter = {
  isConfigured() { return isFirebaseConfigured(); },
  async getServerTime() { return new Date().toISOString(); },
  async upsertFolders(rows) {
    const db = getDb();
    if (!db) return [];
    const batch = firestoreHelpers.writeBatch(db);
    const ids: string[] = [];
    for (const r of rows) {
      const col = firestoreHelpers.collection(db, 'folders');
      const ref = r.id ? firestoreHelpers.doc(col, r.id) : firestoreHelpers.doc(col);
      ids.push(ref.id);
      batch.set(ref, {
        user_id: (r as any).user_id,
        name: r.name,
        display_order: r.display_order,
        is_default: !!r.is_default,
        created_at: r.created_at ? new Date(r.created_at) : firestoreHelpers.serverTimestamp(),
        updated_at: firestoreHelpers.serverTimestamp(),
        deleted_at: r.deleted_at ? new Date(r.deleted_at) : null
      }, { merge: true });
    }
    await batch.commit();
    // read back
    const out: CloudFolderRow[] = [];
    for (const id of ids) {
      const snap = await firestoreHelpers.getDoc(firestoreHelpers.doc(firestoreHelpers.collection(db, 'folders'), id));
      const data = snap.data();
      if (data) out.push(toFolderRow(snap.id, data));
    }
    return out;
  },
  async deleteFolders(ids) {
    const db = getDb();
    if (!db) return;
    const batch = firestoreHelpers.writeBatch(db);
    for (const id of ids) {
      const ref = firestoreHelpers.doc(firestoreHelpers.collection(db, 'folders'), id);
      batch.set(ref, { deleted_at: firestoreHelpers.serverTimestamp() }, { merge: true });
    }
    await batch.commit();
  },
  async listFolders(updatedAfter) {
    const db = getDb();
    if (!db) return [];
    const q = firestoreHelpers.query(
      firestoreHelpers.collection(db, 'folders'),
      firestoreHelpers.where('deleted_at', '==', null)
    );
    const snap = await firestoreHelpers.getDocs(q);
    return snap.docs.map(d => toFolderRow(d.id, d.data()));
  },
  async upsertLessons(rows) {
    const db = getDb();
    if (!db) return [];
    const batch = firestoreHelpers.writeBatch(db);
    const ids: string[] = [];
    for (const r of rows) {
      const col = firestoreHelpers.collection(db, 'lessons');
      const ref = r.id ? firestoreHelpers.doc(col, r.id) : firestoreHelpers.doc(col);
      ids.push(ref.id);
      batch.set(ref, {
        user_id: (r as any).user_id,
        folder_id: r.folder_id,
        title: r.title,
        content: r.content,
        created_at: r.created_at ? new Date(r.created_at) : firestoreHelpers.serverTimestamp(),
        updated_at: firestoreHelpers.serverTimestamp(),
        deleted_at: r.deleted_at ? new Date(r.deleted_at) : null
      }, { merge: true });
    }
    await batch.commit();
    const out: CloudLessonRow[] = [];
    for (const id of ids) {
      const snap = await firestoreHelpers.getDoc(firestoreHelpers.doc(firestoreHelpers.collection(db, 'lessons'), id));
      const data = snap.data();
      if (data) out.push(toLessonRow(snap.id, data));
    }
    return out;
  },
  async deleteLessons(ids) {
    const db = getDb();
    if (!db) return;
    const batch = firestoreHelpers.writeBatch(db);
    for (const id of ids) {
      const ref = firestoreHelpers.doc(firestoreHelpers.collection(db, 'lessons'), id);
      batch.set(ref, { deleted_at: firestoreHelpers.serverTimestamp() }, { merge: true });
    }
    await batch.commit();
  },
  async listLessons(updatedAfter) {
    const db = getDb();
    if (!db) return [];
    const q = firestoreHelpers.query(
      firestoreHelpers.collection(db, 'lessons'),
      firestoreHelpers.where('deleted_at', '==', null)
    );
    const snap = await firestoreHelpers.getDocs(q);
    return snap.docs.map(d => toLessonRow(d.id, d.data()));
  },
  onFoldersChanged(userId, cb) {
    const db = getDb();
    if (!db) return () => {};
    const q = firestoreHelpers.query(
      firestoreHelpers.collection(db, 'folders'),
      firestoreHelpers.where('user_id', '==', userId)
    );
    return firestoreHelpers.onSnapshot(q, (snap) => {
      cb(snap.docs.map(d => toFolderRow(d.id, d.data())));
    });
  },
  onLessonsChanged(userId, cb) {
    const db = getDb();
    if (!db) return () => {};
    const q = firestoreHelpers.query(
      firestoreHelpers.collection(db, 'lessons'),
      firestoreHelpers.where('user_id', '==', userId)
    );
    return firestoreHelpers.onSnapshot(q, (snap) => {
      cb(snap.docs.map(d => toLessonRow(d.id, d.data())));
    });
  }
};
