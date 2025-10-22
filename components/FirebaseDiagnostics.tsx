import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import Button from './common/Button';
import { CloudIcon, XCircleIcon } from './common/Icon';
import { firebaseEnv, getFirebaseApp, getAuthInstance, getDb, firestoreHelpers } from '../services/firebaseClient';

interface FirebaseDiagnosticsProps {
  isOpen: boolean;
  onClose: () => void;
}

type CheckResult = {
  id: string;
  label: string;
  status: 'pending' | 'ok' | 'warn' | 'error';
  detail?: string;
};

const Row: React.FC<{ label: string; status: CheckResult['status']; detail?: string }> = ({ label, status, detail }) => {
  const color = status === 'ok' ? 'text-green-400' : status === 'warn' ? 'text-yellow-400' : status === 'pending' ? 'text-gray-400' : 'text-red-400';
  const badge = status.toUpperCase();
  return (
    <div className="flex flex-col gap-1 border border-gray-800 rounded-lg p-3 bg-gray-900/40">
      <div className="flex items-center justify-between">
        <div className="text-gray-200">{label}</div>
        <span className={`text-xs font-semibold ${color}`}>{badge}</span>
      </div>
      {detail && <div className="text-xs text-gray-400 whitespace-pre-wrap break-words">{detail}</div>}
    </div>
  );
};

