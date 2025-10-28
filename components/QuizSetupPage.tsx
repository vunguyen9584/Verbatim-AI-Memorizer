import React, { useState } from 'react';
import { useTranslation, Trans } from 'react-i18next';
import Button from './common/Button';
import { ArrowLeftIcon, SparklesIcon, BookOpenIcon } from './common/Icon';

const ALL_QUIZ_TYPES = [
  { id: 'cloze_by_token', name: 'Fill-in-the-Blank' },
  { id: 'mcq_cloze', name: 'Multiple Choice' },
  { id: 'ordering', name: 'Word Order' },
];

const QuizSetupPage: React.FC = () => {
  const { t } = useTranslation();
  const [selectedQuizTypes, setSelectedQuizTypes] = useState<string[]>(['cloze_by_token']);
  const [numQuestions, setNumQuestions] = useState(5);
  const [clozeDifficulty, setClozeDifficulty] = useState<'Easy' | 'Medium' | 'Hard'>('Easy');

  const goBack = () => { window.location.hash = ''; };

  const handleQuizTypeToggle = (typeId: string) => {
    setSelectedQuizTypes(prev => prev.includes(typeId) ? prev.filter(tid => tid !== typeId) : [...prev, typeId]);
  };

  const handleStart = () => {
    const params = new URLSearchParams();
    params.set('types', selectedQuizTypes.join(','));
    params.set('num', String(numQuestions));
    params.set('cloze', clozeDifficulty);
    window.location.hash = `#/quiz?${params.toString()}`;
  };

  const localOnly = selectedQuizTypes.length > 0 && selectedQuizTypes.every(id => id === 'ordering' || id === 'cloze_by_token');

  return (
    <div className="min-h-dvh bg-gray-900 text-gray-100 flex flex-col">
      <div className="sticky top-0 z-10 bg-gray-900/80 backdrop-blur border-b border-gray-800 p-3">
        <Button variant="secondary" size="sm" onClick={goBack} className="gap-2">
          <ArrowLeftIcon className="w-4 h-4" aria-hidden="true" />
          {t('playMode.backToModes')}
        </Button>
      </div>
      <div className="flex-1 p-4 md:p-8 flex flex-col">
        <h2 className="text-2xl font-bold text-teal-400 mb-2 text-center">{t('quiz.setupTitle')}</h2>
        <p className="text-gray-400 mb-6 text-center">{t('quiz.setupPrompt')}</p>

        <div className="space-y-6 max-w-3xl mx-auto w-full">
          <div>
            <label className="block text-lg font-semibold text-gray-200 mb-3">{t('quiz.quizTypes')}</label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {ALL_QUIZ_TYPES.map(type => (
                <button
                  key={type.id}
                  onClick={() => handleQuizTypeToggle(type.id)}
                  className={`p-3 rounded-lg border-2 text-left transition-all ${
                    selectedQuizTypes.includes(type.id)
                      ? 'bg-teal-500/30 border-teal-400'
                      : 'bg-gray-700/50 border-gray-600 hover:bg-gray-700'
                  }`}
                >
                  <span>{t(`quiz.${type.id}`)}</span>
                  {(type.id === 'ordering' || type.id === 'cloze_by_token') && (
                    <span className="ml-2 text-xs text-gray-400 align-middle">• {t('quiz.local')}</span>
                  )}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label htmlFor="numQuestions" className="block text-lg font-semibold text-gray-200 mb-2">
              <Trans i18nKey="quiz.numQuestions" values={{ count: numQuestions }} components={{ 1: <strong className="text-white" /> }} />
            </label>
            <input
              type="range"
              id="numQuestions"
              min="1"
              max="10"
              value={numQuestions}
              onChange={(e) => setNumQuestions(Number(e.target.value))}
              className="w-full"
            />
          </div>

          {selectedQuizTypes.includes('cloze_by_token') && (
            <div>
              <label className="block text-lg font-semibold text-gray-200 mb-3">{t('quiz.clozeDifficulty')}</label>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {(['Easy', 'Medium', 'Hard'] as const).map(level => (
                  <button
                    key={level}
                    onClick={() => setClozeDifficulty(level)}
                    className={`p-3 rounded-lg border-2 text-center transition-all ${
                      clozeDifficulty === level
                        ? 'bg-teal-500/30 border-teal-400'
                        : 'bg-gray-700/50 border-gray-600 hover:bg-gray-700'
                    }`}
                  >
                    {t(`quiz.${level.toLowerCase()}`)}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="mt-6">
            <Button onClick={handleStart} variant="primary" className="w-full" disabled={selectedQuizTypes.length === 0} aria-label={t('quiz.start')}>
              {localOnly ? (
                <BookOpenIcon className="w-5 h-5" aria-hidden="true" />
              ) : (
                <SparklesIcon className="w-5 h-5" aria-hidden="true" />
              )}
              {t('quiz.start')}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default QuizSetupPage;
