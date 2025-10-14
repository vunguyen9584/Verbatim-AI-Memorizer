
# Roadmap: Verbatim AI Memorizer

This document outlines the implementation plan and future feature development for the Verbatim AI Memorizer application, based on the provided agentic architecture.

## Vision

To create a world-class, AI-powered learning tool that enables users to achieve absolute verbatim memorization of any text. The application leverages a sophisticated agentic architecture to provide a personalized, effective, and engaging learning experience through principles of active recall, spaced repetition, and incremental difficulty.

---

## Phase 1: Core Functionality (Current Implementation)

This phase focuses on building a functional Minimum Viable Product (MVP) that demonstrates the three core learning modes.

-   **✅ UI Foundation:**
    -   Setup a modern frontend stack using React 18, TypeScript, and Tailwind CSS.
    -   Design a clean, intuitive, and responsive main application layout.

-   **✅ Text Input & Processing:**
    -   Implement a dedicated text area for users to paste the content they wish to learn.
    -   Basic client-side text processing (sentence and word splitting) to simulate the `Content Pipeline`.

-   **✅ AI Agent Service (`geminiService.ts`):**
    -   Create a centralized service to interact with the Google Gemini API.
    -   Encapsulate the specific prompts for each AI agent as defined in the architecture.
    -   Implement robust JSON parsing and error handling for API responses.

-   **✅ Mode 1: Quiz Mode (v1):**
    -   Develop the `QuizMode.tsx` component to manage the quiz lifecycle.
    -   Integrate the `Quiz Generator Agent` to dynamically create "cloze" (fill-in-the-blank) and "typed_exact" quizzes from the user's text.
    -   Implement a strict answer-checking mechanism.
    -   Integrate the `Error Explainer Agent` to provide concise, helpful feedback on incorrect answers.

-   **✅ Mode 2: Play Mode (v1):**
    -   Develop the `PlayMode.tsx` component.
    -   Implement client-side logic for a smooth, word-by-word playback of the text.
    -   Incorporate a "karaoke-style" highlighting effect to visually track progress.

-   **✅ Mode 3: Co-play (Pause & Fill) Mode (v1):**
    -   Develop the `CoPlayMode.tsx` component.
    -   Integrate the `Co-play Planner Agent` to generate a strategic timeline of pause-points.
    -   Implement the interactive playback logic that follows the timeline, pausing and prompting the user for input to continue.

---

## Phase 2: Enhancing the Learning Loop & Personalization

This phase will build upon the core functionality to create a more adaptive and intelligent learning experience.

-   **⏳ Difficulty Progression:**
    -   Integrate the `Difficulty Planner Agent` to create a structured, multi-level learning syllabus for each text, progressing from recognition to full recall.
    -   Allow the user to progress through levels based on performance thresholds.

-   **⏳ Intelligent Hint System:**
    -   Integrate the `Hint Generator Agent` to provide progressively more helpful hints for difficult quiz questions, without giving away the answer immediately.

-   **⏳ Advanced Quiz Types:**
    -   Expand the `Quiz Generator Agent`'s capabilities to include Multiple-Choice Questions (MCQ) and sentence/line ordering exercises.

-   **⏳ User Profiles & Persistence:**
    -   Use browser Local Storage to save the user's text, current progress, and preferences.
    -   This allows users to resume their learning sessions.

---

## Phase 3: Long-Term Retention & Polish

This phase will focus on features that promote long-term memory, provide deeper insights, and refine the user experience.

-   **🗓️ Spaced Repetition System (SRS):**
    -   Implement a client-side SRS algorithm (like FSRS or SM-2) to schedule review sessions for text chunks.
    -   The system will predict the optimal time to practice a specific section to maximize retention.

-   **📊 Progress Analytics:**
    -   Integrate the `Personal Progress Summarizer Agent` to provide users with weekly summaries and actionable recommendations.
    -   Visualize metrics like accuracy, words per minute (WPM), and common error types.

-   **✨ UI/UX Refinements:**
    -   Introduce subtle animations, transitions, and optional sound effects for feedback.
    -   Improve accessibility with keyboard navigation and screen reader support.

-   **☁️ Backend & Cloud Sync:**
    -   Develop a secure backend and database to allow users to create accounts and sync their progress across multiple devices.
