import { collection, doc, getDoc, setDoc, writeBatch } from 'firebase/firestore';
import { db } from './firebaseClient';
import { authService } from './authService';
import { LearningMode, SessionMetrics, ErrorStats, WeeklySummary } from '../types';
import { settings } from '../utils/settings';

type SessionState = {
  id: string;
  mode: LearningMode;
  lessonId?: string;
  targetSnapshot?: string;
  startedAt: number;
  keystrokeTs: number[];
  backspaces: number;
  typedFragments: string[];
  targetFragments: string[];
  idleThresholdMs: number;
};

const LOCAL_SESSIONS_KEY = 'verbatim_sessions';
const LOCAL_WEEKLY_KEY = 'verbatim_weekly_summaries';
const LOCAL_SYNC_INDEX_KEY = 'verbatim_sessions_synced';

class AnalyticsService {
  private current: SessionState | null = null;
  private autoSyncInit = false;

  startSession(params: { mode: LearningMode; lessonId?: string; targetText?: string; idleThresholdMs?: number }): string {
    // End any previous session defensively
    if (this.current) {
      // best effort finalize previous session without throwing
      try { void this.endSession(); } catch {}
    }
    const id = crypto.randomUUID();
    this.current = {
      id,
      mode: params.mode,
      lessonId: params.lessonId,
      targetSnapshot: params.targetText,
      startedAt: Date.now(),
      keystrokeTs: [],
      backspaces: 0,
      typedFragments: [],
      targetFragments: [],
      idleThresholdMs: params.idleThresholdMs ?? 5000,
    };
    return id;
  }

  recordKeystroke(key: string): void {
    if (!this.current) return;
    const now = Date.now();
    this.current.keystrokeTs.push(now);
    if (key === 'Backspace') this.current.backspaces += 1;
  }

  recordSubmission(typed: string, expected: string): void {
    if (!this.current) return;
    // Normalize to plain strings
    const normTyped = (typed || '').toString();
    const normExpected = (expected || '').toString();
    this.current.typedFragments.push(normTyped);
    this.current.targetFragments.push(normExpected);
  }

  async endSession(): Promise<SessionMetrics> {
    if (!this.current) throw new Error('No active analytics session');
    const s = this.current; this.current = null;

    const endedAt = Date.now();
    const startedAt = s.startedAt;
    const durationMs = Math.max(0, endedAt - startedAt);

    const times = [startedAt, ...s.keystrokeTs, endedAt];
    let activeMs = 0;
    for (let i = 0; i < times.length - 1; i++) {
      const gap = Math.max(0, times[i + 1] - times[i]);
      activeMs += Math.min(gap, s.idleThresholdMs);
    }
    // Avoid zero active time
    if (activeMs === 0) activeMs = durationMs;

    const typedText = s.typedFragments.join('\n');
    const targetText = s.targetFragments.join('\n');

    const alignment = computeAlignment(targetText, typedText);
    const correct = alignment.correctChars;
    const errors = alignment.errorChars;
    const accuracy = (correct + errors) > 0 ? correct / (correct + errors) : 1;
    const charsTyped = typedText.length;
    const minutes = Math.max(0.001, activeMs / 60000);
    const wpm = charsTyped > 0 ? (charsTyped / 5) / minutes : 0;

    const metrics: SessionMetrics = {
      id: s.id,
      uid: authService.getUser()?.uid || 'anonymous',
      mode: s.mode,
      lessonId: s.lessonId,
      startedAt: new Date(startedAt),
      endedAt: new Date(endedAt),
      durationMs,
      activeMs,
      charsTyped,
      backspaces: s.backspaces,
      accuracy,
      wpm,
      errorStats: alignment.errorStats,
    };

    await this.persist(metrics);
    return metrics;
  }

