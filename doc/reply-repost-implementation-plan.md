# 返信・リポスト・引用リポスト 実装計画書

## 1. 目的

タイムライン上の投稿に対して「返信」「リポスト」「引用リポスト」をアプリ内から行えるようにする。
現在は閲覧・いいねのみ可能だが、本機能によりBluesky公式アプリに近いソーシャルインタラクションを実現する。

## 2. スコープ

### Phase 1: 返信（Reply）
- PostCardの返信アイコンタップで`PostCreationModal`を返信モードで開く
- 返信先のヘッダー表示（`@handle への返信`）
- `createPost()`に`reply`パラメータ（root/parent URI+CID）を追加
- ThreadScreenからも返信可能

### Phase 2: 単純リポスト（Repost）
- PostCardのリポストアイコンタップでリポスト/解除のトグル
- `agent.repost()` / `agent.deleteRepost()` の呼び出し
- いいねと同じパターンのオプティミスティックUI

### Phase 3: 引用リポスト（Quote Post）
- リポストアイコンタップ時にアクションシート（「リポスト」「引用リポスト」の選択）
- `PostCreationModal`を引用モードで開く
- `embed`に`app.bsky.embed.record`として元投稿を埋め込み
- モーダル内に引用元プレビューカードを表示

## 3. 技術調査結果

### AT Protocol API の対応状況

- **返信（Reply）** — `agent.post()` の `reply` フィールド ✓
  - `reply: { root: { uri, cid }, parent: { uri, cid } }`
  - root = スレッドの最初の投稿、parent = 直接の返信先
- **リポスト（Repost）** — `agent.repost(uri, cid)` / `agent.deleteRepost(uri)` ✓
- **引用リポスト（Quote）** — `agent.post()` の `embed` に `app.bsky.embed.record` を指定 ✓
  - `embed: { $type: 'app.bsky.embed.record', record: { uri, cid } }`

### 既存実装の状況

| 項目 | 現状 |
|---|---|
| 返信アイコン（`MessageCircle`） | 表示のみ（`onPress`なし）。Threadgate制限アイコン対応済み |
| リポストアイコン（`Repeat2`） | 表示のみ（`onPress`なし） |
| いいね（`Heart`） | タップでオプティミスティックUI + API呼び出し。**リポストの実装テンプレートになる** |
| `PostCreationModal` | テキスト、画像、ハッシュタグ、返信設定、コンテンツラベルに対応済み |
| `createPost()` | `text`, `replySettings`, `embed`, `selfLabels` を受け取る。**replyパラメータは未対応** |
| `TimelinePost.viewer.repost` | 型定義済み（`PostViewer.repost?: string`）だがUIに未反映 |
| `PostEmbed.quoted` | 型定義済み。`renderQuotedEmbed()`で引用投稿の表示は実装済み |

## 4. Phase 1: 返信（Reply）実装詳細

### 4.1. 型定義の追加

`src/types/bluesky.ts` に返信先情報の型を追加:

```typescript
/**
 * Reply reference for creating reply posts
 */
export interface ReplyRef {
  root: { uri: string; cid: string };
  parent: { uri: string; cid: string };
}
```

### 4.2. feed.ts の変更

`createPost()` のシグネチャに `reply` パラメータを追加:

```typescript
export async function createPost(
  text: string,
  replySettings?: PostReplySettings,
  embed?: Record<string, unknown>,
  selfLabels?: string[],
  reply?: ReplyRef  // 追加
): Promise<Result<{ uri: string; cid: string }, AppError>>
```

`postRecord` 構築時に `reply` を含める:

```typescript
if (reply) {
  postRecord.reply = {
    root: { uri: reply.root.uri, cid: reply.root.cid },
    parent: { uri: reply.parent.uri, cid: reply.parent.cid },
  };
}
```

### 4.3. usePostCreation.ts の変更

Hook のパラメータに `replyTo` を追加:

```typescript
interface ReplyToInfo {
  uri: string;
  cid: string;
  author: { handle: string; displayName: string };
  text: string;
}

export function usePostCreation(
  initialText?: string,
  initialImages?: PostImageAttachment[],
  replyTo?: ReplyToInfo  // 追加
): UsePostCreationReturn
```

`submitPost()` で `replyTo` を `createPost()` に渡す:

```typescript
// Build reply reference
let replyRef: ReplyRef | undefined;
if (replyTo) {
  replyRef = {
    root: { uri: replyTo.uri, cid: replyTo.cid },
    parent: { uri: replyTo.uri, cid: replyTo.cid },
  };
}

const result = await createPost(
  postText,
  isDefaultSettings ? undefined : settings,
  embed,
  labelsToSend,
  replyRef,
);
```

> **Note**: 単一投稿への返信では `root` と `parent` は同じ値になる。スレッド内の返信に対する返信（ネスト返信）はスコープ外とし、Phase 1 では直接の投稿への返信のみ対応する。将来的にスレッド内返信をサポートする場合は、`root`（スレッドの最初の投稿）と`parent`（直接の返信先）を区別して渡す必要がある。

### 4.4. PostCreationModal.tsx の変更

**Props の拡張:**

```typescript
export function PostCreationModal({
  visible,
  onClose,
  onPostSuccess,
  initialText,
  initialImages,
  replyTo,  // 追加
}: {
  visible: boolean;
  onClose: () => void;
  onPostSuccess?: () => void;
  initialText?: string;
  initialImages?: PostImageAttachment[];
  replyTo?: ReplyToInfo;  // 追加
}): React.JSX.Element
```

**返信先ヘッダーの表示:**

テキスト入力の上に返信先情報を表示:

```
┌─────────────────────────────────────────┐
│  ✕  返信                      [投稿する] │
│─────────────────────────────────────────│
│  🔗 @handle への返信                     │
│  (元投稿テキスト1行プレビュー)            │
│─────────────────────────────────────────│
│  テキスト入力エリア                      │
│                                         │
└─────────────────────────────────────────┘
```

- ヘッダータイトルを「新規投稿」→「返信」に変更（`replyTo` が存在する場合）
- 返信先情報は `colors.backgroundSecondary` の背景カードで表示
- 元投稿テキストは `numberOfLines={2}` で省略表示

### 4.5. PostCard.tsx の変更

**Props の拡張:**

```typescript
interface PostCardProps {
  // ...既存props
  onReplyPress?: (post: TimelinePost) => void;  // 追加
}
```

**返信アイコンのタップハンドラ追加:**

```typescript
const handleReplyPress = useCallback(() => {
  if (!onReplyPress) return;
  // Threadgate 'disabled' の場合は返信不可
  if (post.replyRestriction === 'disabled') return;
  onReplyPress(post);
}, [onReplyPress, post]);
```

返信アイコン部分を `Pressable` でラップ:

```tsx
<Pressable
  style={styles.metric}
  onPress={handleReplyPress}
  disabled={post.replyRestriction === 'disabled' || !onReplyPress}
  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
>
  {/* 既存の MessageCircle / MessageCircleOff / MessageCircleDashed */}
  <Text ...>{post.replyCount ?? 0}</Text>
</Pressable>
```

### 4.6. HomeScreen.tsx の変更

返信ハンドラと返信モーダルの状態を追加:

```typescript
const [replyTarget, setReplyTarget] = useState<ReplyToInfo | null>(null);

const handleReplyPress = useCallback((post: TimelinePost) => {
  setReplyTarget({
    uri: post.uri,
    cid: post.cid,
    author: { handle: post.author.handle, displayName: post.author.displayName },
    text: post.text,
  });
  setIsPostModalVisible(true);
}, []);
```

`PostCreationModal` に `replyTo` を渡す:

```tsx
<PostCreationModal
  visible={isPostModalVisible}
  onClose={() => {
    setIsPostModalVisible(false);
    setReplyTarget(null);
  }}
  onPostSuccess={() => {
    setIsPostModalVisible(false);
    setReplyTarget(null);
    refresh();
  }}
  replyTo={replyTarget ?? undefined}
/>
```

`PostCard` に `onReplyPress` を渡す:

```tsx
<PostCard
  post={item}
  onReplyPress={handleReplyPress}
  // ...既存props
/>
```

### 4.7. ThreadScreen.tsx の変更

HomeScreen と同様に `replyTarget` state と `handleReplyPress` を追加し、`PostCreationModal` と `PostCard` に接続する。
ThreadScreen には現在 `PostCreationModal` がないため、import と JSX の追加が必要。

## 5. Phase 2: 単純リポスト（Repost）実装詳細

### 5.1. feed.ts にリポスト関数追加

`likePost()` / `unlikePost()` と同じパターンで実装:

```typescript
/**
 * Repost a post on Bluesky
 */
export async function repostPost(
  uri: string,
  cid: string
): Promise<Result<{ uri: string }, AppError>> {
  try {
    const agent = getAgent();
    if (!hasActiveSession()) {
      const refreshResult = await refreshSession();
      if (!refreshResult.success) {
        return { success: false, error: refreshResult.error };
      }
    }
    await rateLimiter.throttle();

    const response = await agent.repost(uri, cid);
    return { success: true, data: { uri: response.uri } };
  } catch (error: unknown) {
    return { success: false, error: mapToAppError(error, 'リポスト') };
  }
}

/**
 * Unrepost a post on Bluesky
 */
export async function unrepostPost(
  repostUri: string
): Promise<Result<boolean, AppError>> {
  try {
    const agent = getAgent();
    if (!hasActiveSession()) {
      const refreshResult = await refreshSession();
      if (!refreshResult.success) {
        return { success: false, error: refreshResult.error };
      }
    }
    await rateLimiter.throttle();

    await agent.deleteRepost(repostUri);
    return { success: true, data: true };
  } catch (error: unknown) {
    return { success: false, error: mapToAppError(error, 'リポスト解除') };
  }
}
```

### 5.2. PostCard.tsx の変更（リポストトグル）

いいねと同じオプティミスティックUIパターン:

```typescript
// State
const [isReposted, setIsReposted] = useState(!!post.viewer?.repost);
const [repostCount, setRepostCount] = useState(post.repostCount ?? 0);
const [isRepostLoading, setIsRepostLoading] = useState(false);

// Props に追加
onRepostPress?: (post: TimelinePost, isReposted: boolean) => void;
```

**アイコンの色変更:**
- リポスト済み: `colors.success`（緑）+ `fill`
- 未リポスト: `colors.textSecondary`（グレー）

### 5.3. HomeScreen.tsx / ThreadScreen.tsx にリポストハンドラ追加

いいねハンドラ（`handleLikePress`）と同じパターンで `handleRepostPress` を追加:

```typescript
const handleRepostPress = useCallback(async (post: TimelinePost, isReposted: boolean) => {
  if (isReposted) {
    await repostPost(post.uri, post.cid);
  } else {
    if (post.viewer?.repost) {
      await unrepostPost(post.viewer.repost);
    }
  }
}, []);
```

## 6. Phase 3: 引用リポスト（Quote Post）実装詳細

### 6.1. リポストアイコンのアクションシート化

Phase 2 の単純リポストトグルを拡張し、タップ時にアクションシートを表示:

```
┌─────────────────────────────┐
│  リポスト                    │
│  引用リポスト                │
│  ─────────────────────────  │
│  キャンセル                  │
```

- 既にリポスト済みの場合は「リポストを解除」を表示
- `replyRestriction === 'disabled'`（postgate で引用無効）の場合は「引用リポスト」を非表示

実装: iOS は `ActionSheetIOS`、Android は `Alert`（画像添付のソース選択と同じパターン）

