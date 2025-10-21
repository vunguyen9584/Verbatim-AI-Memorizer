import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Lesson } from '../types';
import { lessonStorageService } from '../services/lessonStorageService';
import Button from './common/Button';
import { XCircleIcon } from './common/Icon';

interface LessonFormProps {
  lesson?: Lesson | null;
  onClose: () => void;
  onSuccess: () => void;
  onError: (message: string) => void;
}

const LessonForm: React.FC<LessonFormProps> = ({ lesson, onClose, onSuccess, onError }) => {
  const { t } = useTranslation();
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (lesson) {
      setTitle(lesson.title);
      setContent(lesson.content);
    }
  }, [lesson]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!title.trim() || !content.trim()) {
      onError(t('lessonForm.validationRequired'));
      return;
    }

    setIsSubmitting(true);
    
    try {
      if (lesson) {
        await lessonStorageService.updateLesson(lesson.id, {
          title: title.trim(),
          content: content.trim()
        });
      } else {
        await lessonStorageService.saveLesson({
          title: title.trim(),
          content: content.trim()
        });
      }
      
      onSuccess();
    } catch (error) {
      console.error('Error saving lesson:', error);
      onError(lesson ? t('lessonForm.updateError') : t('lessonForm.createError'));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCancel = () => {
    if (title.trim() || content.trim()) {
      if (window.confirm(t('lessonForm.unsavedChanges'))) {
        onClose();
      }
    } else {
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-800 rounded-2xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-hidden">
        <div className="flex justify-between items-center p-6 border-b border-gray-700">
          <h2 className="text-xl font-bold text-white">
            {lesson ? t('lessonForm.editLesson') : t('lessonForm.createLesson')}
          </h2>
          <button
            onClick={handleCancel}
            className="text-gray-400 hover:text-white transition-colors"
            aria-label={t('lessonForm.close')}
          >
            <XCircleIcon className="w-6 h-6" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6">
          <div className="space-y-4">
            <div>
              <label htmlFor="title" className="block text-sm font-medium text-gray-200 mb-2">
                {t('lessonForm.titleLabel')}
              </label>
              <input
                type="text"
                id="title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full bg-gray-900/50 border border-gray-700 rounded-lg p-3 text-gray-200 focus:ring-2 focus:ring-teal-500 focus:border-teal-500 transition duration-200"
                placeholder={t('lessonForm.titlePlaceholder')}
                disabled={isSubmitting}
              />
            </div>

            <div>
              <label htmlFor="content" className="block text-sm font-medium text-gray-200 mb-2">
                {t('lessonForm.contentLabel')}
              </label>
              <textarea
                id="content"
                value={content}
                onChange={(e) => setContent(e.target.value)}
                rows={10}
                className="w-full bg-gray-900/50 border border-gray-700 rounded-lg p-3 text-gray-200 focus:ring-2 focus:ring-teal-500 focus:border-teal-500 transition duration-200 resize-none"
                placeholder={t('lessonForm.contentPlaceholder')}
                disabled={isSubmitting}
              />
              <p className="text-xs text-gray-500 mt-1">
                {t('lessonForm.characterCount', { count: content.length })}
              </p>
            </div>
          </div>

          <div className="flex justify-end gap-3 mt-6">
            <Button
              type="button"
              onClick={handleCancel}
              variant="secondary"
              disabled={isSubmitting}
            >
              {t('lessonForm.cancel')}
            </Button>
            <Button
              type="submit"
              variant="primary"
              disabled={isSubmitting || !title.trim() || !content.trim()}
            >
              {isSubmitting 
                ? t('lessonForm.saving') 
                : (lesson ? t('lessonForm.update') : t('lessonForm.create'))
              }
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default LessonForm;