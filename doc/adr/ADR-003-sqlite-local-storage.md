# ADR-003: SQLiteローカルストレージ採用

## ステータス

採用 (Accepted)

## 日付

2026-01-06

## コンテキスト

くもたんアプリでは、以下のデータを永続化する必要がある:

1. **単語データ** (words テーブル)
   - 英単語、日本語訳、定義、元の投稿情報
   - 既読/未読ステータス、登録日時、既読日時
   - CRUD操作（作成、読み取り、更新、削除）

2. **学習統計** (daily_stats テーブル)
   - 日別の学習単語数
   - カレンダー表示、連続学習日数計算

3. **データ特性**
   - ユーザーあたり数百〜数千件の単語（想定最大10,000件）
   - 頻繁な読み取り（単語一覧表示、統計計算）
   - 中程度の書き込み（単語登録、既読切り替え）
   - 複雑なクエリ（フィルタリング、ソート、集計）

### 選択肢1: AsyncStorage（key-value store）
- **メリット**:
  - シンプルなAPI
  - Expo標準サポート
- **デメリット**:
  - JSON文字列としてシリアライズが必要
  - 複雑なクエリに不向き
  - パフォーマンスが悪い（全データを読み込んでフィルタリング）
  - トランザクションサポートなし

### 選択肢2: Realm / WatermelonDB（NoSQL DB）
- **メリット**:
  - リアクティブクエリ
  - オブジェクト指向
  - 複雑なクエリ対応
- **デメリット**:
  - 追加の依存関係（サイズ増加）
  - 学習曲線
  - Expoとの互換性に注意が必要
  - オーバーエンジニアリング（小規模アプリには過剰）

### 選択肢3: expo-sqlite（SQLite）
- **メリット**:
  - 標準SQL、広く知られた技術
  - Expo公式サポート
  - トランザクション、インデックス、集計関数
  - 軽量、高速
  - 複雑なクエリに強い
- **デメリット**:
  - ボイラープレートコードが多い
  - マイグレーション管理が必要

### 選択肢4: クラウドデータベース（Firebase, Supabase）
- **メリット**:
  - デバイス間同期
  - バックアップ自動化
- **デメリット**:
  - ネットワーク必須（オフライン対応が複雑）
  - プライバシー懸念（ユーザーデータが外部送信）
  - 運用コスト（個人開発には不向き）
  - 現時点では要件外（Phase 4で検討予定）

## 決定

**選択肢3: expo-sqlite（SQLite）を採用**

## 理由

1. **要件との適合性**
   - **複雑なクエリ**: フィルタリング（未読のみ）、ソート（日付順、アルファベット順）、集計（統計計算）
   - **トランザクション**: 既読切り替え時に単語テーブルと統計テーブルを原子的に更新
   - **インデックス**: 高速検索のために `english`, `created_at`, `is_read` にインデックス
   - **オフライン完結**: ネットワーク不要、プライバシー保護

2. **パフォーマンス**
   - SQLiteはネイティブC実装で高速
   - インデックスにより大量データでもミリ秒単位でクエリ
   - バッチ操作（複数行の一括挿入）に対応

3. **Expoとの統合**
   - `expo-sqlite`はExpo公式パッケージで長期サポート保証
   - Expo Go、開発ビルド、プロダクションビルド全てで動作
   - マイグレーション機構を自前で実装可能

4. **標準技術**
   - SQL は広く使われており、将来のメンテナンス容易
   - デバッグツール充実（DB Browserなどで直接確認可能）
   - Stack Overflowなどで情報豊富

5. **データサイズ見積もり**
   ```
   単語1件あたり: 約500バイト（テキストデータ）
   10,000件 = 5MB

   統計1日あたり: 約50バイト
   1年間 = 365日 = 18KB

   合計: 約5MB（SQLiteは100MBまで快適に動作）
   ```

6. **将来の拡張性**
   - Phase 4でクラウド同期を追加する場合、SQLiteは維持可能
   - ローカルDBを「キャッシュ」として使い、クラウドと同期する設計が一般的
   - データエクスポート機能（JSON）で移行も容易

## 影響

### データベーススキーマ

