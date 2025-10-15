
import React, { useState, useCallback, useMemo } from 'react';
import { QuizData, ClozeQuizItem, TypedExactQuizItem, MCQQuizItem, OrderingQuizItem } from '../types';
import { generateQuizzes } from '../services/geminiService';
import Loader from './common/Loader';
import Button from './common/Button';
import { CheckCircleIcon, XCircleIcon } from './common/Icon';

interface QuizModeProps {
  text: string;
  tokens: string[];
}

type QuizState = 'setup' | 'loading' | 'active' | 'results';

const ALL_QUIZ_TYPES = [
    { id: 'cloze_by_token', name: 'Fill-in-the-Blank' },
    { id: 'typed_exact', name: 'Type Exact Phrase' },
    { id: 'mcq_cloze', name: 'Multiple Choice' },
    { id: 'ordering', name: 'Word Order' },
];

const QuizMode: React.FC<QuizModeProps> = ({ text, tokens }) => {
  const [quizState, setQuizState] = useState<QuizState>('setup');

  // Setup state
  const [selectedQuizTypes, setSelectedQuizTypes] = useState<string[]>(['cloze_by_token', 'typed_exact']);
  const [numQuestions, setNumQuestions] = useState(5);
  const [error, setError] = useState<string | null>(null);

  // Active quiz state
  const [quizData, setQuizData] = useState<QuizData | null>(null);
  const [currentQuizIndex, setCurrentQuizIndex] = useState(0);
  const [userAnswer, setUserAnswer] = useState<any>(null);
  const [isAnswered, setIsAnswered] = useState(false);
  const [isCorrect, setIsCorrect] = useState(false);
  const [showAnswer, setShowAnswer] = useState(false);
  const [correctAnswersCount, setCorrectAnswersCount] = useState(0);

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
        setError("Please select at least one quiz type.");
        return;
    }
    setError(null);
    resetQuizState();
    setQuizState('loading');
    
    try {
      const options = { quizTypes: selectedQuizTypes, numQuestions };
      const data = await generateQuizzes(text, tokens, options);

      // Basic validation for AI response
      if (!data || !Array.isArray(data.quizzes) || data.quizzes.length === 0) {
        setError("The AI returned an empty or invalid response. Please try again.");
        setQuizState('setup');
        return;
      }

      // More specific validation for quiz item integrity.
      for (const quiz of data.quizzes) {
        if (!quiz || !quiz.type || !quiz.stem) {
             setError("The AI returned a quiz with invalid data. Please try again.");
             setQuizState('setup');
             return;
        }
        // This check specifically prevents the "Answer not available" issue for MCQs.
        if (quiz.type === 'mcq_cloze') {
          const mcq = quiz as MCQQuizItem;
          const hasIndex = typeof mcq.answer_index === 'number';
          const canDerive = (mcq as any).blanks?.[0]?.answer_text && Array.isArray(mcq.options);
          
          if (!hasIndex && !canDerive) {
            setError("The AI returned an MCQ quiz with no answer. Please try again.");
            setQuizState('setup');
            console.warn("Invalid MCQ item from AI:", mcq);
            return;
          }
        }
      }

      setQuizData(data);
      setQuizState('active');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An unknown error occurred while generating the quiz.');
      console.error(err);
      setQuizState('setup');
    }
  }, [text, tokens, selectedQuizTypes, numQuestions]);

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
        correct = clozeQuiz.blanks.every((blank, index) => (userAnswer[index] || '').trim().toLowerCase() === blank.answer_text.trim().toLowerCase());
        break;
      case 'typed_exact':
        const typedQuiz = currentQuiz as TypedExactQuizItem;
        let expected = tokens.slice(typedQuiz.answer_span[0], typedQuiz.answer_span[1] + 1).join('');
        let actual = userAnswer;
        if (typedQuiz.tolerance && !typedQuiz.tolerance.case) {
            expected = expected.toLowerCase();
            actual = actual.toLowerCase();
        }
        if (typedQuiz.tolerance && !typedQuiz.tolerance.punctuation) {
            expected = expected.replace(/[.,/#!$%^&*;:{}=\-_`~()]/g,"").replace(/\s/g, '');
            actual = actual.replace(/[.,/#!$%^&*;:{}=\-_`~()]/g,"").replace(/\s/g, '');
        }
        correct = actual.trim() === expected.trim();
        break;
      case 'mcq_cloze':
        correct = userAnswer === correctAnswerIndex;
        break;
      case 'ordering':
        const orderingQuiz = currentQuiz as OrderingQuizItem;
        const correctOrder = tokens.slice(orderingQuiz.answer_span[0], orderingQuiz.answer_span[1] + 1).join('').replace(/\s/g, '');
        const userAnswerOrder = userAnswer.map((w: any) => w.word).join('').replace(/\s/g, '');
        correct = userAnswerOrder === correctOrder;
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

    switch (currentQuiz.type) {
      case 'cloze_by_token':
        const clozeQuiz = currentQuiz as ClozeQuizItem;
        const parts = (clozeQuiz.base_text_with_masks || '').split('...');
        return (
            <div>
              {parts.map((part, index) => (
                <React.Fragment key={index}>
                  {part}
                  {index < clozeQuiz.blanks.length && (
                    <input
                      type="text"
                      className="bg-gray-700 border-2 border-gray-600 rounded-md p-1 mx-1 text-teal-300 w-32 focus:border-teal-500 focus:outline-none"
                      value={userAnswer?.[index] || ''}
                      disabled={isAnswered}
                      onChange={(e) => {
                        const newAnswers = [...(userAnswer || [])];
                        newAnswers[index] = e.target.value;
                        setUserAnswer(newAnswers);
                      }}
                    />
                  )}
                </React.Fragment>
              ))}
            </div>
        );
      case 'typed_exact':
        return <input type="text" autoFocus className="w-full bg-gray-700 border-2 border-gray-600 rounded-md p-2 text-teal-300 focus:border-teal-500 focus:outline-none" value={userAnswer || ''} disabled={isAnswered} onChange={(e) => setUserAnswer(e.target.value)} />;
      case 'mcq_cloze':
        const mcqQuiz = currentQuiz as MCQQuizItem;
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
        return <div>Unsupported quiz type</div>;
    }
  };

  const renderFeedback = () => {
    if (!isAnswered) return null;
    return (
      <div className={`mt-4 p-4 rounded-lg flex items-center justify-between gap-3 ${isCorrect ? 'bg-green-900/50 text-green-300' : 'bg-red-900/50 text-red-300'}`}>
        <div className="flex items-center gap-3">
            {isCorrect ? <CheckCircleIcon className="w-6 h-6" /> : <XCircleIcon className="w-6 h-6" />}
            <span className="font-semibold">{isCorrect ? 'Correct!' : 'Not quite.'}</span>
        </div>
        {!isCorrect && !showAnswer && (
            <Button variant="ghost" onClick={() => setShowAnswer(true)}>Show Answer</Button>
        )}
      </div>
    );
  };
  
  const getCorrectAnswerText = () => {
    if (!currentQuiz) return null;

    switch (currentQuiz.type) {
        case 'cloze_by_token':
            const clozeQuiz = currentQuiz as ClozeQuizItem;
            return clozeQuiz.blanks.map(b => `"${b.answer_text}"`).join(', ');
        case 'typed_exact':
            const typedQuiz = currentQuiz as TypedExactQuizItem;
            return tokens.slice(typedQuiz.answer_span[0], typedQuiz.answer_span[1] + 1).join('');
        case 'mcq_cloze': {
            const mcqQuiz = currentQuiz as MCQQuizItem;
            if (typeof correctAnswerIndex === 'number') {
                const answerText = mcqQuiz.options?.[correctAnswerIndex]?.text;
                return answerText ?? "Answer not available";
            }
            return "Answer not available";
        }
        case 'ordering':
             const orderingQuiz = currentQuiz as OrderingQuizItem;
             return tokens.slice(orderingQuiz.answer_span[0], orderingQuiz.answer_span[1] + 1).join('');
        default:
            return "Answer not available";
    }
  }

  const renderCorrectAnswer = () => {
    if (!isAnswered || isCorrect || !showAnswer) return null;
    
    const answerText = getCorrectAnswerText();

    return (
        <div className="mt-4 p-4 rounded-lg bg-gray-700/50 text-gray-300">
            <p className="font-semibold text-teal-400">Correct Answer:</p>
            <p className="mt-1 text-lg whitespace-pre-wrap">{answerText}</p>
        </div>
    )
  }

  const renderSetup = () => (
    <div className="p-4 md:p-8 flex flex-col h-full justify-center">
        <h2 className="text-2xl font-bold text-teal-400 mb-2 text-center">Quiz Setup</h2>
        <p className="text-gray-400 mb-6 text-center">Configure your practice session.</p>

        {error && <div className="bg-red-900/50 text-red-300 p-3 rounded-lg mb-4 text-center">{error}</div>}

        <div className="space-y-6">
            <div>
                <label className="block text-lg font-semibold text-gray-200 mb-3">Quiz Types</label>
                <div className="grid grid-cols-2 gap-3">
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
                            {type.name}
                        </button>
                    ))}
                </div>
            </div>
            <div>
                <label htmlFor="numQuestions" className="block text-lg font-semibold text-gray-200 mb-2">Number of Questions: <span className="font-bold text-teal-300">{numQuestions}</span></label>
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
        </div>

        <div className="mt-8">
            <Button onClick={handleGenerateQuiz} variant="primary" className="w-full" disabled={selectedQuizTypes.length === 0}>
                Generate Quiz
            </Button>
        </div>
    </div>
  );

  const renderActiveQuiz = () => {
    if (!quizData || !currentQuiz) {
        return (
            <div className="p-8 text-center text-gray-400">
                Something went wrong.
                <Button onClick={handleEndQuiz} className="mt-4">Start Over</Button>
            </div>
        );
    }
    
    return (
        <div className="p-4 md:p-8 flex flex-col h-full">
          <div className="flex justify-between items-start mb-6">
            <div>
              <p className="text-sm text-gray-400">Question {currentQuizIndex + 1} of {quizData.quizzes.length}</p>
              <h2 className="text-xl font-bold text-teal-400">{currentQuiz.stem}</h2>
            </div>
            <Button onClick={handleEndQuiz} variant="ghost" className="flex-shrink-0">End Quiz</Button>
          </div>
    
          <div className="flex-grow mb-6 text-lg text-gray-200">
            {renderQuizContent()}
          </div>
    
          {renderFeedback()}
          {renderCorrectAnswer()}
    
          <div className="mt-auto pt-6 border-t border-gray-700/50 flex justify-end gap-3">
            {!isAnswered ? (
              <Button onClick={handleCheckAnswer} variant="primary" disabled={userAnswer === null || (Array.isArray(userAnswer) && userAnswer.length === 0)}>Check Answer</Button>
            ) : (
              <Button onClick={handleNext} variant="primary">
                {currentQuizIndex < quizData.quizzes.length - 1 ? 'Next Question' : 'Finish Quiz'}
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
            <h2 className="text-3xl font-bold text-teal-400 mb-4">Quiz Complete!</h2>
            <p className="text-xl text-gray-300 mb-6">You got <span className="font-bold text-white">{correctAnswersCount}</span> out of <span className="font-bold text-white">{quizData.quizzes.length}</span> correct on the first try.</p>
            <Button onClick={handleEndQuiz} variant="primary">Create Another Quiz</Button>
        </div>
    );
  };

  switch(quizState) {
      case 'setup':
          return renderSetup();
      case 'loading':
          return <Loader text="Generating your quiz..." />;
      case 'active':
          return renderActiveQuiz();
      case 'results':
          return renderResults();
      default:
          return null;
  }
};

export default QuizMode;
