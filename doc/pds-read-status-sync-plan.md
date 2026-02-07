# isRead/readAt PDS同期 実装計画書

> **ステータス: 完了** (2026-02-07)
> [pds-vocabulary-sync-plan.md](./pds-vocabulary-sync-plan.md) の Phase 7 として実装。手動テスト(§6 1-3)完了。

## 1. 目的

PDS単語データ同期（Phase 1-6）完了後の拡張として、単語の学習進捗（`isRead`/`readAt`）もPDSに同期する。端末変更時に「どの単語を既読にしたか」も復元可能にする。

`io.kumotan.vocabulary.word` Lexiconを拡張して実装する。

---

## 2. 変更ファイル一覧

| ファイル | 変更内容 |
|---------|---------|
| `lexicons/io/kumotan/vocabulary/word.json` | `isRead`, `readAt` プロパティ追加 |
| `src/services/pds/vocabularySync.ts` | `buildPdsRecord` ヘルパー抽出、`updateWordInPds` 新規追加、`restoreWordsFromPds` 修正 |
| `src/store/wordStore.ts` | `toggleReadStatus` にPDS同期を追加 |
| `doc/pds-vocabulary-sync-plan.md` | 設計判断・フィールド表の更新 |

**変更不要:**
- `src/types/word.ts` — 既に `isRead: boolean` / `readAt: string | null` あり
- `src/services/database/words.ts` — ローカルのトグル処理は変更不要
- `src/services/database/init.ts` — DBマイグレーション不要（`is_read`/`read_at` カラムは既存）
- ロケールファイル — UI変更なし

---

## 3. 保守性の設計判断

| 判断事項 | 決定 | 理由 |
|---------|------|------|
| PDS同期レイヤー | `addWord`/`toggleReadStatus` はストア層、`deleteWord` はDB層（現状維持） | `deleteWord` のみDB層にある理由は、削除後にデータが消え `pds_rkey` を取得できなくなるため |
| レコード構築の共通化 | `buildPdsRecord` ヘルパーを導入 | フィールド追加時の変更箇所を1箇所に集約（保守性改善） |
| 後方互換 | `isRead`/`readAt` は `required` に含めない | 既存PDSレコードでも復元可能 |
| 復元時の `daily_stats` | 更新しない | 復元は過去データであり、本日の学習カウントに含めない |
| 重複スキップ時の `isRead` | ローカル状態を維持 | ローカルが権威データソース |

---

## 4. 実装ステップ

### Step 1: Lexiconスキーマ拡張

**更新ファイル:** [word.json](../lexicons/io/kumotan/vocabulary/word.json)

`properties` に以下を追加:

```json
"isRead": {
  "type": "boolean",
  "description": "Whether the word has been marked as read/learned"
},
"readAt": {
  "type": "string",
  "format": "datetime",
  "description": "Timestamp when the word was marked as read"
}
```

- `required` 配列は `["english", "createdAt"]` のまま変更なし

---

### Step 2: vocabularySync.ts の修正

**更新ファイル:** [vocabularySync.ts](../src/services/pds/vocabularySync.ts)

#### 2a. `buildPdsRecord` ヘルパー関数を新規追加

Word型からPDSレコードオブジェクトを構築する内部ヘルパー。`syncWordToPds` と `updateWordInPds` で共用。

```typescript
function buildPdsRecord(word: Word): Record<string, unknown> {
  const record: Record<string, unknown> = {
    $type: COLLECTION,
    english: word.english,
    createdAt: new Date(word.createdAt).toISOString(),
    isRead: word.isRead,
  };
  if (word.japanese) record.japanese = word.japanese;
  if (word.definition) record.definition = word.definition;
  if (word.postUrl) record.postUrl = word.postUrl;
  if (word.postText) record.postText = word.postText;
  if (word.readAt) record.readAt = new Date(word.readAt).toISOString();
  return record;
}
```

#### 2b. `syncWordToPds` をリファクタリング

インラインのレコード構築を `buildPdsRecord(word)` 呼び出しに置換。動作変更なし（新規単語は `isRead: false`, `readAt: null`）。

#### 2c. `updateWordInPds` 新規関数

```typescript
export async function updateWordInPds(
  agent: BskyAgent, word: Word, rkey: string
): Promise<boolean>
```

- `com.atproto.repo.putRecord` を使用（コードベース初の `putRecord` 利用）
- `putRecord` は全フィールド置換のため、`buildPdsRecord` で完全なレコードを構築
- 失敗時は `console.error` のみ（fire-and-forget）

