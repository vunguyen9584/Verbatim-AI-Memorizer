
import React, { useState, useCallback, useMemo, useEffect } from 'react';
import { useTranslation, Trans } from 'react-i18next';
import { LearningMode, Lesson, AuthUser } from './types';
import TextInputArea from './components/TextInputArea';
import ModeSelector from './components/ModeSelector';
import QuizMode from './components/QuizMode';
import PlayMode from './components/PlayMode';
import CoPlayMode from './components/CoPlayMode';
import MemorizeTipsMode from './components/MemorizeTipsMode';
import LessonManagement from './components/LessonManagement';
import LessonForm from './components/LessonForm';
import { BrainCircuitIcon, BugIcon } from './components/common/Icon';
import DebugPanel from './components/DebugPanel';
import { ToastProvider, useToast } from './components/common/Toast';
import { lessonStorageService } from './services/lessonStorageService';
import AuthGate from './components/auth/AuthGate';
import SyncStatus from './components/common/SyncStatus';
import { authService } from './services/authService';
import Loader from './components/common/Loader';
import { env } from './utils/env';
import IntroductionPage from './components/IntroductionPage';
import SettingsPage from './components/SettingsPage';
import PlayPage from './components/PlayPage';
import CoPlaySetupPage from './components/CoPlaySetupPage';
import CoPlayRunPage from './components/CoPlayRunPage';
import QuizSetupPage from './components/QuizSetupPage';
import QuizRunPage from './components/QuizRunPage';

