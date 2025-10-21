
import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Lesson } from '../types';
import Card from './common/Card';
import Button from './common/Button';
import { ChevronUpIcon, ChevronDownIcon, BookOpenIcon, ArrowLeftIcon, PencilIcon } from './common/Icon';

interface TextInputAreaProps {
  onTextSubmit: (text: string) => void;
  hasSubmittedText: boolean;
  currentLesson?: Lesson | null;
  onBackToLessons?: () => void;
  onEditLesson?: (lesson: Lesson) => void;
}

const TextInputArea: React.FC<TextInputAreaProps> = ({ 
  onTextSubmit, 
  hasSubmittedText, 
  currentLesson, 
  onBackToLessons,
  onEditLesson
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
      <div className="mb-3">
        {/* Header with title and toggle */}
        <div className="flex justify-between items-start gap-3 mb-3">
          <h2 className="text-xl font-bold text-white flex-1 break-words">{getTitle()}</h2>
          <button 
            onClick={() => setIsInputVisible(!isInputVisible)} 
            className="flex items-center text-gray-400 hover:text-white flex-shrink-0"
          >
            <span className="text-sm mr-1">{isInputVisible ? t('textInput.hide') : t('textInput.show')}</span>
            {isInputVisible ? <ChevronUpIcon className="w-5 h-5" /> : <ChevronDownIcon className="w-5 h-5" />}
          </button>
        </div>
        
        {/* Action buttons */}
        {currentLesson && (onBackToLessons || onEditLesson) && (
          <div className="flex flex-wrap items-center gap-2">
            {onBackToLessons && (
              <Button
                onClick={onBackToLessons}
                variant="secondary"
                className="flex items-center gap-2 text-base font-semibold px-4 py-2"
              >
                <ArrowLeftIcon className="w-4 h-4" />
                {t('lessonManagement.backToLessonsShort')}
              </Button>
            )}
            {onEditLesson && (
              <Button
                onClick={() => onEditLesson(currentLesson)}
                variant="ghost"
                className="flex items-center gap-2 text-sm px-3 py-2"
              >
                <PencilIcon className="w-4 h-4" />
                {t('lessonManagement.editLesson')}
              </Button>
            )}
          </div>
        )}
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
