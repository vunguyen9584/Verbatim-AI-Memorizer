import React, { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Folder } from '../types';
import { folderStorageService } from '../services/folderStorageService';
import { lessonStorageService } from '../services/lessonStorageService';
import { useToast } from './common/Toast';
import Card from './common/Card';
import Button from './common/Button';
import { EditIcon, TrashIcon, FolderIcon, ChevronRightIcon } from './common/Icon';

interface FolderManagementProps {
  onFolderSelect: (folderId: string) => void;
}

const FolderManagement: React.FC<FolderManagementProps> = ({ onFolderSelect }) => {
  const { t } = useTranslation();
  const { showToast } = useToast();
  const [folders, setFolders] = useState<Folder[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [editingFolder, setEditingFolder] = useState<Folder | null>(null);
  const [editingName, setEditingName] = useState('');
  const [newFolderName, setNewFolderName] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [draggedFolder, setDraggedFolder] = useState<Folder | null>(null);
  const [dragOverFolder, setDragOverFolder] = useState<Folder | null>(null);
  const [lessonCounts, setLessonCounts] = useState<Record<string, number>>({});

  const loadFolders = useCallback(async () => {
    try {
      setIsLoading(true);
      const allFolders = await folderStorageService.getAllFolders();
      // Folders are already sorted by displayOrder in the service
      setFolders(allFolders);
      
      // Load lesson counts for each folder
      const counts: Record<string, number> = {};
      for (const folder of allFolders) {
        const lessons = await lessonStorageService.getLessonsByFolder(folder.id);
        counts[folder.id] = lessons.length;
      }
      setLessonCounts(counts);
    } catch (error) {
      console.error('Error loading folders:', error);
      showToast({
        type: 'error',
        message: t('folderManagement.loadError'),
        persistent: true
      });
    } finally {
      setIsLoading(false);
    }
  }, [showToast, t]);

  useEffect(() => {
    loadFolders();
  }, [loadFolders]);

  const handleEdit = (folder: Folder) => {
    setEditingFolder(folder);
    setEditingName(folder.name);
  };

  const handleCancelEdit = () => {
    setEditingFolder(null);
    setEditingName('');
  };

  const handleSaveEdit = async () => {
    if (!editingFolder || !editingName.trim()) {
      return;
    }

    try {
      await folderStorageService.updateFolder(editingFolder.id, {
        name: editingName.trim()
      });
      await loadFolders();
      setEditingFolder(null);
      setEditingName('');
      showToast({
        type: 'success',
        message: t('folderManagement.updateSuccess')
      });
    } catch (error) {
      console.error('Error updating folder:', error);
      showToast({
        type: 'error',
        message: t('folderManagement.updateError'),
        persistent: true
      });
    }
  };

  const handleDelete = async (folder: Folder) => {
    // Check if folder has lessons
    const lessons = await lessonStorageService.getLessonsByFolder(folder.id);
    if (lessons.length > 0) {
      showToast({
        type: 'error',
        message: t('folderManagement.deleteErrorHasLessons'),
        persistent: true
      });
      return;
    }

    if (!window.confirm(t('folderManagement.deleteConfirm', { name: folder.name }))) {
      return;
    }

    try {
      await folderStorageService.deleteFolder(folder.id);
      await loadFolders();
      showToast({
        type: 'success',
        message: t('folderManagement.deleteSuccess')
      });
    } catch (error) {
      console.error('Error deleting folder:', error);
      showToast({
        type: 'error',
        message: t('folderManagement.deleteError'),
        persistent: true
      });
    }
  };

  const handleCreateFolder = async () => {
    if (!newFolderName.trim()) {
      showToast({
        type: 'error',
        message: t('folderManagement.nameRequired')
      });
      return;
    }

    try {
      await folderStorageService.saveFolder({
        name: newFolderName.trim(),
        isDefault: false
      });
      await loadFolders();
      setNewFolderName('');
      setIsCreating(false);
      showToast({
        type: 'success',
        message: t('folderManagement.createSuccess')
      });
    } catch (error) {
      console.error('Error creating folder:', error);
      showToast({
        type: 'error',
        message: t('folderManagement.createError'),
        persistent: true
      });
    }
  };

  const handleDragStart = (e: React.DragEvent<HTMLDivElement>, folder: Folder) => {
    if (folder.isDefault) {
      e.preventDefault();
      return;
    }
    
    setDraggedFolder(folder);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', folder.id);
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>, folder: Folder) => {
    e.preventDefault();
    if (!draggedFolder || draggedFolder.id === folder.id) return;
    
    e.dataTransfer.dropEffect = 'move';
    setDragOverFolder(folder);
  };

  const handleDragLeave = () => {
    setDragOverFolder(null);
  };

  const handleDrop = async (e: React.DragEvent<HTMLDivElement>, targetFolder: Folder) => {
    e.preventDefault();
    
    if (!draggedFolder || draggedFolder.id === targetFolder.id) {
      setDraggedFolder(null);
      setDragOverFolder(null);
      return;
    }

    // Prevent moving any folder above the default folder
    if (targetFolder.isDefault) {
      showToast({
        type: 'error',
        message: t('folderManagement.cannotMoveAboveDefault'),
        persistent: true
      });
      setDraggedFolder(null);
      setDragOverFolder(null);
      return;
    }

    try {
      // Create new order
      const newFolders = [...folders];
      const draggedIndex = newFolders.findIndex(f => f.id === draggedFolder.id);
      const targetIndex = newFolders.findIndex(f => f.id === targetFolder.id);

      // Remove dragged folder and insert at target position
      const [removed] = newFolders.splice(draggedIndex, 1);
      newFolders.splice(targetIndex, 0, removed);

      // Update local state immediately for smooth UX
      setFolders(newFolders);

      // Save to storage
      const folderIds = newFolders.map(f => f.id);
      await folderStorageService.reorderFolders(folderIds);

      showToast({
        type: 'success',
        message: t('folderManagement.reorderSuccess')
      });
    } catch (error) {
      console.error('Error reordering folders:', error);
      // Reload folders to revert to saved state
      await loadFolders();
      showToast({
        type: 'error',
        message: t('folderManagement.reorderError'),
        persistent: true
      });
    } finally {
      setDraggedFolder(null);
      setDragOverFolder(null);
    }
  };

  const handleDragEnd = () => {
    setDraggedFolder(null);
    setDragOverFolder(null);
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

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-teal-400"></div>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-8 flex flex-col h-full">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-2xl font-bold text-teal-400">{t('folderManagement.title')}</h2>
        <Button onClick={() => setIsCreating(true)} variant="primary">
          {t('folderManagement.createFolder')}
        </Button>
      </div>

      <div className="mb-4 p-3 bg-gray-700/30 rounded-lg border border-gray-600/50">
        <p className="text-sm text-gray-300">
          <span className="text-teal-400 font-medium">💡 {t('folderManagement.hint')}:</span>{' '}
          {t('folderManagement.dragDropHint')}
        </p>
      </div>

      {isCreating && (
        <Card className="mb-4 bg-gray-700/50">
          <div className="flex gap-2 items-center">
            <input
              type="text"
              value={newFolderName}
              onChange={(e) => setNewFolderName(e.target.value)}
              placeholder={t('folderManagement.folderNamePlaceholder')}
              className="flex-grow bg-gray-900/50 border border-gray-700 rounded-lg p-2 text-gray-200 focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
              autoFocus
              onKeyPress={(e) => {
                if (e.key === 'Enter') {
                  handleCreateFolder();
                }
              }}
            />
            <Button onClick={handleCreateFolder} variant="primary" size="sm">
              {t('folderManagement.create')}
            </Button>
            <Button onClick={() => { setIsCreating(false); setNewFolderName(''); }} variant="secondary" size="sm">
              {t('folderManagement.cancel')}
            </Button>
          </div>
        </Card>
      )}

      <div className="space-y-4 overflow-y-auto flex-grow">
        {folders.map((folder) => (
          <div
            key={folder.id}
            draggable={!folder.isDefault && editingFolder?.id !== folder.id}
            onDragStart={(e) => handleDragStart(e, folder)}
            onDragOver={(e) => handleDragOver(e, folder)}
            onDragLeave={handleDragLeave}
            onDrop={(e) => handleDrop(e, folder)}
            onDragEnd={handleDragEnd}
            className={`select-none ${
              !folder.isDefault && editingFolder?.id !== folder.id ? 'cursor-move' : ''
            } ${
              draggedFolder?.id === folder.id ? 'opacity-50' : ''
            }`}
            style={{
              WebkitUserDrag: !folder.isDefault && editingFolder?.id !== folder.id ? 'element' : 'none'
            }}
          >
            <Card 
              className={`transition-all hover:bg-gray-700/50 ${
                dragOverFolder?.id === folder.id ? 'border-2 border-teal-400 bg-gray-700/30' : ''
              }`}
            >
              {editingFolder?.id === folder.id ? (
                <div className="flex gap-2 items-center">
                  <FolderIcon className="w-5 h-5 text-teal-400 flex-shrink-0" />
                  <input
                    type="text"
                    value={editingName}
                    onChange={(e) => setEditingName(e.target.value)}
                    className="flex-grow bg-gray-900/50 border border-gray-700 rounded-lg p-2 text-gray-200 focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
                    autoFocus
                    onKeyPress={(e) => {
                      if (e.key === 'Enter') {
                        handleSaveEdit();
                      }
                    }}
                  />
                  <Button onClick={handleSaveEdit} variant="primary" size="sm">
                    {t('folderManagement.save')}
                  </Button>
                  <Button onClick={handleCancelEdit} variant="secondary" size="sm">
                    {t('folderManagement.cancel')}
                  </Button>
                </div>
              ) : (
                <div className="flex justify-between items-center">
                  <div
                    onClick={() => onFolderSelect(folder.id)}
                    className="flex-grow flex items-center gap-3 text-left group cursor-pointer"
                  >
                    <FolderIcon className="w-5 h-5 text-teal-400 flex-shrink-0" />
                    <div className="flex-grow">
                      <div className="flex items-center gap-2">
                        <h3 className="text-lg font-semibold text-white group-hover:text-teal-400 transition-colors">
                          {folder.name}
                        </h3>
                        {folder.isDefault && (
                          <span className="text-xs text-gray-500">({t('folderManagement.default')})</span>
                        )}
                        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-teal-400/20 text-teal-300 border border-teal-400/30">
                          {lessonCounts[folder.id] || 0} {t('folderManagement.lessons')}
                        </span>
                      </div>
                      <p className="text-gray-500 text-xs">
                        {t('folderManagement.lastUpdated')}: {formatDate(folder.updatedAt)}
                      </p>
                    </div>
                    <ChevronRightIcon className="w-5 h-5 text-gray-400 group-hover:text-teal-400 transition-colors" />
                  </div>
                  <div 
                    className="flex gap-2 flex-shrink-0 ml-4"
                    onMouseDown={(e) => e.stopPropagation()}
                    onClick={(e) => e.stopPropagation()}
                  >
                    {!folder.isDefault && (
                      <>
                        <Button
                          onClick={() => handleEdit(folder)}
                          variant="secondary"
                          size="sm"
                          className="px-3 py-1"
                        >
                          <EditIcon className="w-4 h-4" />
                        </Button>
                        <Button
                          onClick={() => handleDelete(folder)}
                          variant="ghost"
                          size="sm"
                          className="px-3 py-1 text-red-400 hover:text-red-300"
                        >
                          <TrashIcon className="w-4 h-4" />
                        </Button>
                      </>
                    )}
                  </div>
                </div>
              )}
            </Card>
          </div>
        ))}
      </div>
    </div>
  );
};

export default FolderManagement;

