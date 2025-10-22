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
  private enqueueTimer: number | null = null;
  private enabled: boolean = ((import.meta as any).env?.VITE_SYNC_ENABLED === 'true');
  private currentUserId: string | null = null;

  constructor() {
    this.status = (cloudAdapter.isConfigured() && this.enabled) ? 'unauthenticated' : 'disabled';
  }

  start(): void {
    if (!this.enabled || !cloudAdapter.isConfigured()) {
      this.setStatus('disabled');
      return;
    }
    // Auth is initialized in App.tsx to avoid double initialization.
    authService.onChange(async (user) => {
      if (!user) {
        console.log('[SyncEngine] User logged out');
        
        // Get the previous user ID from status before clearing
        const prevUserId = this.currentUserId;
        this.currentUserId = null;
        
        // Clear all local data (folders and lessons)
        console.log('[SyncEngine] Clearing local data on logout...');
        try {
          await localFolder.clearAll();
          await localLesson.clearAll();
        } catch (error) {
          console.error('[SyncEngine] Error clearing local data:', error);
        }
        
        // Clear cloud cache for the logged out user
        if (prevUserId) {
          this.clearCloudCache(prevUserId);
        }
        
        // Clear pending operations queue
        this.clearPendingQueue();
        
        this.setStatus('unauthenticated');
        console.log('[SyncEngine] All data cleared on logout');
        return;
      }
      console.log('[SyncEngine] User logged in:', user.id);
      this.currentUserId = user.id;
      this.setStatus('idle');
      // Subscribe realtime and update cloud cache (separate from local dataset)
      console.log('[SyncEngine] Setting up realtime listeners for user:', user.id);
      cloudAdapter.onFoldersChanged?.(user.id, (rows) => {
        console.log('[SyncEngine] Folders changed, updating cache with', rows.length, 'folders');
        this.updateCloudCacheFolders(user.id, rows);
      });
      cloudAdapter.onLessonsChanged?.(user.id, (rows) => {
        console.log('[SyncEngine] Lessons changed, updating cache with', rows.length, 'lessons');
        this.updateCloudCacheLessons(user.id, rows);
      });
    });
    // No background auto-upload; uploads are triggered by user actions only
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
    console.log('[SyncEngine] Enqueued operation:', op.entity, op.op, 'Queue size:', q.length);
    // Trigger a debounced immediate sync when user performs an action and is authenticated
    const user = authService.getUser();
    if (user && this.enqueueTimer == null) {
      console.log('[SyncEngine] Scheduling sync in 300ms...');
      this.enqueueTimer = window.setTimeout(() => {
        this.enqueueTimer = null;
        this.triggerSync('user_action').catch((err) => {
          console.error('[SyncEngine] Sync failed:', err);
        });
      }, 300);
    } else if (!user) {
      console.log('[SyncEngine] User not authenticated, sync will be delayed until login');
    }
  }

  async triggerSync(_reason?: string): Promise<void> {
    console.log('[SyncEngine] triggerSync called, reason:', _reason);
    if (!cloudAdapter.isConfigured()) {
      console.log('[SyncEngine] Cloud adapter not configured, skipping sync');
      return;
    }
    if (!authService.getUser()) {
      console.log('[SyncEngine] User not authenticated, setting status to unauthenticated');
      this.setStatus('unauthenticated');
      return;
    }
    const q = this.getQueue();
    if (q.length === 0) {
      console.log('[SyncEngine] Queue is empty, nothing to sync');
      // Nothing to upload; ensure status is idle when authenticated
      this.setStatus('idle');
      return;
    }
    console.log('[SyncEngine] Starting sync, queue size:', q.length);
    this.setStatus('syncing');
    try {
      const user = authService.getUser()!;
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
      console.log('[SyncEngine] Upserting folders:', folderUpserts.length, 'lessons:', lessonUpserts.length);
      if (folderUpserts.length) {
        const result = await cloudAdapter.upsertFolders(folderUpserts);
        console.log('[SyncEngine] Folders upserted:', result.length);
      }
      if (lessonUpserts.length) {
        const result = await cloudAdapter.upsertLessons(lessonUpserts);
        console.log('[SyncEngine] Lessons upserted:', result.length);
      }
      localStorage.setItem(this.queueKey, JSON.stringify([]));
      console.log('[SyncEngine] Sync completed successfully, queue cleared');
      this.setStatus('idle');
    } catch (e) {
      console.error('[SyncEngine] Sync failed with error:', e);
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

  private updateCloudCacheFolders(userId: string, rows: CloudFolderRow[]) {
    try {
      const key = `verbatim_cloud_${userId}_folders`;
      localStorage.setItem(key, JSON.stringify(rows));
    } catch {
      // ignore cache errors
    }
  }

  private updateCloudCacheLessons(userId: string, rows: CloudLessonRow[]) {
    try {
      const key = `verbatim_cloud_${userId}_lessons`;
      localStorage.setItem(key, JSON.stringify(rows));
    } catch {
      // ignore cache errors
    }
  }

  private clearCloudCache(userId: string) {
    try {
      const foldersKey = `verbatim_cloud_${userId}_folders`;
      const lessonsKey = `verbatim_cloud_${userId}_lessons`;
      localStorage.removeItem(foldersKey);
      localStorage.removeItem(lessonsKey);
      console.log('[SyncEngine] Cloud cache cleared for user:', userId);
    } catch (error) {
      console.error('[SyncEngine] Error clearing cloud cache:', error);
    }
  }

  private clearPendingQueue() {
    try {
      localStorage.removeItem(this.queueKey);
      console.log('[SyncEngine] Pending operations queue cleared');
    } catch (error) {
      console.error('[SyncEngine] Error clearing pending queue:', error);
    }
  }
}

export const syncEngine: SyncEngineAPI = new SimpleSyncEngine();



