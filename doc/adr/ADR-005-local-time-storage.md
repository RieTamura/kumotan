# ADR-005: ローカル時刻での日時保存

## ステータス

採用 (Accepted)

## 日付

2026-01-06

## コンテキスト

くもたんアプリでは、以下の日時情報を保存する必要がある:

1. **created_at**: 単語を登録した日時
2. **read_at**: 単語を既読にした日時
3. **daily_stats.date**: 日別統計の日付

これらの日時は以下の用途で使用される:

- **ユーザー体験**: 「今日登録した単語」「昨日学習した単語」
- **カレンダー表示**: 日本時間（JST）で「1月6日に学習した」
- **統計計算**: 連続学習日数、今週の学習日数

タイムゾーンと日時保存方式の選択肢:

### 選択肢1: UTC（協定世界時）で保存
- **メリット**:
  - タイムゾーン独立
  - 将来のクラウド同期で統一しやすい
  - ベストプラクティス（多くのシステムで推奨）
- **デメリット**:
  - ユーザーの体感と不一致
  - 日本時間23:00に登録した単語が、UTCでは翌日00:00扱い
  - 「今日」の判定が複雑（ローカルタイムゾーンへの変換が必要）
  - カレンダー表示で混乱（日本で1/6に学習したのに、UTCでは1/5扱い）

### 選択肢2: ローカル時刻（JST: 日本標準時）で保存
- **メリット**:
  - ユーザーの体感と一致
  - 「今日」の判定が直感的（`date('now', 'localtime')`）
  - カレンダー表示が正確
  - タイムゾーン変換不要（クエリが高速）
- **デメリット**:
  - 将来のグローバル展開で複雑化
  - ユーザーがタイムゾーンを変更した場合の不整合
  - サマータイム（Daylight Saving Time）の影響（日本は無し）

### 選択肢3: UNIX Timestamp（エポック秒）
- **メリット**:
  - タイムゾーン独立
  - 計算が高速（整数演算）
- **デメリット**:
  - 人間にとって可読性が低い
  - SQLiteで日付範囲クエリが複雑
  - デバッグが困難

## 決定

**選択肢2: ローカル時刻（JST）で保存**

## 理由

1. **ユーザー体験を優先**
   - くもたんの主な機能は「学習記録」
   - ユーザーは「今日何個学習したか」を直感的に知りたい
   - 日本時間23:50に学習したのに、翌日扱いされるのは不自然

2. **ターゲットユーザーの明確性**
   - 初期ターゲット: 英語を学習中の日本語話者
   - 想定ユーザー数: 〜1000人（全員日本在住と仮定）
   - Phase 3でグローバル展開予定だが、それまではJST固定で問題なし

3. **日本ではサマータイム無し**
   - JSTは年中UTC+9で固定
   - サマータイムの複雑さを考慮不要

4. **SQLiteの `localtime` 修飾子**
   - SQLiteは `datetime('now', 'localtime')` で現地時刻を取得可能
   - OSのタイムゾーン設定を自動的に反映

5. **将来の移行パス**
   - Phase 4でクラウド同期する際、以下の戦略で対応可能:
     - サーバー側でユーザーのタイムゾーン設定を保存
     - ローカルDBの日時をUTCに変換してアップロード
     - ダウンロード時にユーザーのタイムゾーンに変換して保存

6. **データベースクエリの簡潔性**
   ```sql
   -- ✅ シンプル: ローカル時刻
   SELECT * FROM words WHERE date(created_at) = date('now', 'localtime');

   -- ❌ 複雑: UTC保存の場合
   SELECT * FROM words WHERE date(created_at, '+9 hours') = date('now', 'localtime');
   ```

## 影響

### データベース実装

```sql
-- created_atにローカル時刻を自動設定
CREATE TABLE IF NOT EXISTS words (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  english TEXT NOT NULL,
  created_at DATETIME DEFAULT (datetime('now', 'localtime')),
  read_at DATETIME
);

-- 単語登録時（明示的にローカル時刻を設定）
INSERT INTO words (english, japanese, definition, post_url, post_text, created_at)
VALUES (?, ?, ?, ?, ?, datetime('now', 'localtime'));

-- 既読切り替え時
UPDATE words
SET is_read = 1, read_at = datetime('now', 'localtime')
WHERE id = ?;
```

### 日別統計の生成

```sql
-- 今日の日付（ローカル時刻）
INSERT INTO daily_stats (date, words_read_count)
VALUES (date('now', 'localtime'), 1)
ON CONFLICT(date) DO UPDATE SET
  words_read_count = words_read_count + 1;
```

### クエリ例

