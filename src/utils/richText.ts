export type RichTextTokenType = 'text' | 'url' | 'hashtag' | 'mention';

export interface RichTextToken {
  text: string;
  type: RichTextTokenType;
  value?: string;
}

interface SpecialMatch {
  text: string;
  start: number;
  end: number;
  type: Exclude<RichTextTokenType, 'text'>;
  value?: string;
}

const URL_REGEX = /https?:\/\/[^\s<>"\u3000-\u303F\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF]+/g;
const HASHTAG_REGEX = /#[\p{L}\p{N}_]+/gu;
const MENTION_REGEX = /@[\w](?:[\w.-]*[\w])?/g;

/**
 * Split rich text into plain text, URL, hashtag, and mention tokens.
 * URL has priority over hashtag/mention to avoid overlap parsing issues.
 */
export function tokenizeRichText(text: string): RichTextToken[] {
  if (!text) return [];

  const specialMatches: SpecialMatch[] = [];

  const urlRegex = new RegExp(URL_REGEX.source, 'g');
  let urlMatch: RegExpExecArray | null;
  while ((urlMatch = urlRegex.exec(text)) !== null) {
    specialMatches.push({
      text: urlMatch[0],
      start: urlMatch.index,
      end: urlMatch.index + urlMatch[0].length,
      type: 'url',
    });
  }

  const hashtagRegex = new RegExp(HASHTAG_REGEX.source, 'gu');
  let hashtagMatch: RegExpExecArray | null;
  while ((hashtagMatch = hashtagRegex.exec(text)) !== null) {
    const hashtagStart = hashtagMatch.index;
    const overlapsWithUrl = specialMatches.some(
      (item) => item.type === 'url' && hashtagStart >= item.start && hashtagStart < item.end
    );
    if (!overlapsWithUrl) {
      specialMatches.push({
        text: hashtagMatch[0],
        start: hashtagStart,
        end: hashtagStart + hashtagMatch[0].length,
        type: 'hashtag',
        value: hashtagMatch[0].slice(1),
      });
    }
  }

  const mentionRegex = new RegExp(MENTION_REGEX.source, 'g');
  let mentionMatch: RegExpExecArray | null;
  while ((mentionMatch = mentionRegex.exec(text)) !== null) {
    const mentionStart = mentionMatch.index;
    const overlapsWithOther = specialMatches.some(
      (item) => mentionStart >= item.start && mentionStart < item.end
    );
    if (!overlapsWithOther) {
      specialMatches.push({
        text: mentionMatch[0],
        start: mentionStart,
        end: mentionStart + mentionMatch[0].length,
        type: 'mention',
        value: mentionMatch[0].slice(1),
      });
    }
  }

  if (specialMatches.length === 0) {
    return [{ text, type: 'text' }];
  }

  specialMatches.sort((a, b) => a.start - b.start);

  const tokens: RichTextToken[] = [];
  let currentPos = 0;

  for (const match of specialMatches) {
    if (match.start > currentPos) {
      tokens.push({
        text: text.substring(currentPos, match.start),
        type: 'text',
      });
    }

    tokens.push({
      text: match.text,
      type: match.type,
      value: match.value,
    });

    currentPos = match.end;
  }

  if (currentPos < text.length) {
    tokens.push({
      text: text.substring(currentPos),
      type: 'text',
    });
  }

  return tokens;
}