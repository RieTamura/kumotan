# Bluesky投稿機能 実装計画書

## 1. 概要

| 項目 | 内容 |
|------|------|
| 機能 | HomeScreenからBlueskyにテキスト投稿 |
| UI形式 | ボトムシート（WordPopupと同じパターン） |
| トリガー | FAB（Floating Action Button）右下配置 |
| 対応機能 | テキスト入力 + ハッシュタグ選択 |

---

## 2. ファイル構成

### 新規作成ファイル

| ファイルパス | 役割 |
|-------------|------|
| `src/components/PostCreationModal.tsx` | 投稿作成ボトムシートUI |
| `src/hooks/usePostCreation.ts` | 投稿ロジック管理フック |

### 修正ファイル

| ファイルパス | 変更内容 |
|-------------|---------|
| `src/screens/HomeScreen.tsx` | FAB追加、ScrollToTop位置変更、モーダル統合 |
| `src/locales/ja/home.json` | 日本語翻訳追加 |
| `src/locales/en/home.json` | 英語翻訳追加 |

---

## 3. コンポーネント設計

### 3.1 PostCreationModal.tsx

**Props:**

```typescript
interface PostCreationModalProps {
  visible: boolean;
  onClose: () => void;
  onPostSuccess?: () => void;  // フィード更新用
}
```

**構造:**

```
PostCreationModal
├── Backdrop（タップで閉じる）
├── BottomSheet（Animated.View）
│   ├── Handle（ドラッグハンドル）
│   ├── Header
│   │   ├── Title「新規投稿」
│   │   └── CloseButton（X アイコン）
│   ├── Content
│   │   ├── TextInput（複数行、300文字制限）
│   │   ├── CharacterCounter「45/300」
│   │   └── HashtagSection
│   │       ├── SelectedHashtags（選択済みChips）
│   │       └── PresetHashtags（タップで追加）
│   └── ActionBar
│       ├── PostButton（primary）
│       └── CancelButton（outline）
```

**アニメーション**

- オープン： `Animated.spring` (damping: 20, stiffness: 150)
- クローズ： `Animated.timing` (duration: 200ms)
- 高さ： `SCREEN_HEIGHT * 0.6`

### 3.2 usePostCreation.ts

**状態:**

```typescript
interface PostCreationState {
  text: string;           // 投稿テキスト
  hashtags: string[];     // 選択済みハッシュタグ
  isPosting: boolean;     // 投稿中フラグ
  error: AppError | null; // エラー状態
}
```

**関数:**

| 関数名 | 説明 |
|--------|------|
| `setText(text)` | テキスト更新 |
| `addHashtag(tag)` | ハッシュタグ追加 |
| `removeHashtag(tag)` | ハッシュタグ削除 |
| `submitPost()` | 投稿実行（createPost呼び出し） |
| `reset()` | 状態リセット |

**バリデーション:**

- 空テキストは投稿不可
- 本文 + ハッシュタグ合計300文字以内

---

## 4. HomeScreen.tsx 変更詳細

### 4.1 ScrollToTopボタン位置変更

**変更前（右下）:**

```typescript
scrollToTopButton: {
  position: 'absolute',
  bottom: Spacing.xl,
  right: Spacing.lg,  // ← 右下
}
```

**変更後（左下）:**

```typescript
scrollToTopButton: {
  position: 'absolute',
  bottom: Spacing.xl,
  left: Spacing.lg,   // ← 左下に変更
}
```

### 4.2 FAB追加（右下）

```typescript
// State追加
const [isPostModalVisible, setIsPostModalVisible] = useState(false);

// JSX追加
<Pressable
  style={styles.fab}
  onPress={() => setIsPostModalVisible(true)}
  accessibilityLabel={t('createPost')}
>
  <Plus size={24} color={Colors.background} />
</Pressable>

// スタイル追加
fab: {
  position: 'absolute',
  bottom: Spacing.xl,
  right: Spacing.lg,
  width: 56,
  height: 56,
  borderRadius: 28,
  backgroundColor: Colors.primary,
  justifyContent: 'center',
  alignItems: 'center',
  ...Shadows.lg,
}
```

### 4.3 PostCreationModal統合

```typescript
<PostCreationModal
  visible={isPostModalVisible}
  onClose={() => setIsPostModalVisible(false)}
  onPostSuccess={() => {
    setIsPostModalVisible(false);
    refresh();  // フィード更新
  }}
/>
```

---

## 5. ハッシュタグ設定

### プリセットハッシュタグ

```typescript
const PRESET_HASHTAGS = ['英語学習', 'くもたん', 'Bluesky'];
```

### UI動作

- プリセットをタップ → 選択済みに追加
- 選択済みをタップ → 削除
- 選択済みは青色Chip表示

---

## 6. 翻訳キー

### 日本語 (`src/locales/ja/home.json`)

```json
{
  "createPost": "新規投稿",
  "postPlaceholder": "何を共有しますか？",
  "postButton": "投稿する",
  "postCancel": "キャンセル",
  "hashtags": "ハッシュタグ",
  "postSuccess": "投稿しました",
  "postError": "投稿に失敗しました"
}
```

### 英語 (`src/locales/en/home.json`)

