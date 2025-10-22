import { AuthUser, Folder, Lesson } from '../types';
import { authService } from './authService';
import { folderStorageService } from './folderStorageService';
import { lessonStorageService } from './lessonStorageService';

type ViewMode = 'local' | 'cloud';
type ViewListener = (mode: ViewMode, user: AuthUser | null) => void;

function getCloudCacheKeys(userId: string) {
  return {
    foldersKey: `verbatim_cloud_${userId}_folders`,
    lessonsKey: `verbatim_cloud_${userId}_lessons`
  };
}

function mapCloudFolderToLocal(r: any): Folder {
  return {
    id: r.id,
    name: r.name,
    displayOrder: r.display_order ?? 0,
    isDefault: !!r.is_default,
    createdAt: new Date(r.created_at),
    updatedAt: new Date(r.updated_at)
  };
}

function mapCloudLessonToLocal(r: any): Lesson {
  return {
    id: r.id,
    title: r.title,
    content: r.content,
    folderId: r.folder_id,
    createdAt: new Date(r.created_at),
    updatedAt: new Date(r.updated_at)
  };
}

class DataViewService {
  private listeners: Set<ViewListener> = new Set();
  private loggedInAtMs: number | null = null;

  constructor() {
    authService.onChange(async (user) => {
      if (user) {
        this.loggedInAtMs = Date.now();
        // Notify immediately on login
        for (const l of this.listeners) l(this.getCurrentView(), user);
      } else {
        this.loggedInAtMs = null;
        // On logout, wait a bit to ensure sync engine has cleared local data
        await new Promise(resolve => setTimeout(resolve, 100));
        console.log('[DataViewService] User logged out, notifying listeners to reload with empty data');
        for (const l of this.listeners) l(this.getCurrentView(), user);
      }
    });
  }

  getCurrentView(): ViewMode {
    return authService.getUser() ? 'cloud' : 'local';
  }

  onViewChange(listener: ViewListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  async getAllFolders(): Promise<Folder[]> {
    const user = authService.getUser();
    if (!user) {
      return folderStorageService.getAllFolders();
    }
    const { foldersKey } = getCloudCacheKeys(user.id);
    try {
      const raw = localStorage.getItem(foldersKey);
      const rows = raw ? JSON.parse(raw) : [];
      const active = rows.filter((r: any) => !r.deleted_at);
      
      // Get all local folders
      const locals = await folderStorageService.getAllFolders();
      
      if (active.length === 0) {
        // If no cloud data yet, show all local folders
        // This handles the case when user just logged in and cloud cache is empty
        return locals;
      }
      
      const cloudFolders = active.map(mapCloudFolderToLocal).sort((a: Folder, b: Folder) => {
        if (a.isDefault) return -1;
        if (b.isDefault) return 1;
        return a.displayOrder - b.displayOrder;
      });
      
      // Overlay local folders that don't exist in cloud yet
      // Use a more robust check: if created/updated after login, or doesn't exist in cloud
      const cloudIds = new Set(cloudFolders.map(f => f.id));
      const overlay = this.loggedInAtMs
        ? locals.filter(f => {
            // Include if: not in cloud yet, or created/updated after login
            const isNew = !cloudIds.has(f.id);
            const isRecentlyModified = f.createdAt.getTime() >= this.loggedInAtMs! || f.updatedAt.getTime() >= this.loggedInAtMs!;
            return isNew || isRecentlyModified;
          })
        : [];
      
      const merged: Folder[] = [...cloudFolders];
      for (const lf of overlay) {
        // Replace if exists, otherwise add
        const existingIndex = merged.findIndex(f => f.id === lf.id);
        if (existingIndex >= 0) {
          // Use local version if it's newer
          if (lf.updatedAt > merged[existingIndex].updatedAt) {
            merged[existingIndex] = lf;
          }
        } else {
          merged.push(lf);
        }
      }
      
      // Re-sort after merge
      return merged.sort((a, b) => {
        if (a.isDefault) return -1;
        if (b.isDefault) return 1;
        return a.displayOrder - b.displayOrder;
      });
    } catch (error) {
      console.error('Error in getAllFolders:', error);
      // Fallback to local storage on error
      return folderStorageService.getAllFolders();
    }
  }

  async getFolder(folderId: string): Promise<Folder | null> {
    const folders = await this.getAllFolders();
    return folders.find(f => f.id === folderId) || null;
  }

  async getLessonsByFolder(folderId: string): Promise<Lesson[]> {
    const user = authService.getUser();
    if (!user) {
      return lessonStorageService.getLessonsByFolder(folderId);
    }
    const { lessonsKey } = getCloudCacheKeys(user.id);
    try {
      const raw = localStorage.getItem(lessonsKey);
      const rows = raw ? JSON.parse(raw) : [];
      const active = rows.filter((r: any) => !r.deleted_at && r.folder_id === folderId);
      
      // Get all local lessons for this folder
      const locals = await lessonStorageService.getLessonsByFolder(folderId);
      
      if (active.length === 0) {
        // If no cloud data yet, show all local lessons
        return locals;
      }
      
      const cloudLessons = active.map(mapCloudLessonToLocal);
      
      // Overlay local lessons that don't exist in cloud yet
      const cloudIds = new Set(cloudLessons.map(l => l.id));
      const overlay = this.loggedInAtMs
        ? locals.filter(l => {
            // Include if: not in cloud yet, or created/updated after login
            const isNew = !cloudIds.has(l.id);
            const isRecentlyModified = l.createdAt.getTime() >= this.loggedInAtMs! || l.updatedAt.getTime() >= this.loggedInAtMs!;
            return isNew || isRecentlyModified;
          })
        : [];
      
      const merged: Lesson[] = [...cloudLessons];
      for (const ll of overlay) {
        // Replace if exists, otherwise add
        const existingIndex = merged.findIndex(l => l.id === ll.id);
        if (existingIndex >= 0) {
          // Use local version if it's newer
          if (ll.updatedAt > merged[existingIndex].updatedAt) {
            merged[existingIndex] = ll;
          }
        } else {
          merged.push(ll);
        }
      }
      
      return merged;
    } catch (error) {
      console.error('Error in getLessonsByFolder:', error);
      // Fallback to local storage on error
      return lessonStorageService.getLessonsByFolder(folderId);
    }
  }
}

export const dataViewService = new DataViewService();


