// Simple client-side settings store for user-provided values
// Currently used to store the Gemini API key in localStorage

const GEMINI_API_KEY_STORAGE = 'verbatim_gemini_api_key';
const ANALYTICS_SYNC_STORAGE = 'verbatim_analytics_cloud_sync';

export const settings = {
  getGeminiApiKey(): string | null {
    try {
      return window.localStorage.getItem(GEMINI_API_KEY_STORAGE);
    } catch {
      return null;
    }
  },

  setGeminiApiKey(key: string): void {
    try {
      window.localStorage.setItem(GEMINI_API_KEY_STORAGE, key);
    } catch (e) {
      console.error('Failed to persist Gemini API key:', e);
    }
  },

  clearGeminiApiKey(): void {
    try {
      window.localStorage.removeItem(GEMINI_API_KEY_STORAGE);
    } catch (e) {
      console.error('Failed to clear Gemini API key:', e);
    }
  },

  getAnalyticsCloudSyncEnabled(): boolean {
    try {
      const v = window.localStorage.getItem(ANALYTICS_SYNC_STORAGE);
      return v === '1' || v === 'true';
    } catch {
      return false;
    }
  },

  setAnalyticsCloudSyncEnabled(enabled: boolean): void {
    try {
      window.localStorage.setItem(ANALYTICS_SYNC_STORAGE, enabled ? '1' : '0');
    } catch (e) {
      console.error('Failed to persist analytics sync setting:', e);
    }
  }
};
