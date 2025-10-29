import React, { useEffect, useMemo, useState } from 'react';
import { Trans, useTranslation } from 'react-i18next';
import { LearningMode, SessionMetrics } from '../types';
import { analyticsService } from '../services/analyticsService';
import SyncStatus from './common/SyncStatus';
import Button from './common/Button';
import { BrainCircuitIcon, TrashIcon } from './common/Icon';
import ConfirmDialog from './common/ConfirmDialog';
import { useToast } from './common/Toast';

const StatisticsPage: React.FC = () => {
  const { t, i18n } = useTranslation();
  const { showToast } = useToast();
  const [sessions, setSessions] = useState<SessionMetrics[]>([]);
  const [confirmClear, setConfirmClear] = useState(false);

  useEffect(() => {
    (async () => {
      const all = await analyticsService.getAllSessions();
      setSessions(all);
    })();
  }, []);

  const overall = useMemo(() => {
    const count = sessions.length;
    if (count === 0) return { count: 0, avgWpm: 0, avgAcc: 0, totalActiveMs: 0 };
    const sumWpm = sessions.reduce((s, m) => s + m.wpm, 0);
    const sumAcc = sessions.reduce((s, m) => s + m.accuracy, 0);
    const totalActiveMs = sessions.reduce((s, m) => s + m.activeMs, 0);
    return { count, avgWpm: sumWpm / count, avgAcc: sumAcc / count, totalActiveMs };
  }, [sessions]);

  const byMode = useMemo(() => {
    const map = new Map<LearningMode, SessionMetrics[]>();
    for (const s of sessions) {
      const arr = map.get(s.mode) || [];
      arr.push(s);
      map.set(s.mode, arr);
    }
    return Array.from(map.entries()).map(([mode, arr]) => {
      const count = arr.length;
      const avgWpm = count ? arr.reduce((s, m) => s + m.wpm, 0) / count : 0;
      const avgAcc = count ? arr.reduce((s, m) => s + m.accuracy, 0) / count : 0;
      const totalActiveMs = arr.reduce((s, m) => s + m.activeMs, 0);
      return { mode, count, avgWpm, avgAcc, totalActiveMs };
    });
  }, [sessions]);

  const goBack = () => { window.location.hash = ''; };

  const handleConfirmClear = async () => {
    try {
      await analyticsService.clearAllAnalytics();
      setSessions([]);
      showToast({ type: 'success', message: t('analytics.settings.cleared') });
    } catch {
      showToast({ type: 'error', message: t('analytics.settings.clearError'), persistent: true });
    } finally {
      setConfirmClear(false);
    }
  };

  return (
    <div className="min-h-dvh bg-gray-900 text-gray-100 flex flex-col p-4 md:p-8">
      <header className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <div className="flex items-center">
          <BrainCircuitIcon className="w-8 h-8 text-teal-400 mr-3" />
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-white">
            <Trans i18nKey="headerTitle">Fluent</Trans>
          </h1>
        </div>
        <div className="flex items-center gap-2 md:gap-4 flex-wrap justify-end">
          <div className="flex items-center gap-2">
            <button onClick={() => i18n.changeLanguage('en')} className={`px-2 py-1 text-sm rounded ${i18n.language === 'en' ? 'bg-teal-500 text-white' : 'bg-gray-700'}`}>EN</button>
            <button onClick={() => i18n.changeLanguage('vi')} className={`px-2 py-1 text-sm rounded ${i18n.language === 'vi' ? 'bg-teal-500 text-white' : 'bg-gray-700'}`}>VI</button>
          </div>
          <SyncStatus />
        </div>
      </header>

      <div className="max-w-4xl w-full mx-auto">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl md:text-2xl font-bold text-white">{t('analytics.stats.title')}</h2>
          <Button variant="secondary" onClick={goBack}>{t('settings.back')}</Button>
        </div>

        <div className="bg-gray-800 rounded-2xl p-6 border border-gray-700">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-teal-300">{t('analytics.stats.overall')}</h3>
            <Button variant="secondary" onClick={() => setConfirmClear(true)} className="gap-2">
              <TrashIcon className="w-4 h-4" />
              {t('analytics.stats.clearAll')}
            </Button>
          </div>

          {overall.count === 0 ? (
            <div className="text-gray-400 text-sm">{t('analytics.stats.noData')}</div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-gray-900/50 rounded-xl p-4 border border-gray-700">
                <div className="text-gray-400 text-sm">{t('analytics.stats.totalSessions')}</div>
                <div className="text-2xl font-bold text-white">{overall.count}</div>
              </div>
              <div className="bg-gray-900/50 rounded-xl p-4 border border-gray-700">
                <div className="text-gray-400 text-sm">{t('analytics.stats.avgWpm')}</div>
                <div className="text-2xl font-bold text-white">{Math.round(overall.avgWpm)}</div>
              </div>
              <div className="bg-gray-900/50 rounded-xl p-4 border border-gray-700">
                <div className="text-gray-400 text-sm">{t('analytics.stats.avgAccuracy')}</div>
                <div className="text-2xl font-bold text-white">{Math.round(overall.avgAcc * 100)}%</div>
              </div>
              <div className="bg-gray-900/50 rounded-xl p-4 border border-gray-700">
                <div className="text-gray-400 text-sm">{t('analytics.stats.totalActiveTime')}</div>
                <div className="text-2xl font-bold text-white">{Math.round(overall.totalActiveMs / 1000)}s</div>
              </div>
            </div>
          )}
        </div>

        {overall.count > 0 && (
          <div className="bg-gray-800 rounded-2xl p-6 border border-gray-700 mt-6">
            <h3 className="text-lg font-semibold text-teal-300 mb-4">{t('analytics.stats.byMode')}</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {byMode.map((row) => (
                <div key={row.mode} className="bg-gray-900/50 rounded-xl p-4 border border-gray-700">
                  <div className="text-gray-300 font-semibold mb-2">{t(`learningModes.${row.mode}`)}</div>
                  <div className="grid grid-cols-3 gap-3 text-sm">
                    <div>
                      <div className="text-gray-400">{t('analytics.stats.totalSessions')}</div>
                      <div className="text-white font-bold">{row.count}</div>
                    </div>
                    <div>
                      <div className="text-gray-400">{t('analytics.stats.avgWpm')}</div>
                      <div className="text-white font-bold">{Math.round(row.avgWpm)}</div>
                    </div>
                    <div>
                      <div className="text-gray-400">{t('analytics.stats.avgAccuracy')}</div>
                      <div className="text-white font-bold">{Math.round(row.avgAcc * 100)}%</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      <ConfirmDialog
        open={confirmClear}
        title={t('analytics.stats.clearConfirmTitle')}
        message={t('analytics.stats.clearConfirmText')}
        confirmLabel={t('analytics.stats.clear')}
        cancelLabel={t('settings.back')}
        onConfirm={handleConfirmClear}
        onCancel={() => setConfirmClear(false)}
      />
    </div>
  );
};

export default StatisticsPage;
