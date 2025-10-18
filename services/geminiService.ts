import { GoogleGenAI, Type } from "@google/genai";
import i18n from 'i18next';
import { QuizData, CoPlayPlan, CoPlayModeOption, CoPlayModeType, StoryElements, AcrosticKeywords, MemoryStoryResult, MemoryAcrosticResult, MemoryMethod } from '../types';
import { logger } from '../utils/debugLogger';
import { parseSentences } from '../utils/sentenceParser';

// Fix: Initialize the GoogleGenAI client to interact with the Gemini API.
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

const quizDataSchema = {
    type: Type.OBJECT,
    properties: {
        quizzes: {
            type: Type.ARRAY,
            description: "A list of quiz questions generated from the text.",
            items: {
                type: Type.OBJECT,
                properties: {
                    type: {
                        type: Type.STRING,
                        description: "The type of quiz. Must be one of: 'cloze_by_token', 'mcq_cloze', 'ordering'."
                    },
                    stem: {
                        type: Type.STRING,
                        description: "The instruction or question for the user."
                    },
                    // cloze_by_token
                    base_text_with_masks: { type: Type.STRING },
                    context_before: { type: Type.STRING, description: "The sentence immediately preceding the quiz sentence for context." },
                    context_after: { type: Type.STRING, description: "The sentence immediately following the quiz sentence for context." },
                    blanks: {
                        type: Type.ARRAY,
                        items: {
                            type: Type.OBJECT,
                            properties: {
                                answer_tokens: { type: Type.ARRAY, items: { type: Type.INTEGER } },
                                answer_text: { type: Type.STRING }
                            },
                            required: ['answer_tokens', 'answer_text']
                        }
                    },
                    // ordering
                    answer_span: { type: Type.ARRAY, items: { type: Type.INTEGER } },
                    // mcq_cloze
                    options: {
                        type: Type.ARRAY,
                        items: {
                            type: Type.OBJECT,
                            properties: { text: { type: Type.STRING } },
                            required: ['text']
                        }
                    },
                    answer_index: { type: Type.INTEGER },
                    // ordering
                    scrambled_words: { type: Type.ARRAY, items: { type: Type.STRING } }
                },
                required: ['type', 'stem']
            }
        }
    },
    required: ['quizzes']
};

const coPlayPlanSchema = {
    type: Type.OBJECT,
    properties: {
        timeline: {
            type: Type.ARRAY,
            description: "A sequence of steps for the co-play session.",
            items: {
                type: Type.OBJECT,
                properties: {
                    reveal_until_token: {
                        type: Type.INTEGER,
                        description: "Reveal the text up to this token index (exclusive). The user sees text from token 0 to this token."
                    },
                    pause_require: {
                        type: Type.ARRAY,
                        description: "Specifies a pause where the user must provide input. Typically only one pause per timeline item.",
                        items: {
                            type: Type.OBJECT,
                            properties: {
                                span: {
                                    type: Type.ARRAY,
                                    description: "The start and end token indices (inclusive) of the text the user needs to type.",
                                    items: { type: Type.INTEGER }
                                },
                                user_sentences_to_type: {
                                    type: Type.INTEGER,
                                    description: "The number of sentences the user is expected to type during this pause."
                                }
                            },
                            required: ['span']
                        }
                    }
                },
                required: ['reveal_until_token', 'pause_require']
            }
        }
    },
    required: ['timeline']
};

const storyElementsSchema = {
    type: Type.OBJECT,
    properties: {
        elements: {
            type: Type.ARRAY,
            description: "List of visual elements extracted from each sentence.",
            items: { type: Type.STRING }
        }
    },
    required: ['elements']
};

const acrosticKeywordsSchema = {
    type: Type.OBJECT,
    properties: {
        keywords: {
            type: Type.ARRAY,
            description: "List of key words extracted from each sentence.",
            items: { type: Type.STRING }
        }
    },
    required: ['keywords']
};


