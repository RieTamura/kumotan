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

## 7. Phase 3: タブ UI 改善とタブ並び替え機能

### 7.1. カスタムフィードタブへの × ボタン追加

**ファイル**: `src/components/IndexTabs.tsx`, `src/screens/HomeScreen.tsx`

カスタムフィードタブの右端に × ボタンを表示し、タップでフィード選択を解除（タブを非表示に）できるようにする。

#### TabConfig の拡張

```typescript
export interface TabConfig {
  key: string;
  label?: string;
  renderContent?: (isActive: boolean) => React.ReactNode;
  /** 提供された場合、タブ内に × ボタンを表示しタップ時に呼び出す */
  onRemove?: () => void;
  rowBreak?: boolean;
}
```

#### HomeScreen での設定

```typescript
const customFeedTab: TabConfig = {
  key: 'customFeed',
  label: selectedFeedDisplayName,
  onRemove: () => selectFeed(null, null), // フィード選択を解除
};
```

---

### 7.2. フォルダタブ風の重なりスタイル（階段状タブ）

**ファイル**: `src/components/IndexTabs.tsx`

タブが左側ほど前面に重なるフォルダインデックス風のビジュアルを実現する。

#### 実装詳細

- **margin**: 各タブに `marginRight: -10` を付与し、右タブが左タブに潜り込む
- **z-index**: 非アクティブタブは `tabs.length - globalIndex`（左ほど大きい値 = 前面）
- **アクティブタブ**: `tabs.length + 2` で常に最前面
- **高さ**: アクティブ時 `TAB_HEIGHT_ACTIVE = 44px`、非アクティブ時 `TAB_HEIGHT = 36px`（2段階）

```typescript
// zIndex 計算
zIndex: isActive ? tabs.length + 2 : tabs.length - globalIndex

// marginRight（最後のタブ以外に適用）
tabWithMargin: { marginRight: -10 }
```

---

### 7.3. 設定画面でのタブ並び替え機能

**新規ファイル**: `src/store/tabOrderStore.ts`

**変更ファイル**: `src/screens/HomeScreen.tsx`, `src/screens/SettingsScreen.tsx`

ユーザーがホーム画面のタブ順（Following / カスタムフィード / プロフィール）を設定画面で変更できるようにする。

#### tabOrderStore.ts

```typescript
export type HomeTabKey = 'following' | 'customFeed' | 'profile';
export const DEFAULT_TAB_ORDER: HomeTabKey[] = ['following', 'customFeed', 'profile'];

interface TabOrderState {
  tabOrder: HomeTabKey[];
  moveTab: (fromIndex: number, toIndex: number) => void;
}

export const useTabOrderStore = create<TabOrderState>()(
  persist(/* Zustand + AsyncStorage */)
);
```

#### HomeScreen での tabOrder 活用

```typescript
const { tabOrder } = useTabOrderStore();

const tabs = useMemo(() => {
  const allTabs: Partial<Record<HomeTabKey, TabConfig>> = { /* ... */ };
  return tabOrder
    .map(key => allTabs[key])
    .filter((t): t is TabConfig => t !== undefined);
}, [tabOrder, /* ... */]);

// タブ順変化時に PagerView を再マウント
<PagerView key={tabs.map(t => t.key).join('-')} ... >
```

#### 設定画面の UI（↑↓ アイコンボタン）

```
────────────────────────────
タブの並び替え
────────────────────────────
Following             [↑] [↓]
Now Playing           [↑] [↓]
プロフィール          [↑] [↓]
────────────────────────────
```

- ↑↓ボタンは32×32pxの角丸ボーダーボックス内に `ChevronUp` / `ChevronDown` アイコン（lucide-react-native）
- 先頭の↑ボタン・末尾の↓ボタンは無効化（opacity: 0.3）
- customFeedタブはフィード未設定時も並び替え対象（表示位置のみ制御）

---

### 7.4. プロフィールタブの右端半クリップ表示

**ファイル**: `src/components/IndexTabs.tsx`, `src/screens/HomeScreen.tsx`

プロフィール（アバター）タブをタブエリアの右端で半分クリップし、存在を示唆するビジュアルにする。

#### TabConfig への `clipAtEdge` 追加

```typescript
export interface TabConfig {
  // ... 既存フィールド ...
  /** When true, the tab is clipped at the right edge of the container (half-visible). */
  clipAtEdge?: boolean;
}
```

#### クリップ量の定数化

マジックナンバーを避け、実際のタブ寸法から導出する。

```typescript
// AVATAR_SIZE(24) + paddingHorizontal*2(8*2) + borderWidth*2(1*2) = 42px → 半分 = 21px
const AVATAR_TAB_CLIP = Math.round((AVATAR_SIZE + Spacing.sm * 2 + 2) / 2);
```

`AVATAR_SIZE` や `Spacing.sm` の変更に自動追従する。

#### 仕組み

```
[headerTabsContainer (flex:1, overflow:hidden)] | [headerRight (Bell)]
                                               ↑ここでクリップ
[Following][Latest From Follows ×][avatar → -21px →|← clipped]
```

