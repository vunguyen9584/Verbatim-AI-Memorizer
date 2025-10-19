
import React, { useState, useCallback, useMemo } from 'react';
import { useTranslation, Trans } from 'react-i18next';
import { LearningMode } from './types';
import TextInputArea from './components/TextInputArea';
import ModeSelector from './components/ModeSelector';
import QuizMode from './components/QuizMode';
import PlayMode from './components/PlayMode';
import CoPlayMode from './components/CoPlayMode';
import MemorizeTipsMode from './components/MemorizeTipsMode';
import { BrainCircuitIcon, BugIcon } from './components/common/Icon';
import DebugPanel from './components/DebugPanel';

const App: React.FC = () => {
  const { t, i18n } = useTranslation();
  const [text, setText] = useState<string>('');
  const [mode, setMode] = useState<LearningMode | null>(null);
  const [isDebugPanelOpen, setIsDebugPanelOpen] = useState(false);

  const handleTextSubmit = useCallback((submittedText: string) => {
    setText(submittedText);
    if (!mode) {
      setMode(LearningMode.QUIZ);
    }
  }, [mode]);

  const tokens = useMemo(() => {
    if (!text) return [];
    // This is a simple tokenizer. A more robust one would handle punctuation better.
    return text.split(/(\s+)/).filter(t => t.length > 0);
  }, [text]);

  const renderActiveMode = () => {
    if (!text) {
      return (
        <div className="flex flex-col items-center justify-center h-full text-center p-8 bg-gray-800 rounded-2xl">
           <BrainCircuitIcon className="w-24 h-24 text-teal-400 mb-6" />
           <h2 className="text-3xl font-bold text-white mb-2">{t('appTitle')}</h2>
           <p className="text-lg text-gray-400">{t('pasteTextPrompt')}</p>
        </div>
      );
    }

    switch (mode) {
      case LearningMode.QUIZ:
        return <QuizMode text={text} tokens={tokens} />;
      case LearningMode.PLAY:
        return <PlayMode tokens={tokens} />;
      case LearningMode.CO_PLAY:
        return <CoPlayMode text={text} tokens={tokens} />;
      case LearningMode.MEMORY_TIPS:
        return <MemorizeTipsMode text={text} />;
      default:
        return <div className="text-gray-400">{t('selectModePrompt')}</div>;
    }
  };

  const changeLanguage = (lng: string) => {
    i18n.changeLanguage(lng);
  };

  return (
    <div className="min-h-screen bg-gray-900 text-gray-100 flex flex-col p-4 md:p-8 font-sans">
      <header className="flex items-center justify-between mb-6">
        <div className="flex items-center">
          <BrainCircuitIcon className="w-8 h-8 text-teal-400 mr-3" />
                    <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-white">
            <Trans i18nKey="headerTitle">
              Verbatim <span className="text-teal-400">AI</span> Memorizer
            </Trans>
          </h1>
        </div>
        <div className="flex items-center">
          <button onClick={() => changeLanguage('en')} className={`px-2 py-1 text-sm rounded ${i18n.language === 'en' ? 'bg-teal-500 text-white' : 'bg-gray-700'}`}>EN</button>
          <button onClick={() => changeLanguage('vi')} className={`px-2 py-1 text-sm rounded ml-2 ${i18n.language === 'vi' ? 'bg-teal-500 text-white' : 'bg-gray-700'}`}>VI</button>
          <button onClick={() => setIsDebugPanelOpen(!isDebugPanelOpen)} className="text-gray-500 hover:text-teal-400 transition-colors ml-4" aria-label={t('openDebugPanel')}>
            <BugIcon className="w-6 h-6" />
          </button>
        </div>
      </header>
      
      <main className="flex-grow grid grid-cols-1 lg:grid-cols-3 gap-6 h-full">
        <div className="lg:col-span-1 flex flex-col gap-6">
          <TextInputArea onTextSubmit={handleTextSubmit} hasSubmittedText={!!text} />
          {text && <ModeSelector currentMode={mode} onSelectMode={setMode} />}
        </div>
        
        <div className="lg:col-span-2 bg-gray-800/50 rounded-2xl shadow-lg p-1 min-h-[600px] lg:min-h-0">
          <div className="bg-gray-900/70 rounded-xl h-full w-full overflow-y-auto">
            {renderActiveMode()}
          </div>
        </div>
      </main>

      <DebugPanel isOpen={isDebugPanelOpen} onClose={() => setIsDebugPanelOpen(false)} />
    </div>
  );
};

export default App;
