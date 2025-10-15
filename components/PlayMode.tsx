
import React, { useState, useEffect, useRef } from 'react';
import Button from './common/Button';

interface PlayModeProps {
  tokens: string[];
}

const PlayMode: React.FC<PlayModeProps> = ({ tokens }) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [wpm, setWpm] = useState(200);
  const [currentIndex, setCurrentIndex] = useState(-1);
  const timerRef = useRef<number | null>(null);

  useEffect(() => {
    if (isPlaying && currentIndex < tokens.length - 1) {
      const delay = 60000 / wpm;
      timerRef.current = window.setTimeout(() => {
        setCurrentIndex(prevIndex => prevIndex + 1);
      }, delay);
    } else if (currentIndex >= tokens.length - 1) {
      setIsPlaying(false);
    }
    
    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
    };
  }, [isPlaying, currentIndex, tokens.length, wpm]);

  const handlePlayPause = () => {
    if (currentIndex >= tokens.length - 1) {
      setCurrentIndex(-1); // Reset if at the end
    }
    setIsPlaying(!isPlaying);
  };

  const handleReset = () => {
    setIsPlaying(false);
    setCurrentIndex(-1);
  }

  return (
    <div className="p-4 md:p-8 flex flex-col h-full">
      <h2 className="text-2xl font-bold text-teal-400 mb-6">Play Mode</h2>
      
      <div className="flex-grow bg-gray-900/50 p-6 rounded-lg border border-gray-700/50">
        <p className="text-xl leading-loose whitespace-pre-wrap">
          {tokens.map((token, index) => (
            <span
              key={index}
              className={`transition-colors duration-300 ${
                index <= currentIndex ? 'text-teal-300' : 'text-transparent'
              } ${
                index === currentIndex ? 'bg-teal-500/20 rounded' : ''
              }`}
            >
              {token}
            </span>
          ))}
        </p>
      </div>

      <div className="mt-6 flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-4">
            <Button onClick={handlePlayPause} variant="primary" className="w-28">
                {isPlaying ? 'Pause' : 'Play'}
            </Button>
            <Button onClick={handleReset} variant="secondary">
                Reset
            </Button>
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
    </div>
  );
};

export default PlayMode;