const FirebaseDiagnostics: React.FC<FirebaseDiagnosticsProps> = ({ isOpen, onClose }) => {
  const { t } = useTranslation();
  const [results, setResults] = useState<Record<string, CheckResult>>({});
  const [running, setRunning] = useState(false);

  const setStatus = (id: string, updater: (prev: CheckResult) => CheckResult) => {
    setResults(prev => ({ ...prev, [id]: updater(prev[id] || { id, label: '', status: 'pending' }) }));
  };

  const checks = useMemo(() => (
    [
      { id: 'env', label: t('firebaseDiag.envVars') },
      { id: 'app', label: t('firebaseDiag.appInit') },
      { id: 'auth', label: t('firebaseDiag.authInit') },
      { id: 'firestore', label: t('firebaseDiag.firestoreInit') },
      { id: 'write', label: t('firebaseDiag.firestoreWrite') },
      { id: 'read', label: t('firebaseDiag.firestoreRead') },
    ] as const
  ), [t]);

  useEffect(() => {
    if (!isOpen) return;
    // initialize rows
    const initial: Record<string, CheckResult> = {};
    for (const c of checks) initial[c.id] = { id: c.id, label: c.label, status: 'pending' };
    setResults(initial);
  }, [isOpen, checks]);

  const run = async () => {
    setRunning(true);
    try {
      // ENV
      const missing: string[] = [];
      const keys: Array<keyof typeof firebaseEnv> = ['apiKey', 'authDomain', 'projectId', 'appId'];
      for (const k of keys) if (!firebaseEnv[k]) missing.push(`VITE_FIREBASE_${k.toUpperCase()}`);
      if (missing.length === 0) {
        setStatus('env', prev => ({ ...prev, label: t('firebaseDiag.envVars'), status: 'ok', detail: `${t('firebaseDiag.envOk')}` }));
      } else {
        setStatus('env', prev => ({ ...prev, label: t('firebaseDiag.envVars'), status: 'error', detail: `${t('firebaseDiag.envMissing')}: ${missing.join(', ')}` }));
      }

      // APP INIT
      try {
        const app = getFirebaseApp();
        if (app) {
          setStatus('app', prev => ({ ...prev, label: t('firebaseDiag.appInit'), status: 'ok', detail: `name=${(app as any).name}` }));
        } else {
          setStatus('app', prev => ({ ...prev, label: t('firebaseDiag.appInit'), status: 'error', detail: t('firebaseDiag.appNull') }));
        }
      } catch (e: any) {
        setStatus('app', prev => ({ ...prev, label: t('firebaseDiag.appInit'), status: 'error', detail: String(e?.message || e) }));
      }

      // AUTH INIT
      try {
        const auth = getAuthInstance();
        if (auth) {
          setStatus('auth', prev => ({ ...prev, label: t('firebaseDiag.authInit'), status: 'ok', detail: `tenantId=${(auth as any).tenantId ?? 'n/a'}` }));
        } else {
          setStatus('auth', prev => ({ ...prev, label: t('firebaseDiag.authInit'), status: 'warn', detail: t('firebaseDiag.authNull') }));
        }
      } catch (e: any) {
        setStatus('auth', prev => ({ ...prev, label: t('firebaseDiag.authInit'), status: 'error', detail: String(e?.message || e) }));
      }

      // FIRESTORE INIT
      let dbOk = false;
      try {
        const db = getDb();
        if (db) {
          dbOk = true;
          setStatus('firestore', prev => ({ ...prev, label: t('firebaseDiag.firestoreInit'), status: 'ok', detail: 'connected' }));
        } else {
          setStatus('firestore', prev => ({ ...prev, label: t('firebaseDiag.firestoreInit'), status: 'warn', detail: t('firebaseDiag.firestoreNull') }));
        }
      } catch (e: any) {
        setStatus('firestore', prev => ({ ...prev, label: t('firebaseDiag.firestoreInit'), status: 'error', detail: String(e?.message || e) }));
      }

      // WRITE/READ TEST only if dbOk
      if (dbOk) {
        const db = getDb();
        try {
          const col = firestoreHelpers.collection(db!, '__diagnostics');
          const ref = firestoreHelpers.doc(col);
          await firestoreHelpers.setDoc(ref, { ts: new Date(), note: 'diagnostics' });
          setStatus('write', prev => ({ ...prev, label: t('firebaseDiag.firestoreWrite'), status: 'ok', detail: t('firebaseDiag.writeOk') }));
          try {
            const snap = await firestoreHelpers.getDoc(ref);
            setStatus('read', prev => ({ ...prev, label: t('firebaseDiag.firestoreRead'), status: snap.exists() ? 'ok' : 'error', detail: snap.exists() ? t('firebaseDiag.readOk') : t('firebaseDiag.readMissing') }));
          } catch (e: any) {
            setStatus('read', prev => ({ ...prev, label: t('firebaseDiag.firestoreRead'), status: 'error', detail: String(e?.message || e) }));
          }
        } catch (e: any) {
          setStatus('write', prev => ({ ...prev, label: t('firebaseDiag.firestoreWrite'), status: 'error', detail: String(e?.message || e) }));
        }
      }
    } finally {
      setRunning(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div className="relative w-[720px] max-w-[95vw] bg-gray-900 border border-gray-800 rounded-xl shadow-xl overflow-hidden">
        <header className="flex items-center justify-between p-4 border-b border-gray-800">
          <div className="flex items-center gap-2">
            <CloudIcon className="w-6 h-6 text-teal-400" />
            <h3 className="font-semibold text-white">{t('firebaseDiag.title')}</h3>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-white" aria-label={t('firebaseDiag.close')}>
            <XCircleIcon className="w-6 h-6" />
          </button>
        </header>
        <div className="p-4 space-y-3 max-h-[70vh] overflow-y-auto">
          <p className="text-sm text-gray-400">{t('firebaseDiag.description')}</p>
          {checks.map(c => (
            <Row key={c.id} label={results[c.id]?.label || c.label} status={results[c.id]?.status || 'pending'} detail={results[c.id]?.detail} />
          ))}
        </div>
        <div className="p-4 border-t border-gray-800 flex items-center justify-end gap-2 bg-gray-900/60">
          <Button variant="secondary" onClick={onClose}>{t('firebaseDiag.close')}</Button>
          <Button onClick={run} disabled={running}>
            {running ? t('firebaseDiag.running') : t('firebaseDiag.runChecks')}
          </Button>
        </div>
      </div>
    </div>
  );
};

export default FirebaseDiagnostics;
