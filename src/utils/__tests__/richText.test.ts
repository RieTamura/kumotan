import { tokenizeRichText } from '../richText';

describe('tokenizeRichText', () => {
  it('returns plain text token when no special tokens exist', () => {
    const result = tokenizeRichText('Hello world');

    expect(result).toEqual([{ text: 'Hello world', type: 'text' }]);
  });

  it('tokenizes URL, hashtag, and mention in mixed text', () => {
    const result = tokenizeRichText('See https://example.com #kumotan @alice.bsky.social now');

    expect(result).toEqual([
      { text: 'See ', type: 'text' },
      { text: 'https://example.com', type: 'url', value: undefined },
      { text: ' ', type: 'text' },
      { text: '#kumotan', type: 'hashtag', value: 'kumotan' },
      { text: ' ', type: 'text' },
      { text: '@alice.bsky.social', type: 'mention', value: 'alice.bsky.social' },
      { text: ' now', type: 'text' },
    ]);
  });

  it('does not tokenize hashtag inside URL', () => {
    const result = tokenizeRichText('https://example.com/#anchor #outside');

    expect(result).toEqual([
      { text: 'https://example.com/#anchor', type: 'url', value: undefined },
      { text: ' ', type: 'text' },
      { text: '#outside', type: 'hashtag', value: 'outside' },
    ]);
  });

  it('returns empty array for empty string', () => {
    expect(tokenizeRichText('')).toEqual([]);
  });
});