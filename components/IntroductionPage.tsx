import React from 'react';
import { useTranslation } from 'react-i18next';
import IntroductionContent from './IntroductionContent';
import { BrainCircuitIcon } from './common/Icon';

const IntroductionPage: React.FC = () => {
  const { t, i18n } = useTranslation();

  return (
    <div className="min-h-dvh bg-gradient-to-br from-gray-900 via-gray-800 to-teal-900 text-gray-100">
      <header className="p-4 md:p-6 flex items-center justify-between max-w-6xl mx-auto">
        <div className="flex items-center">
          <BrainCircuitIcon className="w-7 h-7 text-teal-400 mr-3" />
          <h1 className="text-xl md:text-2xl font-bold">{t('appTitle')}</h1>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => (window.location.hash = '')} className="px-3 py-1 bg-gray-700 hover:bg-gray-600 rounded text-sm">{t('introduction.back')}</button>
          <button onClick={() => i18n.changeLanguage('en')} className={`px-2 py-1 text-xs rounded ${i18n.language === 'en' ? 'bg-teal-500 text-white' : 'bg-gray-700 text-gray-200'}`}>EN</button>
          <button onClick={() => i18n.changeLanguage('vi')} className={`px-2 py-1 text-xs rounded ${i18n.language === 'vi' ? 'bg-teal-500 text-white' : 'bg-gray-700 text-gray-200'}`}>VI</button>
        </div>
      </header>
      <main className="py-4 px-4 md:py-6">
        <IntroductionContent />
      </main>
    </div>
  );
};

export default IntroductionPage;