- `clipAtEdge: true` のタブに `marginRight: -AVATAR_TAB_CLIP` を適用して右に押し出す
- `headerTabsContainer` の `overflow: 'hidden'` がクリップ境界を担う（スクリーン端の暗黙依存を排除）
- タブ順序変更があっても `clipAtEdge` フラグで対象タブを明示するため影響を受けない

#### HomeScreen への適用

```typescript
profile: {
  key: 'profile',
  clipAtEdge: true,
  renderContent: (isActive) => <AvatarTabIcon ... />,
},
```

```typescript
headerTabsContainer: {
  flex: 1,
  overflow: 'hidden',
},
```

---

### Phase 3 実装上の決定事項

| 項目 | 決定内容 |
| --- | --- |
| タブ型定義の共有 | `HomeTabKey` を `tabOrderStore.ts` に移動し、HomeScreen と SettingsScreen が共通 import |
| PagerView 再マウント | `key={tabs.length}` → `key={tabs.map(t => t.key).join('-')}` に変更（順序変化も検知） |
| 並び替え UI の選定 | ドラッグ方式（実装コスト高・保守性低）を却下し、↑↓ ボタン方式（Option B）を採用 |
| フィード未設定時の customFeed 行 | 設定画面の並び替えリストには常に表示。フィード未設定の場合は「表示しない」として説明 |

---

## 8. 考慮事項

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

- [x] **[IndexTabs]** `TabConfig` 型を定義し、Props を汎用化
- [x] **[IndexTabs]** タブ数可変に対応（`tabs.map()` による動的レンダリング）
- [x] **[Component]** `FollowingFeedTab.tsx` を新規作成（HomeScreenからFlatList描画ロジックを移動）
- [x] **[HomeScreen]** `scrollOffsets` レコードでスクロールオフセットを管理
- [x] **[HomeScreen]** `tabs: TabConfig[]` の宣言的管理、`getListRef()`でrefを汎用参照
- [ ] **[Test]** 既存の Following・プロフィールタブが正常動作することを確認

### Phase 2: カスタムフィード実装

- [x] **[API]** `getCustomFeed` を `feed.ts` に追加
- [x] **[API]** `getSavedFeeds` を `feed.ts` に追加
- [x] **[Hook]** `useCustomFeed.ts` を作成
- [x] **[Store]** `customFeedStore.ts` を作成（Zustand persistで選択フィードを永続化）
- [x] **[Hook]** `useCustomFeedSettings.ts` を作成
- [x] **[Settings]** 設定画面にカスタムフィード選択 UI を追加
- [x] **[Component]** `CustomFeedTab.tsx` を新規作成
- [x] **[HomeScreen]** カスタムフィードタブを条件付きで追加
- [x] **[i18n]** 多言語ファイルに翻訳キーを追加
- [x] **[Bugfix]** PagerViewへの`null`子要素渡しによるクラッシュを修正（array + filter + `key={tabs.length}`）
- [x] **[Test]** フィード未設定・設定済み・削除済みフィードの各ケースを動作確認済み

### Phase 2 補足: 実装上の決定事項

| 項目 | 決定内容 |
| --- | --- |
| 設定の永続化 | AsyncStorage の直接操作ではなく Zustand `persist` ミドルウェアで管理（`customFeedStore.ts`） |
| PagerView children | `{condition && <View>}` は `null` を渡してクラッシュするため、array + `.filter(null)` + `key={tabs.length}` の組み合わせで解決 |
| タブ数変化時の挙動 | `key={tabs.length}` により PagerView を強制 remount。フィード追加・削除時はページ 0（Following）に戻る |
| フィード削除時のフォールバック | `selectedFeedUri` が null になったとき `activeTab === 'customFeed'` であれば `useEffect` で自動的に Following タブへリセット |

### Phase 3: タブ UI 改善とタブ並び替え機能

- [x] **[IndexTabs]** `TabConfig` に `onRemove` を追加し、カスタムフィードタブに × ボタンを表示
- [x] **[IndexTabs]** `TabConfig` に `rowBreak` を追加（将来の2行レイアウト用、現在は未使用）
- [x] **[IndexTabs]** タブ重なり（staircase）スタイル：`marginRight: -10` + 左優先z-index
- [x] **[HomeScreen]** `onRemove: () => selectFeed(null, null)` でフィード選択解除
- [x] **[HomeScreen]** `PagerView key` を `tabs.map(t => t.key).join('-')` に変更（順序変化も検知）
- [x] **[Store]** `tabOrderStore.ts` を新規作成（`HomeTabKey` 型・`tabOrder`・`moveTab`）
- [x] **[HomeScreen]** `tabOrder` に基づき `tabs` を動的に並び替え
- [x] **[Settings]** タブ並び替えUIを追加（↑↓ アイコンボタン、32×32pxボーダーボックス）
- [x] **[i18n]** `tabOrder`, `tabFollowing`, `tabProfile`, `tabMoveUp`, `tabMoveDown` キーを追加
- [x] **[IndexTabs]** `TabConfig` に `clipAtEdge` を追加し、プロフィールタブを右端で半クリップ表示
- [x] **[HomeScreen]** `headerTabsContainer` に `overflow: 'hidden'` を追加（クリップ境界を明示化）
