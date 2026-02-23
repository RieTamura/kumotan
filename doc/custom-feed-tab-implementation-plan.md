# カスタムフィードタブ実装計画書

## 1. 目的

ホーム画面のインデックスタブにカスタムフィードタブを追加し、Bluesky のカスタムフィード（フィードジェネレーター）をホーム画面から直接閲覧できるようにする。

将来のタブ追加も見越し、実装は 2 フェーズに分けて行う。

- **Phase 1 - リファクタリング**: HomeScreen の分割と IndexTabs の汎用化
- **Phase 2 - カスタムフィード実装**: API・フック・設定 UI・タブ統合

---

## 2. 現状分析

### 現在のタブ構成

| タブ | コンポーネント | データソース |
|------|--------------|-------------|
| Following | HomeScreen 内の FlatList | `useBlueskyFeed` → `getTimeline()` |
| プロフィール | `ProfileView.tsx` | `useAuthorFeed` → `getAuthorFeed()` |

### 課題

- `TabType = 'following' | 'profile'` がハードコードされており、タブ追加のたびに `IndexTabs.tsx`・`HomeScreen.tsx` の両方を大きく改修する必要がある
- `HomeScreen.tsx` が 1,146 行と肥大化しており、Following フィードのロジックがコンポーネントに直接埋め込まれている
- PagerView のページ ref 管理・スクロールハンドラが HomeScreen に集中し、タブ追加ごとに増殖する構造になっている

---

## 3. Phase 1: リファクタリング

### 3.1. IndexTabs の汎用化

**ファイル**: `src/components/IndexTabs.tsx`

#### 変更内容

タブ定義を外部から注入できる汎用的な設計に変更する。

```typescript
// 変更前
interface IndexTabsProps {
  activeTab: 'following' | 'profile';
  onTabChange: (tab: 'following' | 'profile') => void;
  avatarUri?: string;
}

// 変更後
export interface TabConfig {
  key: string;
  label: string;
  renderIcon?: () => React.ReactNode; // アバター等のカスタムアイコン
}

interface IndexTabsProps {
  tabs: TabConfig[];
  activeTab: string;
  onTabChange: (key: string) => void;
}
```

#### 幅・アニメーションの動的計算

- タブ幅を `tabs.length` で均等割りするのではなく、ラベル長に応じた `minWidth` + `flex: 1` で自動伸縮
- アクティブインジケーターのオフセット計算を `tabs.findIndex()` ベースに変更
- アバターアイコンは `renderIcon` コールバックで対応（後方互換維持）

#### 外部に公開する型

```typescript
// src/components/IndexTabs.tsx から export
export type { TabConfig };
```

---

### 3.2. FollowingFeedTab コンポーネントの切り出し

**新規ファイル**: `src/components/FollowingFeedTab.tsx`

現在 HomeScreen に直接書かれている Following フィードのロジック・JSX を独立したコンポーネントに移動する。

#### Props 設計

```typescript
interface FollowingFeedTabProps {
  flatListRef: React.RefObject<FlatList<TimelinePost> | null>;
  onScroll: (event: NativeSyntheticEvent<NativeScrollEvent>) => void;
  onReplyPress: (post: TimelinePost) => void;
  onRepostPress: (post: TimelinePost, shouldRepost: boolean) => Promise<void>;
  onQuotePress: (post: TimelinePost) => void;
  onWordSelect?: (word: string, post: TimelinePost) => void;
}
```

#### コンポーネントが持つ責務

- `useBlueskyFeed` フックの呼び出し
- FlatList のレンダリング（`PostCard`・スケルトン・空状態・エラー表示）
- Pull-to-Refresh・無限スクロール

#### HomeScreen が引き続き持つ責務

- PagerView によるタブ間スワイプ制御
- スクロールトップ FAB の表示制御（各タブの scroll イベントを受け取る）
- 投稿作成 FAB
- 単語ポップアップ・リプライダイアログ等のモーダル管理
- いいね・リポスト等のアクションハンドラ（複数タブから呼ばれる共通処理）

---

### 3.3. HomeScreen のスリム化

**ファイル**: `src/screens/HomeScreen.tsx`

#### タブ定義の宣言的管理

