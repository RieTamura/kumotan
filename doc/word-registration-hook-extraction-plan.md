# 計画書: useWordRegistration カスタムフック抽出 & プロフィールタブへの機能追加

## 概要

HomeScreen に密結合している単語登録・文章モードのロジックを `useWordRegistration` カスタムフックに抽出し、プロフィールタブ（アバタータブ）の投稿フィードにも同機能を追加する。

## 目的

1. **機能追加**: プロフィールタブの投稿フィードで単語登録・文章モードを利用可能にする
2. **保守性向上**: 単語登録ロジックの一元管理により、将来の変更箇所を1箇所に集約
3. **拡張性確保**: 今後スレッド画面や検索結果画面にも同機能を容易に展開可能にする

## 現状分析

### 抽出対象のロジック（HomeScreen.tsx 内）

| 要素 | 行番号 | 内容 |
|------|--------|------|
| `WordPopupState` interface | L51-57 | ポップアップの状態型定義 |
| `initialWordPopupState` | L62-68 | 初期状態 |
| `wordPopup` state | L196 | `useState<WordPopupState>` |
| `handleWordSelect` | L212-223 | 単語選択ハンドラ |
| `handleSentenceSelect` | L228-239 | 文章選択ハンドラ |
| `closeWordPopup` | L244-252 | ポップアップを閉じる処理（遅延リセット含む） |
| `handleAddWord` | L257-285 | 単語追加処理（DB保存 + Alert表示） |
| `WordPopup` 描画 | L667-675 | コンポーネント配置 |

### 利用先の現状

| 画面 | 単語登録 | 文章モード | PostCard の該当props |
|------|---------|-----------|---------------------|
| HomeScreen (Following) | あり | あり | `onWordSelect`, `onSentenceSelect`, `clearSelection` |
| ProfileView | **なし** | **なし** | 未設定 |

---

## 実装計画

### Step 1: `useWordRegistration` フックの作成

**新規ファイル**: `src/hooks/useWordRegistration.ts`

#### フックが管理する状態・関数

```typescript
interface UseWordRegistrationReturn {
  // WordPopup の状態
  wordPopup: WordPopupState;

  // PostCard に渡すコールバック
  handleWordSelect: (word: string, postUri: string, postText: string) => void;
  handleSentenceSelect: (sentence: string, postUri: string, postText: string) => void;

  // WordPopup に渡すコールバック
  closeWordPopup: () => void;
  handleAddWord: (
    word: string,
    japanese: string | null,
    definition: string | null,
    postUri: string | null,
    postText: string | null
  ) => void;
}
```

#### 移動するロジック

HomeScreen.tsx から以下を移動:
- `WordPopupState` interface と `initialWordPopupState`
- `useState<WordPopupState>`
- `handleWordSelect` コールバック
- `handleSentenceSelect` コールバック
- `closeWordPopup` コールバック
- `handleAddWord` コールバック（`addWord` DB呼び出し + Alert表示）

#### 依存関係

- `addWord` (from `../services/database/words`)
- `useTranslation` (Alert メッセージ用の `t('wordAdded')` 等)

翻訳キーは `home` 名前空間のものを使用しているため、フック内でも同じ名前空間を参照する。

---

### Step 2: HomeScreen のリファクタリング

**変更ファイル**: `src/screens/HomeScreen.tsx`

#### 変更内容

1. `useWordRegistration` フックを import して使用
2. 以下を削除（フックに移動済み）:
   - `WordPopupState` interface
   - `initialWordPopupState`
   - `wordPopup` state
   - `handleWordSelect`
   - `handleSentenceSelect`
   - `closeWordPopup`
   - `handleAddWord`
   - `addWord` の import
3. `renderPost` 内の `PostCard` props はフックの戻り値を使用
4. `WordPopup` コンポーネントの props もフックの戻り値を使用

#### 変更前後の比較

