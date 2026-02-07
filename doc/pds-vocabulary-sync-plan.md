# PDS単語データ同期 実装計画書

> **ステータス: 完了** (2026-02-07)
> 全6フェーズの実装および手動テスト（§9）が完了。

## 1. 目的

登録した単語データをBluesky PDS（Personal Data Store）に保存し、端末変更やアプリ再インストール時にデータを復元できるようにする。AT Protocolの「ユーザーがデータを所有する」理念に沿い、単語データのポータビリティを実現する。

## 2. 現状分析

### 現在のデータ保存先

| データ | 保存先 | PDS連携 |
|--------|--------|---------|
| 登録単語 | SQLite（端末ローカル） | なし |
| クイズ履歴 | SQLite（端末ローカル） | なし |
| 学習統計 | SQLite（端末ローカル） | なし |
| 学習セッション | SQLite + PDS（任意） | あり（`io.kumotan.learning.session`） |

### 課題

- 端末変更・アプリ再インストールで単語データが失われる
- AT Protocolの思想に反し、ユーザーがデータを所有していない

### 既存の活用可能な基盤

- PDS書き込みパターン: [session.ts](../src/services/learning/session.ts) の `createRecord` 実装
- Lexiconスキーマ: [lexicons/io/kumotan/learning/session.json](../lexicons/io/kumotan/learning/session.json)
- 単語DB操作: [words.ts](../src/services/database/words.ts) の CRUD一式
- Result型によるエラーハンドリングパターン
- i18n対応済みの多言語基盤

---

## 3. 実装方針: アプローチA（片方向同期 + 削除同期）

### 方針の概要

```
登録時:  SQLiteに保存 → 非同期でPDSにも書き込み（失敗許容）
削除時:  SQLiteから削除 → pds_rkeyがあればPDSからも削除（失敗許容）
復元時:  PDSからlistRecords → ローカルSQLiteに一括挿入（重複スキップ）
```

### 設計判断

| 判断事項 | 決定 | 理由 |
|---------|------|------|
| 同期方向 | ローカル → PDS（片方向） | 複雑な双方向同期を避け、保守性を確保 |
| 失敗時の挙動 | ローカル操作を優先、PDS操作は失敗許容 | UXを阻害しない |
| isRead/readAtのPDS保存 | する | 端末変更時にも学習進捗を復元可能にする（Phase 7で実装） |
| 削除の同期（個別） | する | PDSにゴミデータが蓄積するのを防止 |
| 削除の同期（全件） | しない | PDSをバックアップとして残し、復元機能を有効にする |
| 復元時の重複処理 | englishフィールドで重複チェック、スキップ | 既存の`sanitizeWord` + 重複チェックを流用 |

### PDS保存対象フィールド

| フィールド | PDS保存 | 理由 |
|-----------|---------|------|
| english | Yes | 単語の主キー |
| japanese | Yes | 翻訳データ（再取得コストが高い） |
| definition | Yes | 定義データ（再取得コストが高い） |
| postUrl | Yes | 元投稿への参照 |
| postText | Yes | 文脈の記録 |
| createdAt | Yes | 登録日の復元に必要 |
| id | No | SQLiteの自動採番（PDSではrkeyが代替） |
| isRead | Yes | 学習進捗の復元に必要（Phase 7で追加） |
| readAt | Yes | 学習進捗の復元に必要（Phase 7で追加） |

---

## 4. 実装フェーズ

### Phase 1: Lexiconスキーマ定義

**新規ファイル:** `lexicons/io/kumotan/vocabulary/word.json`

```json
{
  "lexicon": 1,
  "id": "io.kumotan.vocabulary.word",
  "defs": {
    "main": {
      "type": "record",
      "description": "A vocabulary word saved by the user in Kumotan app",
      "key": "tid",
      "record": {
        "type": "object",
        "required": ["english", "createdAt"],
        "properties": {
          "english": {
            "type": "string",
            "maxLength": 1000,
            "description": "English word or phrase"
          },
          "japanese": {
            "type": "string",
            "maxLength": 1000,
            "description": "Japanese translation"
          },
          "definition": {
            "type": "string",
            "maxLength": 5000,
            "description": "English definition"
          },
          "postUrl": {
            "type": "string",
            "format": "uri",
            "description": "URL of the original Bluesky post"
          },
          "postText": {
            "type": "string",
            "maxLength": 3000,
            "description": "Original post text for context"
          },
          "createdAt": {
            "type": "string",
            "format": "datetime",
            "description": "Timestamp when the word was registered"
          }
        }
      }
    }
  }
}
```

