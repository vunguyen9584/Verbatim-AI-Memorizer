
import { GoogleGenAI, Type } from "@google/genai";
import { QuizData, CoPlayPlan, CoPlayModeOption, CoPlayModeType, StoryElements, AcrosticKeywords, MemoryStoryResult, MemoryAcrosticResult, MemoryMethod } from '../types';
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
    - 'cloze_by_token': Fill-in-the-blank style. Provide the base text with '...' masks and define the blanks with their answer text and token indices. Also, provide the sentence immediately before ('context_before') and after ('context_after') the sentence containing the blank, if they exist.
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

        // Validate quiz data integrity
        for (const quiz of parsedData.quizzes) {
            if (quiz.type === 'cloze_by_token') {
                // Ensure fill-in-the-blank questions have surrounding context.
                if (!quiz.context_before && !quiz.context_after) {
                    const errorMsg = "The AI returned a Fill-in-the-Blank quiz with no context. Please try again.";
                    logger.log('GEMINI_VALIDATION_ERROR', { type: 'generateQuizzes', error: errorMsg, quiz });
                    throw new Error(errorMsg);
                }
            }
        }

        return parsedData;
    } catch (e) {
        logger.log('GEMINI_ERROR', { type: 'generateQuizzes', error: e });
        console.error("Error generating quizzes:", e);
        throw new Error("Failed to generate quiz. The AI model may be temporarily unavailable.");
    }
};

export const planCoPlay = async (text: string, tokens: string[], options: CoPlayModeOption): Promise<CoPlayPlan> => {
    const model = 'gemini-2.0-flash';
    const tokenList = tokens.map((token, index) => `[${index}]: ${JSON.stringify(token)}`).join('\n');

    let prompt = `Create a "Co-Play" plan to help a user memorize a piece of text. The plan is a timeline of events. Each event reveals the text up to a certain token, and can optionally pause to require the user to type the next few words.\n\nThe text is:\n---\n${text}\n---\n\nThe tokenization is (index: "token"):\n---\n${tokenList}\n---\n\nThe plan should consist of 3-5 steps.\nEach step in the timeline has:\n- 'reveal_until_token': The index of the token *before* which the text is revealed.\n- 'pause_require': An array that specifies a part of the text the user must type to continue. This should contain one object with a 'span' property, which is a [start, end] tuple of inclusive token indices. A pause should occur *after* the revealed text.\n\nExample: To reveal "The quick brown" and then ask the user to type "fox", you might have a timeline item like:\n{ "reveal_until_token": 3, "pause_require": [{ "span": [3, 3] }] }\n\n`;

    switch (options.type) {
        case CoPlayModeType.AppFirstN:
            prompt += `The user wants to follow a pattern: the app reveals ${options.appSentences} sentence(s), then the user types ${options.userSentences} sentence(s). The app goes first. Generate a timeline that follows this pattern.\n`;
            break;
        case CoPlayModeType.UserFirstN:
            prompt += `The user wants to follow a pattern: the user types ${options.userSentences} sentence(s), then the app reveals ${options.appSentences} sentence(s). The user goes first. Generate a timeline that follows this pattern.\n`;
            break;
        case CoPlayModeType.AppFirstRandom:
            prompt += `The user wants to follow a pattern: the app reveals a random number of sentences, then the user types a random number of sentences. The app goes first. For each user turn, you MUST specify the number of sentences to type in the 'user_sentences_to_type' field.\n`;
            break;
        case CoPlayModeType.UserFirstRandom:
            prompt += `The user wants to follow a pattern: the user types a random number of sentences, then the app reveals a random number of sentences. The user goes first. For each user turn, you MUST specify the number of sentences to type in the 'user_sentences_to_type' field.\n`;
            break;
    }

    prompt += `Generate a complete timeline. Return the output in a JSON object matching the provided schema.`;

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
        
        // Validation
        if (!parsedData.timeline || parsedData.timeline.length === 0) {
            throw new Error("The AI returned an empty or invalid timeline.");
        }

        if (options.type === CoPlayModeType.AppFirstRandom || options.type === CoPlayModeType.UserFirstRandom) {
            for (const item of parsedData.timeline) {
                if (item.pause_require && item.pause_require.length > 0) {
                    if (!item.pause_require[0].user_sentences_to_type) {
                        throw new Error("The AI did not specify the number of sentences to type for a random mode.");
                    }
                }
            }
        }

        return parsedData;
    } catch (e) {
        logger.log('GEMINI_ERROR', { type: 'planCoPlay', error: e });
        console.error("Error planning co-play:", e);
        const errorMessage = e instanceof Error ? e.message : "Failed to generate a Co-Play plan. The AI model may be temporarily unavailable.";
        throw new Error(errorMessage);
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
        analysisPrompt = `Bạn là một chuyên gia phân tích văn bản để tạo câu chuyện gợi nhớ. Nhiệm vụ của bạn là đọc văn bản sau và rút ra những yếu tố hình ảnh cốt lõi, dễ hình dung nhất từ mỗi câu. Các yếu tố này nên là danh từ cụ thể, động từ hành động, hoặc hình ảnh sống động.

Văn bản:
---
${text}
---

Trả về JSON với mảng "elements" chứa các yếu tố hình ảnh theo thứ tự của các câu.`;

        analysisSchema = storyElementsSchema;

        synthesisPrompt = `Bạn là một người kể chuyện sáng tạo chuyên tạo ra các câu chuyện gợi nhớ. Dựa trên danh sách các yếu tố hình ảnh theo thứ tự dưới đây, hãy sáng tác một câu chuyện ngắn, phi lý, hài hước và thật sống động để liên kết tất cả chúng lại với nhau. Câu chuyện phải dễ hình dung để giúp người dùng ghi nhớ thứ tự của các yếu tố.

Các yếu tố hình ảnh:
{{json_elements}}

Câu chuyện gợi nhớ của bạn:`;

    } else if (method === MemoryMethod.ACROSTIC) {
        analysisPrompt = `Bạn là một chuyên gia phân tích văn bản để tạo câu viết tắt gợi nhớ. Nhiệm vụ của bạn là đọc văn bản sau và rút ra những từ khóa quan trọng nhất từ mỗi câu, những từ đại diện cho ý chính của câu đó.

Văn bản:
---
${text}
---

Trả về JSON với mảng "keywords" chứa các từ khóa theo thứ tự của các câu.`;

        analysisSchema = acrosticKeywordsSchema;

        synthesisPrompt = `Bạn là một chuyên gia tạo câu gợi nhớ (acrostic). Dựa vào chuỗi ký tự đầu vào, hãy tạo ra một câu văn hoàn chỉnh, dễ nhớ, và đúng ngữ pháp, trong đó từ đầu tiên bắt đầu bằng ký tự thứ nhất, từ thứ hai bắt đầu bằng ký tự thứ hai, và cứ thế tiếp tục.

Chuỗi ký tự: {{initial_letters}}

Câu gợi nhớ của bạn:`;
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
        throw new Error("Failed to generate memory tips. The AI model may be temporarily unavailable.");
    }
};
