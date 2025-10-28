
import React, { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import { useTranslation, Trans } from 'react-i18next';
import { QuizData, ClozeQuizItem, MCQQuizItem, OrderingQuizItem } from '../types';
import { generateQuizzes } from '../services/geminiService';
import Loader from './common/Loader';
import Button from './common/Button';
import { CheckCircleIcon, XCircleIcon, SparklesIcon, BookOpenIcon } from './common/Icon';
import { parseSentences } from '../utils/sentenceParser';

interface QuizModeProps {
  text: string;
  tokens: string[];
  initialSelectedQuizTypes?: string[];
  initialNumQuestions?: number;
  initialClozeDifficulty?: 'Easy' | 'Medium' | 'Hard';
  autoStart?: boolean;
  hideSetup?: boolean;
}

type QuizState = 'setup' | 'loading' | 'active' | 'results';

const ALL_QUIZ_TYPES = [
    { id: 'cloze_by_token', name: 'Fill-in-the-Blank' },
    { id: 'mcq_cloze', name: 'Multiple Choice' },
    { id: 'ordering', name: 'Word Order' },
];

const QuizMode: React.FC<QuizModeProps> = ({ text, tokens, initialSelectedQuizTypes, initialNumQuestions, initialClozeDifficulty, autoStart = false, hideSetup = false }) => {
  const { t } = useTranslation();
  const [quizState, setQuizState] = useState<QuizState>('setup');

  // Setup state
  const [selectedQuizTypes, setSelectedQuizTypes] = useState<string[]>(() => initialSelectedQuizTypes || ['cloze_by_token']);
  const [numQuestions, setNumQuestions] = useState(() => initialNumQuestions ?? 5);
  const [clozeDifficulty, setClozeDifficulty] = useState<'Easy' | 'Medium' | 'Hard'>(() => initialClozeDifficulty || 'Easy');
  const [error, setError] = useState<string | null>(null); // store i18n key or raw text

  // Active quiz state
  const [quizData, setQuizData] = useState<QuizData | null>(null);
  const [currentQuizIndex, setCurrentQuizIndex] = useState(0);
  const [userAnswer, setUserAnswer] = useState<any>(null);
  const [isAnswered, setIsAnswered] = useState(false);
  const [isCorrect, setIsCorrect] = useState(false);
  const [showAnswer, setShowAnswer] = useState(false);
  const [correctAnswersCount, setCorrectAnswersCount] = useState(0);

  const nextButtonRef = useRef<HTMLButtonElement>(null);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  const currentQuiz = useMemo(() => quizData?.quizzes[currentQuizIndex], [quizData, currentQuizIndex]);

  // Memoize the correct answer index, deriving it if necessary for MCQs.
  const correctAnswerIndex = useMemo(() => {
    if (currentQuiz?.type !== 'mcq_cloze') {
        return undefined;
    }
    const mcqQuiz = currentQuiz as MCQQuizItem;
    // If answer_index is provided and is a number, use it.
    if (typeof mcqQuiz.answer_index === 'number') {
        return mcqQuiz.answer_index;
    }
    // If not, derive it from the 'blanks' field. This makes the component robust
    // as the AI sometimes returns 'blanks' for mcq_cloze instead of answer_index.
    const correctAnswerText = (mcqQuiz as any).blanks?.[0]?.answer_text;
    if (correctAnswerText && mcqQuiz.options) {
        const foundIndex = mcqQuiz.options.findIndex(option => option.text.trim() === correctAnswerText.trim());
        return foundIndex !== -1 ? foundIndex : undefined;
    }
    return undefined; // Cannot determine the index
  }, [currentQuiz]);

  useEffect(() => {
    if (isAnswered && nextButtonRef.current) {
      nextButtonRef.current.focus();
    }
  }, [isAnswered]);

  useEffect(() => {
    // Focus on the first input when a new question is displayed
    if (quizState === 'active' && !isAnswered) {
      const firstInput = inputRefs.current[0];
      // Use a small timeout to ensure the element is focusable after the render.
      setTimeout(() => {
        firstInput?.focus();
      }, 0);
    }
  }, [currentQuizIndex, quizState, isAnswered]);

  useEffect(() => {
    if (autoStart) {
      // Ensure we have at least one quiz type
      if (selectedQuizTypes.length === 0) return;
      handleGenerateQuiz();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoStart]);

  const handleQuizTypeToggle = (typeId: string) => {
    setSelectedQuizTypes(prev =>
      prev.includes(typeId)
        ? prev.filter(t => t !== typeId)
        : [...prev, typeId]
    );
  };
  
  const resetQuizState = () => {
    setQuizData(null);
    setError(null);
    setCurrentQuizIndex(0);
    setUserAnswer(null);
    setIsAnswered(false);
    setIsCorrect(false);
    setShowAnswer(false);
    setCorrectAnswersCount(0);
  };

  const handleGenerateQuiz = useCallback(async () => {
    if (selectedQuizTypes.length === 0) {
        setError('quiz.selectQuizType');
        return;
    }
    setError(null);
    resetQuizState();
    
    // Local generator for ordering quizzes (no AI)
    const makeLocalOrderingQuizzes = (count: number): OrderingQuizItem[] => {
      const sentences = parseSentences(tokens);
      const candidates = sentences.filter(s => s.text.trim().split(/\s+/).filter(Boolean).length >= 3);
      const pool = candidates.length > 0 ? candidates : sentences;
      const indices = [...pool.keys()];
      // shuffle indices
      for (let i = indices.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [indices[i], indices[j]] = [indices[j], indices[i]];
      }

      const items: OrderingQuizItem[] = [];
      for (let k = 0; k < Math.min(count, indices.length); k++) {
        const s = pool[indices[k]];
        const words = s.text.trim().split(/\s+/).filter(Boolean);
        // scramble words ensuring different order when possible
        const scrambled = [...words];
        for (let i = scrambled.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [scrambled[i], scrambled[j]] = [scrambled[j], scrambled[i]];
        }
        if (scrambled.join(' ') === words.join(' ') && scrambled.length > 1) {
          [scrambled[0], scrambled[1]] = [scrambled[1], scrambled[0]];
        }

        items.push({
          type: 'ordering',
          stem: t('quiz.orderingStem'),
          scrambled_words: scrambled,
          answer_span: [s.tokenStart, s.tokenEnd],
        });
      }
      return items;
    };

    // Local generator for fill-in-the-blank (no AI)
    const makeLocalClozeQuizzes = (count: number): ClozeQuizItem[] => {
      const sentences = parseSentences(tokens);
      const pool = sentences.filter(s => s.text.split(/\s+/).filter(Boolean).length >= 4);
      const base = pool.length > 0 ? pool : sentences;
      const idxs = [...base.keys()];
      for (let i = idxs.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [idxs[i], idxs[j]] = [idxs[j], idxs[i]];
      }

      const items: ClozeQuizItem[] = [];
      for (let k = 0; k < Math.min(count, idxs.length); k++) {
        const s = base[idxs[k]];

        // Trim leading/trailing whitespace tokens to align with s.text
        let start = s.tokenStart;
        let end = s.tokenEnd;
        while (start <= end && /^\s+$/.test(tokens[start] || '')) start++;
        while (end >= start && /^\s+$/.test(tokens[end] || '')) end--;

        const sentTokens = tokens.slice(start, end + 1);
        const sentText = sentTokens.join(''); // should match s.text

        // Find candidate words in sentence text
        const wordRegex = /[\p{L}\p{N}][\p{L}\p{N}'-]*/gu;
        const candidates: { start: number; end: number }[] = [];
        let m: RegExpExecArray | null;
        while ((m = wordRegex.exec(sentText)) !== null) {
          const w = m[0];
          if (w.length >= 3) {
            candidates.push({ start: m.index, end: m.index + w.length });
          }
        }
        if (candidates.length === 0) continue;

        // Pick one word/phrase to blank
        const pick = candidates[Math.floor(Math.random() * candidates.length)];

        // Map char range -> token indices
        const tokenCharStarts: number[] = [];
        let acc = 0;
        for (const tk of sentTokens) {
          tokenCharStarts.push(acc);
          acc += tk.length;
        }
        const answerTokenIdxs: number[] = [];
        for (let ti = 0; ti < sentTokens.length; ti++) {
          const charStart = tokenCharStarts[ti];
          const charEnd = charStart + sentTokens[ti].length;
          const overlaps = Math.max(charStart, pick.start) < Math.min(charEnd, pick.end);
          if (overlaps) {
            answerTokenIdxs.push(start + ti);
          }
        }
        const answerText = sentText.slice(pick.start, pick.end);

        const baseWithMask = sentText.slice(0, pick.start) + '...' + sentText.slice(pick.end);

        // Context sentences
        const all = sentences;
        const iInAll = all.findIndex(ss => ss.tokenStart === s.tokenStart && ss.tokenEnd === s.tokenEnd);
        const before = iInAll > 0 ? all[iInAll - 1].text : undefined;
        const after = iInAll < all.length - 1 ? all[iInAll + 1].text : undefined;

        items.push({
          type: 'cloze_by_token',
          stem: t('quiz.fillInTheBlank'),
          base_text_with_masks: baseWithMask,
          blanks: [{ answer_tokens: answerTokenIdxs, answer_text: answerText }],
          context_before: before,
          context_after: after,
        });
      }
      return items;
    };

    const includesOrdering = selectedQuizTypes.includes('ordering');
    const includesCloze = selectedQuizTypes.includes('cloze_by_token');
    const localTypesSelected = includesOrdering || includesCloze;
    const remoteTypes = selectedQuizTypes.filter(tid => tid === 'mcq_cloze');

    // Only local types selected -> fully local, no loading state
    if (localTypesSelected && remoteTypes.length === 0) {
      const localCloze = includesCloze ? makeLocalClozeQuizzes(numQuestions) : [];
      const localOrdering = includesOrdering ? makeLocalOrderingQuizzes(numQuestions) : [];
      const combinedLocal = [...localCloze, ...localOrdering];
      // shuffle
      for (let i = combinedLocal.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [combinedLocal[i], combinedLocal[j]] = [combinedLocal[j], combinedLocal[i]];
      }
      setQuizData({ quizzes: combinedLocal.slice(0, numQuestions) });
      setQuizState('active');
      return;
    }

    // Mix local (cloze/order) with remote AI quizzes (MCQ)
    setQuizState('loading');
    const hasLocal = localTypesSelected;
    const localCount = hasLocal ? Math.ceil(numQuestions / 2) : 0;
    const remoteCount = Math.max(0, numQuestions - localCount);
    const localItems: QuizData['quizzes'] = [
      ...(includesCloze ? makeLocalClozeQuizzes(Math.ceil(localCount / (includesOrdering && includesCloze ? 2 : 1))) : []),
      ...(includesOrdering ? makeLocalOrderingQuizzes(Math.floor(localCount / (includesOrdering && includesCloze ? 2 : 1))) : []),
    ];

    try {
      const options = { quizTypes: remoteTypes, numQuestions: remoteCount } as const;
      const data = remoteCount > 0 ? await generateQuizzes(text, tokens, options) : { quizzes: [] } as QuizData;

      if (!data || !Array.isArray(data.quizzes)) {
        setError('quiz.emptyResponseError');
        setQuizState('setup');
        return;
      }

      // Validate remote MCQs only
      for (const quiz of data.quizzes) {
        if (!quiz || !quiz.type || !quiz.stem) {
          setError('quiz.invalidDataError');
          setQuizState('setup');
          return;
        }
        if (quiz.type === 'mcq_cloze') {
          const mcq = quiz as MCQQuizItem;
          const hasIndex = typeof mcq.answer_index === 'number';
          const canDerive = (mcq as any).blanks?.[0]?.answer_text && Array.isArray(mcq.options);
          if (!hasIndex && !canDerive) {
            setError('quiz.noAnswerError');
            setQuizState('setup');
            console.warn('Invalid MCQ item from AI:', mcq);
            return;
          }
        }
      }

      // Combine and shuffle
      const combined = [...data.quizzes, ...localItems];
      for (let i = combined.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [combined[i], combined[j]] = [combined[j], combined[i]];
      }

      setQuizData({ quizzes: combined });
      setQuizState('active');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'quiz.generationError');
      console.error(err);
      setQuizState('setup');
    }
  }, [text, tokens, selectedQuizTypes, numQuestions, t]);

  const handleEndQuiz = () => {
      resetQuizState();
      setQuizState('setup');
  };

  const handleCheckAnswer = () => {
    if (!currentQuiz || userAnswer === null || userAnswer === undefined || (Array.isArray(userAnswer) && userAnswer.length === 0)) return;

    let correct = false;
    switch (currentQuiz.type) {
      case 'cloze_by_token':
        const clozeQuiz = currentQuiz as ClozeQuizItem;
        if (clozeDifficulty === 'Medium' || clozeDifficulty === 'Hard') {
            let correctAnswer = clozeQuiz.base_text_with_masks || '';
            clozeQuiz.blanks.forEach(blank => {
                correctAnswer = correctAnswer.replace('...', blank.answer_text);
            });
            correct = (userAnswer?.[0] || '').trim().toLowerCase() === correctAnswer.trim().toLowerCase();
        } else { // Easy mode
            correct = clozeQuiz.blanks.every((blank, index) => (userAnswer[index] || '').trim().toLowerCase() === blank.answer_text.trim().toLowerCase());
        }
        break;
      case 'mcq_cloze':
        // Support both multiple-choice selection (number) and free-text input (string/array)
        if (typeof userAnswer === 'number') {
          correct = userAnswer === correctAnswerIndex;
        } else {
          const mcqQuiz = currentQuiz as MCQQuizItem;
          const idx = typeof correctAnswerIndex === 'number' ? correctAnswerIndex : undefined;
          const correctText = typeof idx === 'number' ? mcqQuiz.options?.[idx]?.text : undefined;
          const typed = Array.isArray(userAnswer) ? (userAnswer[0] || '') : (userAnswer || '');
          if (correctText) {
            correct = typed.trim().toLowerCase() === correctText.trim().toLowerCase();
          } else {
            correct = false;
          }
        }
        break;
      case 'ordering':
        const orderingQuiz = currentQuiz as OrderingQuizItem;
        const correctOrder = tokens.slice(orderingQuiz.answer_span[0], orderingQuiz.answer_span[1] + 1).join('').replace(/\s/g, '');
        const userAnswerOrder = userAnswer.map((w: any) => w.word).join('').replace(/\s/g, '');
        correct = userAnswerOrder.toLowerCase() === correctOrder.toLowerCase();
        break;
    }
    
    setIsCorrect(correct);
    setIsAnswered(true);
    if (correct && !isAnswered) { // Only count first attempt
      setCorrectAnswersCount(prev => prev + 1);
    }
  };

  const handleNext = () => {
    setIsAnswered(false);
    setUserAnswer(null);
    setShowAnswer(false);
    if (currentQuizIndex < quizData!.quizzes.length - 1) {
      setCurrentQuizIndex(currentQuizIndex + 1);
    } else {
      setQuizState('results');
    }
  };
  
  const renderQuizContent = () => {
    if (!currentQuiz) return null;

    console.log(JSON.stringify(currentQuiz));

    // Clear refs before re-populating
    if (Array.isArray(inputRefs.current)) {
      inputRefs.current.splice(0, inputRefs.current.length);
    }

    switch (currentQuiz.type) {
      case 'cloze_by_token':
        const clozeQuiz = currentQuiz as ClozeQuizItem;

        if (clozeDifficulty === 'Medium') {
            return (
                <div className="whitespace-pre-line text-center">
                    {clozeQuiz.context_before && <p className="text-gray-400 italic mb-2">{clozeQuiz.context_before}</p>}
                    <input
                        ref={el => inputRefs.current[0] = el}
                        type="text"
                        placeholder={t('quiz.typeMissingLine')}
                        className="bg-gray-700 border-2 border-gray-600 rounded-md p-2 mx-1 text-teal-300 w-full md:w-3/4 focus:border-teal-500 focus:outline-none"
                        value={userAnswer?.[0] || ''}
                        disabled={isAnswered}
                        onChange={(e) => setUserAnswer([e.target.value])}
                        onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleCheckAnswer(); } }}
                      />
                    {clozeQuiz.context_after && <p className="text-gray-400 italic mt-2">{clozeQuiz.context_after}</p>}
                </div>
            );
        }

        if (clozeDifficulty === 'Hard') {
            const beforeParts = clozeQuiz.context_before?.split(' ') || [];
            const afterParts = clozeQuiz.context_after?.split(' ') || [];
            const partialBefore = beforeParts.length > 2 ? `... ${beforeParts.slice(-2).join(' ')}` : clozeQuiz.context_before;
            const partialAfter = afterParts.length > 2 ? `${afterParts.slice(0, 2).join(' ')} ...` : clozeQuiz.context_after;

            return (
                <div className="whitespace-pre-line text-center">
                    {partialBefore && <p className="text-gray-400 italic mb-2">{partialBefore}</p>}
                     <input
                        ref={el => inputRefs.current[0] = el}
                        type="text"
                        placeholder={t('quiz.typeMissingLine')}
                        className="bg-gray-700 border-2 border-gray-600 rounded-md p-2 mx-1 text-teal-300 w-full md:w-3/4 focus:border-teal-500 focus:outline-none"
                        value={userAnswer?.[0] || ''}
                        disabled={isAnswered}
                        onChange={(e) => setUserAnswer([e.target.value])}
                        onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleCheckAnswer(); } }}
                      />
                    {partialAfter && <p className="text-gray-400 italic mt-2">{partialAfter}</p>}
                </div>
            );
        }

        // Default to Easy
        const parts = (clozeQuiz.base_text_with_masks || '').split('...');
        return (
            <div className="whitespace-pre-line">
              {clozeQuiz.context_before && <p className="text-gray-400 italic mb-2">{clozeQuiz.context_before}</p>}
              <p>
                {parts.map((part, index) => (
                  <React.Fragment key={index}>
                    {part}
                    {index < clozeQuiz.blanks.length && (
                      <input
                        ref={el => inputRefs.current[index] = el}
                        type="text"
                        className="bg-gray-700 border-2 border-gray-600 rounded-md p-1 mx-1 text-teal-300 w-full sm:w-32 focus:border-teal-500 focus:outline-none"
                        value={userAnswer?.[index] || ''}
                        disabled={isAnswered}
                        onChange={(e) => {
                          const newAnswers = [...(userAnswer || [])];
                          newAnswers[index] = e.target.value;
                          setUserAnswer(newAnswers);
                        }}
                        onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleCheckAnswer(); } }}
                      />
                    )}
                  </React.Fragment>
                ))}
              </p>
              {clozeQuiz.context_after && <p className="text-gray-400 italic mt-2">{clozeQuiz.context_after}</p>}
            </div>
        );
      case 'mcq_cloze':
        const mcqQuiz = currentQuiz as MCQQuizItem;
        // If user asked ONLY for fill-in-the-blank, render MCQ as free-text input (fallback)
        if (selectedQuizTypes.includes('cloze_by_token') && !selectedQuizTypes.includes('mcq_cloze')) {
          return (
            <div className="space-y-3 text-center">
              <p className="mb-4 whitespace-pre-wrap text-left">{mcqQuiz.base_text_with_masks}</p>
              <input
                ref={el => inputRefs.current[0] = el}
                type="text"
                placeholder={t('quiz.typeMissingLine')}
                className="bg-gray-700 border-2 border-gray-600 rounded-md p-2 mx-1 text-teal-300 w-full md:w-3/4 focus:border-teal-500 focus:outline-none"
                value={userAnswer?.[0] || ''}
                disabled={isAnswered}
                onChange={(e) => setUserAnswer([e.target.value])}
                onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleCheckAnswer(); } }}
              />
            </div>
          );
        }
        // Default MCQ rendering (choice buttons)
        return (
            <div className="space-y-3">
                <p className="mb-4">{mcqQuiz.base_text_with_masks}</p>
                {mcqQuiz.options.map((option, index) => (
                    <button key={index} disabled={isAnswered} onClick={() => setUserAnswer(index)} className={`block w-full text-left p-3 rounded-lg border-2 transition-all ${userAnswer === index ? 'bg-teal-500/30 border-teal-400' : 'bg-gray-700/50 border-gray-600 hover:bg-gray-700'}`}>
                        {option.text}
                    </button>
                ))}
            </div>
        );
      case 'ordering':
        const orderingQuiz = currentQuiz as OrderingQuizItem;
        const selectedWords = userAnswer || [];
        const remainingWords = orderingQuiz.scrambled_words.map((word, index) => ({ word, originalIndex: index })).filter(item => !selectedWords.some((sel: any) => sel.originalIndex === item.originalIndex));

        return (
            <div>
                <div className="bg-gray-900/50 p-3 rounded-lg min-h-[50px] mb-4 border border-gray-700 flex flex-wrap gap-2">
                    {selectedWords.map((wordObj: any, index: number) => (
                        <Button key={index} variant="primary" onClick={() => !isAnswered && setUserAnswer(selectedWords.filter((_: any, i: number) => i !== index))}>
                            {wordObj.word}
                        </Button>
                    ))}
                </div>
                <div className="flex flex-wrap gap-2">
                    {remainingWords.map((item: { word: string, originalIndex: number }) => {
                         return (
                            <Button key={item.originalIndex} variant="secondary" disabled={isAnswered} onClick={() => setUserAnswer([...selectedWords, item])}>
                                {item.word}
                            </Button>
                        );
                    })}
                </div>
            </div>
        );
      default:
        return <div>{t('quiz.unsupportedQuizType')}</div>;
    }
  };

  const renderFeedback = () => {
    if (!isAnswered) return null;
    return (
      <div className={`mt-4 p-4 rounded-lg flex items-center justify-between gap-3 ${isCorrect ? 'bg-green-900/50 text-green-300' : 'bg-red-900/50 text-red-300'}`}>
        <div className="flex items-center gap-3">
            {isCorrect ? <CheckCircleIcon className="w-6 h-6" /> : <XCircleIcon className="w-6 h-6" />}
            <span className="font-semibold">{isCorrect ? t('quiz.correct') : t('quiz.notQuite')}</span>
        </div>
        {!isCorrect && !showAnswer && (
            <Button variant="ghost" onClick={() => setShowAnswer(true)}>{t('quiz.showAnswer')}</Button>
        )}
      </div>
    );
  };
  
  const getCorrectAnswerText = () => {
    if (!currentQuiz) return null;

    switch (currentQuiz.type) {
        case 'cloze_by_token': {
            const clozeQuiz = currentQuiz as ClozeQuizItem;
            let correctAnswer = clozeQuiz.base_text_with_masks || '';
            clozeQuiz.blanks.forEach(blank => {
                correctAnswer = correctAnswer.replace('...', blank.answer_text);
            });
            if (clozeDifficulty === 'Easy') {
                // For easy mode, show the individual blanked words as before
                return clozeQuiz.blanks.map(b => `"${b.answer_text}"`).join(', ');
            }
            return correctAnswer;
        }        case 'mcq_cloze': {
            const mcqQuiz = currentQuiz as MCQQuizItem;
            if (typeof correctAnswerIndex === 'number') {
                const answerText = mcqQuiz.options?.[correctAnswerIndex]?.text;
                return answerText ?? t('quiz.answerNotAvailable');
            }
            return t('quiz.answerNotAvailable');
        }
        case 'ordering':
             const orderingQuiz = currentQuiz as OrderingQuizItem;
             return tokens.slice(orderingQuiz.answer_span[0], orderingQuiz.answer_span[1] + 1).join('');
        default:
            return t('quiz.answerNotAvailable');
    }
  }

  const renderCorrectAnswer = () => {
    if (!isAnswered || isCorrect || !showAnswer) return null;
    
    const answerText = getCorrectAnswerText();

    return (
        <div className="mt-4 p-4 rounded-lg bg-gray-700/50 text-gray-300">
            <p className="font-semibold text-teal-400">{t('quiz.correctAnswer')}</p>
            <p className="mt-1 text-lg whitespace-pre-wrap">{answerText}</p>
        </div>
    )
  }

  const renderSetup = () => (
    <div className="p-4 md:p-8 flex flex-col h-full justify-center">
        <h2 className="text-2xl font-bold text-teal-400 mb-2 text-center">{t('quiz.setupTitle')}</h2>
        <p className="text-gray-400 mb-6 text-center">{t('quiz.setupPrompt')}</p>

        {error && (
          <div className="bg-red-900/50 text-red-300 p-3 rounded-lg mb-4 text-center">
            {/^[-_a-zA-Z0-9.]+$/.test(error) ? t(error) : error}
          </div>
        )}

        <div className="space-y-6">
            <div>
                <label className="block text-lg font-semibold text-gray-200 mb-3">{t('quiz.quizTypes')}</label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {ALL_QUIZ_TYPES.map(type => (
                        <button
                            key={type.id}
                            onClick={() => handleQuizTypeToggle(type.id)}
                            className={`p-3 rounded-lg border-2 text-left transition-all ${
                                selectedQuizTypes.includes(type.id)
                                ? 'bg-teal-500/30 border-teal-400'
                                : 'bg-gray-700/50 border-gray-600 hover:bg-gray-700'
                            }`}
                        >
                            <span>{t(`quiz.${type.id}`)}</span>
                            {(type.id === 'ordering' || type.id === 'cloze_by_token') && (
                              <span className="ml-2 text-xs text-gray-400 align-middle">• {t('quiz.local')}</span>
                            )}
                        </button>
                    ))}
                </div>
            </div>
            <div>
                                <label htmlFor="numQuestions" className="block text-lg font-semibold text-gray-200 mb-2">
                    <Trans
                        i18nKey="quiz.numQuestions"
                        values={{ count: numQuestions }}
                        components={{ 1: <strong className="text-white" /> }}
                    />
                </label>
                <input
                    type="range"
                    id="numQuestions"
                    min="1"
                    max="10"
                    value={numQuestions}
                    onChange={(e) => setNumQuestions(Number(e.target.value))}
                    className="w-full"
                />
            </div>

            {selectedQuizTypes.includes('cloze_by_token') && (
                <div>
                    <label className="block text-lg font-semibold text-gray-200 mb-3">{t('quiz.clozeDifficulty')}</label>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        {(['Easy', 'Medium', 'Hard'] as const).map(level => (
                            <button
                                key={level}
                                onClick={() => setClozeDifficulty(level)}
                                className={`p-3 rounded-lg border-2 text-center transition-all ${
                                    clozeDifficulty === level
                                    ? 'bg-teal-500/30 border-teal-400'
                                    : 'bg-gray-700/50 border-gray-600 hover:bg-gray-700'
                                }`}
                            >
                                {t(`quiz.${level.toLowerCase()}`)}
                            </button>
                        ))}
                    </div>
                </div>
            )}
        </div>

        <div className="mt-8">
            {(() => {
              const localOnly = selectedQuizTypes.length > 0 && selectedQuizTypes.every(id => id === 'ordering' || id === 'cloze_by_token');
              return (
                <Button
                  onClick={handleGenerateQuiz}
                  variant="primary"
                  className="w-full"
                  disabled={selectedQuizTypes.length === 0}
                  aria-label={t(localOnly ? 'quiz.start' : 'quiz.generate')}
                >
                  {localOnly ? (
                    <BookOpenIcon className="w-5 h-5" aria-hidden="true" />
                  ) : (
                    <SparklesIcon className="w-5 h-5" aria-hidden="true" />
                  )}
                  {t(localOnly ? 'quiz.start' : 'quiz.generate')}
                </Button>
              );
            })()}
        </div>
    </div>
  );

  const renderActiveQuiz = () => {
    if (!quizData || !currentQuiz) {
        return (
            <div className="p-8 text-center text-gray-400">
                {t('quiz.somethingWentWrong')}
                <Button onClick={handleEndQuiz} className="mt-4">{t('quiz.startOver')}</Button>
            </div>
        );
    }
    
    return (
        <div className="p-4 md:p-8 flex flex-col h-full">
          <div className="flex justify-between items-start mb-6 flex-col gap-3 sm:flex-row">
            <div>
              <p className="text-sm text-gray-400">{t('quiz.questionProgress', { current: currentQuizIndex + 1, total: quizData.quizzes.length })}</p>
              <h2 className="text-xl font-bold text-teal-400">
                {currentQuiz.stem}
              </h2>
            </div>
            <Button onClick={handleEndQuiz} variant="ghost" className="flex-shrink-0">{t('quiz.endQuiz')}</Button>
          </div>
    
          <div className="flex-grow mb-4 text-lg text-gray-200">
            {renderQuizContent()}
          </div>
    
          {renderFeedback()}
          {renderCorrectAnswer()}
    
          <div className="mt-auto pt-6 border-t border-gray-700/50 flex justify-end gap-3">
            {!isAnswered ? (
              <Button
                onClick={handleCheckAnswer}
                variant="primary"
                disabled={
                  userAnswer === null ||
                  (Array.isArray(userAnswer) && (
                    userAnswer.length === 0 ||
                    userAnswer.every((v: any) => typeof v === 'string' ? v.trim() === '' : false)
                  ))
                }
              >{t('quiz.checkAnswer')}</Button>
            ) : (
              <Button onClick={handleNext} variant="primary" ref={nextButtonRef}>
                {currentQuizIndex < quizData.quizzes.length - 1 ? t('quiz.nextQuestion') : t('quiz.finishQuiz')}
              </Button>
            )}
          </div>
        </div>
      );
  };
  
  const renderResults = () => {
    if (!quizData) return null;
    return (
        <div className="p-8 text-center flex flex-col justify-center items-center h-full">
            <h2 className="text-3xl font-bold text-teal-400 mb-4">{t('quiz.completeTitle')}</h2>
                        <p className="text-xl text-gray-300 mb-6">
                <Trans
                    i18nKey="quiz.results"
                    values={{ correct: correctAnswersCount, total: quizData.quizzes.length }}
                    components={{
                        1: <strong className="text-green-400" />,
                        3: <strong />,
                    }}
                />
            </p>
            <Button onClick={handleEndQuiz} variant="primary">{t('quiz.createAnother')}</Button>
        </div>
    );
  };

  switch(quizState) {
      case 'setup':
          return hideSetup ? <Loader text={t('quiz.generating')} /> : renderSetup();
      case 'loading':
          return <Loader text={t('quiz.generating')} />;
      case 'active':
          return renderActiveQuiz();
      case 'results':
          return renderResults();
      default:
          return null;
  }
};

export default QuizMode;