  private async persist(metrics: SessionMetrics): Promise<void> {
    // Save local
    try {
      const raw = localStorage.getItem(LOCAL_SESSIONS_KEY);
      const arr: SessionMetrics[] = raw ? JSON.parse(raw) : [];
      arr.push(metrics);
      localStorage.setItem(LOCAL_SESSIONS_KEY, JSON.stringify(arr));
    } catch (e) {
      console.warn('Failed to persist local sessions:', e);
    }

    // Update weekly summary local
    try {
      const weekKey = isoWeekKey(metrics.startedAt);
      const raw = localStorage.getItem(LOCAL_WEEKLY_KEY);
      const map: Record<string, WeeklySummary> = raw ? JSON.parse(raw) : {};
      const merged = mergeWeekly(map[weekKey], metrics);
      map[weekKey] = merged;
      localStorage.setItem(LOCAL_WEEKLY_KEY, JSON.stringify(map));
    } catch (e) {
      console.warn('Failed to persist local weekly summary:', e);
    }

    // Optionally save to Firestore
    const uid = authService.getUser()?.uid;
    const cloudEnabled = settings.getAnalyticsCloudSyncEnabled();
    if (!uid || !cloudEnabled) return;

    try {
      const sessionsCol = collection(db, 'users', uid, 'sessions');
      await setDoc(doc(sessionsCol, metrics.id), serializeForFirestore(metrics));

      const weekKey = isoWeekKey(metrics.startedAt);
      const weeklyDoc = doc(db, 'users', uid, 'weeklySummaries', weekKey);
      const snap = await getDoc(weeklyDoc);
      const prev = snap.exists() ? deserializeWeekly(snap.data()) : undefined;
      const merged = mergeWeekly(prev, metrics);
      await setDoc(weeklyDoc, serializeWeekly(merged));

      // Mark as synced locally
      try {
        const idx = this.readSyncIndex();
        idx.add(metrics.id);
        this.writeSyncIndex(idx);
      } catch {}
    } catch (e) {
      console.warn('Firestore analytics persist failed (offline ok):', e);
    }
  }

  async getWeeklySummary(weekKey?: string): Promise<WeeklySummary | null> {
    const uid = authService.getUser()?.uid;
    const targetKey = weekKey || isoWeekKey(new Date());

    // Prefer cloud if enabled and uid present
    if (uid && settings.getAnalyticsCloudSyncEnabled()) {
      try {
        const ref = doc(db, 'users', uid, 'weeklySummaries', targetKey);
        const snap = await getDoc(ref);
        if (snap.exists()) return deserializeWeekly(snap.data());
      } catch (e) { /* ignore, fall back to local */ }
    }

    try {
      const raw = localStorage.getItem(LOCAL_WEEKLY_KEY);
      const map: Record<string, WeeklySummary> = raw ? JSON.parse(raw) : {};
      return map[targetKey] || null;
    } catch {
      return null;
    }
  }

  async clearAllAnalytics(): Promise<void> {
    // Clear local
    try {
      localStorage.removeItem(LOCAL_SESSIONS_KEY);
      localStorage.removeItem(LOCAL_WEEKLY_KEY);
    } catch (e) {
      console.warn('Failed clearing local analytics:', e);
    }

    // Clear Firestore if enabled
    const uid = authService.getUser()?.uid;
    if (!uid || !settings.getAnalyticsCloudSyncEnabled()) return;
    try {
      // Best-effort delete all sessions and weekly summaries
      const batch = writeBatch(db);
      const sessionsCol = collection(db, 'users', uid, 'sessions');
      const weeklyCol = collection(db, 'users', uid, 'weeklySummaries');
      // Fetch lists lazily using getDoc not supported on collection without getDocs
      // Avoid bringing getDocs to keep deps small — but we can safely use dynamic import
      const { getDocs } = await import('firebase/firestore');
      const sessionsSnap = await getDocs(sessionsCol);
      sessionsSnap.forEach(d => batch.delete(d.ref));
      const weeklySnap = await getDocs(weeklyCol);
      weeklySnap.forEach(d => batch.delete(d.ref));
      await batch.commit();
    } catch (e) {
      console.warn('Failed clearing Firestore analytics:', e);
    }
  }

  async getAllSessions(): Promise<SessionMetrics[]> {
    try {
      const raw = localStorage.getItem(LOCAL_SESSIONS_KEY);
      const arr: any[] = raw ? JSON.parse(raw) : [];
      const sessions: SessionMetrics[] = arr.map((m: any) => ({
        ...m,
        startedAt: new Date(m.startedAt),
        endedAt: new Date(m.endedAt),
      }));
      // Newest first
      sessions.sort((a, b) => b.startedAt.getTime() - a.startedAt.getTime());
      return sessions;
    } catch {
      return [];
    }
  }

