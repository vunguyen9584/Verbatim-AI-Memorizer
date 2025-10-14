
import React, { useState, useEffect, useCallback } from 'react';
import { CoPlayPlan, CoPlayTimelineItem } from '../types';
import { planCoPlay } from '../services/geminiService';
import Loader from './common/Loader';
import Button from './common/Button';

interface CoPlayModeProps {
  text: string;
  tokens: string[];
}

const CoPlayMode: React.FC<CoPlayModeProps> = ({ text, tokens }) => {
  const [plan, setPlan] = useState<CoPlayPlan | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [timelineIndex, setTimelineIndex] = useState(0);
  const [userInput, setUserInput] = useState('');
  const [isPaused, setIsPaused] = useState(false);
  const [feedback, setFeedback] = useState<'correct' | 'incorrect' | null>(null);

  const fetchPlan = useCallback(async () => {
    setLoading(true);
    setError(null);
    setPlan(null);
    try {
      const data = await planCoPlay(text, tokens);
      // Add a final step to reveal the rest of the text
      if (data.timeline.length > 0) {
        data.timeline.push({
            reveal_until_token: tokens.length,
            pause_require: [],
        })
      }
      setPlan(data);
      if (data.timeline.length > 0) {
        setIsPaused(true);
      }
    } catch (err) {
      setError('Failed to generate a Co-Play plan. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [text, tokens]);

  useEffect(() => {
    fetchPlan();
  }, [fetchPlan]);
  
  const currentTimelineItem = plan?.timeline[timelineIndex];
  const previousTimelineItem = timelineIndex > 0 ? plan?.timeline[timelineIndex-1] : { reveal_until_token: -1 };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentTimelineItem || currentTimelineItem.pause_require.length === 0) return;

    const [start, end] = currentTimelineItem.pause_require[0].span;
    const correctAnswer = tokens.slice(start, end + 1).join('');
    
    if (userInput.trim() === correctAnswer.trim()) {
      setFeedback('correct');
      setTimeout(() => {
        setTimelineIndex(prev => prev + 1);
        setIsPaused(plan!.timeline[timelineIndex+1]?.pause_require.length > 0);
        setUserInput('');
        setFeedback(null);
      }, 1000);
    } else {
      setFeedback('incorrect');
    }
  };

  const getRevealedText = () => {
    const revealEndIndex = currentTimelineItem?.reveal_until_token ?? tokens.length;
    return tokens.slice(0, revealEndIndex).join('');
  };
  
  const getHiddenText = () => {
    const revealEndIndex = currentTimelineItem?.reveal_until_token ?? 0;
    return tokens.slice(revealEndIndex).join('');
  };

  if (loading) return <Loader text="Planning your session..." />;
  if (error) return <div className="p-8 text-center text-red-400">{error}</div>;
  if (!plan || plan.timeline.length === 0) return <div className="p-8 text-center text-gray-400">Could not create a Co-Play plan for this text.</div>;
  
  const isFinished = timelineIndex >= plan.timeline.length - 1 && !isPaused;

  return (
    <div className="p-4 md:p-8 flex flex-col h-full">
      <h2 className="text-2xl font-bold text-teal-400 mb-6">Co-Play Mode</h2>
      
      <div className="flex-grow bg-gray-900/50 p-6 rounded-lg border border-gray-700/50 mb-6">
        <p className="text-xl leading-loose">
          <span className="text-teal-300">{getRevealedText()}</span>
          {isPaused && currentTimelineItem?.pause_require.length > 0 && <span className="bg-teal-500/20 text-teal-200 p-1 rounded-md animate-pulse">...</span>}
          <span className="text-gray-500">{getHiddenText()}</span>
        </p>
      </div>

      {isFinished ? (
          <div className="text-center p-4 bg-green-900/30 rounded-lg">
              <h3 className="text-2xl font-bold text-green-300">Congratulations!</h3>
              <p className="text-green-400">You've completed the session.</p>
              <Button onClick={fetchPlan} className="mt-4">Play Again</Button>
          </div>
      ) : isPaused && currentTimelineItem?.pause_require.length > 0 ? (
        <form onSubmit={handleSubmit} className="flex flex-col sm:flex-row items-center gap-3">
          <input
            type="text"
            value={userInput}
            onChange={(e) => {
              setUserInput(e.target.value)
              setFeedback(null)
            }}
            placeholder="Type the next part..."
            className={`flex-grow w-full sm:w-auto bg-gray-800 border-2 rounded-lg p-3 text-gray-200 focus:outline-none transition-colors duration-300 ${
              feedback === 'correct' ? 'border-green-500' :
              feedback === 'incorrect' ? 'border-red-500' : 'border-gray-600 focus:border-teal-500'
            }`}
            autoFocus
          />
          <Button type="submit" variant="primary" className="w-full sm:w-auto">
            Continue
          </Button>
        </form>
      ) : (
          <div className="text-center text-gray-400">
              <p>Session in progress...</p>
          </div>
      )}
    </div>
  );
};

export default CoPlayMode;
