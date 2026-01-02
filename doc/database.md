# くもたん (Kumotan) - データベース設計

**アプリ名**: くもたん (Kumotan)  
**コンセプト**: 雲から学ぶ、あなたの単語帳

## ⚠️ セキュリティ注意事項

**SQLインジェクション対策**: すべてのクエリでプレースホルダー（`?`）を使用し、ユーザー入力を直接SQL文に埋め込まないでください。

```typescript
// ✅ 正しい実装（プレースホルダー使用）
await db.runAsync('SELECT * FROM words WHERE english = ?', [userInput]);

// ❌ 危険な実装（絶対に使用しない）
// await db.runAsync(`SELECT * FROM words WHERE english = '${userInput}'`);
```

## ER図

```
┌─────────────────────────┐
│       words             │
├─────────────────────────┤
│ id (PK)                 │
│ english                 │
│ japanese                │
│ definition              │
│ post_url                │
│ post_text               │
│ is_read                 │
│ created_at              │
│ read_at                 │
└─────────────────────────┘
           │
           │ (1対多)
           ▼
┌─────────────────────────┐
│    daily_stats          │
├─────────────────────────┤
│ date (PK)               │
│ words_read_count        │
└─────────────────────────┘
```

## テーブル定義

### 1. words テーブル

単語・熟語の情報を保存

| カラム名 | 型 | NULL | デフォルト | 説明 |
|---------|-----|------|-----------|------|
| id | INTEGER | NOT NULL | AUTO_INCREMENT | 主キー |
| english | TEXT | NOT NULL | - | 英単語・熟語 |
| japanese | TEXT | NULL | - | 日本語訳（DeepL API Key未設定時はNULL） |
| definition | TEXT | NULL | - | 英語の定義（Free Dictionary API） |
| post_url | TEXT | NULL | - | 元の投稿URL |
| post_text | TEXT | NULL | - | 投稿の全文（コンテキスト保存） |
| is_read | INTEGER | NOT NULL | 0 | 既読フラグ（0:未読, 1:既読） |
| created_at | DATETIME | NOT NULL | CURRENT_TIMESTAMP | 登録日時 |
| read_at | DATETIME | NULL | - | 既読にした日時 |

**インデックス:**
```sql
CREATE INDEX idx_words_english ON words(english);
CREATE INDEX idx_words_created_at ON words(created_at DESC);
CREATE INDEX idx_words_is_read ON words(is_read);
CREATE INDEX idx_words_read_at ON words(read_at);
```

**作成SQL:**
```sql
CREATE TABLE IF NOT EXISTS words (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  english TEXT NOT NULL,
  japanese TEXT,  -- DeepL API Key未設定時はNULL
  definition TEXT,
  post_url TEXT,
  post_text TEXT,
  is_read INTEGER DEFAULT 0 CHECK(is_read IN (0, 1)),
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  read_at DATETIME
);
```

### 2. daily_stats テーブル

日別の学習統計を保存（カレンダー表示用）

| カラム名 | 型 | NULL | デフォルト | 説明 |
|---------|-----|------|-----------|------|
| date | TEXT | NOT NULL | - | 日付（YYYY-MM-DD形式） |
| words_read_count | INTEGER | NOT NULL | 0 | その日に既読にした単語数 |

**インデックス:**
```sql
CREATE INDEX idx_daily_stats_date ON daily_stats(date DESC);
```

**作成SQL:**
```sql
CREATE TABLE IF NOT EXISTS daily_stats (
  date TEXT PRIMARY KEY,
  words_read_count INTEGER DEFAULT 0
);
```

### 3. schema_version テーブル（マイグレーション管理用）

```sql
CREATE TABLE IF NOT EXISTS schema_version (
  version INTEGER PRIMARY KEY,
  applied_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 初期バージョン
INSERT INTO schema_version (version) VALUES (1);
```

## クエリ例

### 単語登録

**⚠️ 必ずプレースホルダーを使用してください**

