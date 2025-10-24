import React, { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { authService } from '../../services/authService';
import { AuthUser } from '../../types';
import Avatar from './Avatar';
import { createPortal } from 'react-dom';

const SyncStatus: React.FC = () => {
  const { t } = useTranslation();
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [showDropdown, setShowDropdown] = useState(false);
  const buttonRef = useRef<HTMLButtonElement | null>(null);
  const [menuPos, setMenuPos] = useState<{ top: number; left: number; width: number; maxHeight: number }>({ top: 0, left: 0, width: 256, maxHeight: 0 });

  useEffect(() => {
    // Subscribe to auth state
    const unsubscribe = authService.subscribe((currentUser) => {
      setUser(currentUser);
    });

    // Listen to online/offline events
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      unsubscribe();
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  useEffect(() => {
    if (!showDropdown) return;

    const calcPosition = () => {
      const el = buttonRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();

      const viewportW = window.innerWidth;
      const viewportH = window.innerHeight;
      const desiredWidth = Math.min(256, viewportW - 16); // 16px margin

      const left = Math.min(
        Math.max(8, rect.right - desiredWidth),
        viewportW - 8 - desiredWidth
      );
      const top = Math.min(rect.bottom + 8, viewportH - 8); // place below button
      const maxHeight = Math.max(120, viewportH - top - 8); // keep inside viewport

      setMenuPos({ top, left, width: desiredWidth, maxHeight });
    };

    calcPosition();
    window.addEventListener('resize', calcPosition);
    window.addEventListener('scroll', calcPosition, true);
    return () => {
      window.removeEventListener('resize', calcPosition);
      window.removeEventListener('scroll', calcPosition, true);
    };
  }, [showDropdown]);

  const handleSignOut = async () => {
    try {
      await authService.signOut();
      setShowDropdown(false);
    } catch (error: any) {
      console.error('Sign out error:', error);
    }
  };

  if (!user) {
    return (
      <div className="flex items-center gap-2 text-sm text-gray-400">
        <div className="w-2 h-2 bg-gray-500 rounded-full"></div>
        <span>{t('auth.signInRequired')}</span>
      </div>
    );
  }

  return (
    <div>
      <button
        ref={buttonRef}
        onClick={() => setShowDropdown(!showDropdown)}
        className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-gray-700 transition-colors"
        aria-expanded={showDropdown}
      >
        {/* Avatar */}
        <Avatar
          src={user.photoURL}
          alt={user.displayName || user.email || 'User'}
          size="sm"
          fallbackText={user.displayName || user.email || ''}
        />

        {/* User info */}
        <div className="text-left hidden md:block">
          <div className="text-sm font-medium text-white">
            {user.displayName || user.email}
          </div>
          <div className="flex items-center gap-1 text-xs">
            <div
              className={`w-2 h-2 rounded-full ${
                isOnline ? 'bg-green-500' : 'bg-red-500'
              }`}
            ></div>
            <span className="text-gray-400">
              {isOnline ? t('auth.online') : t('auth.offline')}
            </span>
          </div>
        </div>

        {/* Dropdown arrow */}
        <svg
          className={`w-4 h-4 text-gray-400 transition-transform ${
            showDropdown ? 'rotate-180' : ''
          }`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M19 9l-7 7-7-7"
          />
        </svg>
      </button>

      {/* Dropdown menu via portal to avoid clipping on mobile */}
      {showDropdown && createPortal(
        <>
          <div className="fixed inset-0 z-40" onClick={() => setShowDropdown(false)} />
          <div
            className="fixed z-50 bg-gray-800 rounded-lg shadow-xl border border-gray-700"
            style={{
              top: menuPos.top,
              left: menuPos.left,
              width: menuPos.width,
              maxHeight: menuPos.maxHeight,
              overflowY: 'auto'
            }}
          >
            <div className="p-4 border-b border-gray-700">
              <div className="text-sm text-gray-400">{t('auth.signedInAs')}</div>
              <div className="text-white font-medium truncate">{user.email}</div>
              {user.provider && (
                <div className="text-xs text-gray-500 mt-1 capitalize">
                  {user.provider === 'email-link' ? 'Email' : user.provider}
                </div>
              )}
            </div>
            <div className="p-2">
              <button
                onClick={() => {
                  window.location.hash = '#/introduction';
                  setShowDropdown(false);
                }}
                className="w-full text-left px-4 py-2 text-sm text-teal-400 hover:bg-gray-700 rounded transition-colors"
              >
                {t('menu.about')}
              </button>
              <button
                onClick={handleSignOut}
                className="w-full text-left px-4 py-2 text-sm text-red-400 hover:bg-gray-700 rounded transition-colors"
              >
                {t('auth.signOut')}
              </button>
            </div>
          </div>
        </>,
        document.body
      )}
    </div>
  );
};

export default SyncStatus;
