<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# Verbatim AI Memorizer

React 19 + TypeScript + Vite app for verbatim memorization with Gemini integration. Paste any text, practice via multiple modes, and manage lessons/folders with local persistence and i18n (EN/VI).

## Quick Start

Prerequisites: Node.js (18+ recommended)

1) Install deps: `npm install`
2) Create `.env` with your API keys:
   ```env
   # Gemini API Key (required for AI features)
   GEMINI_API_KEY=YOUR_GEMINI_KEY
   
   # Firebase Config (required for authentication)
   VITE_FIREBASE_API_KEY=your_api_key
   VITE_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
   VITE_FIREBASE_PROJECT_ID=your_project_id
   VITE_FIREBASE_STORAGE_BUCKET=your_project.appspot.com
   VITE_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
   VITE_FIREBASE_APP_ID=your_app_id
   ```
   - See `.env.example` for template
   - See `docs/Firebase-Setup.md` for detailed Firebase setup instructions
   - Never commit `.env` (it's in .gitignore)
3) Dev server: `npm run dev` (http://localhost:3000)
4) Build: `npm run build` | Preview: `npm run preview`

Note: Vite maps `GEMINI_API_KEY` to `process.env.API_KEY` at build time (see `vite.config.ts`).

## Features

- **Authentication** 🔐
  - Google OAuth sign-in (one-click)
  - Email link (passwordless) sign-up with profile collection
  - Full app gating - authentication required for all features
  - User profiles stored in Firestore
  - Online/offline status indicator
- **Four Learning Modes**
  - Quiz: Gemini‑generated cloze, MCQ, and ordering questions with strict answer checking and result summary.
  - Play: Karaoke‑style auto‑reveal at adjustable WPM.
  - Co‑Play: Alternating reveal/type flow with hints; current version uses a client‑side heuristic planner.
  - Memory Tips: Gemini‑generated memory aids (Story or Acrostic).
- **Lesson & Folder Management**
  - Create/edit/delete lessons; start learning from a saved lesson.
  - Folders with default folder, drag‑and‑drop reordering, and safeguards (default folder can't be renamed/deleted).
  - Data persisted in browser Local Storage with migrations for older data.
- **Internationalization**: English and Vietnamese with a header language switcher.
- **Debug utilities**: In‑app debug panel and toasts for feedback.

## Tech Stack

- React 19, TypeScript, Vite
- Firebase (Authentication, Firestore)
- i18next (react‑i18next, browser language detection)
- Google Gemini via `@google/genai`

## Documentation

- [Firebase Setup Guide](docs/Firebase-Setup.md) - Detailed instructions for setting up Firebase Authentication and Firestore
- [Authentication Implementation](docs/Authentication-Implementation.md) - Technical details of the authentication implementation
- [Authentication Plan](docs/Authentication-Plan.md) - Original implementation plan
- [Sync Architecture](docs/Sync-Architecture.md) - Data sync architecture (future)
- [Roadmap](docs/Roadmap.md) - Feature roadmap

## AI Studio (optional)

View the app in AI Studio: https://ai.studio/apps/drive/1-VJw2Ijwv0AGIZj7ekdPRIf0GXNMCgRp
