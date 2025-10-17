import React, { useState, useCallback } from 'react';
import { MemoryMethod, MemoryStoryResult, MemoryAcrosticResult } from '../types';
import { generateMemoryTips } from '../services/geminiService';
import Loader from './common/Loader';
import Button from './common/Button';

interface MemorizeTipsModeProps {
  text: string;
}

type ModeState = 'setup' | 'loading' | 'result';

const MemorizeTipsMode: React.FC<MemorizeTipsModeProps> = ({ text }) => {
  const [modeState, setModeState] = useState<ModeState>('setup');
  const [selectedMethod, setSelectedMethod] = useState<MemoryMethod>(MemoryMethod.STORY);
  const [result, setResult] = useState<MemoryStoryResult | MemoryAcrosticResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleGenerate = useCallback(async () => {
    setError(null);
    setModeState('loading');

    try {
      const data = await generateMemoryTips(text, selectedMethod);
      setResult(data);
      setModeState('result');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An unknown error occurred.');
      setModeState('setup');
    }
  }, [text, selectedMethod]);

  const handleStartOver = () => {
    setResult(null);
    setError(null);
    setModeState('setup');
  };

  const renderSetup = () => (
    <div className="p-4 md:p-8 flex flex-col h-full justify-center">
      <h2 className="text-2xl font-bold text-teal-400 mb-2 text-center">Mẹo Ghi Nhớ</h2>
      <p className="text-gray-400 mb-6 text-center">Chọn phương pháp tạo mẹo ghi nhớ từ văn bản của bạn.</p>

      {error && <div className="bg-red-900/50 text-red-300 p-3 rounded-lg mb-4 text-center">{error}</div>}

      <div className="space-y-6">
        <div>
          <label className="block text-lg font-semibold text-gray-200 mb-3">Phương Pháp</label>
          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={() => setSelectedMethod(MemoryMethod.STORY)}
              className={`p-4 rounded-lg border-2 text-left transition-all ${
                selectedMethod === MemoryMethod.STORY
                  ? 'bg-teal-500/30 border-teal-400'
                  : 'bg-gray-700/50 border-gray-600 hover:bg-gray-700'
              }`}
            >
              <div className="font-semibold">Câu Chuyện</div>
              <div className="text-sm text-gray-400 mt-1">Tạo câu chuyện hình dung từ văn bản</div>
            </button>
            <button
              onClick={() => setSelectedMethod(MemoryMethod.ACROSTIC)}
              className={`p-4 rounded-lg border-2 text-left transition-all ${
                selectedMethod === MemoryMethod.ACROSTIC
                  ? 'bg-teal-500/30 border-teal-400'
                  : 'bg-gray-700/50 border-gray-600 hover:bg-gray-700'
              }`}
            >
              <div className="font-semibold">Câu Viết Tắt</div>
              <div className="text-sm text-gray-400 mt-1">Tạo câu acrostic từ từ khóa</div>
            </button>
          </div>
        </div>
      </div>

      <div className="mt-8">
        <Button onClick={handleGenerate} variant="primary" className="w-full">
          Tạo Mẹo Ghi Nhớ
        </Button>
      </div>
    </div>
  );

  const renderResult = () => {
    if (!result) return null;

    return (
      <div className="p-4 md:p-8 flex flex-col h-full">
        <div className="flex justify-between items-start mb-6">
          <div>
            <h2 className="text-xl font-bold text-teal-400">
              {selectedMethod === MemoryMethod.STORY ? 'Câu Chuyện Gợi Nhớ' : 'Câu Viết Tắt'}
            </h2>
          </div>
          <Button onClick={handleStartOver} variant="ghost">Tạo Lại</Button>
        </div>

        <div className="flex-grow mb-4">
          <div className="bg-gray-700/50 p-6 rounded-lg">
            {selectedMethod === MemoryMethod.STORY ? (
              <p className="text-lg text-gray-200 whitespace-pre-wrap leading-relaxed">
                {(result as MemoryStoryResult).story}
              </p>
            ) : (
              <p className="text-lg text-gray-200 whitespace-pre-wrap leading-relaxed">
                {(result as MemoryAcrosticResult).sentence}
              </p>
            )}
          </div>
        </div>
      </div>
    );
  };

  switch (modeState) {
    case 'setup':
      return renderSetup();
    case 'loading':
      return <Loader text="Đang tạo mẹo ghi nhớ..." />;
    case 'result':
      return renderResult();
    default:
      return null;
  }
};

export default MemorizeTipsMode;
