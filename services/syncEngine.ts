import { PendingOp, SyncEngineAPI, SyncStatus, CloudFolderRow, CloudLessonRow } from '../types';
import { cloudAdapterFirebase as cloudAdapter } from './cloudAdapterFirebase';
import { authService } from './authService';
import { lessonStorageService as localLesson } from './lessonStorageService';
import { folderStorageService as localFolder } from './folderStorageService';

type StatusListener = (s: SyncStatus) => void;

class SimpleSyncEngine implements SyncEngineAPI {
  private status: SyncStatus = 'disabled';
  private listeners: Set<StatusListener> = new Set();
  private queueKey = 'verbatim_pending_ops';
  private cursorKey = 'verbatim_last_synced_at';
  private timer: number | null = null;
  private enabled: boolean = ((import.meta as any).env?.VITE_SYNC_ENABLED === 'true');

  constructor() {
    this.status = (cloudAdapter.isConfigured() && this.enabled) ? 'unauthenticated' : 'disabled';
  }

  start(): void {
    if (!this.enabled || !cloudAdapter.isConfigured()) {
      this.setStatus('disabled');
      return;
    }
    authService.init();
    authService.onChange(() => {
      const user = authService.getUser();
      if (!user) {
        this.setStatus('unauthenticated');
        return;
      }
      this.setStatus('idle');
      // subscribe realtime
      cloudAdapter.onFoldersChanged?.(user.id, (rows) => this.applyRemoteFolders(rows));
      cloudAdapter.onLessonsChanged?.(user.id, (rows) => this.applyRemoteLessons(rows));
    });
    // background timer to flush periodically
    if (this.timer == null) {
      this.timer = window.setInterval(() => {
        this.triggerSync().catch(() => {});
      }, 10000);
    }
  }

  stop(): void {
    if (this.timer != null) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  getStatus(): SyncStatus {
    return this.status;
  }

  onStatusChange(listener: StatusListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  enqueue(op: PendingOp): void {
    const q = this.getQueue();
    q.push(op);
    localStorage.setItem(this.queueKey, JSON.stringify(q));
  }

  async triggerSync(_reason?: string): Promise<void> {
    if (!cloudAdapter.isConfigured()) return;
    if (!authService.getUser()) { this.setStatus('unauthenticated'); return; }
    const q = this.getQueue();
    if (q.length === 0) return;
    this.setStatus('syncing');
    try {
      const user = authService.getUser()!;
      // Split ops; upsert with server timestamps, delete via tombstone
      const folderUpserts: any[] = [];
      const lessonUpserts: any[] = [];
      for (const op of q) {
        if (op.entity === 'folder') {
          if (op.op === 'delete') {
            folderUpserts.push({ id: op.payload.id, user_id: user.id, deleted_at: new Date().toISOString() });
          } else {
            const f = op.payload as any;
            folderUpserts.push({
              id: (f as any).serverId || undefined,
              user_id: user.id,
              name: f.name,
              display_order: f.displayOrder,
              is_default: !!f.isDefault,
              created_at: f.createdAt?.toISOString?.(),
              updated_at: f.updatedAt?.toISOString?.(),
              deleted_at: null
            });
          }
        } else if (op.entity === 'lesson') {
          if (op.op === 'delete') {
            lessonUpserts.push({ id: op.payload.id, user_id: user.id, deleted_at: new Date().toISOString() });
          } else {
            const l = op.payload as any;
            lessonUpserts.push({
              id: (l as any).serverId || undefined,
              user_id: user.id,
              folder_id: l.folderId,
              title: l.title,
              content: l.content,
              created_at: l.createdAt?.toISOString?.(),
              updated_at: l.updatedAt?.toISOString?.(),
              deleted_at: null
            });
          }
        }
      }
      if (folderUpserts.length) await cloudAdapter.upsertFolders(folderUpserts);
      if (lessonUpserts.length) await cloudAdapter.upsertLessons(lessonUpserts);
      localStorage.setItem(this.queueKey, JSON.stringify([]));
      this.setStatus('idle');
    } catch (e) {
      this.setStatus('error');
      throw e;
    }
  }

  private setStatus(s: SyncStatus) {
    this.status = s;
    for (const l of this.listeners) l(s);
  }

  private getQueue(): PendingOp[] {
    try {
      const raw = localStorage.getItem(this.queueKey);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  }

  private applyRemoteFolders(rows: CloudFolderRow[]) {
    // LWW: apply deletes, then updates by updated_at
    const locals = localFolder.folders;
    const byId = new Map(locals.map(f => [f.id, f]));
    rows.forEach(r => {
      const local = byId.get(r.id);
      const remoteUpdated = new Date(r.updated_at).getTime();
      if (r.deleted_at) {
        if (local) {
          localFolder.deleteFolder(local.id).catch(() => {});
        }
      } else if (!local) {
        const newFolder: Omit<import('../types').Folder, 'id' | 'createdAt' | 'updatedAt'> = {
          name: r.name,
          displayOrder: r.display_order,
          isDefault: r.is_default
        };
        localFolder.saveFolder(newFolder).catch(() => {});
      } else {
        // compare timestamps; local has Date
        const localUpdated = local.updatedAt.getTime();
        if (remoteUpdated >= localUpdated) {
          localFolder.updateFolder(local.id, {
            name: r.name,
            displayOrder: r.display_order,
            isDefault: r.is_default
          }).catch(() => {});
        }
      }
    });
  }

  private applyRemoteLessons(rows: CloudLessonRow[]) {
    const locals = localLesson.lessons;
    const byId = new Map(locals.map(l => [l.id, l]));
    rows.forEach(r => {
      const local = byId.get(r.id);
      const remoteUpdated = new Date(r.updated_at).getTime();
      if (r.deleted_at) {
        if (local) {
          localLesson.deleteLesson(local.id).catch(() => {});
        }
      } else if (!local) {
        localLesson.saveLesson({ title: r.title, content: r.content, folderId: r.folder_id }).catch(() => {});
      } else {
        const localUpdated = local.updatedAt.getTime();
        if (remoteUpdated >= localUpdated) {
          localLesson.updateLesson(local.id, {
            title: r.title,
            content: r.content,
            folderId: r.folder_id
          }).catch(() => {});
        }
      }
    });
  }
}

export const syncEngine: SyncEngineAPI = new SimpleSyncEngine();



