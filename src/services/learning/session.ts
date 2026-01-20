/**
 * 学習セッション記録サービス
 * AT Protocolのカスタムレコード（io.kumotan.learning.session）を使用して
 * 学習記録をBluesky PDSに保存する
 */

import { BskyAgent } from '@atproto/api';
import { Buffer } from 'buffer';
import { CreateLearningSessionInput, LearningSession } from '../../types/word';

/**
 * 学習セッションをPDSに保存
 *
 * @param agent - 認証済みのBskyAgentインスタンス
 * @param input - 学習セッションデータ
 * @returns 作成されたレコードのURI
 * @throws Error - API呼び出しに失敗した場合
 */
export async function createLearningSession(
  agent: BskyAgent,
  input: CreateLearningSessionInput
): Promise<string> {
  // Check for session DID (standard auth) or sessionManager DID (OAuth)
  const did = agent.session?.did || (agent as any).sessionManager?.did;
  if (!did) {
    throw new Error('認証が必要です。ログインしてください。');
  }

  const session: LearningSession = {
    date: input.date,
    wordsLearned: input.wordsLearned,
    timeSpent: input.timeSpent,
    achievement: input.achievement,
    visibility: input.visibility || 'public',
    createdAt: new Date().toISOString(),
  };

  try {
    const response = await agent.api.com.atproto.repo.createRecord({
      repo: did,
      collection: 'io.kumotan.learning.session',
      record: {
        $type: 'io.kumotan.learning.session',
        ...session,
      },
    });

    return response.data.uri;
  } catch (error) {
    console.error('学習セッション記録の保存に失敗しました:', error);
    throw new Error('学習記録の保存に失敗しました。もう一度お試しください。');
  }
}

/**
 * 今日の学習セッションを作成してPDSに保存
 *
 * @param agent - 認証済みのBskyAgentインスタンス
 * @param wordsLearned - 学習した単語数
 * @param timeSpent - 学習時間（秒）
 * @param achievement - 達成内容（オプション）
 * @returns 作成されたレコードのURI
 */
export async function shareTodaysSession(
  agent: BskyAgent,
  wordsLearned: number,
  timeSpent: number,
  achievement?: string
): Promise<string> {
  const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD

  return createLearningSession(agent, {
    date: today,
    wordsLearned,
    timeSpent,
    achievement,
    visibility: 'public',
  });
}

/**
 * 学習セッション記録を含む投稿テキストを生成
 *
 * @param wordsLearned - 学習した単語数
 * @param achievement - 達成内容（オプション）
 * @returns Bluesky投稿用テキスト
 */
export function generateSessionPostText(
  wordsLearned: number,
  achievement?: string
): string {
  let text = `今日は${wordsLearned}個の単語を学習しました！`;

  if (achievement) {
    text += `\n${achievement}`;
  }

  text += '\n\n#英語学習 #くもたん';

  return text;
}

/**
 * Bluesky投稿用のfacets（リッチテキスト情報）を生成
 * ハッシュタグを検出してfacetsを作成
 *
 * @param text - 投稿テキスト
 * @returns facets配列
 */
export function generateFacets(text: string): Array<{
  index: { byteStart: number; byteEnd: number };
  features: Array<{ $type: string; tag: string }>;
}> {
  const facets: Array<{
    index: { byteStart: number; byteEnd: number };
    features: Array<{ $type: string; tag: string }>;
  }> = [];

  // ハッシュタグを検出する正規表現
  const hashtagRegex = /#[\p{L}\p{N}_]+/gu;
  let match;

  // テキストをUTF-8バイト配列に変換（Blueskyはバイト位置を使用）
  const encoder = new TextEncoder();

  while ((match = hashtagRegex.exec(text)) !== null) {
    const hashtag = match[0];
    const tag = hashtag.slice(1); // #を除去

    // バイト位置を計算
    const beforeText = text.slice(0, match.index);
    const beforeBytes = encoder.encode(beforeText);
    const hashtagBytes = encoder.encode(hashtag);

    const byteStart = beforeBytes.length;
    const byteEnd = byteStart + hashtagBytes.length;

    facets.push({
      index: { byteStart, byteEnd },
      features: [{ $type: 'app.bsky.richtext.facet#tag', tag }],
    });
  }

  return facets;
}

/**
 * 学習記録をBlueskyに投稿（テキスト投稿のみ）
 *
 * @param agent - 認証済みのBskyAgentインスタンス
 * @param wordsLearned - 学習した単語数
 * @param achievement - 達成内容（オプション）
 * @returns 投稿のURI
 */
