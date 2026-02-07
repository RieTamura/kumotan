/**
 * PDS Vocabulary Sync Service
 * Handles syncing vocabulary words to/from Bluesky PDS (Personal Data Store)
 */

import { BskyAgent } from '@atproto/api';
import { Word } from '../../types/word';
import { getDatabase } from '../database/init';
import { insertWord } from '../database/words';
import { sanitizeWord } from '../../utils/validators';

const COLLECTION = 'io.kumotan.vocabulary.word';

/**
 * PDS復元結果
 */
export interface RestoreResult {
  total: number;
  restored: number;
  skipped: number;
  failed: number;
}

/**
 * URIからrkeyを抽出する
 *
 * @example
 * extractRkey('at://did:plc:xxx/io.kumotan.vocabulary.word/3abc123def')
 * // => '3abc123def'
 */
function extractRkey(uri: string): string | null {
  const parts = uri.split('/');
  return parts.length > 0 ? parts[parts.length - 1] : null;
}

/**
 * DIDを取得する（標準認証とOAuth両対応）
 */
function getDid(agent: BskyAgent): string | null {
  return agent.session?.did || (agent as any).sessionManager?.did || null;
}

/**
 * Word型からPDSレコードオブジェクトを構築する
 */
function buildPdsRecord(word: Word): Record<string, unknown> {
  const record: Record<string, unknown> = {
    $type: COLLECTION,
    english: word.english,
    createdAt: new Date(word.createdAt).toISOString(),
    isRead: word.isRead,
  };
  if (word.japanese) record.japanese = word.japanese;
  if (word.definition) record.definition = word.definition;
  if (word.postUrl) record.postUrl = word.postUrl;
  if (word.postText) record.postText = word.postText;
  if (word.readAt) record.readAt = new Date(word.readAt).toISOString();
  return record;
}

/**
 * 単語をPDSに保存し、rkeyをローカルDBに記録する
 *
 * @param agent - 認証済みのBskyAgent
 * @param word - 保存する単語データ
 * @returns rkey（成功時）またはnull（失敗時）
 */
export async function syncWordToPds(
  agent: BskyAgent,
  word: Word
): Promise<string | null> {
  const did = getDid(agent);
  console.log('[syncWordToPds] did:', did, 'word:', word.english);
  if (!did) {
    console.warn('[syncWordToPds] No DID found, skipping PDS sync');
    return null;
  }

  try {
    const record = buildPdsRecord(word);

    console.log('[syncWordToPds] Calling createRecord...');
    const response = await agent.api.com.atproto.repo.createRecord({
      repo: did,
      collection: COLLECTION,
      record,
    });
    console.log('[syncWordToPds] Response:', response.data.uri);

    const rkey = extractRkey(response.data.uri);
    if (rkey) {
      const database = await getDatabase();
      await database.runAsync(
        'UPDATE words SET pds_rkey = ? WHERE id = ?',
        [rkey, word.id]
      );
    }

    return rkey;
  } catch (error) {
    console.error('[syncWordToPds] Failed to sync word to PDS:', error);
    return null;
  }
}

/**
 * PDS上の単語レコードを削除する
 *
 * @param agent - 認証済みのBskyAgent
 * @param rkey - 削除対象のレコードキー
 * @returns 成功/失敗
 */
export async function deleteWordFromPds(
  agent: BskyAgent,
  rkey: string
): Promise<boolean> {
  const did = getDid(agent);
  if (!did) {
    return false;
  }

  try {
    await agent.api.com.atproto.repo.deleteRecord({
      repo: did,
      collection: COLLECTION,
      rkey,
    });
    return true;
  } catch (error) {
    console.error('[deleteWordFromPds] Failed to delete word from PDS:', error);
    return false;
  }
}

/**
 * PDS上の単語レコードを更新する（既読状態の同期等）
 *
 * @param agent - 認証済みのBskyAgent
 * @param word - 更新後の単語データ
 * @param rkey - 更新対象のレコードキー
 * @returns 成功/失敗
 */