#### 2d. `restoreWordsFromPds` の修正

`insertWord` 成功後、PDSレコードの `isRead`/`readAt` をSQLで適用:

```typescript
const isRead = (value.isRead as boolean) ?? false;
const readAt = (value.readAt as string) ?? null;
if (insertResult.success && (isRead || readAt)) {
  await database.runAsync(
    'UPDATE words SET is_read = ?, read_at = ? WHERE id = ?',
    [isRead ? 1 : 0, readAt, insertResult.data.id]
  );
}
```

- `daily_stats` は更新しない（復元は過去データ）
- 重複スキップ時はローカルの `isRead`/`readAt` を維持（上書きしない）

---

### Step 3: wordStore.ts の修正

**更新ファイル:** [wordStore.ts](../src/store/wordStore.ts)

`toggleReadStatus` アクションにPDS同期を追加。`addWord` と同じfire-and-forgetパターン:

```typescript
// import に updateWordInPds, getPdsRkey を追加
if (result.success) {
  // PDS同期（非同期・失敗許容）
  const isAuthenticated = useAuthStore.getState().isAuthenticated;
  if (isAuthenticated) {
    getPdsRkey(id).then((rkey) => {
      if (rkey) {
        const agent = getAgent();
        updateWordInPds(agent, result.data, rkey).catch((err) => {
          console.error('[wordStore] PDS read status sync failed:', err);
        });
      }
    });
  }
  await get().loadWords();
  return { success: true, data: undefined };
}
```

- `result.data` は `toggleReadStatus` が返す更新済み `Word` オブジェクト（全フィールド含む）
- `pds_rkey` は `getPdsRkey(id)` で別途取得（`rowToWord` に含まれないため）

---

### Step 4: ドキュメント更新

**更新ファイル:** [pds-vocabulary-sync-plan.md](./pds-vocabulary-sync-plan.md)

- §3 設計判断テーブル: `isRead/readAtのPDS保存` を「する」に変更
- §3 PDS保存対象フィールドテーブル: `isRead`, `readAt` を「Yes」に変更
- §10 将来の拡張: `isRead/readAt のPDS同期` の項目を削除（実装済みのため）

---

## 5. データフロー図

### 既読トグル時
```
ユーザー
  │ 単語の既読チェックボックスをタップ
  ▼
WordListScreen → wordStore.toggleReadStatus(id)
  │
  ├──▶ WordService.toggleReadStatus(id)
  │      SQLite UPDATE (is_read, read_at) + daily_stats更新
  │      ──▶ ✅ 更新済みWordオブジェクトを返す
  │
  └──▶ (認証済み & pds_rkeyあり)
       updateWordInPds(agent, updatedWord, rkey)
         ──▶ com.atproto.repo.putRecord ※全フィールド置換
         │
         ├── 成功 → PDSレコードも更新完了
         └── 失敗 → console.error のみ（ローカルは更新済み）
```

### PDS復元時（isRead/readAt対応）
```
restoreWordsFromPds(agent)
  │
  ▼ レコードごとに:
  ├── insertWord() で単語を挿入
  │     ├── 成功 → pds_rkey記録
  │     │          ↘ isRead/readAtがあればSQL UPDATEで適用
  │     │            （daily_statsは更新しない）
  │     └── 重複 → スキップ（ローカルのisRead/readAtを維持）
```

---

## 6. 検証方法

### 手動テスト

1. **登録同期テスト**
   - 単語を登録 → PDS上のレコードに `isRead: false` が含まれることを確認

2. **既読トグルテスト**
   - 単語を既読にトグル → PDS上のレコードが `isRead: true`, `readAt` 付きに更新されることを確認
   - 未読に戻す → PDS上のレコードが `isRead: false`, `readAt` なしに更新されることを確認

3. **復元テスト**
   - 全件削除 → PDSから復元 → `isRead`/`readAt` 状態も復元されることを確認
   - 復元後の `daily_stats` が不正に加算されていないことを確認

4. **スキップテスト**
   - 未認証状態でトグル → PDS操作がスキップされ、ローカルのみ更新されることを確認
   - `pds_rkey` なしの単語をトグル → PDS操作がスキップされることを確認

---

**作成日**: 2026-02-07
**前提ドキュメント**: [pds-vocabulary-sync-plan.md](./pds-vocabulary-sync-plan.md)
