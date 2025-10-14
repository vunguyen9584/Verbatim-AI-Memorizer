import React, { useState, useEffect, useCallback } from 'react';
import { QuizData, QuizItem, ErrorExplanation } from '../types';
import { generateQuiz, explainError } from '../services/geminiService';
import Loader from './common/Loader';
import Button from './common/Button';
import { CheckCircleIcon, XCircleIcon, LightbulbIcon } from './common/Icon';

interface QuizModeProps {
  text: string;
  tokens: string[];
}

const quizTypes = {
  'cloze_by_token': 'Fill in the Blanks',
  'mcq_cloze': 'Multiple Choice',
  'ordering': 'Word Ordering',
  'typed_exact': 'Typed Exact',
};

const QuizMode: React.FC<QuizModeProps> = ({ text, tokens }) => {
  const [quizData, setQuizData] = useState<QuizData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Quiz state
  const [currentQuizIndex, setCurrentQuizIndex] = useState(0);
  const [userAnswers, setUserAnswers] = useState<string[]>([]);
  const [selectedMCQAnswer, setSelectedMCQAnswer] = useState<number | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [feedback, setFeedback] = useState<boolean[]>([]);
  
  // Explainer State
  const [errorExplanations, setErrorExplanations] = useState<(ErrorExplanation | null)[]>([]);
  const [explainerLoading, setExplainerLoading] = useState(false);

  // Hint State
  const [hintRevealedWords, setHintRevealedWords] = useState<string[]>([]);
  const [correctAnswerForHint, setCorrectAnswerForHint] = useState<string[]>([]);

  // Config State
  const [quizType, setQuizType] = useState('cloze_by_token');
  const [numBlanks, setNumBlanks] = useState(1);

  const resetQuizState = () => {
    setQuizData(null);
    setUserAnswers([]);
    setSubmitted(false);
    setFeedback([]);
    setErrorExplanations([]);
    setCurrentQuizIndex(0);
    setSelectedMCQAnswer(null);
    setHintRevealedWords([]);
    setCorrectAnswerForHint([]);
  }

  const fetchQuiz = useCallback(async () => {
    setLoading(true);
    setError(null);
    resetQuizState();
    try {
      const data = await generateQuiz(text, tokens, quizType, { numBlanks });
      setQuizData(data);
      if (data.quizzes.length > 0) {
        const firstQuiz = data.quizzes[0];
        if (firstQuiz.type === 'cloze_by_token') {
          setUserAnswers(Array(firstQuiz.blanks.length).fill(''));
        } else {
          setUserAnswers(['']);
        }
      } else {
        setError("The AI couldn't generate a quiz for this text and configuration. Please try different options.");
      }
    } catch (err) {
      setError('Failed to generate quiz. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [text, tokens, quizType, numBlanks]);

  // Effect to prepare the hint answer when the quiz changes
  useEffect(() => {
    if (!quizData || !quizData.quizzes[currentQuizIndex]) return;
    
    const currentQuiz = quizData.quizzes[currentQuizIndex];
    let answer = '';
    
    if (currentQuiz.type === 'cloze_by_token') {
      answer = currentQuiz.blanks.map(b => b.answer_text).join(' / ');
    } else if (currentQuiz.type === 'typed_exact' || currentQuiz.type === 'ordering') {
      answer = tokens.slice(currentQuiz.answer_span[0], currentQuiz.answer_span[1] + 1).join('');
    } else if (currentQuiz.type === 'mcq_cloze') {
      answer = currentQuiz.options[currentQuiz.answer_index].text;
    }
    
    setCorrectAnswerForHint(answer.split(/(\s+)/).filter(t => t.trim().length > 0));
    setHintRevealedWords([]);
  }, [currentQuizIndex, quizData, tokens]);


  const handleAnswerChange = (index: number, value: string) => {
    const newAnswers = [...userAnswers];
    newAnswers[index] = value;
    setUserAnswers(newAnswers);
  };
  
  const getCorrectAnswer = (quiz: QuizItem, index?: number): string => {
      switch (quiz.type) {
        case 'cloze_by_token':
          return quiz.blanks[index!].answer_text;
        case 'typed_exact':
        case 'ordering':
          return tokens.slice(quiz.answer_span[0], quiz.answer_span[1] + 1).join('');
        case 'mcq_cloze':
            return quiz.options[quiz.answer_index].text;
        default:
          return '';
      }
  };

  const handleSubmit = async () => {
    setSubmitted(true);
    setExplainerLoading(true);
    const currentQuiz = quizData?.quizzes[currentQuizIndex];
    if (!currentQuiz) return;

    let newFeedback: boolean[] = [];
    if (currentQuiz.type === 'cloze_by_token') {
      newFeedback = userAnswers.map((answer, i) => answer.trim() === currentQuiz.blanks[i].answer_text);
    } else if (currentQuiz.type === 'typed_exact' || currentQuiz.type === 'ordering') {
      const correctAnswer = getCorrectAnswer(currentQuiz);
      const userNorm = userAnswers[0].trim().replace(/\s+/g, ' ');
      const correctNorm = correctAnswer.trim().replace(/\s+/g, ' ');
      newFeedback = [userNorm === correctNorm];
    } else if (currentQuiz.type === 'mcq_cloze') {
        newFeedback = [selectedMCQAnswer === currentQuiz.answer_index];
    }
    setFeedback(newFeedback);
    
    const explanations: (ErrorExplanation | null)[] = await Promise.all(
        newFeedback.map(async (isCorrect, index) => {
            if (!isCorrect) {
                try {
                    const userInput = currentQuiz.type === 'mcq_cloze' 
                        ? (selectedMCQAnswer !== null ? currentQuiz.options[selectedMCQAnswer].text : "") 
                        : userAnswers[index];
                    const correctAnswer = getCorrectAnswer(currentQuiz, index);
                    return await explainError(correctAnswer, userInput);
                } catch (e) { return null; }
            }
            return null;
        })
    );
    setErrorExplanations(explanations);
    setExplainerLoading(false);
  };

  const handleNext = () => {
    const nextIndex = currentQuizIndex + 1;
    if (quizData && nextIndex < quizData.quizzes.length) {
      setCurrentQuizIndex(nextIndex);
      setSubmitted(false);
      setFeedback([]);
      setErrorExplanations([]);
      setSelectedMCQAnswer(null);
      const nextQuiz = quizData.quizzes[nextIndex];
        if (nextQuiz.type === 'cloze_by_token') {
          setUserAnswers(Array(nextQuiz.blanks.length).fill(''));
        } else {
          setUserAnswers(['']);
        }
    } else {
      fetchQuiz();
    }
  };
  
  const handleHint = () => {
    if (hintRevealedWords.length >= correctAnswerForHint.length) return;
    setHintRevealedWords(correctAnswerForHint.slice(0, hintRevealedWords.length + 1));
  };

  const renderQuizItem = (quiz: QuizItem) => {
    switch (quiz.type) {
        case 'cloze_by_token': {
            let textWithInputs = quiz.base_text_with_masks;
            quiz.blanks.forEach((_, i) => {
                textWithInputs = textWithInputs.replace('[____]', `__INPUT__${i}__`);
            });
            return (
                <div className="text-lg leading-relaxed text-gray-300">
                    {textWithInputs.split(/(__INPUT__\d+__)/).map((part, partIndex) => {
                        const match = part.match(/__INPUT__(\d+)__/);
                        if (match) {
                            const inputIndex = parseInt(match[1], 10);
                            const isCorrect = feedback[inputIndex];
                            const borderColor = submitted ? (isCorrect ? 'border-green-500' : 'border-red-500') : 'border-gray-600 focus:border-teal-500';
                            return (
                               <div key={partIndex} className="inline-block mx-1">
                                    <input type="text" value={userAnswers[inputIndex]} onChange={(e) => handleAnswerChange(inputIndex, e.target.value)} disabled={submitted}
                                        className={`inline-block w-32 bg-gray-800 border-b-2 ${borderColor} text-center text-teal-300 focus:outline-none transition-colors duration-300`} />
                                    {submitted && (isCorrect ? <CheckCircleIcon className="inline-block w-5 h-5 ml-1 text-green-500" /> : <XCircleIcon className="inline-block w-5 h-5 ml-1 text-red-500" />)}
                               </div>
                            );
                        }
                        return <span key={partIndex}>{part}</span>;
                    })}
                </div>
            );
        }
        case 'mcq_cloze': {
            return (
                <div>
                    <p className="mb-6 text-lg text-gray-300">{quiz.base_text_with_masks}</p>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {quiz.options.map((option, index) => {
                            const isSelected = selectedMCQAnswer === index;
                            let buttonClass = '';
                            if (submitted) {
                                if (index === quiz.answer_index) buttonClass = 'bg-green-500/80 ring-green-400';
                                else if (isSelected) buttonClass = 'bg-red-500/80 ring-red-400';
                            }
                            return (
                                <Button key={index} variant={isSelected ? 'primary' : 'secondary'} onClick={() => setSelectedMCQAnswer(index)} disabled={submitted}
                                    className={`justify-start text-left h-full p-4 whitespace-normal ${buttonClass}`}>
                                    {option.text}
                                </Button>
                            );
                        })}
                    </div>
                </div>
            );
        }
        case 'ordering': {
             return (
                <div>
                    <div className="mb-4 text-gray-300 bg-gray-900/50 p-4 rounded-lg border border-gray-700">
                        <p className="font-semibold text-gray-400 text-sm mb-2">Scrambled words:</p>
                        <p className="text-xl font-mono tracking-wider">{quiz.scrambled_words.join('   ')}</p>
                    </div>
                    <textarea value={userAnswers[0]} onChange={(e) => handleAnswerChange(0, e.target.value)} disabled={submitted} rows={3}
                        className="w-full bg-gray-800 border-2 border-gray-700 focus:border-teal-500 rounded-lg p-3 text-gray-200 focus:ring-2 focus:ring-teal-500 focus:outline-none transition-colors duration-300"
                        placeholder="Type the words in the correct order..." />
                </div>
            );
        }
        case 'typed_exact': {
            return (
                <div>
                    <p className="mb-4 text-gray-300 bg-gray-900/50 p-4 rounded-lg border border-gray-700">"{getCorrectAnswer(quiz)}"</p>
                    <textarea value={userAnswers[0]} onChange={(e) => handleAnswerChange(0, e.target.value)} disabled={submitted} rows={4}
                        className="w-full bg-gray-800 border-2 border-gray-700 focus:border-teal-500 rounded-lg p-3 text-gray-200 focus:ring-2 focus:ring-teal-500 focus:outline-none transition-colors duration-300"
                        placeholder="Type the text exactly as shown..." />
                </div>
            );
        }
        default: return null;
    }
  };
  
  const renderFeedback = () => {
      if (!submitted || explainerLoading) return null;
      return (
          <div className="mt-6 space-y-4">
              {errorExplanations.map((explanation, index) => {
                  if (explanation) {
                      return (
                          <div key={index} className="bg-red-900/30 border border-red-700/50 p-4 rounded-lg">
                              <p className="font-semibold text-red-300 mb-2">{explanation.summary}</p>
                              <div className="flex items-start text-yellow-300/80">
                                  <LightbulbIcon className="w-5 h-5 mr-2 mt-1 flex-shrink-0" />
                                  <p><span className="font-semibold">Tip:</span> {explanation.tip}</p>
                              </div>
                          </div>
                      );
                  }
                  if(feedback.length > index && !feedback[index]) {
                     return <div key={index} className="bg-red-900/30 border border-red-700/50 p-4 rounded-lg font-semibold text-red-300">Incorrect. The correct answer was: "{getCorrectAnswer(quizData!.quizzes[currentQuizIndex], index)}"</div>
                  }
                  return null;
              })}
          </div>
      );
  }

  const currentQuiz = quizData?.quizzes[currentQuizIndex];

  return (
    <div className="p-4 md:p-8 flex flex-col h-full">
        {!quizData && !loading && (
            <div className="flex-grow flex flex-col items-center justify-center">
                <div className="w-full max-w-md bg-gray-800/60 p-6 rounded-xl border border-gray-700">
                    <h2 className="text-xl font-bold text-teal-400 mb-4">Quiz Setup</h2>
                    <div className="space-y-4">
                        <div>
                            <label htmlFor="quizType" className="block text-sm font-medium text-gray-300 mb-1">Quiz Type</label>
                            <select id="quizType" value={quizType} onChange={e => setQuizType(e.target.value)}
                                className="w-full bg-gray-900/50 border border-gray-600 rounded-lg p-2 text-gray-200 focus:ring-2 focus:ring-teal-500">
                                {Object.entries(quizTypes).map(([key, value]) => <option key={key} value={key}>{value}</option>)}
                            </select>
                        </div>
                        {quizType === 'cloze_by_token' && (
                             <div>
                                <label htmlFor="numBlanks" className="block text-sm font-medium text-gray-300 mb-1">Number of Blanks</label>
                                <input type="number" id="numBlanks" value={numBlanks} onChange={e => setNumBlanks(Math.max(1, parseInt(e.target.value)))} min="1" max="5"
                                    className="w-full bg-gray-900/50 border border-gray-600 rounded-lg p-2 text-gray-200 focus:ring-2 focus:ring-teal-500" />
                            </div>
                        )}
                    </div>
                    <Button onClick={fetchQuiz} className="w-full mt-6">Generate Quiz</Button>
                </div>
            </div>
        )}
      
        {loading && <Loader text="Generating Quiz..." />}
        {error && !loading && <div className="p-8 text-center text-red-400">{error} <Button onClick={fetchQuiz} className="mt-4">Try Again</Button></div>}
      
        {quizData && currentQuiz && !loading && (
            <>
                <h2 className="text-2xl font-bold text-teal-400 mb-2">Quiz Mode <span className="text-base font-normal text-gray-400">({quizTypes[currentQuiz.type]})</span></h2>
                <p className="text-gray-400 mb-6">{currentQuiz.stem}</p>
                
                <div className="flex-grow">
                    {renderQuizItem(currentQuiz)}
                    {explainerLoading ? <Loader text="Analyzing..." /> : renderFeedback()}
                </div>

                <div className="mt-4 h-8">
                    {hintRevealedWords.length > 0 && (
                        <div className="p-2 bg-gray-700/50 rounded-md text-teal-300 animate-fade-in">
                           <span className="font-semibold text-gray-400">Hint: </span> {hintRevealedWords.join(' ')}
                        </div>
                    )}
                </div>

                <div className="mt-4 flex justify-between items-center">
                    <Button onClick={handleHint} variant="secondary" disabled={submitted || hintRevealedWords.length >= correctAnswerForHint.length}>
                        <LightbulbIcon className="w-5 h-5 mr-1" /> Hint
                    </Button>
                    {submitted ? (
                        <Button onClick={handleNext} variant="primary">
                            {currentQuizIndex === quizData.quizzes.length - 1 ? 'Finish & New Quiz' : 'Next Question'}
                        </Button>
                    ) : (
                        <Button onClick={handleSubmit} variant="primary">Submit</Button>
                    )}
                </div>
            </>
        )}
    </div>
  );
};

export default QuizMode;