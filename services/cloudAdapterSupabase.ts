import { CloudAdapter, CloudFolderRow, CloudLessonRow } from '../types';
import { getSupabaseEnv } from './supabaseClient';

class NoopCloudAdapter implements CloudAdapter {
  isConfigured(): boolean { return false; }
  async getServerTime(): Promise<string> { return new Date().toISOString(); }
  async upsertFolders(): Promise<CloudFolderRow[]> { return []; }
  async deleteFolders(): Promise<void> { /* noop */ }
  async listFolders(): Promise<CloudFolderRow[]> { return []; }
  async upsertLessons(): Promise<CloudLessonRow[]> { return []; }
  async deleteLessons(): Promise<void> { /* noop */ }
  async listLessons(): Promise<CloudLessonRow[]> { return []; }
}

export const cloudAdapter: CloudAdapter = (() => {
  const env = getSupabaseEnv();
  if (!env.url || !env.anonKey) {
    return new NoopCloudAdapter();
  }
  // Lazy create real adapter without bundling supabase until configured
  // For v1 we keep it noop and allow future extension
  return new NoopCloudAdapter();
})();



