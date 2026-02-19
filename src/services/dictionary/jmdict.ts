/**
 * JMdict辞書サービス
 *
 * オフラインで英語→日本語の辞書検索を提供します。
 * JMdict (Japanese-Multilingual Dictionary) を使用。
 *
 * 辞書データは外部サーバー（GitHub Pages）からダウンロードして使用します。
 * 初回起動時にダウンロードが必要です。
 *
 * ライセンス: Creative Commons Attribution-ShareAlike Licence (V4.0)
 * 帰属表示: This application uses the JMdict/EDICT dictionary files.
 *           These files are the property of the Electronic Dictionary Research
 *           and Development Group, and are used in conformance with the Group's licence.
 */

import * as SQLite from 'expo-sqlite';
import { Result } from '../../types/result';
import {
  JMdictResult,
  JMdictTranslateResult,
  JMdictReverseResult,
  JMdictReverseTranslateResult,
} from '../../types/word';
import { normalizeJapanese } from '../../utils/japanese';
import { AppError, ErrorCode } from '../../utils/errors';
import { LRUCache, createCacheKey } from '../../utils/cache';
import {
  isDictionaryInstalled,
  getOverrides,
  findOverrideForWord,
  isWordDeleted,
  type DictionaryOverride,
} from './ExternalDictionaryService';

/**
 * JMdict検索結果のキャッシュ（200エントリ、30分TTL）
 */
const jmdictCache = new LRUCache<JMdictTranslateResult>(200, 30 * 60 * 1000);

/**
 * JMdict逆引き検索結果のキャッシュ（200エントリ、30分TTL）
 */
const jmdictReverseCache = new LRUCache<JMdictReverseTranslateResult>(200, 30 * 60 * 1000);

/**
 * データベースインスタンス
 */
let jmdictDb: SQLite.SQLiteDatabase | null = null;

/**
 * データベース初期化済みフラグ
 */
let isInitialized = false;

/**
 * JMdictデータベースのパス
 */
const JMDICT_DB_NAME = 'jmdict.db';

/**
 * 初期化状態
 */
export type JMdictInitStatus =
  | 'idle'
  | 'checking'
  | 'copying'
  | 'ready'
  | 'error';

/**
 * 初期化の進捗コールバック
 */
export type JMdictInitProgressCallback = (status: JMdictInitStatus) => void;

/**
 * データベースの整合性を確認
 * metadataテーブルが存在し、正常に読み取れるか確認
 */
async function verifyDatabase(db: SQLite.SQLiteDatabase): Promise<boolean> {
  try {
    const result = await db.getFirstAsync<{ count: number }>(
      "SELECT COUNT(*) as count FROM sqlite_master WHERE type='table' AND name='metadata'"
    );
    return result?.count === 1;
  } catch {
    return false;
  }
}

/**
 * JMdictデータベースを初期化
 *
 * 外部からダウンロードされた辞書データベースを開きます。
 * 辞書がインストールされていない場合はエラーを返します。
 *
 * @param onProgress 進捗コールバック（オプション）
 */
export async function initJMdictDatabase(
  onProgress?: JMdictInitProgressCallback
): Promise<Result<void, AppError>> {
  if (isInitialized && jmdictDb) {
    onProgress?.('ready');
    return { success: true, data: undefined };
  }

  try {
    onProgress?.('checking');

    // 外部辞書がインストールされているか確認
    const installed = await isDictionaryInstalled();
    if (!installed) {
      onProgress?.('error');
      return {
        success: false,
        error: new AppError(
          ErrorCode.DATABASE_ERROR,
          '辞書データがインストールされていません。設定画面から辞書をダウンロードしてください。',
        ),
      };
    }

    // 既存のデータベースを開いて整合性を確認
    try {
      const existingDb = await SQLite.openDatabaseAsync(JMDICT_DB_NAME);
      const isValid = await verifyDatabase(existingDb);
      if (isValid) {
        // DBが正常なのでそのまま使用
        jmdictDb = existingDb;
        if (__DEV__) {
          console.log('JMdict: Using external dictionary database');
        }
      } else {
        // 破損している
        await existingDb.closeAsync();
        onProgress?.('error');
        return {
          success: false,
          error: new AppError(
            ErrorCode.DATABASE_ERROR,
            '辞書データが破損しています。設定画面から再ダウンロードしてください。',
          ),
        };
      }
    } catch (error) {
      // データベースが開けない
      if (__DEV__) {
        console.log('JMdict: Failed to open database', error);
      }
      onProgress?.('error');
      return {
        success: false,
        error: new AppError(
          ErrorCode.DATABASE_ERROR,
          '辞書データベースを開けませんでした。',
          error
        ),
      };
    }

    isInitialized = true;
    onProgress?.('ready');

    if (__DEV__) {
      // メタデータを確認
      const metadata = await jmdictDb!.getAllAsync<{ key: string; value: string }>(
        'SELECT key, value FROM metadata'
      );
      console.log('JMdict metadata:', metadata);
    }

    return { success: true, data: undefined };
  } catch (error) {
    onProgress?.('error');
    return {
      success: false,
      error: new AppError(
        ErrorCode.DATABASE_ERROR,
        'JMdict辞書の初期化に失敗しました。',
        error
      ),
    };
  }
}

