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
