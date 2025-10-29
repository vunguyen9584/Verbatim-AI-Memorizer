# Analytics & Insights Plan

Scope: Implement user-facing analytics focused on Accuracy, WPM, Error Patterns, and Weekly Summaries across Quiz, Play, Co‑Play, and Memory Tips modes.

## 1) Goals and Principles
- Accurate, explainable metrics with consistent formulas
- Low overhead: compute summaries at session end; avoid heavy real‑time work
- Offline‑first with Firestore sync when available
- Privacy by default: user data scoped to their account; easy opt‑out/clear
- i18n-ready labels; minimal dependencies (no chart libs initially)

## 2) Metrics Definitions
- Accuracy (char-level): correctChars / (correctChars + errorChars).
  - Derive via alignment between target text and typed text (Levenshtein ops).
  - Optional word-level accuracy later if needed.
- WPM: (charsTyped / 5) / activeMinutes.
  - activeMinutes excludes idle gaps > 5s (configurable) and paused time.
- Error Patterns:
  - Operation types: substitution, insertion, deletion, transposition.
  - Confusion stats: per-char and bigram confusion matrices (target→typed).
  - Top N difficult tokens/words by error frequency and error rate.
- Session timeframe: from first keystroke to last submission/end.

## 3) Instrumentation
- Capture in input surfaces: TextInputArea, Quiz free‑text fields, Play/Co‑Play typing segments.
- Events buffered in memory; only summaries persisted at session end.
- Record:
  - lessonId, mode, startedAt, endedAt
  - targetText snapshot, final typedText
  - keystrokeCount, backspaceCount
  - idleBreaks: timestamps for long idle gaps

## 4) Computation Pipeline
1. On session end, run alignment of targetText vs typedText to compute:
   - correctChars, errorChars, operations, confusion pairs
2. Compute metrics:
   - accuracy = correctChars / (correctChars + errorChars)
   - wpm = (charsTyped / 5) / activeMinutes
3. Reduce operation list into ErrorStats:
   - perChar: { char, errors }
   - perBigram: { from, to, count }
   - types: { substitution, insertion, deletion, transposition }
4. Persist SessionMetrics and compacted ErrorStats; drop raw events.

## 5) Data Model (TypeScript)
```ts
export enum ModeType { Quiz = 'Quiz', Play = 'Play', CoPlay = 'Co-Play', MemoryTips = 'Memory Tips' }

export interface SessionMetrics {
  id: string;           // generated
  uid: string;          // owner
  mode: ModeType;
  lessonId?: string;
  startedAt: Date;
  endedAt: Date;
  durationMs: number;   // endedAt - startedAt
  activeMs: number;     // minus idle gaps
  charsTyped: number;
  backspaces: number;
  accuracy: number;     // 0..1
  wpm: number;          // computed from activeMs
  errorStats: ErrorStats;
}

export interface ErrorStats {
  totals: { substitutions: number; insertions: number; deletions: number; transpositions: number };
  perChar: Array<{ char: string; errors: number }>;           // top N
  confusions: Array<{ target: string; typed: string; count: number }>; // char/bigram
}

export interface WeeklySummary {
  weekKey: string; // e.g., 2025-W44 (ISO week)
  uid: string;
  sessions: number;
  avgWpm: number;
  avgAccuracy: number; // 0..1
  totalActiveMs: number;
  topErrors: ErrorStats; // merged & trimmed
}
```

## 6) Storage & Sync
- Firestore paths (if authenticated):
  - users/{uid}/sessions/{sessionId} => SessionMetrics
  - users/{uid}/weeklySummaries/{weekKey} => WeeklySummary
- Offline-first:
  - Rely on Firestore SDK offline cache; if Firebase not configured/authenticated, persist to localStorage under keys: `verbatim_sessions` and `verbatim_weekly_summaries`, and provide best-effort migration on login (mirror lesson migration pattern).
- Retention:
  - Keep summaries indefinitely; cap stored confusions/perChar arrays to top 50 items per doc.

## 7) Services (new)
- services/analyticsService.ts
  - startSession({ mode, lessonId, targetText }): string
  - recordKeystroke(evt) ⇒ update in-memory counters only
  - endSession(finalTypedText): computes metrics, persists SessionMetrics
  - getWeeklySummary(weekKey): WeeklySummary
  - recomputeWeekly(weekKey): aggregates sessions ⇒ WeeklySummary
- Reuse authService for uid and firebaseClient for db; mirror lessonStorageService style and error handling.

## 8) Aggregation (Weekly)
- Week key: ISO week using UTC; compute Monday‑based boundaries.
- On each session save:
  - Fetch current week summary, update incremental aggregates:
    - sessions += 1
    - avgWpm, avgAccuracy via running mean
    - totalActiveMs += activeMs
    - merge ErrorStats with capped sizes
- Provide a background recompute util for backfill/correction.

## 9) UI/UX
- Session Recap (modal or panel):
  - Accuracy (progress bar), WPM, time, top 3 error patterns
- Analytics Page:
  - Weekly cards: avg WPM, avg Accuracy, total active time
  - Tables for top confusions and per‑char errors
  - Minimal visuals: CSS bars/sparklines via inline SVG; no new deps
- Settings:
  - Toggle: Enable cloud sync of analytics
  - Button: Clear analytics data (local + Firestore for current user)

## 10) i18n
- Add keys under `analytics.*` for labels: accuracy, wpm, errors, weeklySummary, enableSync, clearData, etc.

## 11) Privacy & Security
- Scope all documents by uid; no shared analytics
- Avoid storing raw keystrokes or full text beyond session targetText and final typedText needed for explanation
- Provide clear delete action and confirmation

## 12) Performance Considerations
- Do alignment once per session end; O(n·m) worst‑case is acceptable for typical lesson sizes; short‑circuit identical spans
- Cap arrays, sample confusions for very long texts
- Debounce UI renders; compute off main typing path

## 13) Incremental Delivery
1. Implement analyticsService with local-only persistence + unit compute
2. Wire session lifecycle in Quiz/Play/Co‑Play input components
3. Add recap modal after session
4. Add weekly aggregation + Analytics page
5. Add Firestore persistence and offline migration
6. Polish i18n + settings toggles + data clear

## 14) Validation
- Manual QA scenarios per mode
- Spot-check formulas with known examples
- Compare week aggregates to raw session list