export const generateQuizzes = async (
    text: string, 
    tokens: string[], 
    options: { quizTypes: string[]; numQuestions: number }
): Promise<QuizData> => {
    const model = 'gemini-2.5-flash';
    const tokenList = tokens.map((token, index) => `[${index}]: ${JSON.stringify(token)}`).join('\\n');

    const prompt = i18n.t('gemini.quizPrompt', {
        text,
        tokenList,
        numQuestions: options.numQuestions,
        quizTypes: options.quizTypes.join(', '),
    });
    
    logger.log('GEMINI_REQUEST', { type: 'generateQuizzes', prompt, options });
    
    try {
        const response = await ai.models.generateContent({
            model,
            contents: prompt,
            config: {
                responseMimeType: "application/json",
                responseSchema: quizDataSchema,
            },
        });

        const jsonResponse = response.text.trim();
        logger.log('GEMINI_RESPONSE_RAW', { type: 'generateQuizzes', response: jsonResponse });
        
        const parsedData = JSON.parse(jsonResponse) as QuizData;
        logger.log('GEMINI_RESPONSE_PARSED', { type: 'generateQuizzes', data: parsedData });

        // Validate quiz data integrity
        for (const quiz of parsedData.quizzes) {
            if (quiz.type === 'cloze_by_token') {
                // Ensure fill-in-the-blank questions have surrounding context.
                if (!quiz.context_before && !quiz.context_after) {
                    const errorMsg = i18n.t('gemini.clozeContextError');
                    logger.log('GEMINI_VALIDATION_ERROR', { type: 'generateQuizzes', error: errorMsg, quiz });
                    throw new Error(errorMsg);
                }
            }
        }

        return parsedData;
    } catch (e) {
        logger.log('GEMINI_ERROR', { type: 'generateQuizzes', error: e });
        console.error("Error generating quizzes:", e);
        throw new Error(i18n.t('gemini.quizGenerationError'));
    }
};

export const planCoPlay = async (text: string, tokens: string[], options: CoPlayModeOption): Promise<CoPlayPlan> => {
    // Simple implementation without AI
    const sentences = parseSentences(tokens);

    if (sentences.length === 0) {
        throw new Error(i18n.t('gemini.sentenceParseError'));
    }

    const timeline = [];

    // Special case for short texts: reveal all, then pause for user to type all
    if (options.appSentences === 'all' || sentences.length <= options.appSentences) {
        timeline.push({
            reveal_until_token: tokens.length,
            pause_require: [{
                span: [0, tokens.length - 1],
                user_sentences_to_type: options.userSentences === 'all' ? sentences.length : options.userSentences,
            }],
        });
    } else {
        // Normal case: alternate app reveal n, user type n
        let currentSentenceIndex = 0;
        let isAppTurn = options.type === CoPlayModeType.AppFirstN || options.type === CoPlayModeType.AppFirstRandom;

        while (currentSentenceIndex < sentences.length) {
            if (isAppTurn) {
                // App reveals sentences
                let sentencesToReveal = options.appSentences === 'all' ? sentences.length - currentSentenceIndex : options.appSentences;
                if (options.type === CoPlayModeType.AppFirstRandom || options.type === CoPlayModeType.UserFirstRandom) {
                    sentencesToReveal = Math.floor(Math.random() * 3) + 1; // Random 1-3 sentences
                }

                let revealUntil = currentSentenceIndex;
                for (let i = 0; i < sentencesToReveal && currentSentenceIndex < sentences.length; i++) {
                    revealUntil = sentences[currentSentenceIndex].tokenEnd + 1;
                    currentSentenceIndex++;
                }

                timeline.push({
                    reveal_until_token: revealUntil,
                    pause_require: [],
                });
            } else {
                // User types sentences
                let sentencesToType = options.userSentences === 'all' ? sentences.length - currentSentenceIndex : options.userSentences;
                if (options.type === CoPlayModeType.AppFirstRandom || options.type === CoPlayModeType.UserFirstRandom) {
                    sentencesToType = Math.floor(Math.random() * 3) + 1; // Random 1-3 sentences
                }

                let typeUntil = currentSentenceIndex;
                for (let i = 0; i < sentencesToType && typeUntil < sentences.length; i++) {
                    typeUntil++;
                }

                const spanStart = timeline.length > 0 ? timeline[timeline.length - 1].reveal_until_token : 0;
                const spanEnd = sentences[typeUntil - 1]?.tokenEnd ?? tokens.length - 1;

                timeline.push({
                    reveal_until_token: Math.max(spanStart - 1, -1),
                    pause_require: [{
                        span: [spanStart, spanEnd],
                        user_sentences_to_type: sentencesToType,
                    }],
                });

                currentSentenceIndex = typeUntil;
            }

            isAppTurn = !isAppTurn;
        }
    }

    const plan: CoPlayPlan = { timeline };

    logger.log('SIMPLE_PLAN', { type: 'planCoPlay', options, sentences: sentences.length, timeline: plan.timeline });

    return plan;
};