```sql
-- ✅ 正しい実装
INSERT INTO words (english, japanese, definition, post_url, post_text)
VALUES (?, ?, ?, ?, ?);
```

```typescript
// TypeScript実装例
await db.runAsync(
  'INSERT INTO words (english, japanese, definition, post_url, post_text) VALUES (?, ?, ?, ?, ?)',
  [
    english.trim().toLowerCase(),  // 正規化
    japanese ?? null,               // API Key未設定時はnull
    definition ?? null,
    postUrl ?? null,
    postText ?? null,
  ]
);
```

### 単語一覧取得（ソート・フィルタ）

#### 登録日時順（新しい順）
```sql
SELECT * FROM words
WHERE is_read = 0  -- 未読のみ（フィルタオプション）
ORDER BY created_at DESC
LIMIT 50 OFFSET 0;
```

#### アルファベット順
```sql
SELECT * FROM words
ORDER BY english ASC
LIMIT 50 OFFSET 0;
```

#### すべての単語（ページネーション）
```sql
SELECT * FROM words
ORDER BY created_at DESC
LIMIT ? OFFSET ?;
```

### 単語を既読にする
```sql
-- 単語の既読フラグを更新
UPDATE words
SET is_read = 1, read_at = CURRENT_TIMESTAMP
WHERE id = ?;

-- 同日の統計を更新
INSERT INTO daily_stats (date, words_read_count)
VALUES (date('now'), 1)
ON CONFLICT(date) DO UPDATE SET
  words_read_count = words_read_count + 1;
```

### 単語を未読に戻す
```sql
-- 単語の既読フラグをリセット
UPDATE words
SET is_read = 0, read_at = NULL
WHERE id = ?;

-- 同日の統計を更新（カウント減）
UPDATE daily_stats
SET words_read_count = words_read_count - 1
WHERE date = date('now') AND words_read_count > 0;
```

### 単語削除
```sql
DELETE FROM words WHERE id = ?;
```

### 単語検索（重複チェック）

**⚠️ ユーザー入力を正規化してから検索してください**

```sql
SELECT * FROM words
WHERE english = ?
LIMIT 1;
```

```typescript
// TypeScript実装例
const sanitizedWord = userInput.trim().toLowerCase();
const word = await db.getFirstAsync<Word>(
  'SELECT * FROM words WHERE english = ? LIMIT 1',
  [sanitizedWord]  // ✅ プレースホルダー使用
);
```

### 進捗統計取得

#### 総単語数・既読数
```sql
SELECT
  COUNT(*) as total_words,
  SUM(CASE WHEN is_read = 1 THEN 1 ELSE 0 END) as read_words,
  ROUND(
    CAST(SUM(CASE WHEN is_read = 1 THEN 1 ELSE 0 END) AS FLOAT) / COUNT(*) * 100,
    1
  ) as read_percentage
FROM words;
```

#### 今週の学習日数
```sql
SELECT COUNT(DISTINCT date) as days_this_week
FROM daily_stats
WHERE date >= date('now', '-7 days');
```

#### 連続学習日数
```sql
WITH RECURSIVE dates AS (
  SELECT date('now') as d
  UNION ALL
  SELECT date(d, '-1 day')
  FROM dates
  WHERE EXISTS (
    SELECT 1 FROM daily_stats WHERE date = date(d, '-1 day')
  )
)
SELECT COUNT(*) as streak FROM dates;
```

#### 今日学習した単語数
```sql
SELECT COUNT(*) as today_count
FROM words
WHERE date(read_at) = date('now');
```

### カレンダー表示用データ取得

#### 指定月の学習日
```sql
SELECT date, words_read_count
FROM daily_stats
WHERE date BETWEEN ? AND ?
ORDER BY date;
```

例：2025年1月のデータ取得
```sql
SELECT date, words_read_count
FROM daily_stats
WHERE date BETWEEN '2025-01-01' AND '2025-01-31'
ORDER BY date;
```

