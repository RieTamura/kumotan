# 投稿への反応設定（Threadgate / Postgate）実装計画書

## 1. 目的
投稿作成時に「返信できるユーザー」と「引用の許可/不許可」を設定できる機能を追加する。
Bluesky公式アプリと同等のUXを提供し、ユーザーのプライバシーとコミュニケーション制御を向上させる。

## 2. スコープ

### Phase 1（今回実装）
- 返信制御: 誰でも / フォロワー / フォロー中の人 / メンションした人 / 返信不可
- 引用制御: 引用を許可 / 引用を禁止
- リストからの選択は**対象外**

## 3. 技術調査結果

### @atproto/api v0.13.35 の対応状況
- `app.bsky.feed.threadgate` — **完全サポート** ✓
  - `agent.app.bsky.feed.threadgate.create()` が利用可能
  - ルール型: `MentionRule`, `FollowerRule`, `FollowingRule`, `ListRule`
- `app.bsky.feed.postgate` — **完全サポート** ✓
  - `agent.app.bsky.feed.postgate.create()` が利用可能
  - ルール型: `DisableRule`（引用禁止）

### レコード構造

```typescript
// Threadgate Record
{
  post: string,           // AT-URI of the post
  allow?: Rule[],         // Empty array = no one can reply, undefined = anyone
  createdAt: string,
  hiddenReplies?: string[]
}

// Postgate Record
{
  post: string,           // AT-URI of the post
  createdAt: string,
  embeddingRules?: DisableRule[] // Empty/undefined = anyone can quote
}
```

## 4. 実装詳細

### 4.1. 型定義の追加

新規型（`src/services/bluesky/feed.ts` 内に定義）:

```typescript
// 返信許可ルールの種類
export type ThreadgateAllowRule =
  | 'mention'    // メンションされた人
  | 'follower'   // フォロワー
  | 'following'; // フォロー中の人

// 投稿の反応設定
export interface PostReplySettings {
  /** true = 誰でも返信可（デフォルト）, false = 選択ルールに従う */
  allowAll: boolean;
  /** allowAll=false のとき適用されるルール（空配列 = 返信不可） */
  allowRules: ThreadgateAllowRule[];
  /** 引用を許可するか（デフォルト: true） */
  allowQuote: boolean;
}

export const DEFAULT_REPLY_SETTINGS: PostReplySettings = {
  allowAll: true,
  allowRules: [],
  allowQuote: true,
};
```

### 4.2. feed.ts の変更

`createPost()` のシグネチャを拡張:

```typescript
export async function createPost(
  text: string,
  replySettings?: PostReplySettings
): Promise<Result<{ uri: string; cid: string }, AppError>>
```

投稿成功後に threadgate / postgate レコードを作成:

```typescript
// 投稿成功後
const response = await agent.post(postRecord);

// Threadgate: デフォルト（allowAll=true）でなければ作成
if (replySettings && !replySettings.allowAll) {
  const allow = replySettings.allowRules.map(rule => {
    switch (rule) {
      case 'mention':  return { $type: 'app.bsky.feed.threadgate#mentionRule' };
      case 'follower': return { $type: 'app.bsky.feed.threadgate#followerRule' };
      case 'following':return { $type: 'app.bsky.feed.threadgate#followingRule' };
    }
  });

  await agent.app.bsky.feed.threadgate.create(
    { repo: agent.session!.did, rkey: rkey },
    { post: response.uri, allow, createdAt: new Date().toISOString() }
  );
}

// Postgate: 引用禁止の場合のみ作成
if (replySettings && !replySettings.allowQuote) {
  await agent.app.bsky.feed.postgate.create(
    { repo: agent.session!.did, rkey: rkey },
    {
      post: response.uri,
      createdAt: new Date().toISOString(),
      embeddingRules: [{ $type: 'app.bsky.feed.postgate#disableRule' }],
    }
  );
}
```

**エラーハンドリング方針**: threadgate/postgate の作成失敗は投稿自体の成功を妨げない。失敗時はコンソールに警告ログを出力するのみ。

### 4.3. usePostCreation.ts の変更

状態に `replySettings` を追加:

```typescript
interface PostCreationState {
  text: string;
  hashtags: string[];
  isPosting: boolean;
  error: AppError | null;
  replySettings: PostReplySettings;  // 追加
}
```

返り値に以下を追加:
- `replySettings: PostReplySettings` — 現在の設定値
- `setReplySettings: (settings: PostReplySettings) => void` — 設定更新