---

### Phase 2: データベースマイグレーション（v6）

**更新ファイル:**
- [config.ts](../src/constants/config.ts) - `DATABASE.VERSION` を 6 に更新
- [init.ts](../src/services/database/init.ts) - マイグレーション追加

**スキーマ変更:**

```sql
-- words テーブルに pds_rkey カラムを追加
ALTER TABLE words ADD COLUMN pds_rkey TEXT DEFAULT NULL;
```

`pds_rkey` はPDSレコードのキー（`createRecord` レスポンスのURIから抽出）を保持する。

```
URI例: at://did:plc:xxx/io.kumotan.vocabulary.word/3abc123def
                                                    ^^^^^^^^^^^
                                                    この部分がrkey
```

---

### Phase 3: PDS同期サービス

**新規ファイル:** `src/services/pds/vocabularySync.ts`

主要な関数:

#### 3.1 `syncWordToPds` — 単語をPDSに書き込み

```typescript
/**
 * 単語をPDSに保存し、rkeyをローカルDBに記録する
 *
 * @param agent - 認証済みのBskyAgent
 * @param word - 保存する単語データ
 * @returns rkey（成功時）またはnull（失敗時）
 */
async function syncWordToPds(agent: BskyAgent, word: Word): Promise<string | null>
```

- 既存の [session.ts](../src/services/learning/session.ts) と同じ `com.atproto.repo.createRecord` パターン
- 成功時にレスポンスURIからrkeyを抽出し、SQLiteの `pds_rkey` カラムを更新
- 失敗時はログ出力のみ（ローカル操作をブロックしない）

#### 3.2 `deleteWordFromPds` — 単語をPDSから削除

```typescript
/**
 * PDS上の単語レコードを削除する
 *
 * @param agent - 認証済みのBskyAgent
 * @param rkey - 削除対象のレコードキー
 * @returns 成功/失敗
 */
async function deleteWordFromPds(agent: BskyAgent, rkey: string): Promise<boolean>
```

- `com.atproto.repo.deleteRecord` を呼び出し
- 失敗時はログ出力のみ（ローカル削除をブロックしない）

#### 3.3 `restoreWordsFromPds` — PDSから単語を復元

```typescript
/**
 * PDSに保存された全単語をローカルDBに復元する
 *
 * @param agent - 認証済みのBskyAgent
 * @returns 復元結果（成功数、スキップ数、失敗数）
 */
async function restoreWordsFromPds(agent: BskyAgent): Promise<RestoreResult>
```

- `com.atproto.repo.listRecords` でページネーション付き全件取得
- 各レコードを `insertWord` で挿入（重複は既存のチェックでスキップ）
- 復元時に `pds_rkey` も記録（再同期時の二重登録防止）

**型定義（同ファイル内）:**

```typescript
interface RestoreResult {
  total: number;      // PDS上の総レコード数
  restored: number;   // 新規挿入された数
  skipped: number;    // 重複でスキップされた数
  failed: number;     // 挿入失敗数
}
```

---

### Phase 4: 既存コードへの統合

#### 4.1 単語登録フローの変更

**更新ファイル:** [useWordRegistration.ts](../src/hooks/useWordRegistration.ts)

```
現在のフロー:
  handleAddWord → addWord(SQLite) → Alert

変更後のフロー:
  handleAddWord → addWord(SQLite) → Alert
                                   ↘ syncWordToPds(PDS) ※非同期・バックグラウンド
```

- `addWord` の結果が `success` の場合のみ `syncWordToPds` を呼ぶ
- PDS同期は `await` せずfire-and-forget（ユーザーの操作をブロックしない）
- 認証状態の確認（未ログイン時はスキップ）

#### 4.2 単語削除フローの変更

**更新ファイル:** [words.ts](../src/services/database/words.ts)