/**
 * JMdictデータベースが利用可能かどうか確認
 *
 * 辞書がインストールされていて、正常に開ける場合にtrueを返します。
 */
export async function isJMdictAvailable(): Promise<boolean> {
  if (isInitialized && jmdictDb) {
    return true;
  }

  // まず外部辞書がインストールされているか確認
  const installed = await isDictionaryInstalled();
  if (!installed) {
    return false;
  }

  // 初期化を試みて成功するか確認
  const result = await initJMdictDatabase();
  return result.success;
}

/**
 * 英単語からJMdictエントリを検索
 */
export async function lookupJMdict(
  word: string
): Promise<Result<JMdictResult[], AppError>> {
  // データベース初期化確認
  if (!isInitialized || !jmdictDb) {
    const initResult = await initJMdictDatabase();
    if (!initResult.success) {
      return { success: false, error: initResult.error };
    }
  }

  if (!jmdictDb) {
    return {
      success: false,
      error: new AppError(
        ErrorCode.DATABASE_ERROR,
        'JMdict辞書が初期化されていません。'
      ),
    };
  }

  const normalizedWord = word.toLowerCase().trim();

  if (!normalizedWord) {
    return {
      success: false,
      error: new AppError(ErrorCode.VALIDATION_ERROR, '検索語を入力してください。'),
    };
  }

  try {
    // 完全一致検索（高優先度）
    const exactResults = await jmdictDb.getAllAsync<{
      entry_id: number;
      kanji: string | null;
      kana: string;
      is_common: number;
      priority: number;
      gloss_id: number;
      gloss: string;
      part_of_speech: string;
      sense_index: number;
    }>(
      `
      SELECT
        e.id as entry_id,
        e.kanji,
        e.kana,
        e.is_common,
        e.priority,
        g.id as gloss_id,
        g.gloss,
        g.part_of_speech,
        g.sense_index
      FROM glosses g
      JOIN entries e ON g.entry_id = e.id
      WHERE g.gloss_normalized = ?
      ORDER BY
        e.priority DESC,
        e.is_common DESC,
        CASE WHEN e.kanji IS NOT NULL THEN 0 ELSE 1 END,
        g.sense_index ASC,
        LENGTH(e.kana) ASC
      LIMIT 20
      `,
      [normalizedWord]
    );

    // 結果がない場合はFTS5全文検索（単語境界を考慮した検索）
    let results = exactResults;
    if (results.length === 0) {
      try {
        // FTS5検索: 単語として検索し、rankでソート
        const ftsResults = await jmdictDb.getAllAsync<{
          entry_id: number;
          kanji: string | null;
          kana: string;
          is_common: number;
          priority: number;
          gloss_id: number;
          gloss: string;
          gloss_normalized: string;
          part_of_speech: string;
          sense_index: number;
          rank: number;
        }>(
          `
          SELECT
            e.id as entry_id,
            e.kanji,
            e.kana,
            e.is_common,
            e.priority,
            g.id as gloss_id,
            g.gloss,
            g.gloss_normalized,
            g.part_of_speech,
            g.sense_index,
            fts.rank
          FROM glosses_fts fts
          JOIN glosses g ON fts.rowid = g.id
          JOIN entries e ON g.entry_id = e.id
          WHERE glosses_fts MATCH ?
          ORDER BY
            fts.rank,
            e.priority DESC,
            e.is_common DESC,
            CASE WHEN e.kanji IS NOT NULL THEN 0 ELSE 1 END,
            g.sense_index ASC,
            LENGTH(e.kana) ASC
          LIMIT 50
          `,
          [normalizedWord]
        );

        // フィルタリング: 検索語が単語の先頭にあるものを優先
        // 例: "skills" → "skills" ✓, "skill" ✓, "skills inventory system" ✗
        const filteredResults = ftsResults.filter((row) => {
          const firstWord = row.gloss_normalized.split(/\s+/)[0];
          // 検索語が最初の単語と一致、または最初の単語が検索語で始まる
          return firstWord === normalizedWord || firstWord.startsWith(normalizedWord);
        });

        results = filteredResults.length > 0 ? filteredResults.slice(0, 20) : [];
      } catch (ftsError) {
        // FTS5が使えない環境（Expo Go等）では前方一致にフォールバック
        if (__DEV__) {
          console.log('FTS5 not available, falling back to LIKE search:', ftsError);
        }
        results = await jmdictDb.getAllAsync<{
          entry_id: number;
          kanji: string | null;
          kana: string;
          is_common: number;
          priority: number;
          gloss_id: number;
          gloss: string;
          part_of_speech: string;
          sense_index: number;
        }>(
          `
          SELECT
            e.id as entry_id,
            e.kanji,
            e.kana,
            e.is_common,
            e.priority,
            g.id as gloss_id,
            g.gloss,
            g.part_of_speech,
            g.sense_index
          FROM glosses g
          JOIN entries e ON g.entry_id = e.id
          WHERE g.gloss_normalized LIKE ?
          ORDER BY
            e.priority DESC,
            e.is_common DESC,
            CASE WHEN e.kanji IS NOT NULL THEN 0 ELSE 1 END,
            g.sense_index ASC,
            LENGTH(e.kana) ASC
          LIMIT 20
          `,
          [`${normalizedWord}%`]
        );
      }
    }

    // 結果をエントリごとにグループ化
    const entriesMap = new Map<number, JMdictResult>();

    for (const row of results) {
      if (!entriesMap.has(row.entry_id)) {
        entriesMap.set(row.entry_id, {
          entry: {
            id: row.entry_id,
            kanji: row.kanji,
            kana: row.kana,
            isCommon: row.is_common === 1,
            priority: row.priority,
          },
          glosses: [],
        });
      }

      const entry = entriesMap.get(row.entry_id)!;
      entry.glosses.push({
        id: row.gloss_id,
        entryId: row.entry_id,
        gloss: row.gloss,
        partOfSpeech: row.part_of_speech,
        senseIndex: row.sense_index,
      });
    }

    return { success: true, data: Array.from(entriesMap.values()) };
  } catch (error) {
    return {
      success: false,
      error: new AppError(
        ErrorCode.DATABASE_ERROR,
        'JMdict検索でエラーが発生しました。',
        error
      ),
    };
  }
}

