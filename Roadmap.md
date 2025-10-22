
# Roadmap: Verbatim AI Memorizer

This roadmap reflects what’s implemented today and what’s planned next, aligned with the current codebase.

## Vision

Build an AI‑powered tool that helps users memorize text verbatim through active recall, spaced repetition, and incremental difficulty.

---

## Phase 1: Core Functionality (Current)

- UI Foundation — Status: Implemented
  - React 19 + TypeScript + Vite app shell, responsive layout, toasts, and debug panel. — Status: Implemented
  - i18n with EN/VI and header language switcher. — Status: Implemented
- Text Input & Processing — Status: Implemented
  - Paste text input; tokenization and basic sentence parsing for playback/planning. — Status: Implemented
- AI Service (`services/geminiService.ts`) — Status: Implemented
  - Gemini via `@google/genai` with schema‑guided JSON; robust parsing and validations. — Status: Implemented
- Modes — Status: Implemented
  - Quiz Mode: Gemini‑generated cloze/MCQ/ordering questions; strict checking and results. — Status: Implemented
  - Play Mode: Karaoke‑style revealing with adjustable WPM. — Status: Implemented
  - Co‑Play Mode: Alternating reveal/type flow with hints; current plan generation is client‑side heuristic (no AI planner yet). — Status: Implemented
  - Memory Tips Mode: Gemini‑generated Story/Acrostic aids. — Status: Implemented
- Lesson & Folder Management — Status: Implemented
  - Local Storage persistence for lessons and folders; default folder initialization and migration. — Status: Implemented
  - Drag‑and‑drop folder reordering; default folder protected from rename/delete. — Status: Implemented

---

## Phase 2: Personalization & Intelligence (Next)

- Co‑Play Planner Agent: Replace heuristic planner with Gemini‑driven timeline generation. — Status: Not Implemented
- Difficulty Progression: Multi‑level syllabus and advancement thresholds. — Status: Not Implemented
- Intelligent Hints: Progressive hinting for quizzes and co‑play typing turns. — Status: Partial (basic word‑by‑word hint in Co‑Play; no quiz hints)
- Advanced Quiz Refinements: Better validation/UX, richer formats, and stability improvements. — Status: Partial (baseline validations present)
- Persistence Enhancements: Save progress metrics and preferences; resume sessions seamlessly. — Status: Not Implemented

---

## Phase 3: Retention & Scale (Future)

- Spaced Repetition (FSRS/SM‑2) scheduling for long‑term retention. — Status: Not Implemented
- Analytics & Insights: Accuracy, WPM, error patterns, weekly summaries. — Status: Not Implemented
- UI/UX Polish and accessibility improvements. — Status: Not Implemented
- Backend & Sync: Optional accounts with cloud sync across devices. — Status: Not Implemented