`submitPost()` で `createPost(postText, state.replySettings)` を呼び出す。

### 4.4. ReplySettingsModal.tsx の新規作成

Bluesky公式アプリに近いUIを実装:

```
┌─────────────────────────────────┐
│  投稿への反応の設定          ✕  │
│─────────────────────────────────│
│  返信できるユーザー              │
│  ○ 誰でも     ○ 返信不可       │
│                                 │
│  □ フォロワー                   │
│  □ フォロー中の人               │
│  □ メンションした人             │
│─────────────────────────────────│
│  99 引用を許可           [ON]   │
│─────────────────────────────────│
│  これらはデフォルトの設定です    │
│        [  保存  ]               │
└─────────────────────────────────┘
```

**UI仕様**:
- 「誰でも」と「返信不可」はラジオボタン形式（排他）
- 「誰でも」以外を選択すると、フォロワー/フォロー中/メンションのチェックボックスが有効化
- 引用許可は独立した Switch コンポーネント
- BottomSheet風のモーダル（下からスライドアップ）

### 4.5. PostCreationModal.tsx の変更

フッターツールバーの左側に反応設定ボタンを追加:

```tsx
{/* Bottom Toolbar */}
<View style={styles.toolbar}>
  {/* Reply Settings Button */}
  <Pressable onPress={() => setShowReplySettings(true)}>
    <Text>🌐 {replySettingsLabel}</Text>
  </Pressable>

  <View style={styles.spacer} />
  {/* Character Counter (既存) */}
</View>
```

`replySettingsLabel` は現在の設定を簡潔に表示:
- 「誰でも反応可能」（デフォルト）
- 「フォロワーのみ」等

### 4.6. 翻訳キーの追加

**ja/home.json** に追加:
```json
{
  "replySettings": "投稿への反応の設定",
  "replySettingsReplyTo": "返信できるユーザー",
  "replySettingsEveryone": "誰でも",
  "replySettingsNoReply": "返信不可",
  "replySettingsFollowers": "フォロワー",
  "replySettingsFollowing": "フォロー中の人",
  "replySettingsMentioned": "メンションした人",
  "replySettingsAllowQuote": "引用を許可",
  "replySettingsDefault": "これらはデフォルトの設定です",
  "replySettingsSave": "保存",
  "replySettingsLabel": "誰でも反応可能",
  "replySettingsLabelNoReply": "返信不可",
  "replySettingsLabelCustom": "一部のユーザーが返信可能"
}
```

**en/home.json** に追加:
```json
{
  "replySettings": "Reply settings",
  "replySettingsReplyTo": "Who can reply",
  "replySettingsEveryone": "Everyone",
  "replySettingsNoReply": "No replies",
  "replySettingsFollowers": "Followers",
  "replySettingsFollowing": "People you follow",
  "replySettingsMentioned": "Mentioned users",
  "replySettingsAllowQuote": "Allow quotes",
  "replySettingsDefault": "These are the default settings",
  "replySettingsSave": "Save",
  "replySettingsLabel": "Everyone can reply",
  "replySettingsLabelNoReply": "Replies disabled",
  "replySettingsLabelCustom": "Some people can reply"
}
```

## 5. 変更ファイル一覧

| ファイル | 変更種別 | 概要 |
|---|---|---|
| `src/services/bluesky/feed.ts` | 修正 | 型定義追加、`createPost()` に threadgate/postgate 作成ロジック追加 |
| `src/hooks/usePostCreation.ts` | 修正 | `replySettings` 状態管理追加 |
| `src/components/ReplySettingsModal.tsx` | **新規** | 反応設定モーダルUI |
| `src/components/PostCreationModal.tsx` | 修正 | フッターに反応設定ボタン追加、ReplySettingsModal連携 |
| `src/locales/ja/home.json` | 修正 | 日本語翻訳キー追加 |
| `src/locales/en/home.json` | 修正 | 英語翻訳キー追加 |

## 6. エラーハンドリング

- **投稿成功 → threadgate作成失敗**: 投稿は成功扱い。設定が反映されなかった旨のログを出力。ユーザーへの通知は行わない（公式アプリと同様の挙動）。
- **投稿成功 → postgate作成失敗**: 同上。
- **セッション期限切れ**: 既存の `refreshSession()` フローに従う。

## 7. テスト方針

- TypeScript型チェック（`npx tsc --noEmit`）で型安全性を確認
- 手動テスト: 各返信設定パターンで投稿し、Bluesky公式アプリで反映を確認