export const generateMemoryTips = async (
    text: string,
    method: MemoryMethod
): Promise<MemoryStoryResult | MemoryAcrosticResult> => {
    const model = 'gemini-2.0-flash';

    let analysisPrompt = '';
    let analysisSchema;
    let synthesisPrompt = '';

    if (method === MemoryMethod.STORY) {
        analysisPrompt = i18n.t('gemini.storyAnalysisPrompt', { text });
        analysisSchema = storyElementsSchema;
        synthesisPrompt = i18n.t('gemini.storySynthesisPrompt');
    } else if (method === MemoryMethod.ACROSTIC) {
        analysisPrompt = i18n.t('gemini.acrosticAnalysisPrompt', { text });
        analysisSchema = acrosticKeywordsSchema;
        synthesisPrompt = i18n.t('gemini.acrosticSynthesisPrompt');
    }

    try {
        // Step 1: Analysis
        logger.log('GEMINI_REQUEST', { type: 'memory_analysis', prompt: analysisPrompt, method });

        const analysisResponse = await ai.models.generateContent({
            model,
            contents: analysisPrompt,
            config: {
                responseMimeType: "application/json",
                responseSchema: analysisSchema,
            },
        });

        const analysisJson = JSON.parse(analysisResponse.text.trim());
        logger.log('GEMINI_RESPONSE_ANALYSIS', { analysisJson });

        // Step 2: Synthesis
        let finalPrompt = synthesisPrompt;

        if (method === MemoryMethod.STORY) {
            const elements = (analysisJson as StoryElements).elements;
            finalPrompt = synthesisPrompt.replace('{{json_elements}}', JSON.stringify(elements));
        } else {
            const keywords = (analysisJson as AcrosticKeywords).keywords;
            const initialLetters = keywords.map(k => k.charAt(0).toUpperCase()).join('');
            finalPrompt = synthesisPrompt.replace('{{initial_letters}}', initialLetters);
        }

        logger.log('GEMINI_REQUEST', { type: 'memory_synthesis', prompt: finalPrompt, method });

        const synthesisResponse = await ai.models.generateContent({
            model,
            contents: finalPrompt,
        });

        const result = synthesisResponse.text.trim();
        logger.log('GEMINI_RESPONSE_SYNTHESIS', { result });

        if (method === MemoryMethod.STORY) {
            return { story: result } as MemoryStoryResult;
        } else {
            return { sentence: result } as MemoryAcrosticResult;
        }

    } catch (e) {
        logger.log('GEMINI_ERROR', { type: 'generateMemoryTips', error: e, method });
        console.error("Error generating memory tips:", e);
        throw new Error(i18n.t('gemini.memoryTipsGenerationError'));
    }
};
