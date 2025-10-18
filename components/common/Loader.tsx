
import React from 'react';
import { useTranslation } from 'react-i18next';

interface LoaderProps {
  text?: string;
}

const Loader: React.FC<LoaderProps> = ({ text }) => {
  const { t } = useTranslation();
  const displayText = text || t('loader.thinking');

  return (
    <div className="flex flex-col items-center justify-center p-8 text-center">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-teal-400 mb-4"></div>
      <p className="text-teal-300 font-semibold">{displayText}</p>
    </div>
  );
};

export default Loader;
