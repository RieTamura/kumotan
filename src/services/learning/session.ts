/**
 * 学習セッション記録サービス
 * AT Protocolのカスタムレコード（io.kumotan.learning.session）を使用して
 * 学習記録をBluesky PDSに保存する
 */

import { BskyAgent } from '@atproto/api';
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
  if (!agent.session?.did) {
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
      repo: agent.session.did,
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
  if (!agent.session?.did) {
    throw new Error('認証が必要です。ログインしてください。');
  }

  const text = generateSessionPostText(wordsLearned, achievement);

  try {
    const response = await agent.api.app.bsky.feed.post.create(
      { repo: agent.session.did },
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
