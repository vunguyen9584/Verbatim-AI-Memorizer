import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import Button from './common/Button';
import { ArrowLeftIcon } from './common/Icon';
import QuizMode from './QuizMode';

interface QuizRunPageProps {
  text: string;
  tokens: string[];
}

const allowedTypes = new Set(['cloze_by_token', 'mcq_cloze', 'ordering']);

const QuizRunPage: React.FC<QuizRunPageProps> = ({ text, tokens }) => {
  const { t } = useTranslation();
  const goBack = () => { window.location.hash = ''; };

  const initialParams = useMemo(() => {
    const hash = window.location.hash;
    const queryIndex = hash.indexOf('?');
    if (queryIndex === -1) return undefined;
    const qs = hash.slice(queryIndex + 1);
    const params = new URLSearchParams(qs);
    const rawTypes = (params.get('types') || '').split(',').map(s => s.trim()).filter(Boolean);
    const types = rawTypes.filter(t => allowedTypes.has(t));
    const num = parseInt(params.get('num') || '', 10);
    const clozeRaw = params.get('cloze');
    const cloze = (clozeRaw === 'Easy' || clozeRaw === 'Medium' || clozeRaw === 'Hard') ? clozeRaw : 'Easy';
    if (types.length === 0) return undefined;
    return {
      types,
      num: Number.isFinite(num) ? Math.max(1, Math.min(10, num)) : 5,
      cloze: cloze as 'Easy' | 'Medium' | 'Hard',
    };
  }, []);

  return (
    <div className="min-h-dvh bg-gray-900 text-gray-100 flex flex-col">
      <div className="sticky top-0 z-10 bg-gray-900/80 backdrop-blur border-b border-gray-800 p-3">
        <Button variant="secondary" size="sm" onClick={goBack} className="gap-2">
          <ArrowLeftIcon className="w-4 h-4" aria-hidden="true" />
          {t('playMode.backToModes')}
        </Button>
      </div>
      <div className="flex-1">
        <QuizMode
          text={text}
          tokens={tokens}
          initialSelectedQuizTypes={initialParams?.types}
          initialNumQuestions={initialParams?.num}
          initialClozeDifficulty={initialParams?.cloze}
          autoStart={Boolean(initialParams)}
          hideSetup={Boolean(initialParams)}
        />
      </div>
    </div>
  );
};

export default QuizRunPage;
