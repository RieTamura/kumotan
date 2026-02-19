# 英語定義の日本語訳表示 実装計画書

> **ステータス: 完了**

## 1. 目的

単語登録時にWordPopupで表示される英語定義（Free Dictionary API取得）をDeepLで日本語に翻訳し、英語定義の直下に表示する。また翻訳結果をローカルDB・PDSに保存することで、端末変更後も日本語訳を復元可能にする。

翻訳機能は設定画面のトグルでON/OFF切り替え可能にし、DeepLクォータ消費を抑えたいユーザーへの配慮を行う。

---

## 2. 変更ファイル一覧

| ファイル | 変更内容 |
|---------|---------|
| `lexicons/io/kumotan/vocabulary/word.json` | `definitionJa` プロパティ追加 |
| `src/types/word.ts` | `Word` / `CreateWordInput` に `definitionJa` 追加 |
| `src/constants/config.ts` | `DATABASE.VERSION` を 7 に更新 |
| `src/services/database/init.ts` | v7マイグレーション（`definition_ja` カラム追加） |
| `src/services/database/words.ts` | `rowToWord` / `insertWord` に `definition_ja` 対応 |
| `src/services/pds/vocabularySync.ts` | `buildPdsRecord` / `restoreWordsFromPds` に `definitionJa` 対応 |
| `src/store/settingsStore.ts` | **新規**：`translateDefinition` トグル設定ストア |
| `src/screens/SettingsScreen.tsx` | Switch コンポーネント追加 |
| `src/hooks/useWordRegistration.ts` | `definitionJa` の受け渡し追加 |
| `src/components/WordPopup.tsx` | DeepL翻訳呼び出し・日本語訳表示 |
| `src/locales/ja/settings.json` | 設定トグル関連テキスト追加 |
| `src/locales/en/settings.json` | 設定トグル関連テキスト追加 |
| `src/components/WordListItem.tsx` | 単語カード展開時に「定義の日本語訳」セクション追加 |

---

## 3. 設計判断

| 判断事項 | 決定 | 理由 |
|---------|------|------|
| 翻訳タイミング | WordPopup表示時（英語定義取得後）に逐次実行 | 英語定義がないと翻訳できないため |
| `definitionJa` の保存 | SQLite・PDSともに保存する | DeepLキャッシュがあっても、PDS復元時の再翻訳コストを避けるため |
| DeepL未設定時の挙動 | `definitionJa` は `null` のまま保存・表示なし | エラーにせずサイレントに機能を無効化 |
| 設定OFF時の挙動 | 翻訳しない・`definitionJa` は `null` のまま保存 | クォータ節約を優先するユーザーの意図を尊重 |
| 後方互換 | `definitionJa` はLexiconの `required` に含めない | 既存PDSレコードを壊さない |
| 復元時の `definitionJa` | PDSに保存済みであれば復元、なければ `null` | 復元時にDeepLを呼ばない（復元はオフライン環境でも行われる可能性がある） |
| 設定ストア | `themeStore.ts` と同パターンの `settingsStore.ts` を新規作成 | 将来の設定項目追加に備えた汎用ストア |

---

## 4. 実装ステップ

### Step 1: Lexiconスキーマ拡張

**更新ファイル:** [word.json](../lexicons/io/kumotan/vocabulary/word.json)

`properties` に以下を追加:

```json
"definitionJa": {
  "type": "string",
  "maxLength": 5000,
  "description": "Japanese translation of the English definition"
}
```

- `required` 配列は `["english", "createdAt"]` のまま変更なし

---

### Step 2: 型定義の追加

**更新ファイル:** [word.ts](../src/types/word.ts)

```typescript
export interface Word {
  // ...既存フィールド
  definition: string | null;
  definitionJa: string | null;  // 追加
}

export interface CreateWordInput {
  // ...既存フィールド
  definition?: string | null;
  definitionJa?: string | null; // 追加
}
```

---

### Step 3: DBスキーマ移行（v7）

**更新ファイル:** [config.ts](../src/constants/config.ts)

```typescript
export const DATABASE = {
  NAME: 'kumotan.db',
  VERSION: 7, // 6 → 7
} as const;
```

**更新ファイル:** [init.ts](../src/services/database/init.ts)

`CREATE TABLE IF NOT EXISTS words` の定義に `definition_ja TEXT` を追加:

```sql
definition_ja TEXT,
```

