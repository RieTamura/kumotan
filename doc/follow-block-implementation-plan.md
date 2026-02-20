# フォロー・ブロック機能実装計画

## 概要

アバタータップでフォロー / フォロー解除・ブロック / ブロック解除ができる機能を追加する。
実装前に `getTimeline` / `getAuthorFeed` の重複マッピングコードをリファクタリングする。

---

## 背景・課題

| 課題 | 内容 |
|---|---|
| コード重複 | `feed.ts` の `getTimeline` と `getAuthorFeed` に同一の投稿マッピングロジックが重複存在 |
| DID 欠落 | `TimelinePost.author` に `did` フィールドがなく、フォロー/ブロック API 呼び出し不可 |
| ビューア状態欠落 | `post.author.viewer.following` / `blocking` がマッピングされておらず初期状態不明 |

---

## 実装ステップ

### Step 0（本ファイル）: 計画書作成

### Step 1: `src/types/bluesky.ts` — 型拡張

```typescript
export interface AuthorViewer {
  following?: string; // フォローレコードの URI
  blocking?: string;  // ブロックレコードの URI
}

// TimelinePost.author に追加
author: {
  did: string;           // 追加
  handle: string;
  displayName: string;
  avatar?: string;
  viewer?: AuthorViewer; // 追加
};
```

### Step 2: `src/services/bluesky/feed.ts` — mapPostItem 抽出

- `extractPostEmbed` の後に private 関数 `mapPostItem(item: { post: any }): TimelinePost` を追加
- `getTimeline` と `getAuthorFeed` の `.map()` 本体を `response.data.feed.map(mapPostItem)` に置換
- `mapPostItem` 内で `item.post.author.did` と `item.post.author.viewer` をマッピング

### Step 3: `src/store/socialStore.ts` — 新規作成（Zustand）

セッション内のフォロー・ブロック状態を DID キーで管理する。

- `userStates: Record<string, { following?: string | null; blocking?: string | null }>`
  - `string` → レコード URI あり（関係が有効）
  - `null` → 明示的に解除済み
  - `undefined`（キーなし）→ 不明（`post.author.viewer` の値を使用）
- `setFollowing(did, uri | null)` / `setBlocking(did, uri | null)`
- ヘルパー: `resolveFollowState()` / `resolveBlockState()`

### Step 4: `src/services/bluesky/social.ts` — 新規作成

`likePost` / `unlikePost` と同一パターンで実装。

| 関数 | AT Protocol API |
|---|---|
| `followUser(did)` | `agent.follow(did)` |
| `unfollowUser(followUri)` | `agent.deleteFollow(followUri)` |
| `blockUser(did)` | `agent.app.bsky.graph.block.create(...)` |
| `unblockUser(blockUri)` | `agent.app.bsky.graph.block.delete(...)` |

`getCurrentDid()` を `auth.ts` からインポートして `blockUser` / `unblockUser` で使用。

### Step 5: `src/components/PostCard.tsx` — アバター UI

- Props 追加: `onFollowPress`, `onBlockPress`, `currentUserDid`
- `useSocialStore` でフォロー・ブロック状態を購読（クロスカード同期）
- `handleAvatarPress`: ActionSheetIOS (iOS) / Alert.alert (Android) でアクションシートを表示
- 自分の投稿 (`isOwnPost`) には表示しない
- アバター `<Image>` を `<Pressable>` でラップ

### Step 6: `src/screens/HomeScreen.tsx` — ハンドラー追加

- `handleFollowPress(did, shouldFollow, followUri)`: 楽観的更新 → API 呼び出し → 失敗時ロールバック
- `handleBlockPress(did, handle, shouldBlock, blockUri)`: ブロックは `ConfirmModal` 経由で確認
- `handleBlockConfirm()`: 確認後にブロック実行
- `ConfirmModal` を JSX に追加
- `renderPost` に `onFollowPress`, `onBlockPress`, `currentUserDid` を追加

### Step 7: i18n キー追加

`src/locales/ja/home.json` と `src/locales/en/home.json` の両方に追記:

| キー | JA | EN |
|---|---|---|
| `follow` | フォローする | Follow |
| `unfollow` | フォロー解除 | Unfollow |
| `block` | ブロックする | Block |
| `unblock` | ブロック解除 | Unblock |
| `userActionTitle` | @{{handle}}さんへのアクション | Actions for @{{handle}} |
| `blockConfirmTitle` | ブロックの確認 | Confirm Block |
| `blockConfirmMessage` | @{{handle}}さんをブロックしますか？ | Block @{{handle}}? |
| `blockConfirm` | ブロックする | Block |

---

## 変更ファイル一覧

| ファイル | 変更種別 |
|---|---|
| `src/types/bluesky.ts` | 型拡張 |
| `src/services/bluesky/feed.ts` | リファクタリング（mapPostItem 抽出） |
| `src/store/socialStore.ts` | 新規作成 |
| `src/services/bluesky/social.ts` | 新規作成 |
| `src/components/PostCard.tsx` | UI 追加（アバター Pressable・アクションシート） |
| `src/screens/HomeScreen.tsx` | ハンドラー追加・ConfirmModal |
| `src/locales/ja/home.json` | i18n キー追加 |
| `src/locales/en/home.json` | i18n キー追加 |

---

## 動作確認チェックリスト

- [ ] 他ユーザーのアバターをタップ → アクションシートが表示される
- [ ] 「フォローする」タップ → 即時 UI 更新 → 同一ユーザーの別ポストも反映される
- [ ] 「ブロックする」タップ → ConfirmModal が表示 → 「ブロックする」で実行
- [ ] 自分のアバターをタップ → アクションシートが表示されない
- [ ] フォロー済みユーザーのアバターをタップ → 「フォロー解除」が表示される
- [ ] ブロック済みユーザーのアバターをタップ → 「ブロック解除」が表示される
- [ ] API 失敗時に UI がロールバックされる
