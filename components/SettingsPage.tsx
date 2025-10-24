import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { settings } from '../utils/settings';
import Button from './common/Button';
import { useToast } from './common/Toast';

const SettingsPage: React.FC = () => {
  const { t } = useTranslation();
  const { showToast } = useToast();
  const [apiKey, setApiKey] = useState('');

  useEffect(() => {
    const existing = settings.getGeminiApiKey();
    if (existing) setApiKey(existing);
  }, []);

  const handleSave = () => {
    const trimmed = apiKey.trim();
    if (!trimmed) {
      showToast({ type: 'error', message: t('settings.validation.apiKeyEmpty'), persistent: false });
      return;
    }
    settings.setGeminiApiKey(trimmed);
    showToast({ type: 'success', message: t('settings.toast.saved'), persistent: false });
  };

  const handleClear = () => {
    settings.clearGeminiApiKey();
    setApiKey('');
    showToast({ type: 'success', message: t('settings.toast.cleared'), persistent: false });
  };

  const goBack = () => {
    window.location.hash = '';
  };

  return (
    <div className="min-h-screen bg-gray-900 text-gray-100 flex flex-col p-4 md:p-8">
      <div className="max-w-2xl w-full mx-auto">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl md:text-3xl font-bold text-white">{t('settings.title')}</h1>
          <Button variant="secondary" onClick={goBack}>{t('settings.back')}</Button>
        </div>

        <div className="bg-gray-800 rounded-2xl p-6 border border-gray-700">
          <h2 className="text-xl font-semibold text-teal-400 mb-2">{t('settings.gemini.title')}</h2>
          <p className="text-gray-400 text-sm mb-4">{t('settings.gemini.description')}</p>
          <div className="space-y-3">
            <input
              type="password"
              className="w-full bg-gray-700 border border-gray-600 rounded-lg p-3 text-gray-100 focus:outline-none focus:ring-2 focus:ring-teal-500"
              placeholder={t('settings.gemini.placeholder')}
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
            />
            <div className="flex gap-3">
              <Button variant="primary" onClick={handleSave}>{t('settings.save')}</Button>
              <Button variant="secondary" onClick={handleClear}>{t('settings.clear')}</Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SettingsPage;
