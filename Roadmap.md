
# Roadmap: Verbatim AI Memorizer

This roadmap reflects what’s implemented today and what’s planned next, aligned with the current codebase.

## Vision

Build an AI‑powered tool that helps users memorize text verbatim through active recall, spaced repetition, and incremental difficulty.

---

## Phase 1: Core Functionality (Current)

- UI Foundation
  - React 19 + TypeScript + Vite app shell, responsive layout, toasts, and debug panel.
  - i18n with EN/VI and header language switcher.
- Text Input & Processing
  - Paste text input; tokenization and basic sentence parsing for playback/planning.
- AI Service (`services/geminiService.ts`)
  - Gemini via `@google/genai` with schema‑guided JSON; robust parsing and validations.
- Modes
  - Quiz Mode: Gemini‑generated cloze/MCQ/ordering questions; strict checking and results.
  - Play Mode: Karaoke‑style revealing with adjustable WPM.
  - Co‑Play Mode: Alternating reveal/type flow with hints; current plan generation is client‑side heuristic (no AI planner yet).
  - Memory Tips Mode: Gemini‑generated Story/Acrostic aids.
- Lesson & Folder Management
  - Local Storage persistence for lessons and folders; default folder initialization and migration.
  - Drag‑and‑drop folder reordering; default folder protected from rename/delete.

---

## Phase 2: Personalization & Intelligence (Next)

- Co‑Play Planner Agent: Replace heuristic planner with Gemini‑driven timeline generation.
- Difficulty Progression: Multi‑level syllabus and advancement thresholds.
- Intelligent Hints: Progressive hinting for quizzes and co‑play typing turns.
- Advanced Quiz Refinements: Better validation/UX, richer formats, and stability improvements.
- Persistence Enhancements: Save progress metrics and preferences; resume sessions seamlessly.

---

## Phase 3: Retention & Scale (Future)

- Spaced Repetition (FSRS/SM‑2) scheduling for long‑term retention.
- Analytics & Insights: Accuracy, WPM, error patterns, weekly summaries.
- UI/UX Polish and accessibility improvements.
- Backend & Sync: Optional accounts with cloud sync across devices.
