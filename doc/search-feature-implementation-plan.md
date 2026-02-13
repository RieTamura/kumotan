# 検索機能 実装計画書

## 1. 目的
アプリ内に検索機能を導入し、保存済み単語のキーワード検索とBluesky投稿の検索を可能にする。単語帳が大きくなるにつれて目的の単語を素早く見つけられるようにし、タイムライン外の投稿からも英単語を発見できるようにする。

## 2. 現状分析

### 既存の検索・フィルタ機能
- **単語一覧（WordListScreen）**: 既読/未読フィルタ、ソート（作成日/アルファベット順）のみ
- **タイムライン（HomeScreen）**: Following/プロフィールのタブ切替のみ
- **キーワードによるテキスト検索は未実装**

### 既存の活用可能な基盤
- SQLite (`expo-sqlite`) による単語データベース（`english`, `japanese`, `definition`, `postText` カラム）
- `WordFilter` 型と `wordStore` による状態管理パターン
- AT Protocol API (`@atproto/api`) によるBluesky連携
- `PostCard` コンポーネントによる投稿表示（単語タップ→保存のフロー）
- i18n対応済みの多言語基盤
- ダーク/ライトテーマ対応

---

## 3. 実装フェーズ

### Phase 1: 保存済み単語のキーワード検索
ユーザーが最も日常的に使う機能。既存画面の拡張で完結する。

### Phase 2: Bluesky投稿検索
新しい英単語との出会いを促進する機能。新規画面・サービスの追加が必要。

### Phase 3: ユーザー検索（将来対応）
ソーシャル機能の拡充。本計画書では概要のみ記載。

---

## 4. Phase 1: 保存済み単語の検索

### 4.1. 型定義の拡張
- **ファイル**: `src/types/word.ts`
- **変更内容**: `WordFilter` に `searchQuery` フィールドを追加
  ```typescript
  export interface WordFilter {
    isRead?: boolean | null;
    sortBy: 'created_at' | 'english';
    sortOrder: 'asc' | 'desc';
    limit?: number;
    offset?: number;
    searchQuery?: string;  // 追加
  }
  ```

### 4.2. データベースサービスの拡張
- **ファイル**: `src/services/database/words.ts`
- **変更内容**: `getWords` 関数の WHERE 句に LIKE 検索を追加
  ```typescript
  // searchQuery がある場合、english / japanese / definition / post_text を横断検索
  if (filter.searchQuery && filter.searchQuery.trim() !== '') {
    const searchTerm = `%${filter.searchQuery.trim()}%`;
    conditions.push(
      '(english LIKE ? OR japanese LIKE ? OR definition LIKE ? OR post_text LIKE ?)'
    );
    params.push(searchTerm, searchTerm, searchTerm, searchTerm);
  }
  ```

### 4.3. 検索バーコンポーネント（新規）
- **ファイル**: `src/components/common/SearchBar.tsx`
- **Props**:
  ```typescript
  interface SearchBarProps {
    value: string;
    onChangeText: (text: string) => void;
    onClear: () => void;
    placeholder?: string;
  }
  ```
- **デザイン**:
  ```
  ┌──────────────────────────────────────┐
  │ 🔍  検索...                      ✕  │
  └──────────────────────────────────────┘
  ```
- **特徴**:
  - `lucide-react-native` の `Search` / `X` アイコン使用
  - テーマ対応（`useTheme` フック利用）
  - フォーカス時のボーダーハイライト

### 4.4. WordListScreen への統合
- **ファイル**: `src/screens/WordListScreen.tsx`
- **変更内容**:
  - ヘッダーとフィルタの間に `SearchBar` を配置
  - ローカルステートに `searchQuery` を追加
  - デバウンス処理（300ms）で入力のたびにストアのフィルタを更新
  - 検索結果が0件の場合の空状態メッセージ