### 6.2. PostCreationModal の引用モード

**Props の拡張:**

```typescript
quoteTo?: {
  uri: string;
  cid: string;
  author: { handle: string; displayName: string; avatar?: string };
  text: string;
};
```

**引用元プレビューの表示:**

テキスト入力の下（画像プレビューの上）に引用元カードを表示。
既存の `renderQuotedEmbed()` のスタイルを再利用:

```
┌─────────────────────────────────────────┐
│  ✕  新規投稿                  [投稿する] │
│─────────────────────────────────────────│
│  テキスト入力エリア                      │
│                                         │
│  ┌─────────────────────────────────┐    │
│  │ 🟢 DisplayName @handle         │    │
│  │ 元投稿テキスト（3行まで）       │    │
│  └─────────────────────────────────┘    │
│                                         │
└─────────────────────────────────────────┘
```

### 6.3. usePostCreation.ts の変更

```typescript
export function usePostCreation(
  initialText?: string,
  initialImages?: PostImageAttachment[],
  replyTo?: ReplyToInfo,
  quoteTo?: QuoteToInfo  // 追加
): UsePostCreationReturn
```

`submitPost()` で引用用 embed を組み立て:

```typescript
// Build quote embed
if (quoteTo) {
  embed = {
    $type: 'app.bsky.embed.record',
    record: {
      uri: quoteTo.uri,
      cid: quoteTo.cid,
    },
  };
}
```

> **Note**: 画像添付と引用リポストの同時使用（`app.bsky.embed.recordWithMedia`）は Phase 3 のスコープ外とする。引用モードでは画像添付ボタンを非表示にする。将来的に対応する場合は embed を `recordWithMedia` に切り替えるロジックが必要。

### 6.4. PostCard.tsx の Props 拡張

```typescript
interface PostCardProps {
  // ...既存props
  onReplyPress?: (post: TimelinePost) => void;
  onRepostPress?: (post: TimelinePost, isReposted: boolean) => void;
  onQuotePress?: (post: TimelinePost) => void;  // 追加
}
```

### 6.5. HomeScreen.tsx / ThreadScreen.tsx の変更

引用ハンドラと引用モーダルの状態を追加:

```typescript
const [quoteTarget, setQuoteTarget] = useState<QuoteToInfo | null>(null);

const handleQuotePress = useCallback((post: TimelinePost) => {
  setQuoteTarget({
    uri: post.uri,
    cid: post.cid,
    author: {
      handle: post.author.handle,
      displayName: post.author.displayName,
      avatar: post.author.avatar,
    },
    text: post.text,
  });
  setIsPostModalVisible(true);
}, []);
```

`PostCreationModal` に `quoteTo` を渡す。

## 7. 変更ファイル一覧

### Phase 1: 返信

| ファイル | 変更種別 | 概要 |
|---|---|---|
| `src/types/bluesky.ts` | 修正 | `ReplyRef` 型追加 |
| `src/services/bluesky/feed.ts` | 修正 | `createPost()` に `reply` パラメータ追加 |
| `src/hooks/usePostCreation.ts` | 修正 | `replyTo` パラメータ追加、`submitPost()` で reply 組み立て |
| `src/components/PostCreationModal.tsx` | 修正 | `replyTo` prop 追加、返信先ヘッダーUI、タイトル変更 |
| `src/components/PostCard.tsx` | 修正 | `onReplyPress` prop 追加、返信アイコンの `Pressable` 化 |
| `src/screens/HomeScreen.tsx` | 修正 | `replyTarget` state、`handleReplyPress`、PostCard/Modal 接続 |
| `src/screens/ThreadScreen.tsx` | 修正 | 同上 + `PostCreationModal` の import・JSX 追加 |
| `src/locales/ja/home.json` | 修正 | 返信関連の翻訳キー追加 |
| `src/locales/en/home.json` | 修正 | 同上（英語） |