/**
 * オーバーライドから結果を生成
 */
function createResultFromOverride(
  override: DictionaryOverride
): JMdictTranslateResult {
  const meaning = override.corrected_meaning || override.meaning || '';
  return {
    text: meaning,
    readings: override.reading ? [override.reading] : [],
    partOfSpeech: override.part_of_speech ? [override.part_of_speech] : [],
    isCommon: true,
    source: 'override',
  };
}

/**
 * 英単語を日本語に翻訳（JMdict使用）
 *
 * DeepLの代替として使用可能。単語レベルの翻訳に最適化。
 * フィードバックから承認されたオーバーライドを優先適用します。
 */
export async function translateWithJMdict(
  word: string
): Promise<Result<JMdictTranslateResult, AppError>> {
  const normalizedWord = word.toLowerCase().trim();
  const cacheKey = createCacheKey('jmdict', normalizedWord);

  // 1. まずオーバーライド（差分）をチェック（キャッシュより優先）
  const overrides = await getOverrides();

  if (__DEV__) {
    console.log('JMdict overrides:', overrides ? `${overrides.entries.length} entries` : 'null');
    if (overrides && overrides.entries.length > 0) {
      console.log('JMdict override entries:', JSON.stringify(overrides.entries.map(e => e.word)));
    }
  }

  // 削除対象として登録されている場合はエラーを返す
  if (isWordDeleted(overrides, normalizedWord)) {
    return {
      success: false,
      error: new AppError(
        ErrorCode.WORD_NOT_FOUND,
        `「${word}」は辞書から削除されました。`
      ),
    };
  }

  // オーバーライドが見つかった場合は優先適用
  const override = findOverrideForWord(overrides, normalizedWord);
  if (override) {
    const result = createResultFromOverride(override);

    // キャッシュに保存
    jmdictCache.set(cacheKey, result);

    if (__DEV__) {
      console.log(
        `JMdict override applied: "${word}" → "${result.text}" (issue #${override.source_issue})`
      );
    }

    return { success: true, data: result };
  }

  // 2. オーバーライドがなければキャッシュを確認
  const cachedResult = jmdictCache.get(cacheKey);
  if (cachedResult) {
    if (__DEV__) {
      console.log(`JMdict cache hit: "${word}"`);
    }
    return { success: true, data: cachedResult };
  }

  // 3. キャッシュもなければ通常の辞書検索
  const lookupResult = await lookupJMdict(word);
  if (!lookupResult.success) {
    return { success: false, error: lookupResult.error };
  }

  if (lookupResult.data.length === 0) {
    return {
      success: false,
      error: new AppError(
        ErrorCode.WORD_NOT_FOUND,
        `「${word}」は辞書に見つかりませんでした。`
      ),
    };
  }

  // 最も適切な結果を選択（優先度とcommonフラグで判断）
  const bestMatch = lookupResult.data[0];
  const entry = bestMatch.entry;
  const glosses = bestMatch.glosses;

  // 日本語テキストを構築（漢字があれば漢字、なければひらがな）
  const japaneseText = entry.kanji || entry.kana;

  // 読みを収集
  const readings = [entry.kana];
  if (entry.kanji && entry.kana !== entry.kanji) {
    // 漢字がある場合は読み仮名も追加
  }

  // 品詞を収集（重複排除）
  const partOfSpeechSet = new Set<string>();
  for (const gloss of glosses) {
    if (gloss.partOfSpeech) {
      gloss.partOfSpeech.split(', ').forEach((pos) => partOfSpeechSet.add(pos));
    }
  }

  const result: JMdictTranslateResult = {
    text: japaneseText,
    readings,
    partOfSpeech: Array.from(partOfSpeechSet),
    isCommon: entry.isCommon,
    source: 'jmdict',
  };

  // キャッシュに保存
  jmdictCache.set(cacheKey, result);

  if (__DEV__) {
    console.log(`JMdict translated: "${word}" → "${japaneseText}"`);
  }

  return { success: true, data: result };
}

