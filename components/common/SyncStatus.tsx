import React, { useEffect, useState } from 'react';
import { SyncStatus as SyncStatusType } from '../../types';
import { syncEngine } from '../../services/syncEngine';
import { authService } from '../../services/authService';
import { useToast } from './Toast';
import { useTranslation } from 'react-i18next';
import { exportImportService } from '../../services/exportImportService';
import { dataViewService } from '../../services/dataViewService';

const dotClass: Record<SyncStatusType, string> = {
  idle: 'bg-teal-400',
  syncing: 'bg-yellow-400',
  error: 'bg-red-500',
  disabled: 'bg-gray-500',
  unauthenticated: 'bg-gray-500'
};

const label: Record<SyncStatusType, string> = {
  idle: 'Synced',
  syncing: 'Syncing…',
  error: 'Sync error',
  disabled: 'Sync off',
  unauthenticated: 'Sign in to sync'
};

const SyncStatus: React.FC = () => {
  const [status, setStatus] = useState<SyncStatusType>(syncEngine.getStatus());
  const [email, setEmail] = useState('');
  const { showToast } = useToast();
  const { t } = useTranslation();
  const [isCloudView, setIsCloudView] = useState(dataViewService.getCurrentView() === 'cloud');

  useEffect(() => {
    const off = syncEngine.onStatusChange(setStatus);
    syncEngine.start();
    const offView = dataViewService.onViewChange((mode) => setIsCloudView(mode === 'cloud'));
    return () => { off(); offView(); };
  }, []);

  const mapEmailLinkError = (err: any): string => {
    const code = err?.code || err?.message || '';
    if (typeof code === 'string') {
      if (code.includes('operation-not-allowed') || code.includes('OPERATION_NOT_ALLOWED')) return t('auth.emailLink.operationNotAllowed');
      if (code.includes('invalid-email')) return t('auth.emailLink.invalidEmail');
      if (code.includes('too-many-requests')) return t('auth.emailLink.tooManyRequests');
      if (code.includes('network-request-failed')) return t('auth.emailLink.networkRequestFailed');
    }
    return t('auth.emailLink.genericError');
  };

  return (
    <div className="flex items-center gap-3 text-sm text-gray-300">
      <span className={`inline-block w-2 h-2 rounded-full ${dotClass[status]}`} />
      <span>{label[status]}{isCloudView ? ' · Cloud' : ' · Local'}</span>
      {status === 'unauthenticated' && (
        <div className="flex items-center gap-2">
          <button
            className="px-2 py-1 bg-teal-600 rounded"
            onClick={async () => {
              try {
                await authService.signInWithGoogle();
              } catch (err: any) {
                const message = err?.message || 'Google sign-in failed';
                showToast({ type: 'error', message, persistent: true });
              }
            }}
          >Google</button>
          <input
            className="px-2 py-1 bg-gray-700 rounded placeholder-gray-400"
            placeholder="email@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <button
            className="px-2 py-1 bg-teal-600 rounded"
            onClick={async () => {
              if (!email) return;
              try {
                await authService.sendEmailLink(email);
                showToast({ type: 'success', message: t('auth.emailLink.sent') });
              } catch (err: any) {
                const message = mapEmailLinkError(err);
                showToast({ type: 'error', message, persistent: true });
              }
            }}
          >Email link</button>
        </div>
      )}
      {status !== 'unauthenticated' && (
        <button className="px-2 py-1 bg-gray-700 rounded" onClick={() => authService.signOut()}>Sign out</button>
      )}
      <button
        className="px-2 py-1 bg-gray-700 rounded"
        onClick={async () => {
          try {
            const blob = await exportImportService.exportAll();
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `verbatim-export-${new Date().toISOString().slice(0,19)}.json`;
            a.click();
            URL.revokeObjectURL(url);
          } catch (e: any) {
            showToast({ type: 'error', message: e?.message || 'Export failed', persistent: true });
          }
        }}
      >Export</button>
      <label className="px-2 py-1 bg-gray-700 rounded cursor-pointer">
        Import
        <input
          type="file"
          accept="application/json"
          className="hidden"
          onChange={async (e) => {
            const file = e.target.files?.[0];
            if (!file) return;
            try {
              const res = await exportImportService.importAll(file);
              showToast({ type: 'success', message: `Imported ${res.folders} folders, ${res.lessons} lessons` });
            } catch (err: any) {
              showToast({ type: 'error', message: err?.message || 'Import failed', persistent: true });
            } finally {
              e.currentTarget.value = '';
            }
          }}
        />
      </label>
    </div>
  );
};

export default SyncStatus;



