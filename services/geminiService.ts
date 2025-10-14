import { GoogleGenAI, Type } from "@google/genai";
import { QuizData, CoPlayPlan, ErrorExplanation } from '../types';

if (!process.env.API_KEY) {
    console.error("API_KEY environment variable not set.");
}

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY! });

// --- AGENT PROMPTS (as per user's detailed architecture) ---

const quizGeneratorSystemPrompt = `
You are an expert in creating exercises for verbatim text memorization. Your sole purpose is to generate quizzes based on a provided text chunk and a requested quiz type.
- You MUST NOT use any words or phrases not present in the original text.
- Your output MUST adhere strictly to the provided JSON schema.
- For 'mcq_cloze', create a sentence with a [____] blank. Provide several options, where only one is correct. The distractors MUST be plausible words/phrases from other parts of the same text.
- For 'ordering', take a short sentence or phrase, scramble the words, and ask the user to put them in the correct order.
- For 'cloze_by_token', create a sentence with one or more [____] blanks for the user to fill in. The number of blanks should match the user request.
- For 'typed_exact', provide a sentence or phrase for the user to retype perfectly.
- Ensure all token spans and indices are accurate.
`;

const coPlayPlannerSystemPrompt = `
You are a strategic learning planner for an interactive "co-play" mode. The goal is to help a user memorize a text by playing it word-by-word and pausing at key moments for them to fill in the blank.
- Your task is to design a timeline of these pause points.
- Choose strategic pause locations: boundaries of meaningful phrases, keywords, or common points of error.
- DO NOT reveal the answers in your plan.
- You MUST only output a valid JSON object adhering to the specified schema.
`;

const errorExplainerSystemPrompt = `
You are a strict and precise "spelling and grammar referee". Your role is to analyze the difference between a ground truth text and a user's input.
- Your feedback must be concise and direct.
- Pinpoint the exact location and type of error (e.g., missing diacritic, incorrect word, punctuation error, word order).
- Provide a helpful, short tip for remembering the correct version.
- DO NOT reveal the full correct answer unless the policy explicitly allows it.
- Your output MUST be a valid JSON object.
`;

// --- API FUNCTIONS ---

/**
 * Simulates the Quiz Generator Agent.
 */
export const generateQuiz = async (text: string, tokens: string[], quizType: string, config: { numBlanks?: number }): Promise<QuizData> => {
    const chunk_tokens_range: [number, number] = [0, tokens.length - 1]; // Use full text for this demo

    const userPrompt = {
        text_id: "doc-01",
        quiz_type_request: quizType,
        chunk_tokens: chunk_tokens_range,
        token_stream: tokens,
        policies: {
            strict_mode: true,
            diacritics_required: true,
            max_questions: 2,
            num_blanks_for_cloze: config.numBlanks || 1,
        }
    };
    
    try {
        const response = await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: JSON.stringify(userPrompt),
            config: {
                systemInstruction: quizGeneratorSystemPrompt,
                responseMimeType: "application/json",
                responseSchema: {
                    type: Type.OBJECT,
                    properties: {
                        quizzes: {
                            type: Type.ARRAY,
                            items: {
                                type: Type.OBJECT,
                                properties: {
                                    type: { type: Type.STRING },
                                    stem: { type: Type.STRING },
                                    // Cloze & MCQ
                                    base_text_with_masks: { type: Type.STRING },
                                    blanks: {
                                        type: Type.ARRAY,
                                        items: {
                                            type: Type.OBJECT,
                                            properties: {
                                                answer_tokens: { type: Type.ARRAY, items: { type: Type.INTEGER } },
                                                answer_text: { type: Type.STRING }
                                            }
                                        }
                                    },
                                    // Typed Exact & Ordering
                                    answer_span: {
                                        type: Type.ARRAY,
                                        items: { type: Type.INTEGER }
                                    },
                                    tolerance: {
                                        type: Type.OBJECT,
                                        properties: {
                                            case: { type: Type.BOOLEAN },
                                            punctuation: { type: Type.BOOLEAN }
                                        }
                                    },
                                    // MCQ
                                    options: {
                                        type: Type.ARRAY,
                                        items: {
                                            type: Type.OBJECT,
                                            properties: { text: { type: Type.STRING } }
                                        }
                                    },
                                    answer_index: { type: Type.INTEGER },
                                    // Ordering
                                    scrambled_words: {
                                        type: Type.ARRAY,
                                        items: { type: Type.STRING }
                                    }
                                }
                            }
                        }
                    }
                }
            }
        });

        const jsonString = response.text.trim();
        const data = JSON.parse(jsonString);
        return data as QuizData;
    } catch (error) {
        console.error("Error generating quiz:", error);
        throw new Error("Failed to generate quiz from AI.");
    }
};


/**
 * Simulates the Co-play Planner Agent.
 */
export const planCoPlay = async (text: string, tokens: string[]): Promise<CoPlayPlan> => {
     const userPrompt = {
        text_id: "doc-01",
        token_stream: tokens,
        user_history: {
            weak_spans: [], // Example, could be populated in a full app
            avg_wpm: 50,
            error_types: ["diacritics"]
        },
        constraints: { "max_pause_per_minute": 6 }
    };

    try {
        const response = await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: JSON.stringify(userPrompt),
            config: {
                systemInstruction: coPlayPlannerSystemPrompt,
                responseMimeType: "application/json",
                responseSchema: {
                    type: Type.OBJECT,
                    properties: {
                        timeline: {
                            type: Type.ARRAY,
                            items: {
                                type: Type.OBJECT,
                                properties: {
                                    reveal_until_token: { type: Type.INTEGER },
                                    pause_require: {
                                        type: Type.ARRAY,
                                        items: {
                                            type: Type.OBJECT,
                                            properties: {
                                                span: { type: Type.ARRAY, items: { type: Type.INTEGER } }
                                            }
                                        }
                                    },
                                    hint_policy: { type: Type.STRING }
                                }
                            }
                        }
                    }
                }
            }
        });

        const jsonString = response.text.trim();
        return JSON.parse(jsonString) as CoPlayPlan;
    } catch (error) {
        console.error("Error planning co-play:", error);
        throw new Error("Failed to generate co-play plan from AI.");
    }
};

/**
 * Simulates the Error Explainer Agent.
 */
export const explainError = async (groundTruth: string, userInput: string): Promise<ErrorExplanation> => {
    const userPrompt = {
        ground_truth: groundTruth,
        user_input: userInput,
        // In a real app, a diff would be generated client-side first
        diff: "Diff calculation would be here", 
        policy: { "reveal_full_answer_if_failed": false }
    };
    
    try {
        const response = await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: JSON.stringify(userPrompt),
            config: {
                systemInstruction: errorExplainerSystemPrompt,
                responseMimeType: "application/json",
                responseSchema: {
                    type: Type.OBJECT,
                    properties: {
                        summary: { type: Type.STRING },
                        annotations: {
                            type: Type.ARRAY,
                            items: {
                                type: Type.OBJECT,
                                properties: {
                                    type: { type: Type.STRING },
                                    at_chars: { type: Type.ARRAY, items: { type: Type.INTEGER } },
                                    tokens: { type: Type.ARRAY, items: { type: Type.STRING } },
                                    example: { type: Type.STRING }
                                }
                            }
                        },
                        tip: { type: Type.STRING }
                    }
                }
            }
        });
        
        const jsonString = response.text.trim();
        return JSON.parse(jsonString) as ErrorExplanation;
    } catch (error) {
        console.error("Error explaining error:", error);
        throw new Error("Failed to get error explanation from AI.");
    }
};