/**
 * JMdictキャッシュをクリア
 */
export function clearJMdictCache(): void {
  jmdictCache.clear();
}

/** テスト用: JMdict初期化状態をリセット */
export function resetJMdictState(): void {
  jmdictCache.clear();
  isInitialized = false;
  jmdictDb = null;
}

/**
 * JMdict辞書のメタデータを取得
 */
export async function getJMdictMetadata(): Promise<
  Result<Record<string, string>, AppError>
> {
  if (!isInitialized || !jmdictDb) {
    const initResult = await initJMdictDatabase();
    if (!initResult.success) {
      return { success: false, error: initResult.error };
    }
  }

  if (!jmdictDb) {
    return {
      success: false,
      error: new AppError(
        ErrorCode.DATABASE_ERROR,
        'JMdict辞書が初期化されていません。'
      ),
    };
  }

  try {
    const rows = await jmdictDb.getAllAsync<{ key: string; value: string }>(
      'SELECT key, value FROM metadata'
    );

    const metadata: Record<string, string> = {};
    for (const row of rows) {
      metadata[row.key] = row.value;
    }

    return { success: true, data: metadata };
  } catch (error) {
    return {
      success: false,
      error: new AppError(
        ErrorCode.DATABASE_ERROR,
        'メタデータの取得に失敗しました。',
        error
      ),
    };
  }
}

/**
 * JMdictライセンス表示用テキスト
 */
export const JMDICT_LICENSE_TEXT = `This application uses the JMdict/EDICT dictionary files. These files are the property of the Electronic Dictionary Research and Development Group (EDRDG), and are used in conformance with the Group's licence.

For more information, see: https://www.edrdg.org/wiki/index.php/JMdict-EDICT_Dictionary_Project`;

/**
 * JMdictの帰属表示（短縮版）
 */
export const JMDICT_ATTRIBUTION = 'JMdict by EDRDG (CC BY-SA 4.0)';

/**
 * 日本語からJMdictエントリを検索（逆引き）
 *
 * 漢字、ひらがな、カタカナで検索し、英語訳を取得します。
 * カタカナはひらがなに変換して検索します。
 */
