import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { CoPlayPlan, CoPlayModeType, CoPlayModeOption } from '../types';
import { planCoPlay } from '../services/geminiService';
import Loader from './common/Loader';
import Button from './common/Button';
import { LightbulbIcon } from './common/Icon';
import { parseSentences } from '../utils/sentenceParser';

interface CoPlayModeProps {
  text: string;
  tokens: string[];
}

const CoPlayMode: React.FC<CoPlayModeProps> = ({ text, tokens }) => {
  const { t } = useTranslation();
  const totalSentences = useMemo(() => parseSentences(tokens).length, [tokens]);
  const [modeOption, setModeOption] = useState<CoPlayModeOption>({
    type: CoPlayModeType.AppFirstN,
    appSentences: 1,
    userSentences: 1,
    startSentence: 1,
    endSentence: totalSentences || 1
  });

  useEffect(() => {
    if (totalSentences > 0) {
      setModeOption(prev => {
        const isInitialOrReset = prev.endSentence <= 1;
        const newEndSentence = isInitialOrReset ? totalSentences : Math.min(prev.endSentence, totalSentences);
        
        return {
          ...prev,
          endSentence: newEndSentence,
          startSentence: Math.min(prev.startSentence, newEndSentence)
        };
      });
    }
  }, [totalSentences]);
  const [plan, setPlan] = useState<CoPlayPlan | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null); // store i18n key or raw text
  const [timelineIndex, setTimelineIndex] = useState(0);
  const [userInput, setUserInput] = useState('');
  const [isPaused, setIsPaused] = useState(true);
  const [feedback, setFeedback] = useState<'correct' | 'incorrect' | null>(null);
  const [hint, setHint] = useState('');
  const [hintWords, setHintWords] = useState(0);
  const [incorrectFeedback, setIncorrectFeedback] = useState<React.ReactNode | null>(null);
  const [currentUserSentenceIndex, setCurrentUserSentenceIndex] = useState(0);
  const [sessionCompleted, setSessionCompleted] = useState(false);

  const [wpm, setWpm] = useState(200);
  const [revealedTokenIndex, setRevealedTokenIndex] = useState(-1);
  const timerRef = useRef<number | null>(null);
  const revealedTokenRef = useRef<HTMLSpanElement | null>(null);
  const lastAppSentencesRef = useRef<number>(typeof modeOption.appSentences === 'number' ? modeOption.appSentences : 1);
  const lastUserSentencesRef = useRef<number>(typeof modeOption.userSentences === 'number' ? modeOption.userSentences : 1);

  const fetchPlan = useCallback(async () => {
    setLoading(true);
    setError(null);
    setPlan(null);
    setSessionCompleted(false);
    setTimelineIndex(0);
    setUserInput('');
    setFeedback(null);
    setHint('');
    setHintWords(0);
    setIncorrectFeedback(null);
    setRevealedTokenIndex(-1);
    setCurrentUserSentenceIndex(0);
    try {
      const data = await planCoPlay(text, tokens, modeOption);

      if (!data || !data.timeline) {
        throw new Error(t('coPlay.invalidPlanError'));
      }

      
      setPlan(data);

      const startsWithPause = data.timeline.length > 0 && data.timeline[0].pause_require.length > 0;
      setIsPaused(startsWithPause);

      if (startsWithPause) {
        const firstPauseStartToken = data.timeline[0].pause_require[0].span[0];
        setRevealedTokenIndex(firstPauseStartToken - 1);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'coPlay.planGenerationError');
    } finally {
      setLoading(false);
    }
  }, [text, tokens, modeOption, t]);

  useEffect(() => {
    if (isPaused && currentTimelineItem?.pause_require.length > 0) {
      setCurrentUserSentenceIndex(0);
    }
  }, [isPaused, timelineIndex]);

  const currentTimelineItem = plan?.timeline[timelineIndex];
  const pauseInfo = currentTimelineItem?.pause_require[0];
  const revealUntilToken = currentTimelineItem?.reveal_until_token ?? (isPaused ? revealedTokenIndex : tokens.length);

  const finalTokenInPlanRange = useMemo(() => {
    if (!plan) return -1;
    let maxToken = -1;
    for (const item of plan.timeline) {
      if (typeof item.reveal_until_token === 'number') {
        maxToken = Math.max(maxToken, item.reveal_until_token - 1);
      }
      for (const pause of item.pause_require) {
        maxToken = Math.max(maxToken, pause.span[1]);
      }
    }
    return maxToken;
  }, [plan]);

  const advanceTimeline = useCallback((targetIndex: number) => {
    if (!plan) return;

    if (targetIndex >= plan.timeline.length) {
      setTimelineIndex(plan.timeline.length);
      setIsPaused(true);
      setSessionCompleted(true);
      if (finalTokenInPlanRange >= 0) {
        setRevealedTokenIndex(prev => Math.max(prev, finalTokenInPlanRange));
      }
      return;
    }

    setTimelineIndex(targetIndex);
    const nextTimelineItem = plan.timeline[targetIndex];
    setIsPaused(Boolean(nextTimelineItem?.pause_require.length));
  }, [plan, finalTokenInPlanRange]);

  useEffect(() => {
    if (!plan || sessionCompleted) return;

    if (!isPaused && revealedTokenIndex < revealUntilToken-1) {
      const delay = 60000 / wpm;
      timerRef.current = window.setTimeout(() => {
        setRevealedTokenIndex(prev => prev + 1);
      }, delay);
    } else if (!isPaused && revealedTokenIndex >= revealUntilToken - 1) {
        advanceTimeline(timelineIndex + 1);
    }

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [isPaused, revealedTokenIndex, wpm, plan, timelineIndex, revealUntilToken, sessionCompleted, advanceTimeline]);

  useEffect(() => {
    if (revealedTokenRef.current) {
      revealedTokenRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [revealedTokenIndex]);


  const startTokenOfPause = pauseInfo?.span[0] ?? 0;
  const endTokenOfPause = pauseInfo?.span[1] ?? 0;

  const turnTokens = useMemo(() => {
    if (!pauseInfo) return [];
    return tokens.slice(pauseInfo.span[0], pauseInfo.span[1] + 1);
  }, [pauseInfo, tokens]);

  const correctAnswer = useMemo(() => turnTokens.join(''), [turnTokens]);

  const turnSentenceData = useMemo(() => parseSentences(turnTokens), [turnTokens]);

  const turnSentences = useMemo(() => turnSentenceData.map(s => s.text), [turnSentenceData]);

  const getTurnSentenceGlobalEnd = useCallback((sentenceIndex: number) => {
    if (!pauseInfo) return null;
    const sentence = turnSentenceData[sentenceIndex];
    if (!sentence) return null;
    return pauseInfo.span[0] + sentence.tokenEnd;
  }, [pauseInfo, turnSentenceData]);

  const handleHint = () => {
    const isMultiSentenceTurn = turnSentences.length > 1;
    const sentenceForHint = turnSentenceData[currentUserSentenceIndex]?.text ?? '';
    const answerForHint = isMultiSentenceTurn ? sentenceForHint : correctAnswer;

    const words = answerForHint.trim().split(/\s+/).filter(w => w.length > 0);
    if (hintWords < words.length) {
      const newHint = words.slice(0, hintWords + 1).join(' ');
      setHint(newHint);
      setHintWords(hintWords + 1);
    }
  };

  const handleShowAnswer = () => {
    if (!currentTimelineItem || currentTimelineItem.pause_require.length === 0) return;

    const endOfTypedPhrase = currentTimelineItem.pause_require[0].span[1];
    setRevealedTokenIndex(endOfTypedPhrase);

    const nextIndex = timelineIndex + 1;
    advanceTimeline(nextIndex);

    // Reset input fields
    setUserInput('');
    setFeedback(null);
    setHint('');
    setHintWords(0);
    setIncorrectFeedback(null);
  };

  const generateDiff = (userInput: string, correctAnswer: string) => {
    const cleanCorrectAnswer = correctAnswer.trim().replace(/[.,\s]+$/, "");
    const userChars = userInput.trim().replace(/[.,\s]+$/, "").split('');
    const correctChars = cleanCorrectAnswer.split('');
    
    return (
      <p className="font-mono bg-gray-800 p-2 rounded mt-2 text-left whitespace-pre-wrap break-words">
        {correctChars.map((char, index) => {
          if (index < userChars.length && userChars[index].toLowerCase() === char.toLowerCase()) {
            return <span key={index} className="text-green-400 opacity-75">{char}</span>;
          } else {
            return <span key={index} className="text-red-400 underline bg-red-900/50">{char}</span>;
          }
        })}
      </p>
    );
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentTimelineItem || currentTimelineItem.pause_require.length === 0) return;

    const isMultiSentenceTurn = turnSentences.length > 1;
    const trimmedUserInput = userInput.trim().replace(/[.,\s]+$/, '');
    
    const answerForThisSubmission = (
      isMultiSentenceTurn
        ? (turnSentenceData[currentUserSentenceIndex]?.text ?? '')
        : correctAnswer
    ).trim().replace(/[.,\s]+$/, '');

    if (trimmedUserInput.toLowerCase() === answerForThisSubmission.toLowerCase()) {
      setFeedback('correct');
      setIncorrectFeedback(null);

      const sentenceGlobalEnd = getTurnSentenceGlobalEnd(currentUserSentenceIndex);
      if (sentenceGlobalEnd !== null) {
        setRevealedTokenIndex(prev => Math.max(prev, sentenceGlobalEnd));
      }

      const isLastSentenceOfTurn = currentUserSentenceIndex >= turnSentences.length - 1;

      if (isMultiSentenceTurn && !isLastSentenceOfTurn) {
        // More sentences to go in this turn
        setTimeout(() => {
          setCurrentUserSentenceIndex(prev => prev + 1);
          setUserInput('');
          setFeedback(null);
          setHint('');
          setHintWords(0);
        }, 300);
      } else {
        // Turn finished (or was single sentence turn)
        setTimeout(() => {
          const endOfTypedPhrase = pauseInfo?.span[1] ?? revealedTokenIndex;
          setRevealedTokenIndex(endOfTypedPhrase);

          const nextIndex = timelineIndex + 1;
          advanceTimeline(nextIndex);
          
          setUserInput('');
          setFeedback(null);
          setHint('');
          setHintWords(0);
        }, 300);
      }
    } else {
      setFeedback('incorrect');
      setIncorrectFeedback(generateDiff(trimmedUserInput, answerForThisSubmission));
    }
  };
  
  const isFinished = sessionCompleted;

  const handleEndSession = () => {
    setPlan(null);
    setSessionCompleted(false);
  };

  const handleModeChange = (type: CoPlayModeType) => {
    setModeOption(prev => {
      if (type === CoPlayModeType.AppFirstRandom || type === CoPlayModeType.UserFirstRandom) {
        const appSentences = typeof prev.appSentences === 'number' ? prev.appSentences : (lastAppSentencesRef.current || 1);
        const userSentences = typeof prev.userSentences === 'number' ? prev.userSentences : (lastUserSentencesRef.current || 1);
        return { ...prev, type, appSentences, userSentences, startSentence: prev.startSentence, endSentence: prev.endSentence };
      }
      return { ...prev, type, startSentence: prev.startSentence, endSentence: prev.endSentence };
    });
  };

  const handleAppSentencesChange = (value: string) => {
    const parsed = parseInt(value, 10);
    const sanitized = Number.isFinite(parsed) && parsed > 0 ? parsed : 1;
    lastAppSentencesRef.current = sanitized;
    setModeOption(prev => ({ ...prev, appSentences: sanitized }));
  };

  const handleUserSentencesChange = (value: string) => {
    const parsed = parseInt(value, 10);
    const sanitized = Number.isFinite(parsed) && parsed > 0 ? parsed : 1;
    lastUserSentencesRef.current = sanitized;
    setModeOption(prev => ({ ...prev, userSentences: sanitized }));
  };

  const handleStartSentenceChange = (value: string) => {
    const parsed = parseInt(value, 10);
    const sanitized = Number.isFinite(parsed) && parsed >= 1 ? parsed : 1;
    setModeOption(prev => ({ 
      ...prev, 
      startSentence: Math.min(sanitized, prev.endSentence) 
    }));
  };

  const handleEndSentenceChange = (value: string) => {
    const parsed = parseInt(value, 10);
    const sanitized = Number.isFinite(parsed) && parsed >= 1 ? parsed : 1;
    setModeOption(prev => ({ 
      ...prev, 
      endSentence: Math.max(sanitized, prev.startSentence) 
    }));
  };

  const toggleAppSentencesAll = () => {
    setModeOption(prev => {
      if (prev.appSentences === 'all') {
        const restored = lastAppSentencesRef.current || 1;
        return { ...prev, appSentences: restored, userSentences: restored };
      }
      if (typeof prev.appSentences === 'number') {
        lastAppSentencesRef.current = prev.appSentences;
      }
      return { ...prev, appSentences: 'all', userSentences: 0 };
    });
  };

  const toggleUserSentencesAll = () => {
    setModeOption(prev => {
      if (prev.userSentences === 'all') {
        const restored = lastUserSentencesRef.current || 1;
        return { ...prev, userSentences: restored, appSentences: restored };
      }
      if (typeof prev.userSentences === 'number') {
        lastUserSentencesRef.current = prev.userSentences;
      }
      return { ...prev, userSentences: 'all', appSentences: 0 };
    });
  };

  const handleStart = () => {
    fetchPlan();
  };

  const handleReset = () => {
    fetchPlan();
  };

  if (!plan) {
    return (
      <div className="p-4 md:p-8 flex flex-col h-full">
        <h2 className="text-2xl font-bold text-teal-400 mb-6">{t('coPlay.setupTitle')}</h2>
        <div className="space-y-4">
          <div>
            <label className="block text-gray-300 mb-2">{t('coPlay.selectMode')}</label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <Button onClick={() => handleModeChange(CoPlayModeType.AppFirstN)} variant={modeOption.type === CoPlayModeType.AppFirstN ? 'primary' : 'secondary'}>{t('coPlay.appFirst')}</Button>
              <Button onClick={() => handleModeChange(CoPlayModeType.UserFirstN)} variant={modeOption.type === CoPlayModeType.UserFirstN ? 'primary' : 'secondary'}>{t('coPlay.userFirst')}</Button>
              <Button onClick={() => handleModeChange(CoPlayModeType.AppFirstRandom)} variant={modeOption.type === CoPlayModeType.AppFirstRandom ? 'primary' : 'secondary'}>{t('coPlay.appFirstRandom')}</Button>
              <Button onClick={() => handleModeChange(CoPlayModeType.UserFirstRandom)} variant={modeOption.type === CoPlayModeType.UserFirstRandom ? 'primary' : 'secondary'}>{t('coPlay.userFirstRandom')}</Button>
            </div>
          </div>
          {[CoPlayModeType.AppFirstN, CoPlayModeType.UserFirstN].includes(modeOption.type) && (
            <div className="space-y-4">
              <div className="border-b border-gray-700 pb-4">
                <h3 className="text-lg font-semibold text-gray-300 mb-3">{t('coPlay.sentenceRange')}</h3>
                <div className="flex flex-wrap items-end gap-2">
                  <div>
                    <label htmlFor="start-sentence" className="block text-gray-300 mb-1 text-sm">{t('coPlay.fromSentence')}</label>
                    <input
                      id="start-sentence"
                      type="number"
                      min="1"
                      max={totalSentences}
                      value={modeOption.startSentence}
                      onChange={e => handleStartSentenceChange(e.target.value)}
                      className="w-20 bg-gray-800 border border-gray-600 rounded p-2"
                    />
                  </div>
                  <div className="text-gray-400 pb-1">{t('coPlay.to')}</div>
                  <div>
                    <label htmlFor="end-sentence" className="block text-gray-300 mb-1 text-sm">{t('coPlay.toSentence')}</label>
                    <input
                      id="end-sentence"
                      type="number"
                      min="1"
                      max={totalSentences}
                      value={modeOption.endSentence}
                      onChange={e => handleEndSentenceChange(e.target.value)}
                      className="w-20 bg-gray-800 border border-gray-600 rounded p-2"
                    />
                  </div>
                  <div className="text-sm text-gray-400 w-full sm:w-auto pt-1 sm:pt-0 sm:pb-1 sm:ml-auto text-left sm:text-right">
                    ({t('coPlay.totalSentences', { total: totalSentences })})
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="app-sentences" className="block text-gray-300 mb-1">{t('coPlay.appSentences')}</label>
                  <div className="flex items-center gap-3">
                    <input
                      id="app-sentences"
                      type="number"
                      min="1"
                      value={modeOption.appSentences === 'all' ? '' : modeOption.appSentences}
                      onChange={e => handleAppSentencesChange(e.target.value)}
                      disabled={modeOption.appSentences === 'all'}
                      placeholder={modeOption.appSentences === 'all' ? t('coPlay.allSentences') : undefined}
                      className="w-24 bg-gray-800 border border-gray-600 rounded p-2 disabled:opacity-70"
                    />
                    <label className="flex items-center gap-2 text-sm text-gray-400">
                      <input type="checkbox" className="accent-teal-500" checked={modeOption.appSentences === 'all'} onChange={toggleAppSentencesAll} />
                      {t('coPlay.all')}
                    </label>
                  </div>
                </div>
                <div>
                  <label htmlFor="user-sentences" className="block text-gray-300 mb-1">{t('coPlay.userSentences')}</label>
                  <div className="flex items-center gap-3">
                    <input
                      id="user-sentences"
                      type="number"
                      min="1"
                      value={modeOption.userSentences === 'all' ? '' : modeOption.userSentences}
                      onChange={e => handleUserSentencesChange(e.target.value)}
                      disabled={modeOption.userSentences === 'all'}
                      placeholder={modeOption.userSentences === 'all' ? t('coPlay.allSentences') : undefined}
                      className="w-24 bg-gray-800 border border-gray-600 rounded p-2 disabled:opacity-70"
                    />
                    <label className="flex items-center gap-2 text-sm text-gray-400">
                      <input type="checkbox" className="accent-teal-500" checked={modeOption.userSentences === 'all'} onChange={toggleUserSentencesAll} />
                      {t('coPlay.all')}
                    </label>
                  </div>
                </div>
              </div>
            </div>
          )}
          <Button onClick={handleStart} variant="primary" size="lg">{t('coPlay.start')}</Button>
        </div>
        {loading && <Loader text={t('coPlay.planningSession')} />}
        {error && (
          <div className="p-4 mt-4 text-center text-red-400 bg-red-900/20 rounded">
            {/^[-_a-zA-Z0-9.]+$/.test(error) ? t(error) : error}
          </div>
        )}
      </div>
    );
  }

  if (loading) return <Loader text={t('coPlay.planningSession')} />;
  if (error) return <div className="p-8 text-center text-red-400">{/^[-_a-zA-Z0-9.]+$/.test(error) ? t(error) : error} <Button onClick={fetchPlan} className="mt-4">{t('coPlay.tryAgain')}</Button></div>;
  if (!plan || plan.timeline.length === 0) return <div className="p-8 text-center text-gray-400">{t('coPlay.planCreationError')}</div>;

  const sentencesToType = currentTimelineItem?.pause_require[0]?.user_sentences_to_type;
  const isMultiSentenceTurn = turnSentences.length > 1;

  return (
    <div className="p-4 md:p-8 flex flex-col h-full">
      <h2 className="text-2xl font-bold text-teal-400 mb-6">{t('coPlay.modeTitle')}</h2>
      
      <div className="max-h-64 overflow-y-auto bg-gray-900/50 p-6 rounded-lg border border-gray-700/50 mb-6">
        <p className="text-xl leading-loose whitespace-pre-wrap">
          {tokens.map((token, index) => {
            const isRevealed = index <= revealedTokenIndex;
            const isCurrentlyRevealing = index === revealedTokenIndex;
            const isPartOfPausePlaceholder = isPaused && !isFinished && currentTimelineItem?.pause_require.length > 0 && index >= startTokenOfPause && index <= endTokenOfPause;

            if (isPartOfPausePlaceholder && index > revealedTokenIndex) {
              if (token.trim() === '') {
                return <span key={index}>{token}</span>;
              }
              return <span key={index} className="bg-gray-700 text-transparent rounded-sm select-none">{token}</span>;
            }

            return (
              <span
                key={index}
                ref={isCurrentlyRevealing ? revealedTokenRef : null}
                className={`transition-colors duration-200 ${
                  isRevealed ? 'text-teal-300' : 'text-transparent'
                } ${
                  isCurrentlyRevealing ? 'bg-teal-500/20 rounded' : ''
                }`}
              >
                {token}
              </span>
            );
          })}
        </p>
      </div>

      {isFinished ? (
          <div className="text-center p-4 bg-green-900/30 rounded-lg">
              <h3 className="text-2xl font-bold text-green-300">{t('coPlay.congratulations')}</h3>
              <p className="text-green-400">{t('coPlay.sessionCompleted')}</p>
              <div className="flex justify-center gap-4 mt-4">
                <Button onClick={handleReset} variant="secondary">{t('coPlay.reset')}</Button>
                <Button onClick={() => setPlan(null)} variant="primary">{t('coPlay.playAgain')}</Button>
              </div>
          </div>
      ) : isPaused && currentTimelineItem?.pause_require.length > 0 ? (
        <>
          <div class="flex justify-between items-center mb-4">
            {sentencesToType && (
              <div class="text-center p-2 bg-blue-900/30 rounded-lg">
                {isMultiSentenceTurn ? (
                  <p class="text-blue-300">
                    {t('coPlay.typeSentence', { current: currentUserSentenceIndex + 1, total: turnSentences.length })}
                  </p>
                ) : (
                  <p class="text-blue-300">{t('coPlay.typeNextSentence')}</p>
                )}
              </div>
            )}
            <div class="flex gap-2">
              <Button onClick={handleReset} variant="secondary" size="sm">{t('coPlay.reset')}</Button>
              <Button onClick={handleEndSession} variant="secondary" size="sm">{t('coPlay.endSession')}</Button>
            </div>
          </div>
          <form onSubmit={handleSubmit} class="flex flex-col sm:flex-row items-center gap-3">
            <div class="relative flex-grow w-full sm:w-auto">
              <input
                type="text"
                value={userInput}
                onChange={(e) => {
                  setUserInput(e.target.value)
                  setFeedback(null)
                  setIncorrectFeedback(null)
                }}
                placeholder={t('coPlay.typeNextPartPlaceholder')}
                class={`w-full bg-gray-800 border-2 rounded-lg p-3 text-gray-200 focus:outline-none transition-colors duration-300 pr-12 ${
                  feedback === 'correct' ? 'border-green-500' : 
                  feedback === 'incorrect' ? 'border-red-500' : 'border-gray-600 focus:border-teal-500'
                }`}
                autoFocus
              />
              <Button
                type="button"
                onClick={handleHint}
                variant="ghost"
                size="icon"
                class="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-teal-400"
                aria-label={t('coPlay.getHint')}
              >
                <LightbulbIcon class="w-6 h-6" />
              </Button>
            </div>
            <div class="flex gap-2">
              <Button type="submit" variant="primary" size="sm">
                {t('coPlay.continue')}
              </Button>
              <Button onClick={handleShowAnswer} variant="secondary" size="sm">
                {t('coPlay.showAnswer')}
              </Button>
            </div>
          </form>
          {hint && (
            <div class="mt-3 text-center text-sm text-gray-400">
              {t('coPlay.hint')}<span class="font-mono bg-gray-700 p-1 rounded">{hint}</span>
            </div>
          )}
          {incorrectFeedback}
        </>
      ) : (
        <div class="flex flex-col sm:flex-row items-center justify-between gap-4">
            <div class="text-center text-gray-400">
                <p>{t('coPlay.revealingText')}</p>
            </div>
            <div class="flex items-center gap-2">
              <label htmlFor="wpm" class="text-sm font-medium text-gray-400">{t('coPlay.speedWPM')}</label>
              <input
                type="range"
                id="wpm"
                min="50"
                max="400"
                step="10"
                value={wpm}
                onChange={(e) => setWpm(Number(e.target.value))}
                class="w-32 md:w-48"
              />
              <span class="font-mono text-teal-300 w-10 text-center">{wpm}</span>
            </div>
            <Button onClick={handleEndSession} variant="secondary" size="sm">{t('coPlay.endSession')}</Button>
        </div>
      )}
    </div>
  );
};

export default CoPlayMode;