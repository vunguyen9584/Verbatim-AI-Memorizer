
import React, { useState } from 'react';
import Card from './common/Card';
import Button from './common/Button';

interface TextInputAreaProps {
  onTextSubmit: (text: string) => void;
}

const TextInputArea: React.FC<TextInputAreaProps> = ({ onTextSubmit }) => {
  const [text, setText] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (text.trim()) {
      onTextSubmit(text.trim());
    }
  };

  return (
    <Card className="flex-grow flex flex-col">
      <h2 className="text-xl font-bold text-white mb-3">Your Text</h2>
      <p className="text-gray-400 mb-4 text-sm">
        Paste the content you want to memorize. The AI will generate learning exercises based on it.
      </p>
      <form onSubmit={handleSubmit} className="flex-grow flex flex-col">
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          className="w-full flex-grow bg-gray-900/50 border border-gray-700 rounded-lg p-3 text-gray-200 focus:ring-2 focus:ring-teal-500 focus:border-teal-500 transition duration-200 resize-none"
          placeholder="Paste your text here..."
        />
        <Button type="submit" className="mt-4 w-full" disabled={!text.trim()}>
          Start Learning
        </Button>
      </form>
    </Card>
  );
};

export default TextInputArea;
