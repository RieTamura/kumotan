# プロフィールタブ ユーザー投稿フィード表示 実装計画書

## 1. 目的
ホーム画面のアバタータブ（プロフィールタブ）内で、ユーザー自身が投稿したフィードをプロフィール情報の下に表示する。これにより、自分の投稿履歴を簡単に確認できるようになる。

## 2. 現状分析

### 既存実装
- **ProfileView** (`src/components/ProfileView.tsx`): プロフィール情報のみ表示（ScrollView）
- **feed.ts** (`src/services/bluesky/feed.ts`): `getTimeline` でFollowingフィード取得
- **PostCard** (`src/components/PostCard.tsx`): 投稿表示コンポーネント（再利用可能）

### Bluesky API
- `app.bsky.feed.getAuthorFeed`: 特定ユーザーの投稿を取得
- パラメータ:
  - `actor`: ユーザーのDIDまたはハンドル
  - `limit`: 取得件数
  - `cursor`: ページネーション用
  - `filter`: 投稿フィルター（`posts_no_replies`, `posts_with_media`, etc.）

## 3. 実装詳細

### 3.1. APIサービス追加
- **ファイル**: `src/services/bluesky/feed.ts`
- **追加関数**: `getAuthorFeed`
- **パラメータ**:
  ```typescript
  export async function getAuthorFeed(
    actor: string,
    limit?: number,
    cursor?: string,
    filter?: 'posts_no_replies' | 'posts_with_media' | 'posts_and_author_threads'
  ): Promise<Result<{ posts: TimelinePost[]; cursor?: string }, AppError>>
  ```

### 3.2. カスタムフック作成
- **ファイル**: `src/hooks/useAuthorFeed.ts`（新規）
- **機能**:
  - ユーザー投稿の取得・管理
  - 無限スクロール対応
  - リフレッシュ機能
  - ローディング・エラー状態管理

### 3.3. ProfileView拡張
- **ファイル**: `src/components/ProfileView.tsx`
- **変更内容**:
  - `ScrollView` → `FlatList` with `ListHeaderComponent`
  - プロフィール情報をヘッダーとして表示
  - フィード投稿を `PostCard` で表示
  - 無限スクロール対応
  - Pull-to-Refresh で両方（プロフィール＋フィード）更新

### 3.4. 多言語対応
- **ファイル**: `src/locales/ja/home.json`, `src/locales/en/home.json`
- **追加キー**:
  ```json
  {
    "profile": {
      "posts": "投稿",
      "noPosts": "まだ投稿がありません",
      "loadingPosts": "投稿を読み込み中..."
    }
  }
  ```

## 4. UIデザイン

### レイアウト
```
┌─────────────────────────────────┐
│  バナー画像                      │
│  ┌──┐                           │
│  │●│ Display Name              │
│  └──┘ @handle                   │
│  Bio description...             │
│  Following: X  Followers: X     │
├─────────────────────────────────┤
│  ─────── 投稿 ───────           │
├─────────────────────────────────┤
│  ┌─────────────────────────────┐│
│  │ PostCard (自分の投稿)        ││
│  └─────────────────────────────┘│
│  ┌─────────────────────────────┐│
│  │ PostCard (自分の投稿)        ││
│  └─────────────────────────────┘│
│         ... (無限スクロール)     │
└─────────────────────────────────┘
```

### スタイリング
- プロフィールとフィードの間にセパレーター
- セパレーターに「投稿」ラベル表示
- 既存のPostCardスタイルを維持

## 5. 実装ステップ

1. [x] **[API]** `feed.ts` に `getAuthorFeed` 関数を追加
2. [ ] **[Hook]** `useAuthorFeed.ts` カスタムフックを作成
3. [ ] **[i18n]** 多言語ファイルに翻訳キーを追加
4. [ ] **[Component]** `ProfileView.tsx` を拡張してフィード表示を実装
5. [ ] **[Test]** 動作確認

## 6. 考慮事項

### パフォーマンス
- 初回表示時はプロフィールのみ表示し、フィードは遅延読み込み
- `PostCard` の `memo` 化は既に実装済み
- フィードデータのキャッシュ検討（将来対応）

### エラーハンドリング
- フィード取得失敗時もプロフィールは表示
- リトライ機能提供

### アクセシビリティ
- セパレーターにアクセシビリティラベル追加

## 7. 進捗状況

- [x] API追加 (`getAuthorFeed` in feed.ts)
- [x] カスタムフック作成 (`useAuthorFeed.ts`)
- [x] 多言語対応 (ja/en home.json)
- [x] ProfileView拡張 (FlatList + PostCard)
- [x] TypeScript型チェック通過