export async function lookupJMdictReverse(
  japaneseText: string
): Promise<Result<JMdictReverseResult[], AppError>> {
  // データベース初期化確認
  if (!isInitialized || !jmdictDb) {
    const initResult = await initJMdictDatabase();
    if (!initResult.success) {
      return { success: false, error: initResult.error };
    }
  }

  if (!jmdictDb) {
    return {
      success: false,
      error: new AppError(
        ErrorCode.DATABASE_ERROR,
        'JMdict辞書が初期化されていません。'
      ),
    };
  }

  const trimmedText = japaneseText.trim();
  if (!trimmedText) {
    return {
      success: false,
      error: new AppError(ErrorCode.VALIDATION_ERROR, '検索語を入力してください。'),
    };
  }

  // 日本語テキストを正規化（カタカナ→ひらがな変換含む）
  const normalizedText = normalizeJapanese(trimmedText);

  try {
    // 漢字またはかなで検索
    // 1. 完全一致検索（漢字 OR かな）
    const results = await jmdictDb.getAllAsync<{
      entry_id: number;
      kanji: string | null;
      kana: string;
      is_common: number;
      priority: number;
      gloss: string;
      part_of_speech: string;
      sense_index: number;
    }>(
      `
      SELECT
        e.id as entry_id,
        e.kanji,
        e.kana,
        e.is_common,
        e.priority,
        g.gloss,
        g.part_of_speech,
        g.sense_index
      FROM entries e
      JOIN glosses g ON e.id = g.entry_id
      WHERE e.kanji = ? OR e.kana = ?
      ORDER BY
        e.priority DESC,
        e.is_common DESC,
        g.sense_index ASC
      LIMIT 50
      `,
      [trimmedText, normalizedText]
    );

    if (results.length === 0) {
      return {
        success: false,
        error: new AppError(
          ErrorCode.WORD_NOT_FOUND,
          `「${japaneseText}」は辞書に見つかりませんでした。`
        ),
      };
    }

    // 結果をエントリごとにグループ化
    const entriesMap = new Map<number, JMdictReverseResult>();

    for (const row of results) {
      if (!entriesMap.has(row.entry_id)) {
        entriesMap.set(row.entry_id, {
          entry: {
            id: row.entry_id,
            kanji: row.kanji,
            kana: row.kana,
            isCommon: row.is_common === 1,
            priority: row.priority,
          },
          englishGlosses: [],
          partOfSpeech: [],
        });
      }

      const entry = entriesMap.get(row.entry_id)!;

      // 英語訳を追加（重複排除）
      if (!entry.englishGlosses.includes(row.gloss)) {
        entry.englishGlosses.push(row.gloss);
      }

      // 品詞を追加（重複排除）
      if (row.part_of_speech) {
        const posList = row.part_of_speech.split(', ');
        for (const pos of posList) {
          if (!entry.partOfSpeech.includes(pos)) {
            entry.partOfSpeech.push(pos);
          }
        }
      }
    }

    return { success: true, data: Array.from(entriesMap.values()) };
  } catch (error) {
    return {
      success: false,
      error: new AppError(
        ErrorCode.DATABASE_ERROR,
        'JMdict逆引き検索でエラーが発生しました。',
        error
      ),
    };
  }
}

/**
 * 日本語を英語に翻訳（JMdict使用）
 *
 * 日本語（漢字/ひらがな/カタカナ）から英語訳を取得します。
 */
export async function translateWithJMdictReverse(
  japaneseText: string
): Promise<Result<JMdictReverseTranslateResult, AppError>> {
  const normalizedText = normalizeJapanese(japaneseText.trim());

  // キャッシュ確認
  const cacheKey = createCacheKey('jmdict-reverse', normalizedText);
  const cachedResult = jmdictReverseCache.get(cacheKey);
  if (cachedResult) {
    if (__DEV__) {
      console.log(`JMdict reverse cache hit: "${japaneseText}"`);
    }
    return { success: true, data: cachedResult };
  }

  // JMdict逆引き検索
  const lookupResult = await lookupJMdictReverse(japaneseText);
  if (!lookupResult.success) {
    return { success: false, error: lookupResult.error };
  }

  if (lookupResult.data.length === 0) {
    return {
      success: false,
      error: new AppError(
        ErrorCode.WORD_NOT_FOUND,
        `「${japaneseText}」は辞書に見つかりませんでした。`
      ),
    };
  }

  // 最も適切な結果を選択（優先度とcommonフラグで判断）
  const bestMatch = lookupResult.data[0];
  const entry = bestMatch.entry;

  // 英語テキストを構築（最初の訳を使用）
  const englishText = bestMatch.englishGlosses[0] || '';

  const result: JMdictReverseTranslateResult = {
    text: englishText,
    originalJapanese: entry.kanji || entry.kana,
    reading: entry.kanji ? entry.kana : undefined,
    partOfSpeech: bestMatch.partOfSpeech,
    isCommon: entry.isCommon,
    source: 'jmdict',
  };

  // キャッシュに保存
  jmdictReverseCache.set(cacheKey, result);

  if (__DEV__) {
    console.log(`JMdict reverse translated: "${japaneseText}" → "${englishText}"`);
  }

  return { success: true, data: result };
}

/**
 * JMdict逆引きキャッシュをクリア
 */
export function clearJMdictReverseCache(): void {
  jmdictReverseCache.clear();
}
