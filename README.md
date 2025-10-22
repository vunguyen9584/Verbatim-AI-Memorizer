<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# Verbatim AI Memorizer

React 19 + TypeScript + Vite app for verbatim memorization with Gemini integration. Paste any text, practice via multiple modes, and manage lessons/folders with local persistence and i18n (EN/VI).

## Quick Start

Prerequisites: Node.js (18+ recommended)

1) Install deps: `npm install`
2) Create `.env.local` with your Gemini API key:
   - `GEMINI_API_KEY=YOUR_KEY` (never commit this file; it’s ignored by .gitignore)
3) Dev server: `npm run dev` (http://localhost:3000)
4) Build: `npm run build` | Preview: `npm run preview`

AI key usage: Vite maps `GEMINI_API_KEY` to `process.env.API_KEY` at build time (see `vite.config.ts`).

## Optional: Enable Cloud Sync (Firebase Auth + Firestore)

To use Google sign‑in or Email Link sign‑in and enable syncing, set up Firebase and local env variables.

1) Create `.env.local` in the project root:

```
VITE_SYNC_ENABLED=true
VITE_FIREBASE_API_KEY=your_firebase_api_key
VITE_FIREBASE_AUTH_DOMAIN=your-project-id.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your-project-id
VITE_FIREBASE_APP_ID=your_firebase_app_id
```

2) Firebase Console configuration:

- Authentication → Sign‑in method:
  - Enable Google provider
  - Enable Email/Passwordless → Email link (passwordless)
- Authentication → Settings → Authorized domains:
  - Add `localhost` and optionally `127.0.0.1`

3) Localhost notes:

- Dev server runs at `http://localhost:3000` by default. The app uses `window.location.origin` in the email link flow, so the origin must be authorized in Firebase.
- If Google popup is blocked, allow popups for `localhost:3000` or try again.
- For the email link flow, after clicking the link in your email, ensure it opens in the same browser profile you used to send the link so the app can read the stored email and complete sign‑in.

After saving `.env.local`, restart the dev server.

## Features

- Four Learning Modes
  - Quiz: Gemini‑generated cloze, MCQ, and ordering questions with strict answer checking and result summary.
  - Play: Karaoke‑style auto‑reveal at adjustable WPM.
  - Co‑Play: Alternating reveal/type flow with hints; current version uses a client‑side heuristic planner.
  - Memory Tips: Gemini‑generated memory aids (Story or Acrostic).
- Lesson & Folder Management
  - Create/edit/delete lessons; start learning from a saved lesson.
  - Folders with default folder, drag‑and‑drop reordering, and safeguards (default folder can’t be renamed/deleted).
  - Data persisted in browser Local Storage with migrations for older data.
- Internationalization: English and Vietnamese with a header language switcher.
- Debug utilities: In‑app debug panel and toasts for feedback.

## Tech Stack

- React 19, TypeScript, Vite
- i18next (react‑i18next, browser language detection)
- Google Gemini via `@google/genai`

## AI Studio (optional)

View the app in AI Studio: https://ai.studio/apps/drive/1-VJw2Ijwv0AGIZj7ekdPRIf0GXNMCgRp
