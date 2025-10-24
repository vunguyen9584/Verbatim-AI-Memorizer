import React, { useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { MemoryMethod, MemoryStoryResult, MemoryAcrosticResult } from '../types';
import { generateMemoryTips } from '../services/geminiService';
import Loader from './common/Loader';
import Button from './common/Button';

interface MemorizeTipsModeProps {
  text: string;
}

type ModeState = 'setup' | 'loading' | 'result';

const MemorizeTipsMode: React.FC<MemorizeTipsModeProps> = ({ text }) => {
  const { t } = useTranslation();
  const [modeState, setModeState] = useState<ModeState>('setup');
  const [selectedMethod, setSelectedMethod] = useState<MemoryMethod>(MemoryMethod.STORY);
  const [result, setResult] = useState<MemoryStoryResult | MemoryAcrosticResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleGenerate = useCallback(async () => {
    setError(null);
    setModeState('loading');

    try {
      const data = await generateMemoryTips(text, selectedMethod);
      setResult(data);
      setModeState('result');
    } catch (err) {
      setError(err instanceof Error ? err.message : t('memorizeTips.unknownError'));
      setModeState('setup');
    }
  }, [text, selectedMethod, t]);

  const handleStartOver = () => {
    setResult(null);
    setError(null);
    setModeState('setup');
  };

  const renderSetup = () => (
    <div className="p-4 md:p-8 flex flex-col h-full justify-center">
      <h2 className="text-2xl font-bold text-teal-400 mb-2 text-center">{t('memorizeTips.title')}</h2>
      <p className="text-gray-400 mb-6 text-center">{t('memorizeTips.prompt')}</p>

      {error && <div className="bg-red-900/50 text-red-300 p-3 rounded-lg mb-4 text-center">{error}</div>}

      <div className="space-y-6">
        <div>
          <label className="block text-lg font-semibold text-gray-200 mb-3">{t('memorizeTips.method')}</label>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <button
              onClick={() => setSelectedMethod(MemoryMethod.STORY)}
              className={`p-4 rounded-lg border-2 text-left transition-all ${
                selectedMethod === MemoryMethod.STORY
                  ? 'bg-teal-500/30 border-teal-400'
                  : 'bg-gray-700/50 border-gray-600 hover:bg-gray-700'
              }`}
            >
              <div className="font-semibold">{t('memorizeTips.story')}</div>
              <div className="text-sm text-gray-400 mt-1">{t('memorizeTips.storyDescription')}</div>
            </button>
            <button
              onClick={() => setSelectedMethod(MemoryMethod.ACROSTIC)}
              className={`p-4 rounded-lg border-2 text-left transition-all ${
                selectedMethod === MemoryMethod.ACROSTIC
                  ? 'bg-teal-500/30 border-teal-400'
                  : 'bg-gray-700/50 border-gray-600 hover:bg-gray-700'
              }`}
            >
              <div className="font-semibold">{t('memorizeTips.acrostic')}</div>
              <div className="text-sm text-gray-400 mt-1">{t('memorizeTips.acrosticDescription')}</div>
            </button>
          </div>
        </div>
      </div>

      <div className="mt-8">
        <Button onClick={handleGenerate} variant="primary" className="w-full">
          {t('memorizeTips.generate')}
        </Button>
      </div>
    </div>
  );

  const renderResult = () => {
    if (!result) return null;

    return (
      <div className="p-4 md:p-8 flex flex-col h-full">
        <div className="flex justify-between items-start mb-6">
          <div>
            <h2 className="text-xl font-bold text-teal-400">
              {selectedMethod === MemoryMethod.STORY ? t('memorizeTips.memoryStory') : t('memorizeTips.memoryAcrostic')}
            </h2>
          </div>
          <Button onClick={handleStartOver} variant="ghost">{t('memorizeTips.generateAgain')}</Button>
        </div>

        <div className="flex-grow mb-4">
          <div className="bg-gray-700/50 p-6 rounded-lg">
            {selectedMethod === MemoryMethod.STORY ? (
              <p className="text-lg text-gray-200 whitespace-pre-wrap leading-relaxed">
                {(result as MemoryStoryResult).story}
              </p>
            ) : (
              <p className="text-lg text-gray-200 whitespace-pre-wrap leading-relaxed">
                {(result as MemoryAcrosticResult).sentence}
              </p>
            )}
          </div>
        </div>
      </div>
    );
  };

  switch (modeState) {
    case 'setup':
      return renderSetup();
    case 'loading':
      return <Loader text={t('memorizeTips.generating')} />;
    case 'result':
      return renderResult();
    default:
      return null;
  }
};

export default MemorizeTipsMode;
