export interface Sentence {
  text: string;
  tokenStart: number;
  tokenEnd: number; // inclusive
}

/**
 * Parses the text into sentences based on tokens.
 * A sentence ends at tokens containing '.', '!', or '?'.
 */
export function parseSentences(tokens: string[]): Sentence[] {
  const sentences: Sentence[] = [];
  let currentSentenceTokens: string[] = [];
  let startIndex = 0;

  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i];
    currentSentenceTokens.push(token);

    // Check if token ends with sentence-ending punctuation or is a newline
    if (/[.?!]$/.test(token.trim()) || token === '\n') {
      const sentenceText = currentSentenceTokens.join('').trim();
      if (sentenceText) {
        sentences.push({
          text: sentenceText,
          tokenStart: startIndex,
          tokenEnd: i,
        });
      }
      currentSentenceTokens = [];
      startIndex = i + 1;
    }
  }

  // Add remaining tokens as a sentence if any
  if (currentSentenceTokens.length > 0) {
    const sentenceText = currentSentenceTokens.join('').trim();
    if (sentenceText) {
      sentences.push({
        text: sentenceText,
        tokenStart: startIndex,
        tokenEnd: tokens.length - 1,
      });
    }
  }

  // If no sentences found, treat the whole text as one sentence
  if (sentences.length === 0 && tokens.length > 0) {
    const sentenceText = tokens.join('').trim();
    if (sentenceText) {
      sentences.push({
        text: sentenceText,
        tokenStart: 0,
        tokenEnd: tokens.length - 1,
      });
    }
  }

  return sentences;
}