```tsx
// Before (HomeScreen.tsx)
const [wordPopup, setWordPopup] = useState<WordPopupState>(initialWordPopupState);
const handleWordSelect = useCallback(...);
const handleSentenceSelect = useCallback(...);
const closeWordPopup = useCallback(...);
const handleAddWord = useCallback(...);

// After (HomeScreen.tsx)
const {
  wordPopup,
  handleWordSelect,
  handleSentenceSelect,
  closeWordPopup,
  handleAddWord,
} = useWordRegistration();
```

既存の動作に影響なし。`renderPost` 内の `clearSelection` ロジックも変わらない（`wordPopup` state は同じ型で返される）。

---

### Step 3: ProfileView への機能追加

**変更ファイル**: `src/components/ProfileView.tsx`

#### 変更内容

1. `useWordRegistration` フックを import して使用
2. `WordPopup` コンポーネントを import して配置
3. `renderPost` 内の `PostCard` に `onWordSelect`, `onSentenceSelect`, `clearSelection` を追加
4. FlatList の外側に `WordPopup` コンポーネントを配置

#### 変更箇所の詳細

```tsx
// ProfileView.tsx に追加

import { useWordRegistration } from '../hooks/useWordRegistration';
import { WordPopup } from './WordPopup';

// フック呼び出し
const {
  wordPopup,
  handleWordSelect,
  handleSentenceSelect,
  closeWordPopup,
  handleAddWord,
} = useWordRegistration();

// renderPost の変更
const renderPost = useCallback(
  ({ item }: { item: TimelinePost }) => {
    const shouldClearSelection =
      !wordPopup.visible && wordPopup.postUri === item.uri && wordPopup.postUri !== '';
    return (
      <PostCard
        post={item}
        onPostPress={handlePostPress}
        onLikePress={handleLikePress}
        onWordSelect={handleWordSelect}          // 追加
        onSentenceSelect={handleSentenceSelect}  // 追加
        clearSelection={shouldClearSelection}     // 追加
      />
    );
  },
  [handlePostPress, handleLikePress, handleWordSelect, handleSentenceSelect, wordPopup.visible, wordPopup.postUri]
);
```

#### レイアウト変更

現在の ProfileView は `FlatList` のみを返しているが、`WordPopup` を配置するために `View` でラップする必要がある。

```tsx
// Before
return (
  <FlatList ... />
);

// After
return (
  <View style={{ flex: 1 }}>
    <FlatList ... />
    <WordPopup
      visible={wordPopup.visible}
      word={wordPopup.word}
      isSentenceMode={wordPopup.isSentenceMode}
      postUri={wordPopup.postUri}
      postText={wordPopup.postText}
      onClose={closeWordPopup}
      onAddToWordList={handleAddWord}
    />
  </View>
);
```

---

## 対象外

- チュートリアル機能（`useTutorial`, `onLayoutElements`）はFollowingタブ専用のため、ProfileViewには追加しない
- PostCard の本アイコン（BookSearch）は既にPostCard内部に組み込まれており、`onSentenceSelect` を渡すだけで自動的に表示される

## 影響範囲

| ファイル | 変更種別 |
|---------|---------|
| `src/hooks/useWordRegistration.ts` | **新規作成** |
| `src/screens/HomeScreen.tsx` | リファクタリング（ロジック削減） |
| `src/components/ProfileView.tsx` | 機能追加 |

## リスク評価

| リスク | 影響度 | 対策 |
|--------|--------|------|
| HomeScreen の既存動作が壊れる | 中 | フック抽出後に動作確認。インターフェースは同一のため低リスク |
| ProfileView の `memo` とフックの相性 | 低 | `useWordRegistration` は内部 state のみ管理するため `memo` に影響しない |
| WordPopup の Modal が PagerView と干渉 | 低 | WordPopup は Modal 使用のため画面全体にオーバーレイされ、PagerView の影響を受けない |

## 工数見積もり

| ステップ | 工数 |
|---------|------|
| Step 1: フック作成 | 小（既存コードの移動） |
| Step 2: HomeScreen リファクタリング | 小（フック呼び出しに置換） |
| Step 3: ProfileView 機能追加 | 小（フック + WordPopup の配置） |
| 動作確認 | 小 |
| **合計** | **小〜中（半日以内）** |