```typescript
// Phase 1 時点のタブ定義（設定次第でカスタムフィードが追加される）
const tabs: TabConfig[] = [
  { key: 'following', label: t('home.tabs.following') },
  { key: 'profile', label: t('home.tabs.profile'), renderIcon: () => <Avatar uri={avatarUri} size={20} /> },
];
```

#### ref・ハンドラの整理

各タブの `flatListRef` と `onScroll` を配列やオブジェクトで管理し、タブ追加時に HomeScreen 本体を修正せずに済む構造にする。

```typescript
// before: 個別の ref
const flatListRef = useRef(...);
const profileFlatListRef = useRef(...);

// after: キーで管理
const flatListRefs = useRef<Record<string, React.RefObject<FlatList | null>>>({
  following: createRef(),
  profile: createRef(),
});
```

---

## 4. Phase 2: カスタムフィード実装

### 4.1. Bluesky API 層の追加

**ファイル**: `src/services/bluesky/feed.ts`

#### `getCustomFeed`

```typescript
export async function getCustomFeed(
  feedUri: string,
  limit: number = 50,
  cursor?: string
): Promise<Result<{ posts: TimelinePost[]; cursor?: string }, AppError>>
```

- `app.bsky.feed.getFeed({ feed: feedUri, limit, cursor })` を呼ぶ
- レスポンスを既存の `TimelinePost` 型にマッピング（`getTimeline` と同じ変換ロジック）
- 既存の `RateLimiter` を通す

#### `getSavedFeeds`

```typescript
export interface FeedInfo {
  uri: string;
  displayName: string;
  description?: string;
  avatarUrl?: string;
}

export async function getSavedFeeds(): Promise<Result<FeedInfo[], AppError>>
```

- `app.bsky.actor.getPreferences()` でピン留めフィードの URI 一覧を取得
- `app.bsky.feed.getFeedGenerators({ feeds: pinnedUris })` で表示名・説明を取得
- 2 回の API コールを順次実行し、1 つの `FeedInfo[]` にまとめて返す

---

### 4.2. カスタムフック

**新規ファイル**: `src/hooks/useCustomFeed.ts`

`useBlueskyFeed` と同じ State・メソッド構成で、`feedUri` を引数に取る。

```typescript
export function useCustomFeed(feedUri: string | null) {
  // feedUri が null の場合は何もしない
  // State: { posts, isLoading, isRefreshing, isLoadingMore, error, cursor, hasMore }
  // Methods: refresh(), loadMore(), clearError()
}
```

- `feedUri` が変わったら自動でリセット＆再取得
- マウント時に `feedUri` があれば自動フェッチ

---

### 4.3. カスタムフィード設定の永続化

**新規ファイル**: `src/hooks/useCustomFeedSettings.ts`

```typescript
export function useCustomFeedSettings() {
  // selectedFeedUri: string | null  (AsyncStorage から復元)
  // savedFeeds: FeedInfo[]          (Bluesky から取得)
  // isLoading: boolean
  // selectFeed(uri: string | null): Promise<void>
  // refreshSavedFeeds(): Promise<void>
}
```

- `AsyncStorage` のキー: `'customFeedUri'`
- アプリ起動時に保存済み URI を復元
- 設定画面からのみ変更可能

---

### 4.4. 設定画面の拡張

**ファイル**: `src/screens/SettingsScreen.tsx`

「フィード」セクションを追加する。

#### UI フロー

```
設定画面
└─ フィード
   └─ カスタムフィード: [Now Playing ▼]  ← 選択中のフィード名
         ↓ タップ
   ┌──────────────────────────────┐
   │ カスタムフィードを選択        │
   │                              │
   │ ○ Now Playing                │  ← ピン留め済みフィード一覧
   │ ○ Japanese Learning          │
   │ ○ Tech News                  │
   │ ○ 表示しない                  │
   └──────────────────────────────┘
```

- フィード一覧取得中はスケルトン表示
- 「表示しない」を選ぶとカスタムフィードタブが非表示になる
- 選択変更は即座にホーム画面へ反映

---

### 4.5. HomeScreen へのカスタムフィードタブ統合

**ファイル**: `src/screens/HomeScreen.tsx`