### Phase 2: 単純リポスト

| ファイル | 変更種別 | 概要 |
|---|---|---|
| `src/services/bluesky/feed.ts` | 修正 | `repostPost()`, `unrepostPost()` 関数追加 |
| `src/components/PostCard.tsx` | 修正 | リポストのオプティミスティックUI（state, ハンドラ, アイコン色変更） |
| `src/screens/HomeScreen.tsx` | 修正 | `handleRepostPress` 追加 |
| `src/screens/ThreadScreen.tsx` | 修正 | 同上 |
| `src/locales/ja/home.json` | 修正 | リポスト関連の翻訳キー追加 |
| `src/locales/en/home.json` | 修正 | 同上（英語） |

### Phase 3: 引用リポスト

| ファイル | 変更種別 | 概要 |
|---|---|---|
| `src/components/PostCard.tsx` | 修正 | アクションシート化、`onQuotePress` prop 追加 |
| `src/hooks/usePostCreation.ts` | 修正 | `quoteTo` パラメータ追加、引用 embed 組み立て |
| `src/components/PostCreationModal.tsx` | 修正 | `quoteTo` prop 追加、引用元プレビューUI |
| `src/screens/HomeScreen.tsx` | 修正 | `quoteTarget` state、`handleQuotePress` 追加 |
| `src/screens/ThreadScreen.tsx` | 修正 | 同上 |
| `src/locales/ja/home.json` | 修正 | 引用リポスト関連の翻訳キー追加 |
| `src/locales/en/home.json` | 修正 | 同上（英語） |

## 8. 翻訳キー

### 追加する翻訳キー（ja/home.json）

```json
{
  "replyTitle": "返信",
  "replyTo": "@{{handle}} への返信",
  "repost": "リポスト",
  "unrepost": "リポストを解除",
  "quotePost": "引用リポスト",
  "repostActionTitle": "リポスト",
  "replyDisabled": "この投稿には返信できません",
  "quoteDisabled": "この投稿は引用できません"
}
```

### 追加する翻訳キー（en/home.json）

```json
{
  "replyTitle": "Reply",
  "replyTo": "Replying to @{{handle}}",
  "repost": "Repost",
  "unrepost": "Undo repost",
  "quotePost": "Quote post",
  "repostActionTitle": "Repost",
  "replyDisabled": "Replies are disabled for this post",
  "quoteDisabled": "Quoting is disabled for this post"
}
```

## 9. エラーハンドリング

| シナリオ | 対応 |
|---|---|
| 返信先投稿が削除されている | API エラーとしてキャッチし、トーストで通知 |
| リポスト API 失敗 | オプティミスティック UI をロールバック（いいねと同じパターン） |
| 引用先投稿が Postgate で引用禁止 | アクションシートに「引用リポスト」を非表示。UI で事前ブロック |
| Threadgate で返信不可 | 返信アイコンを `disabled` にし、タップ不可。`MessageCircleOff` アイコン表示で視覚的にも明示 |
| セッション期限切れ | 既存の `refreshSession()` フローに従う |

## 10. 設計判断

| 判断 | 選択 | 理由 |
|---|---|---|
| 返信の root/parent 解決 | Phase 1 では root = parent（直接返信のみ） | スレッド内ネスト返信は複雑度が高い。まずは直接返信で MVP を確認 |
| 返信モーダル vs 別画面 | 既存 `PostCreationModal` を拡張 | 既存パターンの再利用で実装コスト最小化。UX の一貫性維持 |
| リポストのUI | オプティミスティックUI（いいねと同パターン） | ユーザー体験として即時フィードバックが重要。既存実装パターンの再利用 |
| アクションシート | iOS: `ActionSheetIOS` / Android: `Alert` | 画像添付ソース選択と同じパターン。追加依存なし |
| 画像 + 引用の同時使用 | Phase 3 スコープ外 | `recordWithMedia` embed の組み立てが追加の複雑度。まずは単体機能として安定させる |
| リポスト済み表示色 | `colors.success`（緑） | Bluesky 公式アプリと同じ視覚的フィードバック |
| スレッド内返信（ネスト返信） | Phase 1 スコープ外 | root URI の解決に追加 API 呼び出しが必要。MVP では直接返信のみ |