### データエクスポート
```sql
SELECT
  english,
  japanese,
  definition,
  post_url,
  is_read,
  created_at,
  read_at
FROM words
ORDER BY created_at DESC;
```

### データ削除（すべて）
```sql
-- すべての単語を削除
DELETE FROM words;

-- すべての統計を削除
DELETE FROM daily_stats;

-- VACUUM（ストレージ最適化）
VACUUM;
```

## データベース初期化

### 初期化コード例（TypeScript）

```typescript
import * as SQLite from 'expo-sqlite';

export async function initDatabase() {
  const db = await SQLite.openDatabaseAsync('soratan.db');
  
  // wordsテーブル作成
  // japanese はNULL許可（DeepL API Key未設定時）
  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS words (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      english TEXT NOT NULL,
      japanese TEXT,
      definition TEXT,
      post_url TEXT,
      post_text TEXT,
      is_read INTEGER DEFAULT 0 CHECK(is_read IN (0, 1)),
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      read_at DATETIME
    );
  `);
  
  // daily_statsテーブル作成
  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS daily_stats (
      date TEXT PRIMARY KEY,
      words_read_count INTEGER DEFAULT 0
    );
  `);
  
  // schema_versionテーブル作成
  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS schema_version (
      version INTEGER PRIMARY KEY,
      applied_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);
  
  // インデックス作成
  await db.execAsync(`
    CREATE INDEX IF NOT EXISTS idx_words_english ON words(english);
    CREATE INDEX IF NOT EXISTS idx_words_created_at ON words(created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_words_is_read ON words(is_read);
    CREATE INDEX IF NOT EXISTS idx_words_read_at ON words(read_at);
    CREATE INDEX IF NOT EXISTS idx_daily_stats_date ON daily_stats(date DESC);
  `);
  
  // 初期バージョン登録
  await db.runAsync(`
    INSERT OR IGNORE INTO schema_version (version) VALUES (1);
  `);
  
  return db;
}
```

## マイグレーション戦略

### バージョン管理

将来的にスキーマ変更が必要な場合のマイグレーション例

```typescript
async function migrateDatabase(db: SQLite.SQLiteDatabase) {
  const result = await db.getFirstAsync<{ version: number }>(
    'SELECT version FROM schema_version ORDER BY version DESC LIMIT 1'
  );
  
  const currentVersion = result?.version || 0;
  
  // Version 2へのマイグレーション例
  if (currentVersion < 2) {
    await db.execAsync(`
      ALTER TABLE words ADD COLUMN pronunciation TEXT;
    `);
    await db.runAsync(
      'INSERT INTO schema_version (version) VALUES (2)'
    );
  }
  
  // Version 3へのマイグレーション例
  if (currentVersion < 3) {
    await db.execAsync(`
      CREATE TABLE tags (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL UNIQUE
      );
      
      CREATE TABLE word_tags (
        word_id INTEGER,
        tag_id INTEGER,
        PRIMARY KEY (word_id, tag_id),
        FOREIGN KEY (word_id) REFERENCES words(id) ON DELETE CASCADE,
        FOREIGN KEY (tag_id) REFERENCES tags(id) ON DELETE CASCADE
      );
    `);
    await db.runAsync(
      'INSERT INTO schema_version (version) VALUES (3)'
    );
  }
}
```

## パフォーマンス考慮

### インデックス戦略
- `english`: 単語検索・重複チェック用
- `created_at`: 登録日時順ソート用
- `is_read`: フィルタリング用
- `read_at`: 進捗統計計算用

### クエリ最適化
- 必要なカラムのみSELECT
- LIMITを使用してページネーション
- WHERE句でインデックスを活用
- 複雑な集計はキャッシュ検討

### トランザクション
複数のクエリをまとめて実行する場合はトランザクションを使用

```typescript
await db.withTransactionAsync(async () => {
  await db.runAsync(
    'UPDATE words SET is_read = 1, read_at = CURRENT_TIMESTAMP WHERE id = ?',
    [wordId]
  );
  
  await db.runAsync(`
    INSERT INTO daily_stats (date, words_read_count)
    VALUES (date('now'), 1)
    ON CONFLICT(date) DO UPDATE SET
      words_read_count = words_read_count + 1
  `);
});
```

## バックアップ・復元

### データエクスポート（JSON）

```typescript
async function exportData(db: SQLite.SQLiteDatabase): Promise<string> {
  const words = await db.getAllAsync('SELECT * FROM words ORDER BY created_at');
  const stats = await db.getAllAsync('SELECT * FROM daily_stats ORDER BY date');
  
  const data = {
    version: 1,
    exported_at: new Date().toISOString(),
    words,
    daily_stats: stats,
  };
  
  return JSON.stringify(data, null, 2);
}
```

### データインポート

```typescript
async function importData(db: SQLite.SQLiteDatabase, jsonData: string) {
  const data = JSON.parse(jsonData);
  
  await db.withTransactionAsync(async () => {
    // 既存データ削除
    await db.runAsync('DELETE FROM words');
    await db.runAsync('DELETE FROM daily_stats');
    
    // wordsインポート
    for (const word of data.words) {
      await db.runAsync(
        `INSERT INTO words (english, japanese, definition, post_url, post_text, is_read, created_at, read_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          word.english,
          word.japanese,
          word.definition,
          word.post_url,
          word.post_text,
          word.is_read,
          word.created_at,
          word.read_at,
        ]
      );
    }
    
    // statsインポート
    for (const stat of data.daily_stats) {
      await db.runAsync(
        'INSERT INTO daily_stats (date, words_read_count) VALUES (?, ?)',
        [stat.date, stat.words_read_count]
      );
    }
  });
}
```

## データ整合性

### 制約
- `is_read`: 0または1のみ（CHECK制約）
- `date`: YYYY-MM-DD形式（アプリ側でバリデーション）
- `english`: NOT NULL、空文字列を許可しない（アプリ側でバリデーション）
- `japanese`: NULL許可（DeepL API Key未設定時）

### カスケード削除
将来的にタグ機能などを追加する場合、外部キー制約とカスケード削除を実装

## セキュリティベストプラクティス

### 1. SQLインジェクション対策

**すべてのクエリでプレースホルダーを使用**

```typescript
// ✅ 安全な実装
await db.runAsync('SELECT * FROM words WHERE english = ?', [userInput]);
await db.runAsync('DELETE FROM words WHERE id = ?', [wordId]);

