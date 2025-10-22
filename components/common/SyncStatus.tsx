import React, { useEffect, useState } from 'react';
import { SyncStatus as SyncStatusType } from '../../types';
import { syncEngine } from '../../services/syncEngine';
import { authService } from '../../services/authService';
import { useToast } from './Toast';

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

  useEffect(() => {
    const off = syncEngine.onStatusChange(setStatus);
    syncEngine.start();
    return () => off();
  }, []);

  return (
    <div className="flex items-center gap-3 text-sm text-gray-300">
      <span className={`inline-block w-2 h-2 rounded-full ${dotClass[status]}`} />
      <span>{label[status]}</span>
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
                showToast({ type: 'success', message: 'Sign-in link sent. Check your email.' });
              } catch (err: any) {
                const message = err?.message || 'Could not send email sign-in link';
                showToast({ type: 'error', message, persistent: true });
              }
            }}
          >Email link</button>
        </div>
      )}
      {status !== 'unauthenticated' && (
        <button className="px-2 py-1 bg-gray-700 rounded" onClick={() => authService.signOut()}>Sign out</button>
      )}
    </div>
  );
};

export default SyncStatus;