```
現在のフロー:
  deleteWord(id) → SQLite DELETE

変更後のフロー:
  deleteWord(id) → pds_rkeyを取得 → SQLite DELETE
                                    ↘ deleteWordFromPds(rkey) ※非同期
```

- 削除前に `pds_rkey` を取得（削除後は取得不可のため）
- `pds_rkey` が存在する場合のみPDS削除を実行

#### 4.3 全件削除フローの変更

**更新ファイル:** [words.ts](../src/services/database/words.ts)

`deleteAllWords` はローカルデータのみ削除し、PDS側のデータは削除しない。PDSはバックアップとして機能し、「PDSから復元」で単語を復元できる状態を維持する。個別の単語削除では引き続きPDS側も削除する（ユーザーの意図的な削除のため）。

---

### Phase 5: 復元UI

**更新ファイル:** [SettingsScreen.tsx](../src/screens/SettingsScreen.tsx)

設定画面の「データ管理」セクションに以下を追加:

```
┌─────────────────────────────────────┐
│  データ管理                          │
├─────────────────────────────────────┤
│  📤 データをエクスポート        >    │  ← 既存
│  🔄 PDSからデータを復元        >    │  ← 新規追加
│  🗑  データを全削除             >    │  ← 既存
└─────────────────────────────────────┘
```

**復元フロー:**

1. ユーザーが「PDSからデータを復元」をタップ
2. 確認ダイアログ表示:「PDSに保存された単語データを復元します。既に登録済みの単語はスキップされます。」
3. 復元処理実行（プログレス表示）
4. 結果表示:「復元完了: 新規○件、スキップ○件」

---

### Phase 6: 多言語対応

**更新ファイル:**
- `src/locales/ja/settings.json` - 復元関連テキスト追加
- `src/locales/en/settings.json` - 復元関連テキスト追加

追加するキー:
```json
{
  "pdsRestore": "Restore from PDS",
  "pdsRestoreDescription": "Restore vocabulary data saved in your Bluesky PDS",
  "pdsRestoreConfirm": "Restore vocabulary data from PDS? Already registered words will be skipped.",
  "pdsRestoreSuccess": "Restored {{restored}} words ({{skipped}} skipped)",
  "pdsRestoreEmpty": "No vocabulary data found in PDS",
  "pdsRestoreError": "Failed to restore data. Please try again.",
  "pdsSyncEnabled": "PDS sync is active. New words are automatically saved to your PDS."
}
```

---

## 5. 変更ファイル一覧

| ファイル | 変更内容 |
|---------|---------|
| `lexicons/io/kumotan/vocabulary/word.json` | **新規** Lexiconスキーマ定義 |
| `src/constants/config.ts` | `DATABASE.VERSION` を 6 に更新 |
| `src/services/database/init.ts` | v6マイグレーション（`pds_rkey` カラム追加） |
| `src/services/pds/vocabularySync.ts` | **新規** PDS同期サービス（sync/delete/restore） |
| `src/services/database/words.ts` | `deleteWord` / `deleteAllWords` にPDS削除を追加 |
| `src/hooks/useWordRegistration.ts` | `handleAddWord` にPDS同期呼び出しを追加 |
| `src/screens/SettingsScreen.tsx` | 「PDSから復元」ボタン追加 |
| `src/locales/ja/settings.json` | 復元関連テキスト追加 |
| `src/locales/en/settings.json` | 復元関連テキスト追加 |

---

## 6. データフロー図

### 単語登録時
```
ユーザー
  │ 単語をタップ → 保存
  ▼
useWordRegistration.handleAddWord()
  │
  ├──▶ addWord() ──▶ SQLite INSERT ──▶ ✅ Alert「保存しました」
  │
  └──▶ syncWordToPds() ──▶ com.atproto.repo.createRecord
         │                    collection: 'io.kumotan.vocabulary.word'
         │
         ├── 成功 → rkeyをSQLiteに保存 (UPDATE words SET pds_rkey = ?)
         └── 失敗 → console.error のみ（UXに影響なし）
```

