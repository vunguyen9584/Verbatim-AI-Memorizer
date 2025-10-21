import { Lesson, LessonStorage } from '../types';

class LocalStorageLessonService implements LessonStorage {
  private readonly STORAGE_KEY = 'verbatim_lessons';
  private readonly DEFAULT_FOLDER_ID = 'default';

  private generateId(): string {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
  }

  private getStoredLessons(): Lesson[] {
    try {
      const stored = localStorage.getItem(this.STORAGE_KEY);
      if (!stored) return [];
      
      const lessons = JSON.parse(stored);
      let needsMigration = false;
      
      const parsedLessons = lessons.map((lesson: any) => {
        // Migration: add folderId if it doesn't exist
        if (!lesson.folderId) {
          needsMigration = true;
          return {
            ...lesson,
            folderId: this.DEFAULT_FOLDER_ID,
            createdAt: new Date(lesson.createdAt),
            updatedAt: new Date(lesson.updatedAt)
          };
        }
        
        return {
          ...lesson,
          createdAt: new Date(lesson.createdAt),
          updatedAt: new Date(lesson.updatedAt)
        };
      });
      
      // Save migrated data back to storage
      if (needsMigration) {
        this.saveToStorage(parsedLessons);
      }
      
      return parsedLessons;
    } catch (error) {
      console.error('Error loading lessons from storage:', error);
      return [];
    }
  }

  private saveToStorage(lessons: Lesson[]): void {
    try {
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(lessons));
    } catch (error) {
      console.error('Error saving lessons to storage:', error);
      throw new Error('Failed to save lessons to storage');
    }
  }

  async saveLesson(lessonData: Omit<Lesson, 'id' | 'createdAt' | 'updatedAt'>): Promise<Lesson> {
    const lessons = this.getStoredLessons();
    const newLesson: Lesson = {
      ...lessonData,
      id: this.generateId(),
      createdAt: new Date(),
      updatedAt: new Date()
    };

    lessons.push(newLesson);
    this.saveToStorage(lessons);
    
    return newLesson;
  }

  async updateLesson(id: string, updates: Partial<Lesson>): Promise<Lesson> {
    const lessons = this.getStoredLessons();
    const lessonIndex = lessons.findIndex(lesson => lesson.id === id);
    
    if (lessonIndex === -1) {
      throw new Error(`Lesson with id ${id} not found`);
    }

    const updatedLesson: Lesson = {
      ...lessons[lessonIndex],
      ...updates,
      updatedAt: new Date()
    };

    lessons[lessonIndex] = updatedLesson;
    this.saveToStorage(lessons);
    
    return updatedLesson;
  }

  async deleteLesson(id: string): Promise<void> {
    const lessons = this.getStoredLessons();
    const filteredLessons = lessons.filter(lesson => lesson.id !== id);
    
    if (lessons.length === filteredLessons.length) {
      throw new Error(`Lesson with id ${id} not found`);
    }

    this.saveToStorage(filteredLessons);
  }

  async getLesson(id: string): Promise<Lesson | null> {
    const lessons = this.getStoredLessons();
    return lessons.find(lesson => lesson.id === id) || null;
  }

  async getAllLessons(): Promise<Lesson[]> {
    return this.getStoredLessons();
  }

  async getLessonsByFolder(folderId: string): Promise<Lesson[]> {
    const lessons = this.getStoredLessons();
    return lessons.filter(lesson => lesson.folderId === folderId);
  }

  get lessons(): Lesson[] {
    return this.getStoredLessons();
  }
}

export const lessonStorageService = new LocalStorageLessonService();