  /**
   * Best-effort background sync of unsynced local sessions to Firestore.
   * Non-throwing; safe to call frequently.
   */
  async syncPendingToCloud(): Promise<void> {
    const uid = authService.getUser()?.uid;
    if (!uid || !settings.getAnalyticsCloudSyncEnabled()) return;
    const isOnline = typeof navigator !== 'undefined' ? navigator.onLine : true;
    if (!isOnline) return;

    let sessions: SessionMetrics[] = [];
    try { sessions = await this.getAllSessions(); } catch { sessions = []; }
    if (!sessions.length) return;

    const idx = this.readSyncIndex();
    const pending = sessions.filter(s => !idx.has(s.id));
    if (!pending.length) return;

    for (let i = 0; i < pending.length; i++) {
      const m = pending[i];
      try {
        const sessionsCol = collection(db, 'users', uid, 'sessions');
        await setDoc(doc(sessionsCol, m.id), serializeForFirestore(m));

        const wk = isoWeekKey(m.startedAt);
        const weeklyDoc = doc(db, 'users', uid, 'weeklySummaries', wk);
        const snap = await getDoc(weeklyDoc);
        const prev = snap.exists() ? deserializeWeekly(snap.data()) : undefined;
        const merged = mergeWeekly(prev, m);
        await setDoc(weeklyDoc, serializeWeekly(merged));

        idx.add(m.id);
        // Yield occasionally to keep UI responsive
        if (i % 5 === 4) await new Promise(r => setTimeout(r, 0));
      } catch (e) {
        // Stop on hard failures but keep what we've synced
        console.warn('Analytics sync item failed:', e);
        break;
      }
    }
    try { this.writeSyncIndex(idx); } catch {}
  }

  /**
   * Initialize auto sync hooks (idempotent). Triggers on auth changes and online events.
   */
  initAutoSync(): void {
    if (this.autoSyncInit) return;
    this.autoSyncInit = true;
    // Fire once on load (deferred)
    setTimeout(() => { void this.syncPendingToCloud(); }, 0);
    // Online event
    if (typeof window !== 'undefined') {
      window.addEventListener('online', () => { void this.syncPendingToCloud(); });
    }
    // Auth changes
    authService.subscribe(() => { void this.syncPendingToCloud(); });
  }

  private readSyncIndex(): Set<string> {
    try {
      const raw = localStorage.getItem(LOCAL_SYNC_INDEX_KEY);
      if (!raw) return new Set();
      const arr: string[] = JSON.parse(raw);
      return new Set(arr);
    } catch { return new Set(); }
  }

  private writeSyncIndex(set: Set<string>): void {
    try {
      localStorage.setItem(LOCAL_SYNC_INDEX_KEY, JSON.stringify(Array.from(set)));
    } catch {}
  }
}

// Singleton
export const analyticsService = new AnalyticsService();

// ---- Helpers ----

function isoWeekKey(date: Date): string {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7; // Monday=1
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil((((d as any) - (yearStart as any)) / 86400000 + 1) / 7);
  const year = d.getUTCFullYear();
  return `${year}-W${String(weekNo).padStart(2, '0')}`;
}

function mergeWeekly(prev: WeeklySummary | undefined, metrics: SessionMetrics): WeeklySummary {
  const weekKey = isoWeekKey(metrics.startedAt);
  const base: WeeklySummary = prev || {
    weekKey,
    uid: metrics.uid,
    sessions: 0,
    avgWpm: 0,
    avgAccuracy: 0,
    totalActiveMs: 0,
    topErrors: emptyErrorStats(),
  };
  const sessions = base.sessions + 1;
  const avgWpm = (base.avgWpm * base.sessions + metrics.wpm) / sessions;
  const avgAccuracy = (base.avgAccuracy * base.sessions + metrics.accuracy) / sessions;
  const totalActiveMs = base.totalActiveMs + metrics.activeMs;
  const topErrors = mergeErrorStats(base.topErrors, metrics.errorStats, 50);
  return { ...base, sessions, avgWpm, avgAccuracy, totalActiveMs, topErrors };
}

function emptyErrorStats(): ErrorStats {
  return {
    totals: { substitutions: 0, insertions: 0, deletions: 0, transpositions: 0 },
    perChar: [],
    confusions: [],
  };
}

function mergeErrorStats(a: ErrorStats, b: ErrorStats, cap: number): ErrorStats {
  const totals = {
    substitutions: a.totals.substitutions + b.totals.substitutions,
    insertions: a.totals.insertions + b.totals.insertions,
    deletions: a.totals.deletions + b.totals.deletions,
    transpositions: a.totals.transpositions + b.totals.transpositions,
  };

  const perCharMap = new Map<string, number>();
  for (const { char, errors } of [...a.perChar, ...b.perChar]) {
    perCharMap.set(char, (perCharMap.get(char) || 0) + errors);
  }
  const perChar = [...perCharMap.entries()]
    .map(([char, errors]) => ({ char, errors }))
    .sort((x, y) => y.errors - x.errors)
    .slice(0, cap);

  const confMap = new Map<string, number>();
  for (const { target, typed, count } of [...a.confusions, ...b.confusions]) {
    const k = `${target}→${typed}`;
    confMap.set(k, (confMap.get(k) || 0) + count);
  }
  const confusions = [...confMap.entries()]
    .map(([k, count]) => {
      const [target, typed] = k.split('→');
      return { target, typed, count };
    })
    .sort((x, y) => y.count - x.count)
    .slice(0, cap);

  return { totals, perChar, confusions };
}