- **レイアウト**:
  ```
  ┌─────────────────────────────────────┐
  │  単語帳                         💡  │  ← ヘッダー（既存）
  ├─────────────────────────────────────┤
  │  🔍 検索...                      ✕  │  ← 検索バー（新規）
  ├─────────────────────────────────────┤
  │  新着順 ↓                           │  ← ソート表示（既存）
  ├─────────────────────────────────────┤
  │  [未読] [既読] [すべて]          ⇅  │  ← フィルタ（既存）
  ├─────────────────────────────────────┤
  │  ┌─────────────────────────────────┐│
  │  │ WordListItem                   ││  ← 検索結果
  │  └─────────────────────────────────┘│
  │  ┌─────────────────────────────────┐│
  │  │ WordListItem                   ││
  │  └─────────────────────────────────┘│
  └─────────────────────────────────────┘
  ```

### 4.5. 多言語対応
- **ファイル**: `src/locales/ja/wordList.json`, `src/locales/en/wordList.json`
- **追加キー**:
  ```json
  {
    "search": {
      "placeholder": "単語を検索...",
      "noResults": "一致する単語が見つかりません",
      "noResultsMessage": "別のキーワードで検索してください"
    }
  }
  ```
  ```json
  {
    "search": {
      "placeholder": "Search words...",
      "noResults": "No matching words found",
      "noResultsMessage": "Try a different keyword"
    }
  }
  ```

---

## 5. Phase 2: Bluesky投稿検索

### 5.1. APIサービス追加
- **ファイル**: `src/services/bluesky/search.ts`（新規）
- **関数**:
  ```typescript
  /**
   * Bluesky投稿を検索
   */
  export async function searchPosts(
    query: string,
    limit?: number,
    cursor?: string,
  ): Promise<Result<{ posts: TimelinePost[]; cursor?: string }, AppError>>

  /**
   * Blueskyユーザーを検索（Phase 3用に先行定義）
   */
  export async function searchActors(
    query: string,
    limit?: number,
    cursor?: string,
  ): Promise<Result<{ actors: BlueskyProfile[]; cursor?: string }, AppError>>
  ```
- **使用API**:
  - `app.bsky.feed.searchPosts` — 投稿のフルテキスト検索
  - `app.bsky.actor.searchActors` — ユーザー検索（Phase 3）
- **考慮事項**:
  - 既存の `RateLimiter` を共有して使用
  - 投稿のフォーマット変換は既存の `mapToTimelinePost` パターンを再利用

### 5.2. カスタムフック作成
- **ファイル**: `src/hooks/useSearchPosts.ts`（新規）
- **インターフェース**:
  ```typescript
  interface UseSearchPostsReturn {
    posts: TimelinePost[];
    isLoading: boolean;
    isLoadingMore: boolean;
    error: AppError | null;
    hasMore: boolean;
    search: (query: string) => Promise<void>;
    loadMore: () => Promise<void>;
    clear: () => void;
  }
  ```
- **特徴**:
  - デバウンス処理
  - 無限スクロール対応
  - ネットワーク状態チェック
  - 検索結果の重複除去

### 5.3. 検索画面（新規）
- **ファイル**: `src/screens/SearchScreen.tsx`（新規）
- **レイアウト**:
  ```
  ┌─────────────────────────────────────┐
  │  🔍 Blueskyを検索...            ✕   │  ← 検索バー
  ├─────────────────────────────────────┤
  │  おすすめタグ:                       │
  │  [#EnglishLearning] [#TOEIC]        │  ← プリセットタグ（検索前に表示）
  │  [#英語学習] [#vocabulary]           │
  ├─────────────────────────────────────┤
  │  ┌─────────────────────────────────┐│
  │  │ PostCard (検索結果)             ││  ← 既存PostCardを再利用
  │  └─────────────────────────────────┘│
  │  ┌─────────────────────────────────┐│
  │  │ PostCard (検索結果)             ││
  │  └─────────────────────────────────┘│
  │         ... (無限スクロール)         │
  └─────────────────────────────────────┘
  ```
- **機能**:
  - 検索結果を `PostCard` で表示（単語タップ→`WordPopup`→保存の既存フローを活用）
  - 英語学習に関連するプリセットハッシュタグのサジェスト
  - 検索履歴の表示（直近5件、AsyncStorageに保存）

