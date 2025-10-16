export enum LearningMode {
  QUIZ = 'Quiz',
  PLAY = 'Play',
  CO_PLAY = 'Co-Play'
}

// --- QUIZ TYPES ---

// Shared
export interface QuizItemBase {
  type: 'cloze_by_token' | 'mcq_cloze' | 'ordering';
  stem: string;
}

// Cloze (Fill-in-the-blank)
export interface ClozeBlank {
  answer_tokens: number[];
  answer_text: string;
}

export interface ClozeQuizItem extends QuizItemBase {
  type: 'cloze_by_token';
  base_text_with_masks: string;
  blanks: ClozeBlank[];
  context_before?: string;
  context_after?: string;
}


// Multiple Choice Cloze
export interface MCQOption {
    text: string;
}

export interface MCQQuizItem extends QuizItemBase {
    type: 'mcq_cloze';
    base_text_with_masks: string;
    options: MCQOption[];
    answer_index: number;
}

// Ordering
export interface OrderingQuizItem extends QuizItemBase {
    type: 'ordering';
    scrambled_words: string[];
    answer_span: [number, number];
}


export type QuizItem = ClozeQuizItem | MCQQuizItem | OrderingQuizItem;

export interface QuizData {
  quizzes: QuizItem[];
}

export interface ErrorExplanation {
  summary: string;
  annotations: {
    type: string;
    at_chars?: number[];
    tokens?: string[];
    example?: string;
  }[];
  tip: string;
}


// --- CO-PLAY TYPES ---
export interface CoPlayPauseRequire {
  span: [number, number];
  user_sentences_to_type?: number;
}

export interface CoPlayTimelineItem {
  reveal_until_token: number;
  pause_require: CoPlayPauseRequire[];
}

export interface CoPlayPlan {
  timeline: CoPlayTimelineItem[];
}

export enum CoPlayModeType {
  AppFirstN = 'app-first-n',
  UserFirstN = 'user-first-n',
  AppFirstRandom = 'app-first-random',
  UserFirstRandom = 'user-first-random',
}

export interface CoPlayModeOption {
  type: CoPlayModeType;
  appSentences: number;
  userSentences: number;
}