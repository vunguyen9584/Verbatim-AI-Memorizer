import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import Button from './common/Button';
import { ArrowLeftIcon } from './common/Icon';
import CoPlayMode from './CoPlayMode';
import { CoPlayModeOption, CoPlayModeType } from '../types';

interface CoPlayRunPageProps {
  text: string;
  tokens: string[];
}

const CoPlayRunPage: React.FC<CoPlayRunPageProps> = ({ text, tokens }) => {
  const { t } = useTranslation();
  const goBack = () => { window.location.hash = ''; };

  const initialModeOption: CoPlayModeOption | undefined = useMemo(() => {
    const hash = window.location.hash;
    const queryIndex = hash.indexOf('?');
    if (queryIndex === -1) return undefined;
    const qs = hash.slice(queryIndex + 1);
    const params = new URLSearchParams(qs);
    const type = params.get('type') as CoPlayModeType | null;
    const start = parseInt(params.get('start') || '', 10);
    const end = parseInt(params.get('end') || '', 10);
    const appRaw = params.get('app');
    const userRaw = params.get('user');
    if (!type || !Object.values(CoPlayModeType).includes(type as CoPlayModeType)) return undefined;
    const app: number | 'all' = appRaw === 'all' ? 'all' : (Number.isFinite(Number(appRaw)) ? Math.max(1, Number(appRaw)) : 1);
    const user: number | 'all' = userRaw === 'all' ? 'all' : (Number.isFinite(Number(userRaw)) ? Math.max(1, Number(userRaw)) : 1);
    return {
      type: type as CoPlayModeType,
      startSentence: Number.isFinite(start) ? Math.max(1, start) : 1,
      endSentence: Number.isFinite(end) ? Math.max(1, end) : 1,
      appSentences: app,
      userSentences: user,
    };
  }, []);

  return (
    <div className="min-h-dvh bg-gray-900 text-gray-100 flex flex-col">
      <div className="sticky top-0 z-10 bg-gray-900/80 backdrop-blur border-b border-gray-800 p-3">
        <Button variant="secondary" size="sm" onClick={goBack} className="gap-2">
          <ArrowLeftIcon className="w-4 h-4" aria-hidden="true" />
          {t('coPlay.backToModes')}
        </Button>
      </div>
      <div className="flex-1">
        <CoPlayMode text={text} tokens={tokens} initialModeOption={initialModeOption} autoStart={Boolean(initialModeOption)} hideSetup={Boolean(initialModeOption)} />
      </div>
    </div>
  );
};

export default CoPlayRunPage;