export async function shareToBlueskyTimeline(
  agent: BskyAgent,
  wordsLearned: number,
  achievement?: string
): Promise<string> {
  // Check for session DID (standard auth) or sessionManager DID (OAuth)
  const did = agent.session?.did || (agent as any).sessionManager?.did;
  if (!did) {
    throw new Error('認証が必要です。ログインしてください。');
  }

  const text = generateSessionPostText(wordsLearned, achievement);

  try {
    const response = await agent.api.app.bsky.feed.post.create(
      { repo: did },
      {
        text,
        createdAt: new Date().toISOString(),
      }
    );

    return response.uri;
  } catch (error) {
    console.error('Blueskyへの投稿に失敗しました:', error);
    throw new Error('Blueskyへの投稿に失敗しました。もう一度お試しください。');
  }
}

/**
 * 画像をBlueskyにアップロード
 *
 * @param agent - 認証済みのBskyAgentインスタンス
 * @param base64Data - 画像のbase64データ（data:image/...;base64,プレフィックスなし）
 * @param mimeType - 画像のMIMEタイプ（デフォルト: image/jpeg）
 * @returns アップロードされた画像のblobデータ
 */
export async function uploadImageToBluesky(
  agent: BskyAgent,
  base64Data: string,
  mimeType: string = 'image/jpeg'
): Promise<{ blob: { $type: string; ref: { $link: string }; mimeType: string; size: number } }> {
  // Check for session DID (standard auth) or sessionManager DID (OAuth)
  const did = agent.session?.did || (agent as any).sessionManager?.did;
  if (!did) {
    throw new Error('認証が必要です。ログインしてください。');
  }

  try {
    // Convert base64 to Uint8Array using Buffer
    const uint8Array = new Uint8Array(Buffer.from(base64Data, 'base64'));

    console.log('[Upload] Image data:', {
      base64Length: base64Data.length,
      base64Prefix: base64Data.substring(0, 30),
      uint8ArrayLength: uint8Array.length,
      mimeType,
    });

    // Upload to Bluesky
    const uploadResponse = await agent.uploadBlob(uint8Array, {
      encoding: mimeType,
    });

    console.log('[Upload] Upload response:', {
      mimeType: uploadResponse.data.blob.mimeType,
      size: uploadResponse.data.blob.size,
    });

    return {
      blob: {
        $type: 'blob',
        ref: uploadResponse.data.blob.ref,
        mimeType: uploadResponse.data.blob.mimeType,
        size: uploadResponse.data.blob.size,
      },
    };
  } catch (error) {
    console.error('画像のアップロードに失敗しました:', error);
    throw new Error('画像のアップロードに失敗しました。もう一度お試しください。');
  }
}

/**
 * 学習記録を画像付きでBlueskyに投稿
 *
 * @param agent - 認証済みのBskyAgentインスタンス
 * @param wordsLearned - 学習した単語数
 * @param imageBase64 - シェアカード画像のbase64データ
 * @param aspectRatio - 画像のアスペクト比 {width: number, height: number}
 * @param achievement - 達成内容（オプション）
 * @returns 投稿のURI
 */
export async function shareToBlueskyWithImage(
  agent: BskyAgent,
  wordsLearned: number,
  imageBase64: string,
  aspectRatio: { width: number; height: number },
  achievement?: string
): Promise<string> {
  // Check for session DID (standard auth) or sessionManager DID (OAuth)
  const did = agent.session?.did || (agent as any).sessionManager?.did;
  if (!did) {
    throw new Error('認証が必要です。ログインしてください。');
  }

  const text = generateSessionPostText(wordsLearned, achievement);
  const facets = generateFacets(text);

  try {
    // Upload image first
    const uploadedImage = await uploadImageToBluesky(agent, imageBase64);

    console.log('[Share] Image aspect ratio:', {
      width: aspectRatio.width,
      height: aspectRatio.height,
      ratio: aspectRatio.width / aspectRatio.height,
    });

    const response = await agent.api.app.bsky.feed.post.create(
      { repo: did },
      {
        text,
        facets,
        embed: {
          $type: 'app.bsky.embed.images',
          images: [
            {
              alt: `${wordsLearned}個の単語を学習しました`,
              image: uploadedImage.blob,
              aspectRatio: {
                width: aspectRatio.width,
                height: aspectRatio.height,
              },
            },
          ],
        },
        createdAt: new Date().toISOString(),
      }
    );

    return response.uri;
  } catch (error) {
    console.error('Blueskyへの画像付き投稿に失敗しました:', error);
    throw new Error('Blueskyへの投稿に失敗しました。もう一度お試しください。');
  }
}