マイグレーション追加:

```typescript
// Migration to version 7: Add definition_ja column
if (currentVersion < 7) {
  await database.execAsync(`
    ALTER TABLE words ADD COLUMN definition_ja TEXT DEFAULT NULL;
  `);
  await database.runAsync(
    'INSERT INTO schema_version (version) VALUES (?)',
    [7]
  );
}
```

---

### Step 4: DB読み書き対応

**更新ファイル:** [words.ts](../src/services/database/words.ts)

`rowToWord` に追加:

```typescript
definitionJa: row.definition_ja as string | null,
```

`insertWord` の INSERT文に `definition_ja` を追加:

```sql
INSERT INTO words (english, japanese, definition, definition_ja, post_url, post_text, created_at)
VALUES (?, ?, ?, ?, ?, ?, datetime('now', 'localtime'))
```

対応するパラメータに `input.definitionJa ?? null` を追加。

---

### Step 5: PDS同期対応

**更新ファイル:** [vocabularySync.ts](../src/services/pds/vocabularySync.ts)

`buildPdsRecord` に追加:

```typescript
if (word.definitionJa) record.definitionJa = word.definitionJa;
```

`restoreWordsFromPds` の `insertWord` 呼び出し部分に追加:

```typescript
const insertResult = await insertWord({
  english,
  japanese: (value.japanese as string) ?? null,
  definition: (value.definition as string) ?? null,
  definitionJa: (value.definitionJa as string) ?? null, // 追加
  postUrl: (value.postUrl as string) ?? null,
  postText: (value.postText as string) ?? null,
});
```

---

### Step 6: 設定ストアの新規作成

**新規ファイル:** `src/store/settingsStore.ts`

[themeStore.ts](../src/store/themeStore.ts) と同パターンで作成:

```typescript
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface SettingsState {
  translateDefinition: boolean;
  setTranslateDefinition: (value: boolean) => void;
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      translateDefinition: true,
      setTranslateDefinition: (value) => set({ translateDefinition: value }),
    }),
    {
      name: 'settings-storage',
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
);
```

- デフォルトは `true`（DeepLキーが設定済みなら翻訳する）

---

### Step 7: 設定画面へのトグル追加

**更新ファイル:** [SettingsScreen.tsx](../src/screens/SettingsScreen.tsx)

DeepL APIキーが設定済みの場合のみ有効（未設定時はグレーアウト）なSwitchを追加:

```
┌─────────────────────────────────────────┐
│  翻訳設定                                │
├─────────────────────────────────────────┤
│  英語の定義を日本語に翻訳  ●  ON         │
│    DeepL APIを使用します                  │
│  (DeepL APIキー未設定の場合はグレーアウト) │
└─────────────────────────────────────────┘
```

`hasApiKey()` で DeepL設定済みを確認し、未設定時は `disabled` + 説明テキストを表示。

---

### Step 8: WordPopup での翻訳・表示

**更新ファイル:** [WordPopup.tsx](../src/components/WordPopup.tsx)

#### 翻訳処理の追加

英語定義取得（`lookupWord`）完了後、以下の条件を満たす場合のみ DeepL翻訳を実行:

```
translateDefinition === true（設定ON）
  AND hasApiKey()（DeepLキー設定済み）
  AND definition !== null（英語定義が取得できた）
```

処理は逐次（英語定義取得 → 翻訳）:

```typescript
const dictResult = await lookupWord(word);
if (dictResult.success) {
  setDefinition(dictResult.data.definition);

  if (translateDefinition && hasDeepLKey) {
    setIsTranslatingDefinition(true);
    const jaResult = await translateToJapanese(dictResult.data.definition);
    if (jaResult.success) {
      setDefinitionJa(jaResult.data.text);
    }
    setIsTranslatingDefinition(false);
  }
}
```

#### 表示レイアウト

```
英語の定義
  (Singlish) Used to contradict an underlying assumption...

  定義の日本語訳（translateDefinition=ON かつ DeepL設定済みの場合）
  相手の思い込みに反論する際に使われる（シングリッシュ）
```

- ローディング中はシンプルなインジケーター表示
- 翻訳失敗時は表示なし（エラーをユーザーに見せない）

---

### Step 9: useWordRegistration への `definitionJa` 受け渡し

**更新ファイル:** [useWordRegistration.ts](../src/hooks/useWordRegistration.ts)

