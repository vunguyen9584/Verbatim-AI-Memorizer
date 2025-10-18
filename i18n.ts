import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

const resources = {
  en: {
    translation: {
      common: {
        loading: 'Loading...'
      },
      coPlay: {
        invalidPlanError: 'Failed to generate a valid Co-Play plan.',
        planGenerationError: 'Failed to generate a Co-Play plan. Please try again.',
        setupTitle: 'Co-Play Mode Setup',
        selectMode: 'Select Mode:',
        appFirst: 'App First',
        userFirst: 'User First',
        appFirstRandom: 'App First (Random)',
        userFirstRandom: 'User First (Random)',
        appSentences: 'App Sentences:',
        userSentences: 'User Sentences:',
        allSentences: 'All sentences',
        all: 'All',
        start: 'Start',
        planningSession: 'Planning your session...',
        tryAgain: 'Try Again',
        planCreationError: 'Could not create a Co-Play plan for this text.',
        modeTitle: 'Co-Play Mode',
        congratulations: 'Congratulations!',
        sessionCompleted: "You've completed the session.",
        reset: 'Reset',
        playAgain: 'Play Again',
        endSession: 'End Session',
        typeSentence: 'Please type sentence {{current}} of {{total}}.',
        typeNextSentence: 'Please type the next sentence.',
        typeNextPartPlaceholder: 'Type the next part...',
        getHint: 'Get a hint',
        continue: 'Continue',
        showAnswer: 'Show Answer',
        hint: 'Hint: ',
        revealingText: 'Revealing text...',
        speedWPM: 'Speed (WPM):'
      }
    }
  }
};

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources,
    fallbackLng: 'en',
    interpolation: {
      escapeValue: false,
    },
    load: 'languageOnly',
    detection: {
      order: ['querystring', 'localStorage', 'navigator'],
      caches: ['localStorage'],
    },
  });

export default i18n;