```json
{
  "createPost": "New Post",
  "postPlaceholder": "What's on your mind?",
  "postButton": "Post",
  "postCancel": "Cancel",
  "hashtags": "Hashtags",
  "postSuccess": "Posted successfully",
  "postError": "Failed to post"
}
```

---

## 7. 実装手順

| Step | タスク | ファイル |
|------|--------|---------|
| 1 | 翻訳キー追加 | `locales/ja/home.json`, `locales/en/home.json` |
| 2 | usePostCreationフック作成 | `src/hooks/usePostCreation.ts` |
| 3 | PostCreationModal作成 | `src/components/PostCreationModal.tsx` |
| 4 | HomeScreen修正（ScrollToTop移動） | `src/screens/HomeScreen.tsx` |
| 5 | HomeScreen修正（FAB追加） | `src/screens/HomeScreen.tsx` |
| 6 | HomeScreen修正（Modal統合） | `src/screens/HomeScreen.tsx` |
| 7 | 動作確認・テスト | - |

---

## 8. 依存関係

### 既存利用（変更なし）

- `createPost()` from `src/services/bluesky/feed.ts`
- `Button` from `src/components/common/Button.tsx`
- `Colors`, `Spacing`, `FontSizes`, `BorderRadius`, `Shadows` from `src/constants/colors.ts`

### 新規import

- `Plus`, `X` from `lucide-react-native`

---

## 9. 検証方法

1. **FAB表示確認**: HomeScreen右下に+ボタンが表示される
2. **ScrollToTop確認**: 左下に移動し、正常に動作する
3. **モーダル開閉**: FABタップでボトムシート開く、背景タップで閉じる
4. **テキスト入力**: 300文字制限、文字数カウンター動作
5. **ハッシュタグ**: プリセット選択/削除が正常動作
6. **投稿実行**: 投稿成功 → トースト表示 → モーダル閉じる → フィード更新
7. **エラー処理**: ネットワークエラー時にエラーメッセージ表示

---

## 10. 画面レイアウト（イメージ）

```
┌─────────────────────────────┐
│  タイムライン        💡     │ ← ヘッダー
├─────────────────────────────┤
│                             │
│  [投稿1]                    │
│  [投稿2]                    │
│  [投稿3]                    │
│  ...                        │
│                             │
│ ⬆️                      ➕  │ ← 左下: ScrollToTop / 右下: FAB
└─────────────────────────────┘

ボトムシート（FABタップ時）:
┌─────────────────────────────┐
│         ━━━                 │ ← ハンドル
│  新規投稿              ✕    │ ← ヘッダー
├─────────────────────────────┤
│  ┌─────────────────────┐    │
│  │ 何を共有しますか？   │    │ ← TextInput
│  │                     │    │
│  └─────────────────────┘    │
│                    45/300   │ ← 文字数
│                             │
│  ハッシュタグ               │
│  [#英語学習] [#くもたん]    │ ← 選択済み
│  #Bluesky                   │ ← プリセット
│                             │
│  [    投稿する    ]         │ ← Primary Button
│  [   キャンセル   ]         │ ← Outline Button
└─────────────────────────────┘
```

---

## 11. 追加機能：ハッシュタグ自動抽出 ✅ 実装完了

### 11.1 概要

投稿テキストに直接入力されたハッシュタグ（例：`#テスト投稿`）を自動検出し、履歴に保存する機能。

### 11.2 変更ファイル

| ファイルパス                   | 変更内容                                       |
|-------------------------------|-----------------------------------------------|
| `src/hooks/usePostCreation.ts` | `submitPost`内でテキストからハッシュタグを抽出 |

### 11.3 実装詳細

**`extractHashtagsFromText`関数（新規追加）:**

```typescript
/**
 * Extract hashtags from text using regex
 * Supports Unicode characters (Japanese, English, etc.)
 */
const extractHashtagsFromText = useCallback((text: string): string[] => {
  const hashtagRegex = /#[\p{L}\p{N}_]+/gu;
  const matches = text.match(hashtagRegex);
  return matches?.map((tag) => tag.slice(1)) ?? [];
}, []);
```

**`submitPost`関数の変更:**

```typescript
const submitPost = useCallback(async (): Promise<boolean> => {
  // ... 既存コード ...

  const postText = buildPostText();
  const result = await createPost(postText);

  if (result.success) {
    // Extract hashtags from post text and combine with selected hashtags
    const extractedTags = extractHashtagsFromText(postText);
    const allTags = [...new Set([...state.hashtags, ...extractedTags])];

    if (allTags.length > 0) {
      await saveHashtagsToHistory(allTags);
    }

    setState(initialState);
    return true;
  }
  // ...
}, [isValid, state.isPosting, state.hashtags, buildPostText, extractHashtagsFromText, saveHashtagsToHistory]);
```

### 11.4 動作フロー

1. ユーザーがテキストに `#タグ名` を入力
2. 投稿ボタンを押す
3. 投稿成功後、テキストから `#` で始まる文字列を正規表現で抽出
4. 抽出したタグを履歴に保存（最大5件、重複排除）
5. 次回モーダル表示時に履歴として表示される

### 11.5 パフォーマンス

- 正規表現マッチは数ミリ秒以下
- 投稿時に1回のみ実行
- AsyncStorageは非同期なのでUIをブロックしない
- 投稿テキストは最大300文字なので負荷は無視できるレベル