WordPopup から受け取った `definitionJa` を `CreateWordInput` に含める:

```typescript
await addWord({
  english: word,
  japanese,
  definition,
  definitionJa,  // 追加
  postUrl,
  postText,
});
```

---

### Step 10: ロケール追加

**更新ファイル:** `src/locales/ja/settings.json`, `src/locales/en/settings.json`

```json
// ja
{
  "translateDefinition": "英語の定義を日本語に翻訳",
  "translateDefinitionDescription": "DeepL APIを使用します",
  "translateDefinitionNoApiKey": "DeepL APIキーを設定すると有効になります"
}

// en
{
  "translateDefinition": "Translate definition to Japanese",
  "translateDefinitionDescription": "Uses DeepL API",
  "translateDefinitionNoApiKey": "Set a DeepL API key to enable this feature"
}
```

---

## 5. データフロー図

### 単語登録時（設定ON・DeepL設定済み）

```
ユーザー（長押し → 単語選択）
  ▼
WordPopup
  ├──▶ lookupWord()                → 英語定義取得（Free Dictionary API）
  ├──▶ translateToJapanese(def)    → 定義の日本語訳取得（DeepL）
  │      ※逐次実行（定義取得後）
  ├──▶ translateToJapaneseWithFallback(word) → 単語の日本語訳
  │
  │    [表示]
  │    英語の定義: "..."
  │    定義の日本語訳: "..."  ← 新規
  │
  └── 単語帳に追加ボタン押下
        ▼
  useWordRegistration.handleAddWord()
        ▼
  addWord({ english, japanese, definition, definitionJa, ... })
        ▼
  insertWord()     → SQLite に保存（definition_ja カラム含む）
  syncWordToPds()  → PDS に { ..., definitionJa } を保存
```

### 単語登録時（設定OFF または DeepL未設定）

```
WordPopup
  ├──▶ lookupWord()   → 英語定義取得
  │    ※翻訳はスキップ
  │
  └── 単語帳に追加ボタン押下
        ▼
  addWord({ ..., definitionJa: null })
        ▼
  SQLite / PDS に definitionJa = null で保存
```

### PDS復元時

```
restoreWordsFromPds(agent)
  ▼ レコードごとに:
  ├── insertWord({ ..., definitionJa: value.definitionJa ?? null })
  │     ├── 成功 → pds_rkey記録（definitionJaもそのまま復元）
  │     └── 重複 → スキップ
```

---

## 6. 工数・保守性まとめ

| 観点 | 評価 |
|------|------|
| 工数 | 1〜1.5日（Step 8のWordPopupが最も複雑） |
| 保守性 | 良好（各Stepが既存パターン踏襲） |
| DeepLクォータ | 定義文（20〜50語程度）の追加消費あり。設定OFFで抑制可能 |
| 後方互換 | すべてオプショナル追加のため既存データに影響なし |

---

## 7. 検証方法

### 手動テスト

1. **設定トグルON（DeepL設定済み）**
   - 英語単語を長押し → WordPopupに英語定義と日本語訳が両方表示されることを確認
   - 単語を登録 → SQLiteの `definition_ja` に値が入っていることを確認
   - PDS上のレコードに `definitionJa` フィールドが含まれることを確認

2. **設定トグルOFF**
   - 英語単語を長押し → WordPopupに英語定義のみ表示（日本語訳なし）を確認
   - 単語を登録 → `definition_ja` が `null` で保存されることを確認

3. **DeepL未設定**
   - 設定画面でトグルがグレーアウトされていることを確認
   - WordPopupで日本語訳が表示されないことを確認

4. **PDS復元**
   - `definitionJa` 付きでPDSに保存された単語を復元 → `definition_ja` が正しく復元されることを確認
   - `definitionJa` なし（旧レコード）を復元 → `null` で復元されることを確認

5. **DeepL翻訳失敗時**
   - ネットワーク切断またはクォータ超過を模擬 → エラーが表示されず、英語定義のみ表示されることを確認

---

**作成日**: 2026-02-18
**関連ドキュメント**:
- [pds-vocabulary-sync-plan.md](./pds-vocabulary-sync-plan.md) - PDS同期の基本設計
- [pds-read-status-sync-plan.md](./pds-read-status-sync-plan.md) - 既存Lexicon拡張の参考例

---

## 8. 関連する完了機能

