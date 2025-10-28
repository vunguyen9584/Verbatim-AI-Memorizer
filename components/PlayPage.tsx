import React from 'react';
import { useTranslation } from 'react-i18next';
import PlayMode from './PlayMode';
import Button from './common/Button';
import { ArrowLeftIcon } from './common/Icon';

interface PlayPageProps {
  tokens: string[];
}

const PlayPage: React.FC<PlayPageProps> = ({ tokens }) => {
  const { t } = useTranslation();
  const goBack = () => {
    window.location.hash = '';
  };

  return (
    <div className="min-h-dvh bg-gray-900 text-gray-100 flex flex-col">
      <div className="sticky top-0 z-10 bg-gray-900/80 backdrop-blur border-b border-gray-800 p-3">
        <Button variant="secondary" size="sm" onClick={goBack} className="gap-2">
          <ArrowLeftIcon className="w-4 h-4" aria-hidden="true" />
          {t('playMode.backToModes')}
        </Button>
      </div>
      <div className="flex-1">
        <PlayMode tokens={tokens} />
      </div>
    </div>
  );
};

export default PlayPage;