## 11. テスト方針

- TypeScript 型チェック（`npx tsc --noEmit`）で型安全性を確認
- 手動テスト:
  - 返信: 投稿に返信 → Bluesky 公式アプリでスレッド表示を確認
  - リポスト: リポスト/解除 → カウント更新・色変更を確認
  - 引用: 引用投稿 → 公式アプリで引用元の埋め込み表示を確認
  - Threadgate `disabled` 投稿への返信が不可であることを確認
  - Postgate（引用禁止）投稿に対して引用オプションが非表示であることを確認

## 12. 実施順序

1. **Phase 1: 返信** — 既存モーダルの拡張のみ。最小変更で完結
2. **Phase 2: 単純リポスト** — いいねの実装パターンをコピー。Phase 1 と独立して実装可能
3. **Phase 3: 引用リポスト** — Phase 2 のアクションシート化 + PostCreationModal の引用モード追加。Phase 1・2 の完了が前提

## 13. 実装状況

### Phase 1: 返信 ✅ 完了 (2026-02-17)

- [x] `src/types/bluesky.ts`: `ReplyRef` 型追加
- [x] `src/services/bluesky/feed.ts`: `createPost()` に `reply` パラメータ追加
- [x] `src/hooks/usePostCreation.ts`: `ReplyToInfo` 型・`replyTo` パラメータ追加
- [x] `src/components/PostCreationModal.tsx`: `replyTo` prop・返信先ヘッダーUI追加
- [x] `src/components/PostCard.tsx`: `onReplyPress` prop・返信アイコン `Pressable` 化
- [x] `src/screens/HomeScreen.tsx`: `replyTarget` state・`handleReplyPress` ハンドラ追加
- [x] `src/screens/ThreadScreen.tsx`: 同上 + `PostCreationModal` の import・JSX 追加
- [x] `src/locales/ja/home.json`, `src/locales/en/home.json`: 返信関連翻訳キー追加

### Phase 2: 単純リポスト ✅ 完了 (2026-02-17)

- [x] `src/services/bluesky/feed.ts`: `repostPost()`, `unrepostPost()` 関数追加
- [x] `src/components/PostCard.tsx`: リポストのオプティミスティックUI（state, ハンドラ, アイコン色変更）
- [x] `src/screens/HomeScreen.tsx`: `handleRepostPress` 追加
- [x] `src/screens/ThreadScreen.tsx`: 同上
- [x] `src/locales/ja/home.json`, `src/locales/en/home.json`: リポスト関連翻訳キー追加

### Phase 3: 引用リポスト ✅ 完了 (2026-02-17)

- [x] `src/components/PostCard.tsx`: アクションシート化、`onQuotePress` prop 追加
- [x] `src/hooks/usePostCreation.ts`: `QuoteToInfo` 型・`quoteTo` パラメータ追加、引用 embed 組み立て
- [x] `src/components/PostCreationModal.tsx`: `quoteTo` prop・引用元プレビューUI追加、引用モードで画像添付非表示
- [x] `src/screens/HomeScreen.tsx`: `quoteTarget` state・`handleQuotePress` 追加
- [x] `src/screens/ThreadScreen.tsx`: 同上
- [x] `src/locales/ja/home.json`, `src/locales/en/home.json`: 引用リポスト関連翻訳キー追加

### 追加対応 ✅ 完了 (2026-02-17)

- [x] PostCardのタップ競合修正。`metricButtonPressed` refで親Pressableのタップを抑制
- [x] `src/components/ProfileView.tsx`: プロフィールタブの投稿にも返信・リポスト・引用を接続