// ❌ 危険な実装（絶対に使用しない）
// await db.runAsync(`SELECT * FROM words WHERE english = '${userInput}'`);
// await db.runAsync(`DELETE FROM words WHERE id = ${wordId}`);
```

### 2. 入力の正規化

```typescript
// 単語を保存する前に正規化
function sanitizeWord(input: string): string {
  return input.trim().toLowerCase();
}

// 使用例
const sanitizedWord = sanitizeWord(userInput);
if (sanitizedWord.length === 0 || sanitizedWord.length > 100) {
  throw new Error('Invalid word length');
}
```

### 3. トランザクションの使用

複数の関連するクエリは必ずトランザクション内で実行

```typescript
await db.withTransactionAsync(async () => {
  // 複数のクエリをまとめて実行
  // エラー時は自動ロールバック
});
```

### 4. エラーハンドリング

```typescript
async function safeDbOperation<T>(
  operation: () => Promise<T>,
  errorMessage: string
): Promise<Result<T, AppError>> {
  try {
    const result = await operation();
    return { success: true, data: result };
  } catch (error) {
    console.error(`Database error: ${errorMessage}`, error);
    return {
      success: false,
      error: new AppError(ErrorCode.DATABASE_ERROR, errorMessage, error),
    };
  }
}
```

### 5. 機密データの保護

- **SQLiteには機密データ（トークン、API Key）を保存しない**
- 認証情報は `expo-secure-store` を使用
- デバッグログにクエリ結果を出力する際は機密情報をマスク