#### タブ定義への追加

```typescript
const customFeedTab: TabConfig | null = selectedFeedUri
  ? { key: 'customFeed', label: customFeedDisplayName }
  : null;

const tabs: TabConfig[] = [
  { key: 'following', label: t('home.tabs.following') },
  ...(customFeedTab ? [customFeedTab] : []),
  { key: 'profile', label: t('home.tabs.profile'), renderIcon: ... },
];
```

- カスタムフィードが未設定の場合はタブを非表示（2 タブ構成を維持）
- PagerView のページ数は `tabs.length` に連動

#### CustomFeedTab コンポーネント（新規）

`src/components/CustomFeedTab.tsx` — `FollowingFeedTab` と同じ Props 構成。内部で `useCustomFeed(feedUri)` を使用。

---

## 5. 多言語対応

**ファイル**: `src/locales/ja/home.json`, `src/locales/en/home.json`

```json
{
  "tabs": {
    "following": "Following",
    "profile": "プロフィール",
    "customFeed": "{{name}}"
  }
}
```

**ファイル**: `src/locales/ja/settings.json`, `src/locales/en/settings.json`

```json
{
  "feed": {
    "sectionTitle": "フィード",
    "customFeed": "カスタムフィード",
    "customFeedNone": "表示しない",
    "customFeedSelect": "カスタムフィードを選択",
    "customFeedLoading": "フィードを読み込み中..."
  }
}
```

---

## 6. UIデザイン

### ホーム画面（カスタムフィード設定済みの場合）

```
┌──────────────┬──────────────┬──────┐
│  Following   │  Now Playing │  ●  │
┴──────────────┴──────────────┴──────┴──
│                                      │
│    カスタムフィードの PostCard 一覧   │
│                                      │
```

### 設定画面

```
────────────────────────────────────
フィード
────────────────────────────────────
カスタムフィード          Now Playing >
────────────────────────────────────
```

---

## 7. 考慮事項

### フィード URI の不整合

- 保存済み URI のフィードをユーザーが Bluesky 側で削除した場合、`getCustomFeed` が 404 を返す
- エラー時はタブにエラー表示＋「設定から別のフィードを選択してください」のメッセージを表示
- 設定画面を開いたタイミングで URI の有効性を再確認する

### パフォーマンス

- `getSavedFeeds()` は設定画面を開いたときのみ呼び出す（ホーム画面では不要）
- カスタムフィードタブは表示されたときに初回フェッチ（遅延初期化）
- タブ切り替えでフェッチ済みデータは保持し、Pull-to-Refresh のみ再取得

### アクセシビリティ

- IndexTabs の各タブに `accessibilityRole="tab"` と `accessibilityState={{ selected }}` を維持
- タブ追加後もスクリーンリーダーでの操作性を確認

---

## 8. 実装ステップと進捗

### Phase 1: リファクタリング

- [ ] **[IndexTabs]** `TabConfig` 型を定義し、Props を汎用化
- [ ] **[IndexTabs]** 幅・アニメーションの動的計算に変更
- [ ] **[Component]** `FollowingFeedTab.tsx` を新規作成（HomeScreen からロジック移動）
- [ ] **[HomeScreen]** `flatListRefs` をオブジェクト管理に変更
- [ ] **[HomeScreen]** `tabs: TabConfig[]` の宣言的管理に変更
- [ ] **[Test]** 既存の Following・プロフィールタブが正常動作することを確認

### Phase 2: カスタムフィード実装

- [ ] **[API]** `getCustomFeed` を `feed.ts` に追加
- [ ] **[API]** `getSavedFeeds` を `feed.ts` に追加
- [ ] **[Hook]** `useCustomFeed.ts` を作成
- [ ] **[Hook]** `useCustomFeedSettings.ts` を作成
- [ ] **[Settings]** 設定画面にカスタムフィード選択 UI を追加
- [ ] **[Component]** `CustomFeedTab.tsx` を新規作成
- [ ] **[HomeScreen]** カスタムフィードタブを条件付きで追加
- [ ] **[i18n]** 多言語ファイルに翻訳キーを追加
- [ ] **[Test]** フィード未設定・設定済み・削除済みフィードの各ケースを確認
