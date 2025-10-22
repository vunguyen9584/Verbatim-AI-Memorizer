export enum LearningMode {
  QUIZ = 'Quiz',
  PLAY = 'Play',
  CO_PLAY = 'Co-Play',
  MEMORY_TIPS = 'Memory Tips'
}

// --- QUIZ TYPES ---

// Shared
export interface QuizItemBase {
  type: 'cloze_by_token' | 'mcq_cloze' | 'ordering';
  stem: string;
}

// Cloze (Fill-in-the-blank)
export interface ClozeBlank {
  answer_tokens: number[];
  answer_text: string;
}

export interface ClozeQuizItem extends QuizItemBase {
  type: 'cloze_by_token';
  base_text_with_masks: string;
  blanks: ClozeBlank[];
  context_before?: string;
  context_after?: string;
}


// Multiple Choice Cloze
export interface MCQOption {
    text: string;
}

export interface MCQQuizItem extends QuizItemBase {
    type: 'mcq_cloze';
    base_text_with_masks: string;
    options: MCQOption[];
    answer_index: number;
}

// Ordering
export interface OrderingQuizItem extends QuizItemBase {
    type: 'ordering';
    scrambled_words: string[];
    answer_span: [number, number];
}


export type QuizItem = ClozeQuizItem | MCQQuizItem | OrderingQuizItem;

export interface QuizData {
  quizzes: QuizItem[];
}

export interface ErrorExplanation {
  summary: string;
  annotations: {
    type: string;
    at_chars?: number[];
    tokens?: string[];
    example?: string;
  }[];
  tip: string;
}


// --- CO-PLAY TYPES ---
export interface CoPlayPauseRequire {
  span: [number, number];
  user_sentences_to_type?: number;
}

export interface CoPlayTimelineItem {
  reveal_until_token: number;
  pause_require: CoPlayPauseRequire[];
}

export interface CoPlayPlan {
  timeline: CoPlayTimelineItem[];
}

export enum CoPlayModeType {
  AppFirstN = 'app-first-n',
  UserFirstN = 'user-first-n',
  AppFirstRandom = 'app-first-random',
  UserFirstRandom = 'user-first-random',
}

export interface CoPlayModeOption {
  type: CoPlayModeType;
  appSentences: number | 'all';
  userSentences: number | 'all';
  startSentence: number;
  endSentence: number;
}

// --- MEMORY TIPS TYPES ---

export enum MemoryMethod {
  STORY = 'Story',
  ACROSTIC = 'Acrostic'
}

export interface StoryElements {
  elements: string[];
}

export interface AcrosticKeywords {
  keywords: string[];
}

export interface MemoryStoryResult {
  story: string;
}

export interface MemoryAcrosticResult {
  sentence: string;
}

// --- LESSON MANAGEMENT TYPES ---

export interface Folder {
  id: string;
  name: string;
  displayOrder: number;
  createdAt: Date;
  updatedAt: Date;
  isDefault: boolean;
}

export interface Lesson {
  id: string;
  title: string;
  content: string;
  folderId: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface LessonStorage {
  lessons: Lesson[];
  saveLesson: (lesson: Omit<Lesson, 'id' | 'createdAt' | 'updatedAt'>) => Promise<Lesson>;
  updateLesson: (id: string, updates: Partial<Lesson>) => Promise<Lesson>;
  deleteLesson: (id: string) => Promise<void>;
  getLesson: (id: string) => Promise<Lesson | null>;
  getAllLessons: () => Promise<Lesson[]>;
  getLessonsByFolder: (folderId: string) => Promise<Lesson[]>;
}

export interface FolderStorage {
  folders: Folder[];
  saveFolder: (folder: Omit<Folder, 'id' | 'createdAt' | 'updatedAt'>) => Promise<Folder>;
  updateFolder: (id: string, updates: Partial<Folder>) => Promise<Folder>;
  deleteFolder: (id: string) => Promise<void>;
  getFolder: (id: string) => Promise<Folder | null>;
  getAllFolders: () => Promise<Folder[]>;
  getDefaultFolder: () => Promise<Folder>;
  reorderFolders: (folderIds: string[]) => Promise<void>;
}

export interface ToastMessage {
  id: string;
  type: 'success' | 'error';
  message: string;
  duration?: number;
  persistent?: boolean;
}

// --- SYNC & AUTH TYPES ---

export interface AuthUser {
  id: string;
  email?: string | null;
}

export type SyncEntity = 'folder' | 'lesson';

export type SyncOpType = 'upsert' | 'delete';

export interface PendingOp<TPayload = any> {
  id: string; // local op id
  op: SyncOpType;
  entity: SyncEntity;
  payload: TPayload;
  localId?: string; // local entity id
  ts: number; // client timestamp (ms)
}

export type SyncStatus = 'idle' | 'syncing' | 'error' | 'disabled' | 'unauthenticated';

export interface CloudFolderRow {
  id: string; // server uuid
  name: string;
  display_order: number;
  is_default: boolean;
  created_at: string; // ISO
  updated_at: string; // ISO
  deleted_at: string | null; // ISO
}

export interface CloudLessonRow {
  id: string; // server uuid
  folder_id: string; // server uuid
  title: string;
  content: string;
  created_at: string; // ISO
  updated_at: string; // ISO
  deleted_at: string | null; // ISO
}

export interface CloudAdapter {
  isConfigured(): boolean;
  getServerTime(): Promise<string>; // ISO timestamp
  // Folders
  upsertFolders(rows: Array<Partial<CloudFolderRow> & { id?: string }>): Promise<CloudFolderRow[]>;
  deleteFolders(ids: string[]): Promise<void>;
  listFolders(updatedAfter?: string): Promise<CloudFolderRow[]>;
  // Lessons
  upsertLessons(rows: Array<Partial<CloudLessonRow> & { id?: string }>): Promise<CloudLessonRow[]>;
  deleteLessons(ids: string[]): Promise<void>;
  listLessons(updatedAfter?: string): Promise<CloudLessonRow[]>;
  // Optional realtime subscriptions
  onFoldersChanged?: (userId: string, cb: (rows: CloudFolderRow[]) => void) => () => void;
  onLessonsChanged?: (userId: string, cb: (rows: CloudLessonRow[]) => void) => () => void;
}

export interface SyncEngineAPI {
  start(): void;
  stop(): void;
  getStatus(): SyncStatus;
  onStatusChange(listener: (status: SyncStatus) => void): () => void;
  enqueue(op: PendingOp): void;
  triggerSync(reason?: string): Promise<void>;
}