```sql
-- 今日登録した単語
SELECT * FROM words
WHERE date(created_at) = date('now', 'localtime');

-- 今週学習した日数
SELECT COUNT(DISTINCT date)
FROM daily_stats
WHERE date >= date('now', 'localtime', '-7 days')
  AND words_read_count > 0;

-- 特定月のカレンダーデータ
SELECT date, words_read_count
FROM daily_stats
WHERE date BETWEEN '2026-01-01' AND '2026-01-31'
ORDER BY date;
```

### タイムゾーン変更時の挙動

デバイスのタイムゾーン設定が変更された場合:

- **既存データ**: 変更されない（文字列として保存済み）
- **新規データ**: 新しいタイムゾーンで保存される
- **影響**: ユーザーが日本→アメリカに移動した場合、過去の日本時間データと新しいアメリカ時間データが混在

**緩和策**:
```typescript
// アプリ起動時にタイムゾーン変更を検出
const storedTimezone = await AsyncStorage.getItem('timezone');
const currentTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;

if (storedTimezone && storedTimezone !== currentTimezone) {
  // ユーザーに警告表示
  Alert.alert(
    'タイムゾーン変更を検知',
    '学習記録の日時が正確でなくなる可能性があります。問題がある場合は設定からデータをリセットしてください。'
  );
}

await AsyncStorage.setItem('timezone', currentTimezone);
```

### データエクスポート時のフォーマット

```typescript
// エクスポートJSON（ローカル時刻を明示）
{
  "words": [
    {
      "id": 1,
      "english": "hello",
      "created_at": "2026-01-06 15:30:00",  // JST (UTC+9)
      "timezone": "Asia/Tokyo"
    }
  ],
  "metadata": {
    "exported_at": "2026-01-06T15:30:00+09:00",
    "timezone": "Asia/Tokyo",
    "format_version": "1.0"
  }
}
```

## トレードオフ

### 受け入れるデメリット

- **グローバル展開時の複雑化**: 将来的にタイムゾーン対応が必要
  - **緩和策**: Phase 3でタイムゾーン設定機能を追加
  - **移行パス**: サーバー側で各ユーザーのタイムゾーンを管理
  - **影響範囲**: Phase 3以降（2年後を想定）

- **タイムゾーン変更時の不整合**: ユーザーが海外移住した場合
  - **緩和策**: タイムゾーン変更検知と警告表示
  - **影響範囲**: 極めて少数のユーザー（想定 < 1%）

### 得られるメリット

- **ユーザー体感の正確性**: 「今日」が直感的
- **実装のシンプルさ**: タイムゾーン変換不要
- **パフォーマンス**: 追加の計算なし
- **デバッグの容易性**: ログが人間にとって可読

## Phase 3以降の拡張計画

### ユーザーごとのタイムゾーン設定

```typescript
// settings テーブルに追加
CREATE TABLE IF NOT EXISTS user_settings (
  key TEXT PRIMARY KEY,
  value TEXT
);

INSERT INTO user_settings (key, value)
VALUES ('timezone', 'Asia/Tokyo');

// アプリ設定画面でタイムゾーン選択可能に
const timezones = [
  'Asia/Tokyo',      // 日本標準時 (UTC+9)
  'America/New_York', // 東部標準時 (UTC-5/-4)
  'Europe/London',    // グリニッジ標準時 (UTC+0/+1)
  // ...
];
```

### クラウド同期時のUTC変換

```typescript
// アップロード時: ローカル時刻 → UTC
function convertToUTC(localTime: string, timezone: string): string {
  const dt = new Date(localTime);
  return dt.toISOString(); // UTC形式
}

// ダウンロード時: UTC → ローカル時刻
function convertToLocalTime(utcTime: string, timezone: string): string {
  const dt = new Date(utcTime);
  return dt.toLocaleString('sv-SE', { timeZone: timezone }); // YYYY-MM-DD HH:mm:ss
}
```

## 過去の実装経緯

### マイグレーション履歴

- **Version 1**: created_atをUTCで保存（初期実装）
- **Version 2**: UTCをJSTに変換するマイグレーション（失敗、9時間引いてしまった）
- **Version 3**: 修正、9時間足してJSTに戻す
- **Version 4**: さらに修正、最終的にJSTで統一

この経緯から、**初めからローカル時刻で保存すべき**という教訓を得た。

## 参照

- SQLite Date and Time Functions: https://www.sqlite.org/lang_datefunc.html
- ISO 8601 Date and Time Format: https://www.iso.org/iso-8601-date-and-time-format.html
- JavaScript Intl.DateTimeFormat: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Intl/DateTimeFormat
- 実装: src/services/database/init.ts (L118-L195)

## ステークホルダー

- **決定者**: RieTamura（開発者）
- **影響を受ける人**: くもたんアプリのすべてのユーザー

## レビュー日

次回レビュー予定: Phase 3開始時（グローバル展開検討時）
