// Simple client-side settings store for user-provided values
// Currently used to store the Gemini API key in localStorage

const GEMINI_API_KEY_STORAGE = 'verbatim_gemini_api_key';

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
  }
};