function computeAlignment(target: string, typed: string): { correctChars: number; errorChars: number; errorStats: ErrorStats } {
  // Dynamic programming Levenshtein with simple transposition detection on backtrace
  const a = [...target];
  const b = [...typed];
  const n = a.length, m = b.length;
  const dp: number[][] = Array.from({ length: n + 1 }, () => Array(m + 1).fill(0));
  for (let i = 0; i <= n; i++) dp[i][0] = i;
  for (let j = 0; j <= m; j++) dp[0][j] = j;
  for (let i = 1; i <= n; i++) {
    for (let j = 1; j <= m; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(
        dp[i - 1][j] + 1,          // deletion
        dp[i][j - 1] + 1,          // insertion
        dp[i - 1][j - 1] + cost,   // substitution or match
      );
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
        dp[i][j] = Math.min(dp[i][j], dp[i - 2][j - 2] + 1); // transposition
      }
    }
  }

  // Backtrace to collect operations
  let i = n, j = m;
  let correct = 0, errors = 0;
  const stats = emptyErrorStats();
  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && a[i - 1] === b[j - 1] && dp[i][j] === dp[i - 1][j - 1]) {
      correct += 1; i -= 1; j -= 1; continue;
    }
    // transposition
    if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1] && dp[i][j] === dp[i - 2][j - 2] + 1) {
      errors += 2;
      stats.totals.transpositions += 1;
      const bigramTarget = `${a[i - 2]}${a[i - 1]}`;
      const bigramTyped = `${b[j - 2]}${b[j - 1]}`;
      addConfusion(stats, bigramTarget, bigramTyped, 1);
      addPerChar(stats, a[i - 1], 1);
      addPerChar(stats, a[i - 2], 1);
      i -= 2; j -= 2; continue;
    }
    // substitution
    if (i > 0 && j > 0 && dp[i][j] === dp[i - 1][j - 1] + 1) {
      errors += 1;
      stats.totals.substitutions += 1;
      addConfusion(stats, a[i - 1], b[j - 1], 1);
      addPerChar(stats, a[i - 1], 1);
      i -= 1; j -= 1; continue;
    }
    // deletion
    if (i > 0 && dp[i][j] === dp[i - 1][j] + 1) {
      errors += 1;
      stats.totals.deletions += 1;
      addConfusion(stats, a[i - 1], '∅', 1);
      addPerChar(stats, a[i - 1], 1);
      i -= 1; continue;
    }
    // insertion
    if (j > 0 && dp[i][j] === dp[i][j - 1] + 1) {
      errors += 1;
      stats.totals.insertions += 1;
      addConfusion(stats, '∅', b[j - 1], 1);
      addPerChar(stats, b[j - 1], 1); // count against typed char as well
      j -= 1; continue;
    }
    // Fallback
    if (i > 0) { i -= 1; }
    else if (j > 0) { j -= 1; }
  }

  // Cap arrays
  stats.perChar = stats.perChar.sort((x, y) => y.errors - x.errors).slice(0, 50);
  stats.confusions = stats.confusions.sort((x, y) => y.count - x.count).slice(0, 50);

  return { correctChars: correct, errorChars: errors, errorStats: stats };
}

function addPerChar(stats: ErrorStats, char: string, delta: number) {
  const idx = stats.perChar.findIndex(x => x.char === char);
  if (idx >= 0) stats.perChar[idx].errors += delta; else stats.perChar.push({ char, errors: delta });
}

function addConfusion(stats: ErrorStats, target: string, typed: string, delta: number) {
  const idx = stats.confusions.findIndex(x => x.target === target && x.typed === typed);
  if (idx >= 0) stats.confusions[idx].count += delta; else stats.confusions.push({ target, typed, count: delta });
}

function serializeForFirestore(m: SessionMetrics) {
  return {
    ...m,
    startedAt: m.startedAt,
    endedAt: m.endedAt,
  } as any;
}

function serializeWeekly(w: WeeklySummary) { return { ...w }; }
function deserializeWeekly(data: any): WeeklySummary { return { ...data } as WeeklySummary; }