const AppContent: React.FC = () => {
  const { t, i18n } = useTranslation();
  const { showToast } = useToast();
  const [user, setUser] = useState<AuthUser | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [text, setText] = useState<string>('');
  const [mode, setMode] = useState<LearningMode | null>(null);
  const [isDebugPanelOpen, setIsDebugPanelOpen] = useState(false);
  const [currentView, setCurrentView] = useState<'learning' | 'lessons'>('lessons');
  const [currentLesson, setCurrentLesson] = useState<Lesson | null>(null);
  const [editingLesson, setEditingLesson] = useState<Lesson | null>(null);
  const [isEditFormOpen, setIsEditFormOpen] = useState(false);

  // Subscribe to auth state
  useEffect(() => {
    const unsubscribe = authService.subscribe((currentUser) => {
      setUser(currentUser);
      setAuthLoading(false);
    });

    return () => unsubscribe();
  }, []);

  // Simple hash-based routes for special pages
  const [showIntro, setShowIntro] = useState<boolean>(window.location.hash === '#/introduction');
  const [showSettings, setShowSettings] = useState<boolean>(window.location.hash === '#/settings');
  const [showPlay, setShowPlay] = useState<boolean>(window.location.hash === '#/play');
  const [showQuizSetup, setShowQuizSetup] = useState<boolean>(window.location.hash === '#/quiz-setup');
  const [showQuizRun, setShowQuizRun] = useState<boolean>(window.location.hash.startsWith('#/quiz'));
  const [showCoPlaySetup, setShowCoPlaySetup] = useState<boolean>(window.location.hash === '#/co-play-setup');
  const [showCoPlayRun, setShowCoPlayRun] = useState<boolean>(window.location.hash.startsWith('#/co-play'));
  useEffect(() => {
    const onHash = () => {
      setShowIntro(window.location.hash === '#/introduction');
      setShowSettings(window.location.hash === '#/settings');
      setShowPlay(window.location.hash === '#/play');
      setShowQuizSetup(window.location.hash === '#/quiz-setup');
      setShowQuizRun(window.location.hash.startsWith('#/quiz'));
      setShowCoPlaySetup(window.location.hash === '#/co-play-setup');
      setShowCoPlayRun(window.location.hash.startsWith('#/co-play'));
    };
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  useEffect(() => {
    const handleStartLearning = (event: CustomEvent) => {
      const lesson = event.detail as Lesson;
      setCurrentLesson(lesson);
      setText(lesson.content);
      setMode(null);
      setCurrentView('learning');
    };

    window.addEventListener('startLearning', handleStartLearning as EventListener);
    return () => {
      window.removeEventListener('startLearning', handleStartLearning as EventListener);
    };
  }, []);

  const handleTextSubmit = useCallback((submittedText: string) => {
    setText(submittedText);
    setCurrentLesson(null);
    // Do not auto-select a mode; user will choose explicitly
  }, [mode]);

  const handleBackToLessons = useCallback(() => {
    setCurrentView('lessons');
    setText('');
    setMode(null);
    setCurrentLesson(null);
  }, []);

  const handleEditLesson = useCallback((lesson: Lesson) => {
    setEditingLesson(lesson);
    setIsEditFormOpen(true);
  }, []);

  const handleEditFormClose = useCallback(() => {
    setIsEditFormOpen(false);
    setEditingLesson(null);
  }, []);

  const handleEditFormSuccess = useCallback(async () => {
    try {
      if (editingLesson) {
        const updatedLesson = await lessonStorageService.getLessonById(editingLesson.id);
        if (updatedLesson) {
          setCurrentLesson(updatedLesson);
          setText(updatedLesson.content);
        }
      }
      handleEditFormClose();
      showToast({
        type: 'success',
        message: t('lessonManagement.updateSuccess')
      });
    } catch (error) {
      console.error('Error refreshing lesson:', error);
      showToast({
        type: 'error',
        message: t('lessonManagement.loadError'),
        persistent: true
      });
    }
  }, [editingLesson, handleEditFormClose, showToast, t]);

  const tokens = useMemo(() => {
    if (!text) return [];
    // This is a simple tokenizer. A more robust one would handle punctuation better.
    return text.split(/(\s+)/).filter(t => t.length > 0);
  }, [text]);

  const renderActiveMode = () => {
    if (!text) {
      return (
        <div className="flex flex-col items-center justify-center h-full text-center p-8 bg-gray-800 rounded-2xl">
           <BrainCircuitIcon className="w-24 h-24 text-teal-400 mb-6" />
           <h2 className="text-3xl font-bold text-white mb-2">{t('appTitle')}</h2>
           <p className="text-lg text-gray-400">{t('pasteTextPrompt')}</p>
        </div>
      );
    }

    switch (mode) {
      case LearningMode.QUIZ:
        return <QuizMode text={text} tokens={tokens} />;
      case LearningMode.PLAY:
        return <PlayMode tokens={tokens} />;
      case LearningMode.CO_PLAY:
        return <CoPlayMode text={text} tokens={tokens} />;
      case LearningMode.MEMORY_TIPS:
        return <MemorizeTipsMode text={text} />;
      default:
        return <div className="text-gray-400">{t('selectModePrompt')}</div>;
    }
  };

  const changeLanguage = (lng: string) => {
    i18n.changeLanguage(lng);
  };

  // Show loading state while checking auth
  if (showIntro) {
    return <IntroductionPage />;
  }

  if (showSettings) {
    return <SettingsPage />;
  }

  // Show loading state while checking auth
  if (authLoading) {
    return (
      <div className="min-h-dvh bg-gray-900 flex items-center justify-center">
        <Loader />
      </div>
    );
  }

  // Show AuthGate if user is not authenticated
  if (!user) {
    return <AuthGate />;
  }

  if (showPlay) {
    return (
      <div className="min-h-dvh bg-gray-900">
        <PlayPage tokens={tokens} />
      </div>
    );
  }

  if (showQuizSetup) {
    return (
      <div className="min-h-dvh bg-gray-900">
        <QuizSetupPage />
      </div>
    );
  }

  if (showQuizRun) {
    return (
      <div className="min-h-dvh bg-gray-900">
        <QuizRunPage text={text} tokens={tokens} />
      </div>
    );
  }

  if (showCoPlaySetup) {
    return (
      <div className="min-h-dvh bg-gray-900">
        <CoPlaySetupPage text={text} tokens={tokens} />
      </div>
    );
  }

  if (showCoPlayRun) {
    return (
      <div className="min-h-dvh bg-gray-900">
        <CoPlayRunPage text={text} tokens={tokens} />
      </div>
    );
  }

  return (
    <div className="min-h-dvh bg-gray-900 text-gray-100 flex flex-col p-4 md:p-8 font-sans">
        <header className="flex items-center justify-between mb-6 flex-wrap gap-3">
          <div className="flex items-center">
            <BrainCircuitIcon className="w-8 h-8 text-teal-400 mr-3" />
            <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-white">
              <Trans i18nKey="headerTitle">
                Fluent
              </Trans>
            </h1>
          </div>
          <div className="flex items-center gap-2 md:gap-4 flex-wrap justify-end">
            <div className="flex items-center gap-2">
              <button onClick={() => changeLanguage('en')} className={`px-2 py-1 text-sm rounded ${i18n.language === 'en' ? 'bg-teal-500 text-white' : 'bg-gray-700'}`}>EN</button>
              <button onClick={() => changeLanguage('vi')} className={`px-2 py-1 text-sm rounded ${i18n.language === 'vi' ? 'bg-teal-500 text-white' : 'bg-gray-700'}`}>VI</button>
              {env.showDebugButton && (
                <button onClick={() => setIsDebugPanelOpen(!isDebugPanelOpen)} className="text-gray-500 hover:text-teal-400 transition-colors" aria-label={t('openDebugPanel')}>
                  <BugIcon className="w-6 h-6" />
                </button>
              )}
            </div>
            <SyncStatus />
          </div>
        </header>
      
      <main className="flex-grow grid grid-cols-1 lg:grid-cols-3 gap-6 h-full">
        {currentView === 'lessons' ? (
          <div className="lg:col-span-3">
            <LessonManagement />
          </div>
        ) : (
          <>
            <div className="lg:col-span-1 flex flex-col gap-6">
              <TextInputArea 
                onTextSubmit={handleTextSubmit} 
                hasSubmittedText={!!text} 
                currentLesson={currentLesson}
                onBackToLessons={handleBackToLessons}
                onEditLesson={handleEditLesson}
              />
              {text && <ModeSelector currentMode={mode} onSelectMode={setMode} />}
            </div>
            
            <div className="lg:col-span-2 bg-gray-800/50 rounded-2xl shadow-lg p-1 min-h-[600px] lg:min-h-0">
              <div className="bg-gray-900/70 rounded-xl h-full w-full overflow-y-auto">
                {renderActiveMode()}
              </div>
            </div>
          </>
        )}
      </main>

      <DebugPanel isOpen={isDebugPanelOpen} onClose={() => setIsDebugPanelOpen(false)} />
      
      {isEditFormOpen && (
        <LessonForm
          lesson={editingLesson}
          onClose={handleEditFormClose}
          onSuccess={handleEditFormSuccess}
          onError={(message) => showToast({
            type: 'error',
            message,
            persistent: true
          })}
        />
      )}
    </div>
  );
};

const App: React.FC = () => {
  return (
    <ToastProvider>
      <div className="safe-area min-h-dvh">
        <AppContent />
      </div>
    </ToastProvider>
  );
};

export default App;
