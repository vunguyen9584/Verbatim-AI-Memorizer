import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Lesson, Folder } from '../types';
import { lessonStorageService } from '../services/lessonStorageService';
import { folderStorageService } from '../services/folderStorageService';
import Button from './common/Button';
import { XCircleIcon } from './common/Icon';
import ConfirmDialog from './common/ConfirmDialog';
import { extractTextFromImage } from '../services/geminiService';

interface LessonFormProps {
  lesson?: Lesson | null;
  currentFolderId?: string;
  onClose: () => void;
  onSuccess: () => void;
  onError: (message: string) => void;
}

const LessonForm: React.FC<LessonFormProps> = ({ lesson, currentFolderId, onClose, onSuccess, onError }) => {
  const { t } = useTranslation();
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [folderId, setFolderId] = useState('');
  const [folders, setFolders] = useState<Folder[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoadingFolders, setIsLoadingFolders] = useState(true);
  const [showUnsavedDialog, setShowUnsavedDialog] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Track initial values to detect unsaved changes accurately
  const initialRef = useRef<{ title: string; content: string; folderId: string }>({ title: '', content: '', folderId: '' });
  const initializedRef = useRef(false);

  useEffect(() => {
    const loadFolders = async () => {
      try {
        setIsLoadingFolders(true);
        const allFolders = await folderStorageService.getAllFolders();
        setFolders(allFolders.sort((a, b) => {
          // Default folder always first
          if (a.isDefault) return -1;
          if (b.isDefault) return 1;
          return a.name.localeCompare(b.name);
        }));

        // Set default folder if no folder is selected
        if (!lesson && !currentFolderId) {
          const defaultFolder = await folderStorageService.getDefaultFolder();
          setFolderId(defaultFolder.id);
        } else if (currentFolderId && !lesson) {
          setFolderId(currentFolderId);
        }
      } catch (error) {
        console.error('Error loading folders:', error);
        onError(t('folderManagement.loadError'));
      } finally {
        setIsLoadingFolders(false);
      }
    };

    loadFolders();
  }, [lesson, currentFolderId, onError, t]);

  useEffect(() => {
    if (lesson) {
      setTitle(lesson.title);
      setContent(lesson.content);
      setFolderId(lesson.folderId);
    }
  }, [lesson]);

  // Initialize initial values once when lesson is loaded or default folder is determined
  useEffect(() => {
    if (initializedRef.current) return;
    if (lesson) {
      initialRef.current = { title: lesson.title, content: lesson.content, folderId: lesson.folderId };
      initializedRef.current = true;
    } else if (!lesson && folderId) {
      initialRef.current = { title: '', content: '', folderId };
      initializedRef.current = true;
    }
  }, [lesson, folderId]);

  const isDirty = useMemo(() => {
    return (
      title !== initialRef.current.title ||
      content !== initialRef.current.content ||
      folderId !== initialRef.current.folderId
    );
  }, [title, content, folderId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!title.trim() || !content.trim()) {
      onError(t('lessonForm.validationRequired'));
      return;
    }

    if (!folderId) {
      onError(t('lessonForm.folderRequired'));
      return;
    }

    setIsSubmitting(true);
    let createdTempId: string | null = null;
    try {
      if (lesson) {
        const updatedTemp: Lesson = {
          id: lesson.id,
          title: title.trim(),
          content: content.trim(),
          folderId: folderId,
          createdAt: lesson.createdAt,
          updatedAt: new Date(),
        };

        window.dispatchEvent(
          new CustomEvent('lesson:update:optimistic', { detail: { lesson: updatedTemp, original: lesson } })
        );

        const saved = await lessonStorageService.updateLesson(lesson.id, {
          title: updatedTemp.title,
          content: updatedTemp.content,
          folderId: updatedTemp.folderId,
        });

        window.dispatchEvent(
          new CustomEvent('lesson:update:confirmed', { detail: { saved } })
        );
      } else {
        const tempId = `temp-${Date.now()}`;
        createdTempId = tempId;
        const tempLesson: Lesson = {
          id: tempId,
          title: title.trim(),
          content: content.trim(),
          folderId: folderId,
          createdAt: new Date(),
          updatedAt: new Date(),
        };

        window.dispatchEvent(
          new CustomEvent('lesson:create:optimistic', { detail: { lesson: tempLesson } })
        );

        const saved = await lessonStorageService.saveLesson({
          title: tempLesson.title,
          content: tempLesson.content,
          folderId: tempLesson.folderId,
        });

        window.dispatchEvent(
          new CustomEvent('lesson:create:confirmed', { detail: { saved, tempId } })
        );
      }

      onSuccess();
    } catch (error) {
      console.error('Error saving lesson:', error);
      if (lesson) {
        window.dispatchEvent(
          new CustomEvent('lesson:update:revert', { detail: { original: lesson } })
        );
      } else {
        window.dispatchEvent(
          new CustomEvent('lesson:create:revert', { detail: { tempId: createdTempId } })
        );
      }
      onError(lesson ? t('lessonForm.updateError') : t('lessonForm.createError'));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCancel = () => {
    if (isDirty) {
      setShowUnsavedDialog(true);
    } else {
      onClose();
    }
  };

  const onPickImage = () => fileInputRef.current?.click();

  const handleImageSelected: React.ChangeEventHandler<HTMLInputElement> = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsImporting(true);
    try {
      const extracted = await extractTextFromImage(file);
      setContent((prev) => (prev ? `${prev}\n\n${extracted}` : extracted));
      if (!title.trim()) {
        const base = file.name.replace(/\.[^.]+$/, '');
        setTitle(base);
      }
    } catch (err) {
      const key = err instanceof Error ? err.message : 'imageImport.extractError';
      onError(t(key));
    } finally {
      setIsImporting(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-800 rounded-2xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col">
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

        <form onSubmit={handleSubmit} className="flex-1 flex flex-col overflow-hidden">
          <div className="flex-1 overflow-y-auto p-6 space-y-4">
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
              <label htmlFor="folder" className="block text-sm font-medium text-gray-200 mb-2">
                {t('lessonForm.folderLabel')}
              </label>
              <select
                id="folder"
                value={folderId}
                onChange={(e) => setFolderId(e.target.value)}
                className="w-full bg-gray-900/50 border border-gray-700 rounded-lg p-3 text-gray-200 focus:ring-2 focus:ring-teal-500 focus:border-teal-500 transition duration-200"
                disabled={isSubmitting || isLoadingFolders}
              >
                {isLoadingFolders ? (
                  <option value="">{t('lessonForm.loadingFolders')}</option>
                ) : (
                  folders.map((folder) => (
                    <option key={folder.id} value={folder.id}>
                      {folder.name.startsWith('folderManagement.') ? t(folder.name) : folder.name}
                    </option>
                  ))
                )}
              </select>
            </div>

            <div>
              <label htmlFor="content" className="block text-sm font-medium text-gray-200 mb-2">
                {t('lessonForm.contentLabel')}
              </label>
              <div className="flex items-center gap-3 mb-2">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleImageSelected}
                />
                <Button
                  type="button"
                  variant="secondary"
                  onClick={onPickImage}
                  disabled={isSubmitting || isImporting}
                >
                  {isImporting ? t('imageImport.importing') : t('imageImport.importFromImage')}
                </Button>
                <span className="text-xs text-gray-500">{t('imageImport.hint')}</span>
              </div>
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
          <div className="shrink-0 p-4 sm:p-6 border-t border-gray-700 bg-gray-800">
            <div className="flex justify-end gap-3">
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
              disabled={isSubmitting || isImporting || !title.trim() || !content.trim() || !folderId}
            >
              {isSubmitting 
                ? t('lessonForm.saving') 
                : (lesson ? t('lessonForm.update') : t('lessonForm.create'))
              }
            </Button>
            </div>
          </div>
        </form>
        <ConfirmDialog
          open={showUnsavedDialog}
          title={t('lessonForm.unsavedTitle')}
          message={t('lessonForm.unsavedChanges')}
          confirmLabel={t('lessonForm.discard')}
          cancelLabel={t('lessonForm.keepEditing')}
          onConfirm={() => {
            setShowUnsavedDialog(false);
            onClose();
          }}
          onCancel={() => setShowUnsavedDialog(false)}
          showIcon={false}
        />
      </div>
    </div>
  );
};

export default LessonForm;
