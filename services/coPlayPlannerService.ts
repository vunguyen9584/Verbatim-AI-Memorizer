import i18n from 'i18next';
import { CoPlayPlan, CoPlayModeOption, CoPlayModeType } from '../types';
import { parseSentences } from '../utils/sentenceParser';
import { logger } from '../utils/debugLogger';

export const planCoPlay = async (text: string, tokens: string[], options: CoPlayModeOption): Promise<CoPlayPlan> => {
  const sentences = parseSentences(tokens);

  if (sentences.length === 0) {
    throw new Error(i18n.t('gemini.sentenceParseError'));
  }

  const startIdx = Math.max(1, Math.min(options.startSentence, sentences.length)) - 1;
  const endIdx = Math.max(startIdx, Math.min(options.endSentence, sentences.length)) - 1;
  const filteredSentences = sentences.slice(startIdx, endIdx + 1);

  if (filteredSentences.length === 0) {
    throw new Error(i18n.t('gemini.sentenceRangeError'));
  }

  const timeline: CoPlayPlan['timeline'] = [];

  if (options.appSentences === 'all' || options.userSentences === 'all') {
    const firstTokenIdx = filteredSentences[0].tokenStart;
    const lastTokenIdx = filteredSentences[filteredSentences.length - 1].tokenEnd;

    timeline.push({
      reveal_until_token: (options.appSentences === 'all' ? lastTokenIdx : firstTokenIdx - 1) + 1,
      pause_require: [{
        span: [firstTokenIdx, lastTokenIdx],
        user_sentences_to_type: options.userSentences === 'all' ? filteredSentences.length : (options.appSentences === 'all' ? 0 : (options.userSentences as number)),
      }],
    });
  } else {
    let currentSentenceIndex = startIdx;
    let isAppTurn = options.type === CoPlayModeType.AppFirstN || options.type === CoPlayModeType.AppFirstRandom;

    while (currentSentenceIndex <= endIdx) {
      if (isAppTurn) {
        let sentencesToReveal = typeof options.appSentences === 'number' ? options.appSentences : endIdx - currentSentenceIndex + 1;
        if (options.type === CoPlayModeType.AppFirstRandom || options.type === CoPlayModeType.UserFirstRandom) {
          sentencesToReveal = Math.floor(Math.random() * 3) + 1;
        }

        let revealUntil = currentSentenceIndex > 0 ? sentences[currentSentenceIndex - 1].tokenEnd + 1 : 0;
        for (let i = 0; i < sentencesToReveal && currentSentenceIndex <= endIdx; i++) {
          revealUntil = sentences[currentSentenceIndex].tokenEnd + 1;
          currentSentenceIndex++;
        }

        timeline.push({ reveal_until_token: revealUntil, pause_require: [] });
      } else {
        let sentencesToTypeRaw = typeof options.userSentences === 'number' ? options.userSentences : endIdx - currentSentenceIndex + 1;
        if (options.type === CoPlayModeType.AppFirstRandom || options.type === CoPlayModeType.UserFirstRandom) {
          sentencesToTypeRaw = Math.floor(Math.random() * 3) + 1;
        }

        let typeUntil = currentSentenceIndex;
        for (let i = 0; i < sentencesToTypeRaw && typeUntil <= endIdx; i++) {
          typeUntil++;
        }

        const sentencesToType = typeUntil - currentSentenceIndex;
        if (sentencesToType === 0) {
          isAppTurn = !isAppTurn;
          continue;
        }

        const spanStart = currentSentenceIndex === startIdx ? sentences[startIdx].tokenStart : sentences[currentSentenceIndex - 1].tokenEnd + 1;
        const spanEnd = sentences[typeUntil - 1].tokenEnd;

        timeline.push({
          reveal_until_token: spanStart,
          pause_require: [{ span: [spanStart, spanEnd], user_sentences_to_type: sentencesToType }],
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