### 5.4. ナビゲーション変更
- **ファイル**: `src/navigation/AppNavigator.tsx`
- **方式の選択肢**:

  **案A: ボトムタブに検索タブを追加**
  ```
  [ホーム] [単語帳] [🔍検索] [クイズ] [進捗] [設定]
  ```
  - タブ数が6になり、やや多い

  **案B: ホーム画面のヘッダーに検索アイコンを配置（推奨）**
  ```
  ┌───────────┐   ┌───┐        🔍  💡
  │ Following │   │ ● │
  ────┴───────────┴───┴──────────────────
  ```
  - 検索画面はスタックナビゲーションで表示
  - タブ数を維持しつつ、自然なアクセスポイントを提供
  - BlueskyやTwitterと同様のUXパターン

- **推奨**: 案B（ヘッダーに検索アイコン）
- **変更内容**:
  - `RootStackParamList` に `Search` ルートを追加
  - `HomeScreen` のヘッダーに検索アイコンを追加（`Search` lucideアイコン）
  - タップで `SearchScreen` にスタック遷移

### 5.5. 多言語対応
- **ファイル**: `src/locales/ja/search.json`（新規）, `src/locales/en/search.json`（新規）
- **キー例**:
  ```json
  {
    "header": "検索",
    "placeholder": "Blueskyを検索...",
    "suggestedTags": "おすすめタグ",
    "recentSearches": "最近の検索",
    "noResults": "投稿が見つかりません",
    "noResultsMessage": "別のキーワードで検索してください",
    "clearHistory": "履歴をクリア"
  }
  ```

---

## 6. Phase 3: ユーザー検索（将来対応）

概要のみ記載。Phase 2 完了後に詳細を策定する。

- `SearchScreen` にタブ切替を追加（投稿 / ユーザー）
- `searchActors` API を利用
- 検索結果からプロフィール画面に遷移
- `ProfileView` を再利用

---

## 7. 変更ファイル一覧

### Phase 1（単語検索）

| ファイル | 変更内容 |
|---------|---------|
| `src/types/word.ts` | `WordFilter` に `searchQuery` を追加 |
| `src/services/database/words.ts` | `getWords` に LIKE 検索を追加 |
| `src/components/common/SearchBar.tsx` | **新規** 検索バーコンポーネント |
| `src/screens/WordListScreen.tsx` | 検索バーの統合、デバウンス処理 |
| `src/locales/ja/wordList.json` | 検索関連の翻訳キー追加 |
| `src/locales/en/wordList.json` | 検索関連の翻訳キー追加 |

### Phase 2（投稿検索）

| ファイル | 変更内容 |
|---------|---------|
| `src/services/bluesky/search.ts` | **新規** 検索APIサービス |
| `src/hooks/useSearchPosts.ts` | **新規** 検索フック |
| `src/screens/SearchScreen.tsx` | **新規** 検索画面 |
| `src/navigation/AppNavigator.tsx` | `Search` ルート追加 |
| `src/screens/HomeScreen.tsx` | ヘッダーに検索アイコン追加 |
| `src/locales/ja/search.json` | **新規** 検索画面の翻訳 |
| `src/locales/en/search.json` | **新規** 検索画面の翻訳 |
| `src/locales/index.ts` | `search` 名前空間追加 |

---

## 8. 実装ステップ

### Phase 1 完了 (2026-02-13)

1. [x] **[Types]** `WordFilter` に `searchQuery` を追加
2. [x] **[Database]** `getWords` に LIKE 検索条件を追加（`english`前方一致 + `japanese`部分一致）
3. [x] ~~**[Component]** `SearchBar.tsx` コンポーネントを作成~~ → 不要。`TextInput`を直接配置
4. [x] **[Screen]** `WordListScreen.tsx` に検索バーを統合（デバウンス300ms、Loading制御改善）
5. [x] **[i18n]** 多言語対応の翻訳キー追加
6. [x] **[Test]** 動作確認（英語/日本語での検索、空文字、フィルタとの組み合わせ、チカチカ防止）

### Phase 2
1. [ ] **[API]** `search.ts` にBluesky検索サービスを作成
2. [ ] **[Hook]** `useSearchPosts.ts` カスタムフックを作成
3. [ ] **[Screen]** `SearchScreen.tsx` を作成
4. [ ] **[Navigation]** `AppNavigator.tsx` に検索ルートを追加
5. [ ] **[HomeScreen]** ヘッダーに検索アイコンを追加
6. [ ] **[i18n]** `search.json` を作成
7. [ ] **[Test]** 動作確認（検索、無限スクロール、単語保存フロー、オフライン時）

