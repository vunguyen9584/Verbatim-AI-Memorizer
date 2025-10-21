
import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Lesson } from '../types';
import Card from './common/Card';
import Button from './common/Button';
import { ChevronUpIcon, ChevronDownIcon, BookOpenIcon, ArrowLeftIcon } from './common/Icon';

interface TextInputAreaProps {
  onTextSubmit: (text: string) => void;
  hasSubmittedText: boolean;
  currentLesson?: Lesson | null;
  onBackToLessons?: () => void;
}

const TextInputArea: React.FC<TextInputAreaProps> = ({ 
  onTextSubmit, 
  hasSubmittedText, 
  currentLesson, 
  onBackToLessons 
}) => {
  const { t } = useTranslation();
  const [text, setText] = useState('');
  const [isInputVisible, setIsInputVisible] = useState(true);

  useEffect(() => {
    if (hasSubmittedText) {
      setIsInputVisible(false);
    }
  }, [hasSubmittedText]);

  useEffect(() => {
    if (currentLesson) {
      setText(currentLesson.content);
    }
  }, [currentLesson]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (text.trim()) {
      onTextSubmit(text.trim());
    }
  };

  const getTitle = () => {
    if (currentLesson) {
      return (
        <div className="flex items-center gap-2">
          <BookOpenIcon className="w-5 h-5 text-teal-400" />
          <span>{currentLesson.title}</span>
        </div>
      );
    }
    return t('textInput.title');
  };

  return (
    <Card className={`flex flex-col ${isInputVisible ? 'flex-grow' : ''}`}>
      <div className="flex justify-between items-center mb-3">
        <div className="flex items-center gap-3">
          <h2 className="text-xl font-bold text-white">{getTitle()}</h2>
          {currentLesson && onBackToLessons && (
            <button
              onClick={onBackToLessons}
              className="flex items-center gap-1 text-xs text-teal-400 hover:text-teal-300 transition-colors px-2 py-1 rounded hover:bg-gray-700/50"
            >
              <ArrowLeftIcon className="w-3 h-3" />
              {t('lessonManagement.backToLessons')}
            </button>
          )}
        </div>
        <button onClick={() => setIsInputVisible(!isInputVisible)} className="flex items-center text-gray-400 hover:text-white">
          <span className="text-sm mr-1">{isInputVisible ? t('textInput.hide') : t('textInput.show')}</span>
          {isInputVisible ? <ChevronUpIcon className="w-5 h-5" /> : <ChevronDownIcon className="w-5 h-5" />}
        </button>
      </div>
      {isInputVisible && (
        <>
          <p className="text-gray-400 mb-4 text-sm">
            {currentLesson 
              ? t('lessonForm.contentLabel')
              : t('textInput.prompt')
            }
          </p>
          <form onSubmit={handleSubmit} className="flex-grow flex flex-col">
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              className="w-full flex-grow bg-gray-900/50 border border-gray-700 rounded-lg p-3 text-gray-200 focus:ring-2 focus:ring-teal-500 focus:border-teal-500 transition duration-200 resize-none"
              placeholder={currentLesson ? '' : t('textInput.placeholder')}
              readOnly={!!currentLesson}
            />
            {!currentLesson && (
              <Button type="submit" className="mt-4 w-full" disabled={!text.trim()}>
                {t('textInput.startLearning')}
              </Button>
            )}
          </form>
        </>
      )}
    </Card>
  );
};

export default TextInputArea;
