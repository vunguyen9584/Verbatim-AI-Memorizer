
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { CoPlayPlan, CoPlayModeType, CoPlayModeOption } from '../types';
import { planCoPlay } from '../services/geminiService';
import Loader from './common/Loader';
import Button from './common/Button';
import { LightbulbIcon } from './common/Icon';

interface CoPlayModeProps {
  text: string;
  tokens: string[];
}

const CoPlayMode: React.FC<CoPlayModeProps> = ({ text, tokens }) => {
  const [modeOption, setModeOption] = useState<CoPlayModeOption>({ type: CoPlayModeType.AppFirstN, appSentences: 1, userSentences: 1 });
  const [appSentences, setAppSentences] = useState(1);
  const [userSentences, setUserSentences] = useState(1);
  const [plan, setPlan] = useState<CoPlayPlan | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [timelineIndex, setTimelineIndex] = useState(0);
  const [userInput, setUserInput] = useState('');
  const [isPaused, setIsPaused] = useState(true);
  const [feedback, setFeedback] = useState<'correct' | 'incorrect' | null>(null);
  const [hint, setHint] = useState('');
  const [incorrectFeedback, setIncorrectFeedback] = useState<React.ReactNode | null>(null);

  const [wpm, setWpm] = useState(200);
  const [revealedTokenIndex, setRevealedTokenIndex] = useState(-1);
  const timerRef = useRef<number | null>(null);

  const fetchPlan = useCallback(async () => {
    setLoading(true);
    setError(null);
    setPlan(null);
    setTimelineIndex(0);
    setUserInput('');
    setFeedback(null);
    setHint('');
    setIncorrectFeedback(null);
    setRevealedTokenIndex(-1);
    try {
      const data = await planCoPlay(text, tokens, modeOption);
      if (data.timeline.length > 0) {
        data.timeline.push({
            reveal_until_token: tokens.length,
            pause_require: [],
        });
      }
      setPlan(data);
      console.log('Co-Play Plan:', data);

      const startsWithPause = data.timeline.length > 0 && data.timeline[0].pause_require.length > 0;
      setIsPaused(startsWithPause);

      if (startsWithPause) {
        const firstPauseStartToken = data.timeline[0].pause_require[0].span[0];
        setRevealedTokenIndex(firstPauseStartToken - 1);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate a Co-Play plan. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [text, tokens, modeOption]);

  // Remove useEffect that fetches plan on load

  const currentTimelineItem = plan?.timeline[timelineIndex];
  const prevTimelineItem = timelineIndex > 0 ? plan.timeline[timelineIndex - 1] : null;
  const revealUntilToken = currentTimelineItem?.reveal_until_token ?? (isPaused ? revealedTokenIndex : tokens.length);

  useEffect(() => {
    if (!plan) return;

    if (!isPaused && revealedTokenIndex < revealUntilToken) {
      const delay = 60000 / wpm;
      timerRef.current = window.setTimeout(() => {
        setRevealedTokenIndex(prev => prev + 1);
      }, delay);
    } else if (!isPaused && revealedTokenIndex >= revealUntilToken - 1) {
        // Finished revealing this segment, advance the timeline.
        setTimelineIndex(prevIndex => {
          const nextIndex = prevIndex + 1;
          
          if (nextIndex >= plan.timeline.length) {
            setIsPaused(true);
            return prevIndex;
          }

          const nextTimelineItem = plan.timeline[nextIndex];
          if (nextTimelineItem && nextTimelineItem.pause_require.length > 0) {
              setIsPaused(true);
          }
          
          return nextIndex;
        });
    }

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [isPaused, revealedTokenIndex, wpm, plan, timelineIndex, revealUntilToken]);


  const startTokenOfPause = currentTimelineItem?.pause_require[0]?.span[0] ?? 0;
  const endTokenOfPause = currentTimelineItem?.pause_require[0]?.span[1] ?? 0;
  const correctAnswer = tokens.slice(startTokenOfPause, endTokenOfPause + 1).join('');

  const handleHint = () => {
    if (hint.length < correctAnswer.length) {
      setHint(correctAnswer.substring(0, hint.length + 1));
    }
  };

  const generateDiff = (userInput: string, correctAnswer: string) => {
    const userChars = userInput.trim().split('');
    const correctChars = correctAnswer.trim().split('');
    
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

    const trimmedUserInput = userInput.trim();
    const trimmedCorrectAnswer = correctAnswer.trim();

    if (trimmedUserInput.toLowerCase() === trimmedCorrectAnswer.toLowerCase()) {
      setFeedback('correct');
      setIncorrectFeedback(null);

      setTimeout(() => {
        // Reveal the text the user just typed.
        const endOfTypedPhrase = currentTimelineItem.pause_require[0].span[1];
        setRevealedTokenIndex(endOfTypedPhrase);

        // Move to the next timeline item.
        const nextIndex = timelineIndex + 1;
        setTimelineIndex(nextIndex);

        // Check if the new timeline item requires a pause.
        const nextTimelineItem = plan?.timeline[nextIndex];
        if (nextTimelineItem && nextTimelineItem.pause_require.length > 0) {
          setIsPaused(true); // The next phase is another pause.
        } else {
          setIsPaused(false); // The next phase is auto-reveal.
        }
        
        // Reset input fields for the next round.
        setUserInput('');
        setFeedback(null);
        setHint('');

      }, 300);
    } else {
      setFeedback('incorrect');
      setIncorrectFeedback(generateDiff(trimmedUserInput, trimmedCorrectAnswer));
    }
  };
  
  const isFinished = timelineIndex >= (plan?.timeline.length ?? 0);

  const handleModeChange = (type: CoPlayModeType) => {
    setModeOption({ type, appSentences, userSentences });
  };

  const handleStart = () => {
    setModeOption({ type: modeOption.type, appSentences, userSentences });
    fetchPlan();
  };

  const handleReset = () => {
    if (!plan) return;

    setTimelineIndex(0);
    setUserInput('');
    setFeedback(null);
    setHint('');
    setIncorrectFeedback(null);

    const startsWithPause = plan.timeline.length > 0 && plan.timeline[0].pause_require.length > 0;
    setIsPaused(startsWithPause);

    if (startsWithPause) {
      const firstPauseStartToken = plan.timeline[0].pause_require[0].span[0];
      setRevealedTokenIndex(firstPauseStartToken - 1);
    } else {
      setRevealedTokenIndex(-1);
    }
  };

  if (!plan) {
    return (
      <div className="p-4 md:p-8 flex flex-col h-full">
        <h2 className="text-2xl font-bold text-teal-400 mb-6">Co-Play Mode Setup</h2>
        <div className="space-y-4">
          <div>
            <label className="block text-gray-300 mb-2">Select Mode:</label>
            <div className="grid grid-cols-2 gap-2">
              <Button onClick={() => handleModeChange(CoPlayModeType.AppFirstN)} variant={modeOption.type === CoPlayModeType.AppFirstN ? 'primary' : 'secondary'}>App First</Button>
              <Button onClick={() => handleModeChange(CoPlayModeType.UserFirstN)} variant={modeOption.type === CoPlayModeType.UserFirstN ? 'primary' : 'secondary'}>User First</Button>
              <Button onClick={() => handleModeChange(CoPlayModeType.AppFirstRandom)} variant={modeOption.type === CoPlayModeType.AppFirstRandom ? 'primary' : 'secondary'}>App First (Random)</Button>
              <Button onClick={() => handleModeChange(CoPlayModeType.UserFirstRandom)} variant={modeOption.type === CoPlayModeType.UserFirstRandom ? 'primary' : 'secondary'}>User First (Random)</Button>
            </div>
          </div>
          {[CoPlayModeType.AppFirstN, CoPlayModeType.UserFirstN].includes(modeOption.type) && (
            <div className="flex items-center space-x-4">
              <div>
                <label htmlFor="app-sentences" className="block text-gray-300 mb-1">App Sentences:</label>
                <input id="app-sentences" type="number" min="1" value={appSentences} onChange={e => setAppSentences(parseInt(e.target.value, 10))} className="w-20 bg-gray-800 border border-gray-600 rounded p-2" />
              </div>
              <div>
                <label htmlFor="user-sentences" className="block text-gray-300 mb-1">User Sentences:</label>
                <input id="user-sentences" type="number" min="1" value={userSentences} onChange={e => setUserSentences(parseInt(e.target.value, 10))} className="w-20 bg-gray-800 border border-gray-600 rounded p-2" />
              </div>
            </div>
          )}
          <Button onClick={handleStart} variant="primary" size="lg">Start</Button>
        </div>
        {loading && <Loader text="Planning your session..." />}
        {error && <div className="p-4 mt-4 text-center text-red-400 bg-red-900/20 rounded">{error}</div>}
      </div>
    );
  }

  if (loading) return <Loader text="Planning your session..." />;
  if (error) return <div className="p-8 text-center text-red-400">{error} <Button onClick={fetchPlan} className="mt-4">Try Again</Button></div>;
  if (!plan || plan.timeline.length === 0) return <div className="p-8 text-center text-gray-400">Could not create a Co-Play plan for this text.</div>;

  const sentencesToType = currentTimelineItem?.pause_require[0]?.user_sentences_to_type;

  return (
    <div className="p-4 md:p-8 flex flex-col h-full">
      <h2 className="text-2xl font-bold text-teal-400 mb-6">Co-Play Mode</h2>
      
      <div className="flex-grow bg-gray-900/50 p-6 rounded-lg border border-gray-700/50 mb-6">
        <p className="text-xl leading-loose whitespace-pre-wrap">
          {tokens.map((token, index) => (
            <span
              key={index}
              className={`transition-colors duration-200 ${
                index <= revealedTokenIndex ? 'text-teal-300' : 'text-transparent'
              } ${
                index === revealedTokenIndex ? 'bg-teal-500/20 rounded' : ''
              }`}
            >
              {token}
            </span>
          ))}
           {isPaused && !isFinished && currentTimelineItem?.pause_require.length > 0 && (
            tokens.slice(startTokenOfPause, endTokenOfPause + 1).map((token, i) => {
                if (token.trim() === '') {
                    return <span key={`placeholder-${i}`}>{token}</span>;
                }
                return <span key={`placeholder-${i}`} className="bg-gray-700 text-transparent rounded-sm select-none">{token}</span>;
            })
           )}
        </p>
      </div>

      {isFinished ? (
          <div className="text-center p-4 bg-green-900/30 rounded-lg">
              <h3 className="text-2xl font-bold text-green-300">Congratulations!</h3>
              <p className="text-green-400">You've completed the session.</p>
              <div className="flex justify-center gap-4 mt-4">
                <Button onClick={handleReset} variant="secondary">Reset</Button>
                <Button onClick={() => setPlan(null)} variant="primary">Play Again</Button>
              </div>
          </div>
      ) : isPaused && currentTimelineItem?.pause_require.length > 0 ? (
        <>
          <div className="flex justify-between items-center mb-4">
            {sentencesToType && (
              <div className="text-center p-2 bg-blue-900/30 rounded-lg">
                <p className="text-blue-300">Please type the next {sentencesToType} sentence(s).</p>
              </div>
            )}
            <Button onClick={handleReset} variant="secondary" size="sm">Reset</Button>
          </div>
          <form onSubmit={handleSubmit} className="flex flex-col sm:flex-row items-center gap-3">
            <div className="relative flex-grow w-full sm:w-auto">
              <input
                type="text"
                value={userInput}
                onChange={(e) => {
                  setUserInput(e.target.value)
                  setFeedback(null)
                  setIncorrectFeedback(null)
                }}
                placeholder="Type the next part..."
                className={`w-full bg-gray-800 border-2 rounded-lg p-3 text-gray-200 focus:outline-none transition-colors duration-300 pr-12 ${
                  feedback === 'correct' ? 'border-green-500' :
                  feedback === 'incorrect' ? 'border-red-500' : 'border-gray-600 focus:border-teal-500'
                }`}
                autoFocus
              />
              <Button 
                onClick={handleHint} 
                variant="ghost" 
                size="icon" 
                className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-teal-400"
                aria-label="Get a hint"
              >
                <LightbulbIcon className="w-6 h-6" />
              </Button>
            </div>
            <Button type="submit" variant="primary" className="w-full sm:w-auto">
              Continue
            </Button>
          </form>
          {incorrectFeedback && (
            <div className="mt-3 text-sm text-gray-400">
              <p className="font-semibold mb-1 text-left">Suggestion:</p>
              {incorrectFeedback}
            </div>
          )}
          {hint && (
            <div className="mt-3 text-center text-sm text-gray-400">
              Hint: <span className="font-mono bg-gray-700 p-1 rounded">{hint}</span>
            </div>
          )}
        </>
      ) : (
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="text-center text-gray-400">
                <p>Revealing text...</p>
            </div>
            <div className="flex items-center gap-2">
              <label htmlFor="wpm" className="text-sm font-medium text-gray-400">Speed (WPM):</label>
              <input
                type="range"
                id="wpm"
                min="50"
                max="400"
                step="10"
                value={wpm}
                onChange={(e) => setWpm(Number(e.target.value))}
                className="w-32 md:w-48"
              />
              <span className="font-mono text-teal-300 w-10 text-center">{wpm}</span>
            </div>
        </div>
      )}
    </div>
  );
};

export default CoPlayMode;
