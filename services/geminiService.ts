import { GoogleGenAI, Type } from "@google/genai";
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
    // Simple implementation without AI
    const sentences = parseSentences(tokens);

    if (sentences.length === 0) {
        throw new Error("Could not parse any sentences from the text.");
    }

    const timeline = [];

    // Special case for short texts: reveal all, then pause for user to type all
    if (sentences.length <= options.appSentences) {
        timeline.push({
            reveal_until_token: tokens.length,
            pause_require: [{
                span: [0, tokens.length - 1],
                user_sentences_to_type: sentences.length,
            }],
        });
    } else {
        // Normal case: alternate app reveal n, user type n
        let currentSentenceIndex = 0;
        let isAppTurn = options.type === CoPlayModeType.AppFirstN || options.type === CoPlayModeType.AppFirstRandom;

        while (currentSentenceIndex < sentences.length) {
            if (isAppTurn) {
                // App reveals sentences
                let sentencesToReveal = options.appSentences;
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
                let sentencesToType = options.userSentences;
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
