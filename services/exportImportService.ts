import { Folder, Lesson } from '../types';
import { folderStorageService } from './folderStorageService';
import { lessonStorageService } from './lessonStorageService';

export interface ExportBundle {
  version: 1;
  exportedAt: string;
  folders: Omit<Folder, 'createdAt' | 'updatedAt'> & { createdAt: string; updatedAt: string }[];
  lessons: Omit<Lesson, 'createdAt' | 'updatedAt'> & { createdAt: string; updatedAt: string }[];
}

export const exportImportService = {
  async exportAll(): Promise<Blob> {
    const folders = await folderStorageService.getAllFolders();
    const lessons = await lessonStorageService.getAllLessons();
    const bundle: ExportBundle = {
      version: 1,
      exportedAt: new Date().toISOString(),
      folders: folders.map(f => ({ ...f, createdAt: f.createdAt.toISOString(), updatedAt: f.updatedAt.toISOString() })),
      lessons: lessons.map(l => ({ ...l, createdAt: l.createdAt.toISOString(), updatedAt: l.updatedAt.toISOString() }))
    } as any;
    const json = JSON.stringify(bundle, null, 2);
    return new Blob([json], { type: 'application/json' });
  },

  async importAll(file: File): Promise<{ folders: number; lessons: number }> {
    const text = await file.text();
    const data = JSON.parse(text);
    if (data.version !== 1) throw new Error('Unsupported export version');
    // Merge strategy: add new, update existing by id
    const existingFolders = await folderStorageService.getAllFolders();
    const folderById = new Map(existingFolders.map(f => [f.id, f]));
    let folderCount = 0;
    for (const rf of data.folders) {
      const existing = folderById.get(rf.id);
      if (!existing) {
        // create with given id is not supported by service; create new and ignore id
        await folderStorageService.saveFolder({
          name: rf.name,
          displayOrder: rf.displayOrder,
          isDefault: !!rf.isDefault
        } as any);
      } else {
        await folderStorageService.updateFolder(existing.id, {
          name: rf.name,
          displayOrder: rf.displayOrder,
          isDefault: !!rf.isDefault
        } as any);
      }
      folderCount++;
    }
    const existingLessons = await lessonStorageService.getAllLessons();
    const lessonById = new Map(existingLessons.map(l => [l.id, l]));
    let lessonCount = 0;
    for (const rl of data.lessons) {
      const existing = lessonById.get(rl.id);
      if (!existing) {
        await lessonStorageService.saveLesson({
          title: rl.title,
          content: rl.content,
          folderId: rl.folderId
        });
      } else {
        await lessonStorageService.updateLesson(existing.id, {
          title: rl.title,
          content: rl.content,
          folderId: rl.folderId
        });
      }
      lessonCount++;
    }
    return { folders: folderCount, lessons: lessonCount };
  }
};


