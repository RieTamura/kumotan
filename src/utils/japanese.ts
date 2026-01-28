/**
 * 日本語処理ユーティリティ
 *
 * カタカナ・ひらがな変換、日本語判定などの機能を提供します。
 */

/**
 * カタカナをひらがなに変換
 *
 * @param text 変換するテキスト
 * @returns ひらがなに変換されたテキスト
 */
export function katakanaToHiragana(text: string): string {
  return text.replace(/[\u30A1-\u30F6]/g, (char) => {
    // カタカナのコードポイントからひらがなのコードポイントへ変換
    // カタカナ: U+30A1-U+30F6
    // ひらがな: U+3041-U+3096
    // 差分は 0x60 (96)
    return String.fromCharCode(char.charCodeAt(0) - 0x60);
  });
}

/**
 * ひらがなをカタカナに変換
 *
 * @param text 変換するテキスト
 * @returns カタカナに変換されたテキスト
 */
export function hiraganaToKatakana(text: string): string {
  return text.replace(/[\u3041-\u3096]/g, (char) => {
    return String.fromCharCode(char.charCodeAt(0) + 0x60);
  });
}

/**
 * テキストが日本語を含むかどうかを判定
 *
 * ひらがな、カタカナ、漢字のいずれかを含む場合にtrueを返します。
 *
 * @param text 判定するテキスト
 * @returns 日本語を含む場合はtrue
 */
export function containsJapanese(text: string): boolean {
  // ひらがな: U+3040-U+309F
  // カタカナ: U+30A0-U+30FF
  // 漢字（CJK統合漢字）: U+4E00-U+9FAF
  // 漢字（CJK統合漢字拡張A）: U+3400-U+4DBF
  return /[\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF\u3400-\u4DBF]/.test(text);
}

/**
 * テキストが主に日本語かどうかを判定
 *
 * 日本語文字が半数以上を占める場合にtrueを返します。
 * 空白や記号は除外してカウントします。
 *
 * @param text 判定するテキスト
 * @returns 主に日本語の場合はtrue
 */
export function isPrimarilyJapanese(text: string): boolean {
  // 空白と記号を除去
  const cleanText = text.replace(/[\s\p{P}\p{S}]/gu, '');
  if (cleanText.length === 0) return false;

  const japaneseChars = cleanText.match(
    /[\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF\u3400-\u4DBF]/g
  );
  const japaneseCount = japaneseChars ? japaneseChars.length : 0;

  return japaneseCount / cleanText.length > 0.5;
}

/**
 * 日本語テキストを正規化（検索用）
 *
 * - カタカナをひらがなに変換
 * - 全角英数字を半角に変換
 * - 前後の空白を除去
 *
 * @param text 正規化するテキスト
 * @returns 正規化されたテキスト
 */
export function normalizeJapanese(text: string): string {
  let normalized = text.trim();

  // カタカナをひらがなに変換
  normalized = katakanaToHiragana(normalized);

  // 全角英数字を半角に変換
  normalized = normalized.replace(/[Ａ-Ｚａ-ｚ０-９]/g, (char) => {
    return String.fromCharCode(char.charCodeAt(0) - 0xfee0);
  });

  return normalized;
}
