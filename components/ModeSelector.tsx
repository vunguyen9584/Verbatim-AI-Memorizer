
import React from 'react';
import { useTranslation } from 'react-i18next';
import { LearningMode } from '../types';
import Card from './common/Card';
import Button from './common/Button';
import { SparklesIcon } from './common/Icon';

interface ModeSelectorProps {
  currentMode: LearningMode | null;
  onSelectMode: (mode: LearningMode) => void;
}

const ModeSelector: React.FC<ModeSelectorProps> = ({ currentMode, onSelectMode }) => {
  const { t } = useTranslation();
  const modes = Object.values(LearningMode);

  return (
    <Card>
      <h2 className="text-xl font-bold text-white mb-4">{t('modeSelector.title')}</h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        {modes.map((mode) => (
          <Button
            key={mode}
            onClick={() => onSelectMode(mode)}
            variant={currentMode === mode ? 'primary' : 'secondary'}
            className="text-sm md:text-base"
          >
            {(mode === LearningMode.QUIZ || mode === LearningMode.MEMORY_TIPS) && (
              <SparklesIcon className="w-4 h-4" aria-hidden="true" />
            )}
            {t(`learningModes.${mode}`)}
          </Button>
        ))}
      </div>
    </Card>
  );
};

export default ModeSelector;
