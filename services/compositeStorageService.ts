import { Folder, FolderStorage, Lesson, LessonStorage, PendingOp } from '../types';
import { folderStorageService as localFolder } from './folderStorageService';
import { lessonStorageService as localLesson } from './lessonStorageService';
import { syncEngine } from './syncEngine';

function createOpId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2);
}

class CompositeLessonStorage implements LessonStorage {
  get lessons(): Lesson[] { return localLesson.lessons; }

  async saveLesson(lessonData: Omit<Lesson, 'id' | 'createdAt' | 'updatedAt'>): Promise<Lesson> {
    const saved = await localLesson.saveLesson(lessonData);
    const op: PendingOp = {
      id: createOpId(), op: 'upsert', entity: 'lesson', payload: saved, localId: saved.id, ts: Date.now()
    };
    syncEngine.enqueue(op);
    return saved;
  }

  async updateLesson(id: string, updates: Partial<Lesson>): Promise<Lesson> {
    const updated = await localLesson.updateLesson(id, updates);
    const op: PendingOp = {
      id: createOpId(), op: 'upsert', entity: 'lesson', payload: updated, localId: updated.id, ts: Date.now()
    };
    syncEngine.enqueue(op);
    return updated;
  }

  async deleteLesson(id: string): Promise<void> {
    await localLesson.deleteLesson(id);
    const op: PendingOp = { id: createOpId(), op: 'delete', entity: 'lesson', payload: { id }, localId: id, ts: Date.now() };
    syncEngine.enqueue(op);
  }

  async getLesson(id: string): Promise<Lesson | null> { return localLesson.getLesson(id); }
  async getAllLessons(): Promise<Lesson[]> { return localLesson.getAllLessons(); }
  async getLessonsByFolder(folderId: string): Promise<Lesson[]> { return localLesson.getLessonsByFolder(folderId); }
}

class CompositeFolderStorage implements FolderStorage {
  get folders(): Folder[] { return localFolder.folders; }

  async saveFolder(folderData: Omit<Folder, 'id' | 'createdAt' | 'updatedAt'>): Promise<Folder> {
    const saved = await localFolder.saveFolder(folderData);
    const op: PendingOp = { id: createOpId(), op: 'upsert', entity: 'folder', payload: saved, localId: saved.id, ts: Date.now() };
    syncEngine.enqueue(op);
    return saved;
  }

  async updateFolder(id: string, updates: Partial<Folder>): Promise<Folder> {
    const updated = await localFolder.updateFolder(id, updates);
    const op: PendingOp = { id: createOpId(), op: 'upsert', entity: 'folder', payload: updated, localId: updated.id, ts: Date.now() };
    syncEngine.enqueue(op);
    return updated;
  }

  async deleteFolder(id: string): Promise<void> {
    await localFolder.deleteFolder(id);
    const op: PendingOp = { id: createOpId(), op: 'delete', entity: 'folder', payload: { id }, localId: id, ts: Date.now() };
    syncEngine.enqueue(op);
  }

  async getFolder(id: string): Promise<Folder | null> { return localFolder.getFolder(id); }
  async getAllFolders(): Promise<Folder[]> { return localFolder.getAllFolders(); }
  async getDefaultFolder(): Promise<Folder> { return localFolder.getDefaultFolder(); }
  async reorderFolders(folderIds: string[]): Promise<void> {
    await localFolder.reorderFolders(folderIds);
    const op: PendingOp = { id: createOpId(), op: 'upsert', entity: 'folder', payload: { reorder: folderIds }, ts: Date.now() } as any;
    syncEngine.enqueue(op);
  }
}

export const compositeLessonStorage: LessonStorage = new CompositeLessonStorage();
export const compositeFolderStorage: FolderStorage = new CompositeFolderStorage();



