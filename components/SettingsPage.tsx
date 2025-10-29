import React, { useEffect, useState } from 'react';
import { Trans, useTranslation } from 'react-i18next';
import { settings } from '../utils/settings';
import Button from './common/Button';
import { useToast } from './common/Toast';
import { testGeminiApiKey } from '../services/geminiService';
import { BrainCircuitIcon, SparklesIcon, TrashIcon } from './common/Icon';
import SyncStatus from './common/SyncStatus';
import { analyticsService } from '../services/analyticsService';

const SettingsPage: React.FC = () => {
  const { t, i18n } = useTranslation();
  const { showToast } = useToast();
  const [apiKey, setApiKey] = useState('');
  const [isTesting, setIsTesting] = useState(false);
  const [testPassed, setTestPassed] = useState(false);
  const [lastTestedKey, setLastTestedKey] = useState('');
  const [analyticsSync, setAnalyticsSync] = useState<boolean>(false);

  useEffect(() => {
    const existing = settings.getGeminiApiKey();
    if (existing) setApiKey(existing);
    setAnalyticsSync(settings.getAnalyticsCloudSyncEnabled());
  }, []);

  const handleSave = () => {
    const trimmed = apiKey.trim();
    if (!trimmed) {
      showToast({ type: 'error', message: t('settings.validation.apiKeyEmpty'), persistent: false });
      return;
    }
    if (!testPassed || lastTestedKey !== trimmed) {
      showToast({ type: 'error', message: t('settings.validation.testRequired'), persistent: false });
      return;
    }
    settings.setGeminiApiKey(trimmed);
    showToast({ type: 'success', message: t('settings.toast.saved'), persistent: false });
  };

  const handleClear = () => {
    settings.clearGeminiApiKey();
    setApiKey('');
    setTestPassed(false);
    setLastTestedKey('');
    showToast({ type: 'success', message: t('settings.toast.cleared'), persistent: false });
  };

  const handleTest = async () => {
    const trimmed = apiKey.trim();
    if (!trimmed) {
      showToast({ type: 'error', message: t('settings.validation.apiKeyEmpty'), persistent: false });
      return;
    }
    try {
      setIsTesting(true);
      await testGeminiApiKey(trimmed);
      setTestPassed(true);
      setLastTestedKey(trimmed);
      showToast({ type: 'success', message: t('settings.toast.testSuccess'), persistent: false });
    } catch (e) {
      setTestPassed(false);
      setLastTestedKey('');
      showToast({ type: 'error', message: t('settings.toast.testFailed'), persistent: false });
    } finally {
      setIsTesting(false);
    }
  };

  const goBack = () => {
    window.location.hash = '';
  };

  const toggleAnalyticsSync = () => {
    const next = !analyticsSync;
    setAnalyticsSync(next);
    settings.setAnalyticsCloudSyncEnabled(next);
    showToast({ type: 'success', message: next ? t('analytics.settings.syncEnabled') : t('analytics.settings.syncDisabled') });
  };

  const handleClearAnalytics = async () => {
    try {
      await analyticsService.clearAllAnalytics();
      showToast({ type: 'success', message: t('analytics.settings.cleared') });
    } catch (e) {
      showToast({ type: 'error', message: t('analytics.settings.clearError'), persistent: true });
    }
  };

  return (
    <div className="min-h-dvh bg-gray-900 text-gray-100 flex flex-col p-4 md:p-8">
      <header className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <div className="flex items-center">
          <BrainCircuitIcon className="w-8 h-8 text-teal-400 mr-3" />
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-white">
            <Trans i18nKey="headerTitle">
              Fluent
            </Trans>
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

      <div className="max-w-2xl w-full mx-auto">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl md:text-2xl font-bold text-white">{t('settings.title')}</h2>
          <Button variant="secondary" onClick={goBack}>{t('settings.back')}</Button>
        </div>

        <div className="bg-gray-800 rounded-2xl p-6 border border-gray-700">
          <h2 className="text-xl font-semibold text-teal-400 mb-2">{t('settings.gemini.title')}</h2>
          <p className="text-gray-400 text-sm mb-2">{t('settings.gemini.description')}</p>
          <p className="text-gray-400 text-xs mb-2">
            <Trans i18nKey="settings.gemini.getKeyInstruction">
              Don't have a key? Generate one at <a href="https://aistudio.google.com/api-keys" target="_blank" rel="noopener noreferrer" className="text-teal-400 underline">Google AI Studio</a>.
            </Trans>
          </p>
          <p className="text-gray-400 text-xs mb-4">{t('settings.gemini.testInstruction')}</p>
          <div className="space-y-3">
            <input
              type="password"
              className="w-full bg-gray-700 border border-gray-600 rounded-lg p-3 text-gray-100 focus:outline-none focus:ring-2 focus:ring-teal-500"
              placeholder={t('settings.gemini.placeholder')}
              value={apiKey}
              onChange={(e) => { setApiKey(e.target.value); setTestPassed(false); }}
            />
            <div className="flex gap-3">
              <Button variant="secondary" onClick={handleTest} disabled={isTesting} aria-label={isTesting ? t('settings.gemini.testing') : t('settings.gemini.test')}>
                <SparklesIcon className="w-5 h-5" aria-hidden="true" />
                {isTesting ? t('settings.gemini.testing') : t('settings.gemini.test')}
              </Button>
              <Button variant="primary" onClick={handleSave} disabled={!testPassed || lastTestedKey !== apiKey.trim()}>{t('settings.save')}</Button>
              <Button variant="secondary" onClick={handleClear}>{t('settings.clear')}</Button>
            </div>
          </div>
        </div>

        <div className="bg-gray-800 rounded-2xl p-6 border border-gray-700 mt-6">
          <h2 className="text-xl font-semibold text-teal-400 mb-2">{t('analytics.settings.title')}</h2>
          <p className="text-gray-400 text-sm mb-4">{t('analytics.settings.desc')}</p>
          <div className="flex items-center justify-between gap-3 mb-4">
            <div>
              <div className="text-gray-200 font-medium">{t('analytics.settings.cloudSync')}</div>
              <div className="text-gray-400 text-sm">{t('analytics.settings.cloudSyncHint')}</div>
            </div>
            <button onClick={toggleAnalyticsSync} className={`px-3 py-1 rounded border ${analyticsSync ? 'bg-teal-600 border-teal-400' : 'bg-gray-700 border-gray-600'}`}>
              {analyticsSync ? t('analytics.settings.on') : t('analytics.settings.off')}
            </button>
          </div>
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="text-gray-200 font-medium">{t('analytics.settings.clearData')}</div>
              <div className="text-gray-400 text-sm">{t('analytics.settings.clearHint')}</div>
            </div>
            <Button variant="secondary" onClick={handleClearAnalytics} className="gap-2">
              <TrashIcon className="w-4 h-4" />
              {t('analytics.settings.clearAction')}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SettingsPage;
