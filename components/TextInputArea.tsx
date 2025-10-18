
import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import Card from './common/Card';
import Button from './common/Button';
import { ChevronUpIcon, ChevronDownIcon } from './common/Icon';

interface TextInputAreaProps {
  onTextSubmit: (text: string) => void;
  hasSubmittedText: boolean;
}

const TextInputArea: React.FC<TextInputAreaProps> = ({ onTextSubmit, hasSubmittedText }) => {
  const { t } = useTranslation();
  const [text, setText] = useState('');
  const [isInputVisible, setIsInputVisible] = useState(true);

  useEffect(() => {
    if (hasSubmittedText) {
      setIsInputVisible(false);
    }
  }, [hasSubmittedText]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (text.trim()) {
      onTextSubmit(text.trim());
    }
  };

  return (
    <Card className={`flex flex-col ${isInputVisible ? 'flex-grow' : ''}`}>
      <div className="flex justify-between items-center mb-3">
        <h2 className="text-xl font-bold text-white">{t('textInput.title')}</h2>
        <button onClick={() => setIsInputVisible(!isInputVisible)} className="flex items-center text-gray-400 hover:text-white">
          <span className="text-sm mr-1">{isInputVisible ? t('textInput.hide') : t('textInput.show')}</span>
          {isInputVisible ? <ChevronUpIcon className="w-5 h-5" /> : <ChevronDownIcon className="w-5 h-5" />}
        </button>
      </div>
      {isInputVisible && (
        <>
          <p className="text-gray-400 mb-4 text-sm">
            {t('textInput.prompt')}
          </p>
          <form onSubmit={handleSubmit} className="flex-grow flex flex-col">
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              className="w-full flex-grow bg-gray-900/50 border border-gray-700 rounded-lg p-3 text-gray-200 focus:ring-2 focus:ring-teal-500 focus:border-teal-500 transition duration-200 resize-none"
              placeholder={t('textInput.placeholder')}
            />
            <Button type="submit" className="mt-4 w-full" disabled={!text.trim()}>
              {t('textInput.startLearning')}
            </Button>
          </form>
        </>
      )}
    </Card>
  );
};

export default TextInputArea;