```sql
-- 単語テーブル
CREATE TABLE IF NOT EXISTS words (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  english TEXT NOT NULL,
  japanese TEXT,  -- DeepL API未設定時はNULL
  definition TEXT,
  post_url TEXT,
  post_text TEXT,
  is_read INTEGER DEFAULT 0 CHECK(is_read IN (0, 1)),
  created_at DATETIME DEFAULT (datetime('now', 'localtime')),
  read_at DATETIME
);

-- インデックス
CREATE INDEX IF NOT EXISTS idx_words_english ON words(english);
CREATE INDEX IF NOT EXISTS idx_words_created_at ON words(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_words_is_read ON words(is_read);
CREATE INDEX IF NOT EXISTS idx_words_read_at ON words(read_at);

-- 統計テーブル
CREATE TABLE IF NOT EXISTS daily_stats (
  date TEXT PRIMARY KEY,  -- YYYY-MM-DD形式
  words_read_count INTEGER DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_daily_stats_date ON daily_stats(date DESC);

-- スキーマバージョン管理
CREATE TABLE IF NOT EXISTS schema_version (
  version INTEGER PRIMARY KEY,
  applied_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

### トランザクション例

```typescript
// 単語を既読にする際、統計も原子的に更新
await database.withTransactionAsync(async () => {
  // 1. 単語を既読に変更
  await database.runAsync(
    "UPDATE words SET is_read = 1, read_at = datetime('now', 'localtime') WHERE id = ?",
    [wordId]
  );

  // 2. 今日の統計を更新（UPSERT）
  await database.runAsync(
    `INSERT INTO daily_stats (date, words_read_count)
     VALUES (date('now', 'localtime'), 1)
     ON CONFLICT(date) DO UPDATE SET
     words_read_count = words_read_count + 1`
  );
});
```

### マイグレーション戦略

```typescript
async function runMigrations(database: SQLiteDatabase, currentVersion: number): Promise<void> {
  // Version 1 → 2: インデックス追加
  if (currentVersion < 2) {
    await database.execAsync(`
      CREATE INDEX IF NOT EXISTS idx_words_post_url ON words(post_url);
    `);
    await database.runAsync('INSERT INTO schema_version (version) VALUES (?)', [2]);
  }

  // Version 2 → 3: 新しいカラム追加
  if (currentVersion < 3) {
    await database.execAsync(`
      ALTER TABLE words ADD COLUMN difficulty INTEGER DEFAULT 0;
    `);
    await database.runAsync('INSERT INTO schema_version (version) VALUES (?)', [3]);
  }

  // 以降のバージョンも同様に追加
}
```

### セキュリティ: SQLインジェクション対策

**必須ルール**: すべてのクエリでプレースホルダー（`?`）を使用

```typescript
// ❌ 危険: 文字列結合
const word = userInput;
await database.runAsync(`SELECT * FROM words WHERE english = '${word}'`);
// → ユーザーが "'; DROP TABLE words; --" を入力すると破壊的

// ✅ 安全: プレースホルダー
await database.runAsync(
  'SELECT * FROM words WHERE english = ?',
  [word]
);
// → 自動的にエスケープされる
```

## トレードオフ

### 受け入れるデメリット

- **ボイラープレートコード**: CRUD操作を手動実装
  - **緩和策**: サービス層で抽象化（`src/services/database/words.ts`）
  - **影響範囲**: 開発者のみ、ユーザーには影響なし

- **マイグレーション管理**: スキーマ変更時に手動でマイグレーションコード記述
  - **緩和策**: `schema_version` テーブルでバージョン追跡
  - **影響範囲**: リリース前にテスト必須

### 得られるメリット

- **パフォーマンス**: 10,000件の単語でも高速クエリ（< 10ms）
- **オフライン完結**: ネットワーク不要、Airplane Modeでも全機能利用可能
- **プライバシー**: ユーザーデータがデバイス外に出ない
- **コスト**: 運用コストゼロ（クラウドDB不要）

## 代替案の将来検討

### Phase 4: クラウド同期追加時の設計

SQLiteをローカルキャッシュとして継続使用し、クラウドと同期:

```
┌─────────────┐
│  SQLite DB  │ ← ローカルストレージ（現在の実装）
│  (Cache)    │
└──────┬──────┘
       │ 同期
       ↓
┌─────────────┐
│ Cloud DB    │ ← Supabase / PDS (Personal Data Server)
│ (Source of  │
│  Truth)     │
└─────────────┘
```

同期戦略:
- オフライン時はSQLiteのみ使用
- オンライン復帰時にクラウドと双方向同期
- 競合解決ルール（Last Write Wins、クライアント優先など）

## 参照

- expo-sqlite Documentation: https://docs.expo.dev/versions/latest/sdk/sqlite/
- SQLite Best Practices: https://www.sqlite.org/queryplanner.html
- SQL Injection Prevention: https://owasp.org/www-community/attacks/SQL_Injection
- requirements.md データベース設計セクション（L115-L138）

## パフォーマンステスト結果

（実装時に追記予定）

| 操作 | データ件数 | 実行時間 |
|------|-----------|---------|
| 単語挿入 | N/A | < 5ms |
| 全単語取得（ソート済み） | 1,000件 | < 10ms |
| フィルタリング（未読のみ） | 1,000件中500件 | < 8ms |
| 統計計算（7日間） | 7日分 | < 5ms |
| 既読切り替え（トランザクション） | N/A | < 10ms |

## ステークホルダー

- **決定者**: RieTamura（開発者）
- **影響を受ける人**: くもたんアプリのすべてのユーザー

## レビュー日

次回レビュー予定: Phase 4開始時（クラウド同期検討時）