export async function updateWordInPds(
  agent: BskyAgent,
  word: Word,
  rkey: string
): Promise<boolean> {
  const did = getDid(agent);
  if (!did) {
    return false;
  }

  try {
    const record = buildPdsRecord(word);

    await agent.api.com.atproto.repo.putRecord({
      repo: did,
      collection: COLLECTION,
      rkey,
      record,
    });
    return true;
  } catch (error) {
    console.error('[updateWordInPds] Failed to update word in PDS:', error);
    return false;
  }
}

/**
 * PDSに保存された全単語をローカルDBに復元する
 *
 * @param agent - 認証済みのBskyAgent
 * @returns 復元結果（成功数、スキップ数、失敗数）
 */
export async function restoreWordsFromPds(
  agent: BskyAgent
): Promise<RestoreResult> {
  const did = getDid(agent);
  if (!did) {
    throw new Error('認証が必要です。ログインしてください。');
  }

  const result: RestoreResult = {
    total: 0,
    restored: 0,
    skipped: 0,
    failed: 0,
  };

  try {
    let cursor: string | undefined;

    do {
      const response = await agent.api.com.atproto.repo.listRecords({
        repo: did,
        collection: COLLECTION,
        limit: 100,
        cursor,
      });

      const records = response.data.records;
      result.total += records.length;

      for (const record of records) {
        try {
          const value = record.value as Record<string, unknown>;
          const english = value.english as string;

          if (!english) {
            result.failed++;
            continue;
          }

          const rkey = extractRkey(record.uri);

          const insertResult = await insertWord({
            english,
            japanese: (value.japanese as string) ?? null,
            definition: (value.definition as string) ?? null,
            postUrl: (value.postUrl as string) ?? null,
            postText: (value.postText as string) ?? null,
          });

          if (insertResult.success) {
            // 復元した単語にrkeyを記録
            if (rkey) {
              const database = await getDatabase();
              await database.runAsync(
                'UPDATE words SET pds_rkey = ? WHERE id = ?',
                [rkey, insertResult.data.id]
              );
            }
            // isRead/readAtの復元（daily_statsは更新しない）
            const isRead = (value.isRead as boolean) ?? false;
            const readAt = (value.readAt as string) ?? null;
            if (isRead || readAt) {
              const database = await getDatabase();
              await database.runAsync(
                'UPDATE words SET is_read = ?, read_at = ? WHERE id = ?',
                [isRead ? 1 : 0, readAt, insertResult.data.id]
              );
            }
            result.restored++;
          } else {
            // 重複の場合はスキップとしてカウント
            if (insertResult.error.code === 'DUPLICATE_WORD') {
              // 既存の単語にもrkeyを記録（まだ設定されていない場合）
              if (rkey) {
                const database = await getDatabase();
                const sanitizedEnglish = sanitizeWord(english);
                await database.runAsync(
                  'UPDATE words SET pds_rkey = ? WHERE english = ? AND pds_rkey IS NULL',
                  [rkey, sanitizedEnglish]
                );
              }
              result.skipped++;
            } else {
              result.failed++;
            }
          }
        } catch (error) {
          console.error('[restoreWordsFromPds] Failed to restore record:', error);
          result.failed++;
        }
      }

      cursor = response.data.cursor;
    } while (cursor);

    return result;
  } catch (error) {
    console.error('[restoreWordsFromPds] Failed to restore from PDS:', error);
    throw error;
  }
}

/**
 * 単語のpds_rkeyを取得する
 *
 * @param wordId - 単語のID
 * @returns pds_rkey（存在しない場合はnull）
 */
export async function getPdsRkey(wordId: number): Promise<string | null> {
  const database = await getDatabase();
  const row = await database.getFirstAsync<{ pds_rkey: string | null }>(
    'SELECT pds_rkey FROM words WHERE id = ?',
    [wordId]
  );
  return row?.pds_rkey ?? null;
}

/**
 * 全単語のpds_rkeyを取得する
 *
 * @returns pds_rkeyの配列
 */
export async function getAllPdsRkeys(): Promise<string[]> {
  const database = await getDatabase();
  const rows = await database.getAllAsync<{ pds_rkey: string }>(
    'SELECT pds_rkey FROM words WHERE pds_rkey IS NOT NULL'
  );
  return rows.map(row => row.pds_rkey);
}
