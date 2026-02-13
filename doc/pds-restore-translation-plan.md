# PDS復元時の翻訳補完計画

## 背景・課題

PDSから単語データを復元すると、`japanese` フィールドが `null` の単語はクイズ対象から除外される。

### 原因の流れ

1. `buildPdsRecord` は `word.japanese` が falsy の場合、PDS レコードに `japanese` フィールドを含めない
2. `restoreWordsFromPds` は PDS レコードに `japanese` がなければ `null` で INSERT する
3. `getRandomWordsForQuiz` は `WHERE japanese IS NOT NULL AND japanese != ''` でフィルターするため、これらの単語はクイズに出ない

## 解決方針

**案A: 復元時にJMdict（ローカル辞書）で翻訳補完する**

- 復元ループ内で `japanese` が null/空の単語に対し、JMdict ローカル辞書で翻訳を試みる
- DeepL API は呼ばない（コスト・速度の観点）
- JMdict で見つからなかった単語は `untranslated` として件数をカウント
- `RestoreResult` に `untranslated` フィールドを追加し、復元結果ダイアログに表示

## 変更対象

### 1. `src/services/pds/vocabularySync.ts`

#### `RestoreResult` インターフェースの拡張

```typescript
export interface RestoreResult {
  total: number;
  restored: number;
  skipped: number;
  failed: number;
  untranslated: number; // 追加: JMdictで翻訳できなかった件数
}
```

#### `restoreWordsFromPds` 関数の変更

復元ループ内で、INSERT 成功後に `japanese` が null の場合:

1. `translateWithJMdict(english)` を呼ぶ
2. 成功時: DB の `japanese` カラムを UPDATE する
3. 失敗時: `result.untranslated++`

```
for (const record of records) {
  // ... 既存の INSERT 処理 ...

  if (insertResult.success && !value.japanese) {
    const translationResult = await translateWithJMdict(english);
    if (translationResult.success) {
      await database.runAsync(
        'UPDATE words SET japanese = ? WHERE id = ?',
        [translationResult.data.text, insertResult.data.id]
      );
    } else {
      result.untranslated++;
    }
  }
}
```

### 2. 復元結果の表示（呼び出し元）

復元完了ダイアログに `untranslated` が 0 より大きい場合、「X件はオフライン辞書で翻訳できなかったため、クイズ対象外です」と追記する。

## 変更しないもの

- クイズのフィルター条件（`japanese IS NOT NULL AND japanese != ''`）は変更しない
- DeepL API は復元処理では呼ばない
- 既存の sync/backup フローには手を加えない

## リスクと注意点

- JMdict が未初期化の場合は `initJMdictDatabase()` を呼ぶ必要がある
- 大量の単語がある場合、JMdict 検索は高速（ローカルDB）なので問題にならない見込み
- JMdict に存在しない単語（専門用語、固有名詞等）は翻訳されずに残る
