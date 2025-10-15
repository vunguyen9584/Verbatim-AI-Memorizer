
import { GoogleGenAI, Type } from "@google/genai";
import { QuizData, CoPlayPlan } from '../types';
import { logger } from '../utils/debugLogger';

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
                        description: "The type of quiz. Must be one of: 'cloze_by_token', 'typed_exact', 'mcq_cloze', 'ordering'."
                    },
                    stem: {
                        type: Type.STRING,
                        description: "The instruction or question for the user."
                    },
                    // cloze_by_token
                    base_text_with_masks: { type: Type.STRING },
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
                    // typed_exact & ordering
                    answer_span: { type: Type.ARRAY, items: { type: Type.INTEGER } },
                    // typed_exact
                    tolerance: {
                        type: Type.OBJECT,
                        properties: {
                            case: { type: Type.BOOLEAN },
                            punctuation: { type: Type.BOOLEAN }
                        }
                    },
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


export const generateQuizzes = async (
    text: string, 
    tokens: string[], 
    options: { quizTypes: string[]; numQuestions: number }
): Promise<QuizData> => {
    const model = 'gemini-2.5-flash';
    const tokenList = tokens.map((token, index) => `[${index}]: ${JSON.stringify(token)}`).join('\n');

    const prompt = `Based on the following text and its tokenization, generate a series of quiz questions to help a user memorize it.

    **CRITICAL INSTRUCTION: The 'stem' for each question MUST be in the same language as the provided text.**

    The text is:
    ---
    ${text}
    ---

    The tokenization is (index: "token"):
    ---
    ${tokenList}
    ---
    
    Generate exactly ${options.numQuestions} quiz questions. The quiz types must be chosen from the following list: [${options.quizTypes.join(', ')}].

    Available types:
    - 'cloze_by_token': Fill-in-the-blank style. Provide the base text with '...' masks and define the blanks with their answer text and token indices.
    - 'typed_exact': The user must type an exact phrase. Provide 'base_text_with_masks' where '...' represents the phrase to be typed. Also provide the 'answer_span' for the phrase.
    - 'mcq_cloze': A multiple-choice cloze question. Provide 'base_text_with_masks', an array of 'options', and CRITICALLY, 'answer_index' which is the zero-based index of the correct option within the 'options' array. Do NOT include a 'blanks' field for this type.
    - 'ordering': Scramble a sequence of words from the text for the user to reorder. Provide the scrambled words and the token span of the correct answer.

    Return the output in a JSON object matching the provided schema. Ensure all token indices are accurate based on the tokenization provided. For each quiz object, only include fields relevant to its 'type'.
    `;
    
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

        return parsedData;
    } catch (e) {
        logger.log('GEMINI_ERROR', { type: 'generateQuizzes', error: e });
        console.error("Error generating quizzes:", e);
        throw new Error("Failed to generate quiz. The AI model may be temporarily unavailable.");
    }
};

export const planCoPlay = async (text: string, tokens: string[]): Promise<CoPlayPlan> => {
    const model = 'gemini-2.5-flash';
    const tokenList = tokens.map((token, index) => `[${index}]: ${JSON.stringify(token)}`).join('\n');

    const prompt = `Create a "Co-Play" plan to help a user memorize a piece of text. The plan is a timeline of events. Each event reveals the text up to a certain token, and can optionally pause to require the user to type the next few words.

    The text is:
    ---
    ${text}
    ---

    The tokenization is (index: "token"):
    ---
    ${tokenList}
    ---

    The plan should consist of 3-5 steps.
    Each step in the timeline has:
    - 'reveal_until_token': The index of the token *before* which the text is revealed.
    - 'pause_require': An array that specifies a part of the text the user must type to continue. This should contain one object with a 'span' property, which is a [start, end] tuple of inclusive token indices. A pause should occur *after* the revealed text.

    Example: To reveal "The quick brown" and then ask the user to type "fox", you might have a timeline item like:
    { "reveal_until_token": 3, "pause_require": [{ "span": [3, 3] }] }

    Generate a complete timeline. The first step should reveal a small chunk and then pause. Subsequent steps should reveal more.
    Return the output in a JSON object matching the provided schema.
    `;

    logger.log('GEMINI_REQUEST', { type: 'planCoPlay', prompt });

    try {
        const response = await ai.models.generateContent({
            model,
            contents: prompt,
            config: {
                responseMimeType: "application/json",
                responseSchema: coPlayPlanSchema,
            },
        });

        const jsonResponse = response.text.trim();
        logger.log('GEMINI_RESPONSE_RAW', { type: 'planCoPlay', response: jsonResponse });

        const parsedData = JSON.parse(jsonResponse) as CoPlayPlan;
        logger.log('GEMINI_RESPONSE_PARSED', { type: 'planCoPlay', data: parsedData });
        
        return parsedData;
    } catch (e) {
        logger.log('GEMINI_ERROR', { type: 'planCoPlay', error: e });
        console.error("Error planning co-play:", e);
        throw new Error("Failed to generate a Co-Play plan. The AI model may be temporarily unavailable.");
    }
};
