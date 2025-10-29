import { GoogleGenAI, Type } from "@google/genai";
import i18n from 'i18next';
import { QuizData, StoryElements, AcrosticKeywords, MemoryStoryResult, MemoryAcrosticResult, MemoryMethod } from '../types';
import { logger } from '../utils/debugLogger';
import { settings } from '../utils/settings';

// Initialize the GoogleGenAI client with the user-provided API key from settings
const getAI = () => {
    const apiKey = settings.getGeminiApiKey();
    if (!apiKey) {
        // Throw i18n key so UI can translate reactively on language change
        throw new Error('gemini.apiKeyMissing');
    }
    return new GoogleGenAI({ apiKey });
};

// Quick validation call to verify a provided API key without saving it
export const testGeminiApiKey = async (key: string): Promise<void> => {
    const apiKey = key.trim();
    if (!apiKey) {
        throw new Error('settings.validation.apiKeyEmpty');
    }
    try {
        const client = new GoogleGenAI({ apiKey });
        const res = await client.models.generateContent({
            model: 'gemini-2.0-flash',
            contents: 'ping'
        });
        // If request resolves without throwing, consider the key valid
        if (!res || typeof res.text !== 'string') {
            throw new Error('gemini.quizGenerationError');
        }
    } catch (e) {
        throw e instanceof Error ? e : new Error('gemini.quizGenerationError');
    }
};

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
        const response = await getAI().models.generateContent({
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
                    const errorKey = 'gemini.clozeContextError';
                    logger.log('GEMINI_VALIDATION_ERROR', { type: 'generateQuizzes', error: errorKey, quiz });
                    throw new Error(errorKey);
                }
            }
        }

        return parsedData;
    } catch (e) {
        logger.log('GEMINI_ERROR', { type: 'generateQuizzes', error: e });
        console.error("Error generating quizzes:", e);
        const messageKey = e instanceof Error ? e.message : 'gemini.quizGenerationError';
        throw new Error(messageKey);
    }
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

        const analysisResponse = await getAI().models.generateContent({
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

        const synthesisResponse = await getAI().models.generateContent({
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
        const messageKey = e instanceof Error ? e.message : 'gemini.memoryTipsGenerationError';
        throw new Error(messageKey);
    }
};

// Extract plain text from an image using Gemini Vision
export const extractTextFromImage = async (file: File): Promise<string> => {
    if (!file || !file.type.startsWith('image/')) {
        throw new Error('imageImport.invalidType');
    }
    try {
        const buffer = await file.arrayBuffer();
        const base64 = (() => {
            const bytes = new Uint8Array(buffer);
            const chunkSize = 0x8000;
            let binary = '';
            for (let i = 0; i < bytes.length; i += chunkSize) {
                const chunk = bytes.subarray(i, i + chunkSize);
                binary += String.fromCharCode(...chunk);
            }
            return btoa(binary);
        })();

        const response = await getAI().models.generateContent({
            model: 'gemini-2.5-flash',
            contents: [
                {
                    role: 'user',
                    parts: [
                        { text: 'Extract all readable text from this image. Return plain text only.' },
                        { inlineData: { mimeType: file.type, data: base64 } }
                    ]
                }
            ],
            config: {
                responseMimeType: 'text/plain'
            }
        });

        const text = (response.text || '').trim();
        if (!text) {
            throw new Error('imageImport.emptyResult');
        }
        return text;
    } catch (e) {
        const messageKey = e instanceof Error ? e.message : 'imageImport.extractError';
        throw new Error(messageKey);
    }
};
