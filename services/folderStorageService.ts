import { Folder, FolderStorage } from '../types';

class LocalStorageFolderService implements FolderStorage {
  private readonly STORAGE_KEY = 'verbatim_folders';
  private readonly DEFAULT_FOLDER_ID = 'default';

  private generateId(): string {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
  }

  private getStoredFolders(): Folder[] {
    try {
      const stored = localStorage.getItem(this.STORAGE_KEY);
      if (!stored) {
        // Return empty array instead of auto-creating default folder
        // Default folder will be created on-demand when needed
        return [];
      }
      
      const folders = JSON.parse(stored);
      let needsMigration = false;
      
      const parsedFolders = folders.map((folder: any, index: number) => {
        // Migration: add displayOrder if it doesn't exist
        if (folder.displayOrder === undefined) {
          needsMigration = true;
          return {
            ...folder,
            displayOrder: index,
            createdAt: new Date(folder.createdAt),
            updatedAt: new Date(folder.updatedAt)
          };
        }
        
        return {
          ...folder,
          createdAt: new Date(folder.createdAt),
          updatedAt: new Date(folder.updatedAt)
        };
      });

      // Migration: normalize default folder's name to i18n key
      const defaultByIdIndex = parsedFolders.findIndex((f: Folder) => f.id === this.DEFAULT_FOLDER_ID);
      if (defaultByIdIndex !== -1) {
        const defaultFolder = parsedFolders[defaultByIdIndex];
        let updated = false;
        if (defaultFolder.name !== 'folderManagement.default') {
          defaultFolder.name = 'folderManagement.default';
          updated = true;
        }
        if (!defaultFolder.isDefault) {
          defaultFolder.isDefault = true;
          updated = true;
        }
        if (updated) {
          defaultFolder.updatedAt = new Date();
          needsMigration = true;
        }
      }

      // Ensure default folder exists
      if (!parsedFolders.find((f: Folder) => f.id === this.DEFAULT_FOLDER_ID)) {
        const defaultFolder = this.createDefaultFolder();
        parsedFolders.unshift(defaultFolder);
        needsMigration = true;
      }

      // Save migrated data back to storage
      if (needsMigration) {
        this.saveToStorage(parsedFolders);
      }

      // Sort by displayOrder (default folder always first)
      return parsedFolders.sort((a, b) => {
        if (a.isDefault) return -1;
        if (b.isDefault) return 1;
        return a.displayOrder - b.displayOrder;
      });
    } catch (error) {
      console.error('Error loading folders from storage:', error);
      const defaultFolder = this.createDefaultFolder();
      return [defaultFolder];
    }
  }

  private createDefaultFolder(): Folder {
    return {
      id: this.DEFAULT_FOLDER_ID,
      name: 'folderManagement.default', // Translation key instead of hardcoded text
      displayOrder: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
      isDefault: true
    };
  }

  private saveToStorage(folders: Folder[]): void {
    try {
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(folders));
    } catch (error) {
      console.error('Error saving folders to storage:', error);
      throw new Error('Failed to save folders to storage');
    }
  }

  async saveFolder(folderData: Omit<Folder, 'id' | 'createdAt' | 'updatedAt'>): Promise<Folder> {
    const folders = this.getStoredFolders();
    
    // Calculate next display order (max + 1)
    const maxOrder = folders.reduce((max, folder) => 
      Math.max(max, folder.displayOrder), -1);
    
    const newFolder: Folder = {
      ...folderData,
      id: this.generateId(),
      displayOrder: maxOrder + 1,
      createdAt: new Date(),
      updatedAt: new Date(),
      isDefault: false
    };

    folders.push(newFolder);
    this.saveToStorage(folders);
    
    return newFolder;
  }

  async updateFolder(id: string, updates: Partial<Folder>): Promise<Folder> {
    const folders = this.getStoredFolders();
    const folderIndex = folders.findIndex(folder => folder.id === id);
    
    if (folderIndex === -1) {
      throw new Error(`Folder with id ${id} not found`);
    }

    // Prevent updating default folder name or isDefault flag
    if (folders[folderIndex].isDefault) {
      throw new Error('Cannot modify default folder');
    }

    const updatedFolder: Folder = {
      ...folders[folderIndex],
      ...updates,
      id: folders[folderIndex].id, // Ensure id doesn't change
      isDefault: folders[folderIndex].isDefault, // Ensure isDefault doesn't change
      updatedAt: new Date()
    };

    folders[folderIndex] = updatedFolder;
    this.saveToStorage(folders);
    
    return updatedFolder;
  }

  async deleteFolder(id: string): Promise<void> {
    const folders = this.getStoredFolders();
    const folder = folders.find(f => f.id === id);
    
    if (!folder) {
      throw new Error(`Folder with id ${id} not found`);
    }

    if (folder.isDefault) {
      throw new Error('Cannot delete default folder');
    }

    const filteredFolders = folders.filter(folder => folder.id !== id);
    this.saveToStorage(filteredFolders);
  }

  async getFolder(id: string): Promise<Folder | null> {
    const folders = this.getStoredFolders();
    return folders.find(folder => folder.id === id) || null;
  }

  async getAllFolders(): Promise<Folder[]> {
    const folders = this.getStoredFolders();
    // Don't auto-create default folder if empty (e.g., after logout)
    // Default folder will be created when actually needed
    return folders;
  }

  async getDefaultFolder(): Promise<Folder> {
    const folders = this.getStoredFolders();
    let defaultFolder = folders.find(f => f.id === this.DEFAULT_FOLDER_ID);
    
    if (!defaultFolder) {
      // Create default folder on-demand (e.g., when saving a lesson)
      defaultFolder = this.createDefaultFolder();
      folders.unshift(defaultFolder);
      this.saveToStorage(folders);
    }
    
    return defaultFolder;
  }

  async reorderFolders(folderIds: string[]): Promise<void> {
    const folders = this.getStoredFolders();
    const folderMap = new Map(folders.map(f => [f.id, f]));
    
    // Update display order based on the new order
    const reorderedFolders = folderIds.map((id, index) => {
      const folder = folderMap.get(id);
      if (!folder) {
        throw new Error(`Folder with id ${id} not found`);
      }
      
      return {
        ...folder,
        displayOrder: index,
        updatedAt: new Date()
      };
    });
    
    this.saveToStorage(reorderedFolders);
  }

  get folders(): Folder[] {
    return this.getStoredFolders();
  }

  async clearAll(): Promise<void> {
    try {
      localStorage.removeItem(this.STORAGE_KEY);
      console.log('[FolderStorage] All folders cleared from local storage');
    } catch (error) {
      console.error('Error clearing folders from storage:', error);
      throw new Error('Failed to clear folders from storage');
    }
  }
}

export const folderStorageService = new LocalStorageFolderService();