### 単語削除時
```
ユーザー
  │ 単語を削除
  ▼
deleteWord(id)
  │
  ├──▶ SELECT pds_rkey FROM words WHERE id = ?
  ├──▶ SQLite DELETE ──▶ ✅ 削除完了
  │
  └──▶ (pds_rkeyがあれば)
       deleteWordFromPds(rkey) ──▶ com.atproto.repo.deleteRecord
         │
         ├── 成功 → PDSからも削除完了
         └── 失敗 → console.error のみ（ローカルは削除済み）
```

### PDS復元時
```
ユーザー
  │ 設定画面「PDSから復元」をタップ
  ▼
restoreWordsFromPds(agent)
  │
  ├──▶ com.atproto.repo.listRecords
  │      collection: 'io.kumotan.vocabulary.word'
  │      limit: 100, cursor: ...（ページネーション）
  │
  ▼ レコードごとに:
  ├── findWordByEnglish(record.english)
  │     ├── 存在する → スキップ（skipped++）
  │     └── 存在しない → insertWord() → pds_rkeyも記録
  │                        ├── 成功 → restored++
  │                        └── 失敗 → failed++
  │
  └──▶ RestoreResult { total, restored, skipped, failed }
```

---

## 7. エラーハンドリング方針

| シナリオ | 対応 |
|---------|------|
| PDS書き込み失敗（ネットワークエラー） | ローカル保存は成功。PDS同期は無視 |
| PDS削除失敗 | ローカル削除は成功。PDS側にレコードが残るが復元時に重複チェックで吸収 |
| 復元時にPDS接続失敗 | エラーメッセージ表示、リトライを促す |
| 復元時に個別レコード挿入失敗 | スキップして次のレコードへ（failed++） |
| 未認証状態での同期 | PDS操作をスキップ（ローカルのみ動作） |
| PDS上に大量レコード（1000件超） | listRecordsのページネーション（cursor）で対応 |

---

## 8. AT Protocolのレート制限・サイズ制限

| 制限事項 | 値 | 本実装への影響 |
|---------|-----|---------------|
| レコードサイズ上限 | 約1MB/レコード | 単語1件は最大10KB程度。問題なし |
| listRecordsの1回の取得上限 | 100件 | ページネーション（cursor）で対応 |
| createRecordのレート制限 | PDS依存（通常は十分な余裕あり） | 単語登録は1件ずつのため問題なし |
| コレクション内のレコード数上限 | 制限なし（実質的） | 数千件規模では問題なし |

---

## 9. 検証方法

### 単体テスト
- `vocabularySync.ts` のrkey抽出ロジック
- `RestoreResult` の集計ロジック

### 手動テスト（全項目完了: 2026-02-07）

1. **登録同期テスト** ✅
   - 単語を登録 → PDS上にレコードが作成されることを確認
   - SQLiteの `pds_rkey` カラムに値が保存されることを確認

2. **削除同期テスト** ✅
   - PDS同期済みの単語を削除 → PDS上のレコードも削除されることを確認

3. **復元テスト** ✅
   - アプリのデータを全削除 → 「PDSから復元」→ 単語が復元されることを確認
   - 一部の単語がローカルに存在する状態で復元 → 重複がスキップされることを確認

4. **オフラインテスト** ✅
   - 機内モードで単語登録 → ローカル保存が成功することを確認
   - 機内モードで復元 → エラーメッセージが表示されることを確認

---

## 10. 将来の拡張（本計画のスコープ外）

以下は本計画では実装しないが、将来的に追加可能なもの:

- **双方向同期**: 複数端末からの同時利用に対応
- **同期キュー**: オフライン時の変更を記録し、オンライン復帰時にバッチ同期
- **クイズ結果のPDS保存**: `io.kumotan.learning.quiz` コレクション

これらはアプローチAの上に段階的に追加可能であり、本計画の設計はこれらの拡張を妨げない。

---

**作成日**: 2026-02-06
**実装完了日**: 2026-02-07
**関連ドキュメント**:
- [storage-strategy.md](./storage-strategy.md) - ストレージ戦略
- [lexicons/io/kumotan/learning/session.json](../lexicons/io/kumotan/learning/session.json) - 既存Lexiconスキーマ
- [japanese-dictionary-proposal.md](./japanese-dictionary-proposal.md) - AT Protocol連携の先行設計
- [pds-read-status-sync-plan.md](./pds-read-status-sync-plan.md) - isRead/readAt PDS同期実装計画書(Phase 7)