---

## 9. 考慮事項

### パフォーマンス
- 単語検索はデバウンス（300ms）で不要なクエリを防止
- SQLiteの LIKE 検索は単語数が数千件程度なら十分高速
- 将来的に単語数が大幅に増えた場合はFTS（Full-Text Search）を検討
- Bluesky検索は既存の `RateLimiter` で制御

### UX
- 検索バーは常に表示し、入力即時にフィルタリング（インクリメンタル検索）
- 検索クエリはフィルタ（既読/未読）やソートと組み合わせ可能
- 検索結果0件時は明確なメッセージとアクション提案を表示
- キーボードの「検索」ボタンで `returnKeyType="search"` を設定

### アクセシビリティ
- 検索バーに `accessibilityLabel` と `accessibilityHint` を設定
- 検索結果件数をスクリーンリーダーに通知
- クリアボタンに適切なラベルを付与

### セキュリティ
- SQLインジェクション防止: パラメータバインディング使用（既存パターンに準拠）
- 検索入力のサニタイズ（極端に長い文字列の制限）

---

## 10. 検証方法

### Phase 1
1. 英語単語での検索（部分一致）
2. 日本語訳での検索
3. 定義テキストでの検索
4. 投稿本文での検索
5. フィルタ（既読/未読）との併用
6. ソートとの併用
7. 検索クリア後の全件表示復帰
8. 0件結果の表示
9. ダーク/ライトモードでの表示確認
10. 日本語/英語UIでの表示確認

### Phase 2
1. キーワードでのBluesky投稿検索
2. ハッシュタグでの検索
3. 検索結果からの単語保存フロー
4. 無限スクロール
5. オフライン時のエラー表示
6. 検索履歴の保存と表示
7. レート制限超過時のハンドリング

---

---

## 11. 実装前評価（2026-02-13）

### Phase 1 評価

| 観点 | 評価 |
|------|------|
| 工数 | **小**（半日〜1日） |
| 新規ファイル数 | 0（既存 `Input` コンポーネントを再利用） |
| 既存コード変更量 | 少 |
| リスク | 低 |
| ユーザー価値 | 高（日常使用頻度が高い） |

#### 改善点

- `SearchBar.tsx`の新規作成は不要。既存`Input`コンポーネントが`leftIcon`/`rightIcon`をサポート済みのため再利用する。
- 検索対象カラム： 初期は`english`/`japanese`/`definition`の3カラムに絞る。`post_text`は長文ノイズが多いため、必要に応じて後から追加する。
- `wordStore.setFilter`が`Partial<WordFilter>`を受け取り自動で`loadWords()`を呼ぶ設計のため、検索クエリの反映はほぼゼロコストで接続可能。

### Phase 2評価

| 観点 | 評価 |
|------|------|
| 工数 | **中〜大**（2〜4日） |
| 新規ファイル数 | 4〜5 |
| 既存コード変更量 | 中 |
| リスク | 中（API依存・UX複雑性） |
| ユーザー価値 | 中（新規発見の促進） |

#### 要注意点
- `useSearchPosts` と `useBlueskyFeed` の重複リスク — 共通化の方針を先に決めるべき
- 検索履歴（AsyncStorage）の設計詳細が未定 — 実装時に設計判断が発生する
- `searchActors` の先行定義は YAGNI — Phase 3 着手時に追加する方が保守的
- プリセットタグのハードコード定義場所の決定が必要

#### 改善提案
- Phase 2 を 2a（検索API + 最小構成画面）/ 2b（検索履歴・プリセットタグ・UX改善）に分割
- ナビゲーション案B（ヘッダーアイコン）は妥当

### 実装方針
- **Phase 1 を先に実装・リリースし、ユーザーフィードバックを取得してから Phase 2 に着手する**
- Phase 1 は ROI が非常に高く、既存基盤の延長で完結する

---

**作成日**: 2026-02-06
**評価日**: 2026-02-13
**関連要件**: doc/requirements.md
