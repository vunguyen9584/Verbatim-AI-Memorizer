import React from 'react';
import PlayMode from './PlayMode';

interface PlayPageProps {
  tokens: string[];
}

const PlayPage: React.FC<PlayPageProps> = ({ tokens }) => {
  return (
    <div className="min-h-dvh bg-gray-900 text-gray-100 flex flex-col">
      <div className="flex-1">
        <PlayMode tokens={tokens} />
      </div>
    </div>
  );
};

export default PlayPage;
