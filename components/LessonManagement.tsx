import React, { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Lesson, Folder } from '../types';
import { lessonStorageService } from '../services/lessonStorageService';
import { folderStorageService } from '../services/folderStorageService';
import { useToast } from './common/Toast';
import Card from './common/Card';
import Button from './common/Button';
import ConfirmDialog from './common/ConfirmDialog';
import { EditIcon, TrashIcon, PlayIcon, ArrowLeftIcon } from './common/Icon';
import LessonForm from './LessonForm';
import FolderManagement from './FolderManagement';

const LessonManagement: React.FC = () => {
  const { t } = useTranslation();
  const { showToast } = useToast();
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [editingLesson, setEditingLesson] = useState<Lesson | null>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [selectedFolder, setSelectedFolder] = useState<Folder | null>(null);
  const [currentFolder, setCurrentFolder] = useState<Folder | null>(null);
  const [pendingDeleteLesson, setPendingDeleteLesson] = useState<Lesson | null>(null);

  const loadLessons = useCallback(async (folderId?: string) => {
    try {
      setIsLoading(true);
      let allLessons: Lesson[];
      
      if (folderId) {
        allLessons = await lessonStorageService.getLessonsByFolder(folderId);
      } else {
        allLessons = await lessonStorageService.getAllLessons();
      }
      
      setLessons(allLessons.sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime()));
    } catch (error) {
      console.error('Error loading lessons:', error);
      showToast({
        type: 'error',
        message: t('lessonManagement.loadError'),
        persistent: true
      });
    } finally {
      setIsLoading(false);
    }
  }, [showToast, t]);

  useEffect(() => {
    if (selectedFolder) {
      loadLessons(selectedFolder.id);
    }
  }, [selectedFolder, loadLessons]);

  const handleFolderSelect = async (folderId: string) => {
    try {
      const folder = await folderStorageService.getFolder(folderId);
      if (folder) {
        setSelectedFolder(folder);
        setCurrentFolder(folder);
        await loadLessons(folderId);
      }
    } catch (error) {
      console.error('Error selecting folder:', error);
      showToast({
        type: 'error',
        message: t('folderManagement.loadError'),
        persistent: true
      });
    }
  };

  const handleBackToFolders = () => {
    setSelectedFolder(null);
    setCurrentFolder(null);
  };

  const handleEdit = (lesson: Lesson) => {
    setEditingLesson(lesson);
    setIsFormOpen(true);
  };

  const requestDeleteLesson = (lesson: Lesson) => {
    setPendingDeleteLesson(lesson);
  };

  const performDeleteLesson = async () => {
    if (!pendingDeleteLesson) return;
    try {
      await lessonStorageService.deleteLesson(pendingDeleteLesson.id);
      await loadLessons(selectedFolder?.id);
      showToast({ type: 'success', message: t('lessonManagement.deleteSuccess') });
    } catch (error) {
      console.error('Error deleting lesson:', error);
      showToast({ type: 'error', message: t('lessonManagement.deleteError'), persistent: true });
    } finally {
      setPendingDeleteLesson(null);
    }
  };

  const handleStartLearning = (lesson: Lesson) => {
    // This will be handled by the parent component
    // We'll emit an event or use a callback prop
    const event = new CustomEvent('startLearning', { detail: lesson });
    window.dispatchEvent(event);
  };

  const handleFormClose = () => {
    setIsFormOpen(false);
    setEditingLesson(null);
  };

  const handleFormSuccess = async () => {
    await loadLessons(selectedFolder?.id);
    handleFormClose();
    showToast({
      type: 'success',
      message: editingLesson 
        ? t('lessonManagement.updateSuccess') 
        : t('lessonManagement.createSuccess')
    });
  };

  const formatDate = (date: Date) => {
    return new Intl.DateTimeFormat(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    }).format(date);
  };

  // Show folder list if no folder is selected
  if (!selectedFolder) {
    return <FolderManagement onFolderSelect={handleFolderSelect} />;
  }

  // Show lessons for selected folder
  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-teal-400"></div>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-8 flex flex-col h-full">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 mb-6">
        <div className="flex items-center gap-4">
          <Button 
            onClick={handleBackToFolders} 
            variant="secondary"
            size="sm"
            className="flex items-center gap-2"
          >
            <ArrowLeftIcon className="w-4 h-4" />
            {t('lessonManagement.backToFolders')}
          </Button>
          <h2 className="text-2xl font-bold text-teal-400">
            {currentFolder ? (currentFolder.name.startsWith('folderManagement.') ? t(currentFolder.name) : currentFolder.name) : ''}
          </h2>
        </div>
        <Button onClick={() => setIsFormOpen(true)} variant="primary">
          {t('lessonManagement.createLesson')}
        </Button>
      </div>

      {lessons.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-full text-center">
          <div className="text-gray-400 mb-4">
            <PlayIcon className="w-16 h-16 mx-auto mb-4" />
            <p className="text-lg">{t('lessonManagement.noLessons')}</p>
            <p className="text-sm mt-2">{t('lessonManagement.createFirstLesson')}</p>
          </div>
          <Button onClick={() => setIsFormOpen(true)} variant="primary">
            {t('lessonManagement.createLesson')}
          </Button>
        </div>
      ) : (
        <div className="space-y-4 overflow-y-auto flex-grow">
          {lessons.map((lesson) => (
            <Card key={lesson.id} className="hover:bg-gray-700/50 transition-colors">
              <div className="flex justify-between items-start gap-3 flex-col sm:flex-row">
                <div className="flex-grow mr-4">
                  <h3 className="text-lg font-semibold text-white mb-2">{lesson.title}</h3>
                  <p className="text-gray-400 text-sm mb-2 line-clamp-2">
                    {lesson.content.substring(0, 150)}
                    {lesson.content.length > 150 && '...'}
                  </p>
                  <p className="text-gray-500 text-xs">
                    {t('lessonManagement.lastUpdated')}: {formatDate(lesson.updatedAt)}
                  </p>
                </div>
                <div className="flex gap-2 flex-shrink-0">
                  <Button
                    onClick={() => handleStartLearning(lesson)}
                    variant="primary"
                    size="sm"
                    className="px-3 py-1"
                  >
                    <PlayIcon className="w-4 h-4" />
                  </Button>
                  <Button
                    onClick={() => handleEdit(lesson)}
                    variant="secondary"
                    size="sm"
                    className="px-3 py-1"
                  >
                    <EditIcon className="w-4 h-4" />
                  </Button>
                  <Button
                    onClick={() => requestDeleteLesson(lesson)}
                    variant="ghost"
                    size="sm"
                    className="px-3 py-1 text-red-400 hover:text-red-300"
                  >
                    <TrashIcon className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {isFormOpen && (
        <LessonForm
          lesson={editingLesson}
          currentFolderId={selectedFolder.id}
          onClose={handleFormClose}
          onSuccess={handleFormSuccess}
          onError={(message) => showToast({
            type: 'error',
            message,
            persistent: true
          })}
        />
      )}

      <ConfirmDialog
        open={!!pendingDeleteLesson}
        title={t('lessonManagement.deleteTitle', { defaultValue: 'Delete lesson' })}
        message={pendingDeleteLesson ? t('lessonManagement.deleteConfirm', { title: pendingDeleteLesson.title }) : ''}
        cancelLabel={t('lessonForm.cancel')}
        confirmLabel={t('lessonManagement.deleteAction', { defaultValue: 'Delete' })}
        onCancel={() => setPendingDeleteLesson(null)}
        onConfirm={performDeleteLesson}
      />
    </div>
  );
};

export default LessonManagement;
