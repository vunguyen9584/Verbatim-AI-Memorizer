
import React from 'react';
import { LearningMode } from '../types';
import Card from './common/Card';
import Button from './common/Button';

interface ModeSelectorProps {
  currentMode: LearningMode | null;
  onSelectMode: (mode: LearningMode) => void;
}

const ModeSelector: React.FC<ModeSelectorProps> = ({ currentMode, onSelectMode }) => {
  const modes = Object.values(LearningMode);

  return (
    <Card>
      <h2 className="text-xl font-bold text-white mb-4">Learning Mode</h2>
      <div className="grid grid-cols-2 gap-2">
        {modes.map((mode) => (
          <Button
            key={mode}
            onClick={() => onSelectMode(mode)}
            variant={currentMode === mode ? 'primary' : 'secondary'}
            className="text-sm md:text-base"
          >
            {mode}
          </Button>
        ))}
      </div>
    </Card>
  );
};

export default ModeSelector;
