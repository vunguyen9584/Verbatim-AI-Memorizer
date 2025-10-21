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
        // Initialize with default folder
        const defaultFolder = this.createDefaultFolder();
        this.saveToStorage([defaultFolder]);
        return [defaultFolder];
      }
      
      const folders = JSON.parse(stored);
      const parsedFolders = folders.map((folder: any) => ({
        ...folder,
        createdAt: new Date(folder.createdAt),
        updatedAt: new Date(folder.updatedAt)
      }));

      // Ensure default folder exists
      if (!parsedFolders.find((f: Folder) => f.id === this.DEFAULT_FOLDER_ID)) {
        const defaultFolder = this.createDefaultFolder();
        parsedFolders.unshift(defaultFolder);
        this.saveToStorage(parsedFolders);
      }

      return parsedFolders;
    } catch (error) {
      console.error('Error loading folders from storage:', error);
      const defaultFolder = this.createDefaultFolder();
      return [defaultFolder];
    }
  }

  private createDefaultFolder(): Folder {
    return {
      id: this.DEFAULT_FOLDER_ID,
      name: 'Mặc định',
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
    const newFolder: Folder = {
      ...folderData,
      id: this.generateId(),
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
    return this.getStoredFolders();
  }

  async getDefaultFolder(): Promise<Folder> {
    const folders = this.getStoredFolders();
    const defaultFolder = folders.find(f => f.id === this.DEFAULT_FOLDER_ID);
    
    if (!defaultFolder) {
      const newDefaultFolder = this.createDefaultFolder();
      folders.unshift(newDefaultFolder);
      this.saveToStorage(folders);
      return newDefaultFolder;
    }
    
    return defaultFolder;
  }

  get folders(): Folder[] {
    return this.getStoredFolders();
  }
}

export const folderStorageService = new LocalStorageFolderService();