### 日本語文章モードの英語翻訳表示 + 設定トグル

> **ステータス: 完了 (2026-02-19)**

本機能と同じ設計パターン（設定トグル + DeepL翻訳 + WordPopup表示）で以下を実装した。

| 項目 | 内容 |
| ---- | ---- |
| 目的 | 日本語文章モード時に文章全体の英語訳を登録ポップアップに表示 |
| 設定キー | `translateSentenceToEnglish`（`settingsStore.ts`） |
| 翻訳処理 | `fetchJapaneseSentenceData` 内で `translateToEnglishWithFallback(word, { isWord: false })` を呼び出し |
| UI変更 | セクションタイトルを `isJapanese` に応じて "文章の英語訳" / "文章の日本語訳" に動的切り替え |
| DBへの保存 | なし（文章翻訳は表示専用。保存は将来機能として下記に記載） |
| 変更ファイル数 | 5ファイル（settingsStore, WordPopup, SettingsScreen, locales×2） |

---

## 9. 単語帳ページへの表示追加

> **ステータス: 完了 (2026-02-19)**

### 概要

単語帳ページの単語カード（展開時）に `definitionJa`（定義の日本語訳）を表示するよう対応した。

### 変更内容

**変更ファイル:** [WordListItem.tsx](../src/components/WordListItem.tsx)

展開時の「英語定義」セクション直下に「定義の日本語訳」セクションを追加。

```tsx
{/* Japanese translation of definition */}
{word.definition && word.definitionJa && (
  <View style={styles.detailSection}>
    <Text style={[styles.detailLabel, { color: colors.textSecondary }]}>定義の日本語訳</Text>
    <Text style={[styles.detailText, { color: colors.text }]}>{word.definitionJa}</Text>
  </View>
)}
```

### 表示条件

- `word.definition`が非null（英語定義が存在する）
- かつ`word.definitionJa`が非null（日本語訳が保存済み）

両条件を満たさない場合はセクション自体を非表示とする。

### 設計メモ

- バックエンド（DB・PDS・型定義）は前フェーズで完成済みのため、UI追加のみ（10行程度）
- 既存の `detailLabel` / `detailText` スタイルを流用し、新規スタイル追加なし
- 新旧どちらの登録データとも後方互換（`definitionJa = null` の単語では非表示になるだけ）

---

## 10. 将来の拡張計画

### 日本語文章モードの英語翻訳をPDSに保存する

> **ステータス: 未実装（将来機能）**

#### 機能概要

日本語文章モードで投稿を登録する際、文章全体の英語翻訳（`translateToEnglish()` の結果）を各単語レコードに紐づけてDB・PDSに保存する。

#### 変更が必要なレイヤー

| レイヤー | ファイル | 変更内容 |
| ------- | ------- | ------- |
| Lexicon | `lexicons/io/kumotan/vocabulary/word.json` | `sentenceTranslation` フィールド追加（string, maxLength 5000） |
| 型定義 | `src/types/word.ts` | `Word` と `CreateWordInput` に `sentenceTranslation?: string \| null` 追加 |
| DBマイグレーション | `src/services/database/init.ts` | v8: `ALTER TABLE words ADD COLUMN sentence_translation TEXT DEFAULT NULL` |
| DBサービス | `src/services/database/words.ts` | INSERT文・`rowToWord()` マッピングに追加 |
| PDS sync | `src/services/pds/vocabularySync.ts` | `buildPdsRecord()` と `restoreWordsFromPds()` に追加 |
| WordPopup | `src/components/WordPopup.tsx` | 日本語文章モードの `addWordToStore` 呼び出し時に `sentenceTranslation?.text` を渡す |

#### 将来機能の設計メモ

- フィールド名は `sentenceTranslation`（既存の `english` フィールドとの衝突を避けるため）
- 同じ文章から登録された各単語が **同じ** `sentenceTranslation` を共有して保存される
- 設定 `translateSentenceToEnglish` がOFFの場合は保存しない
- Lexiconの `required` 配列は変更しない（後方互換のため）
- `restoreWordsFromPds` での復元対応も必須

#### 実装しなかった理由（2026-02-19時点）

- `postText`（元の投稿文）がすでに保存されており、必要なら再翻訳が可能
- Lexiconへの追加は後から削除・リネームしにくく、フィールドの価値を確認してから追加するのが安全
- 工数・リスクに対してユーザー価値が現時点では不明
