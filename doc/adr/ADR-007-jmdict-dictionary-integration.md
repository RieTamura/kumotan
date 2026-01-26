# ADR-007: JMdict辞書統合

## ステータス

採用 (Accepted)

## 日付

2026-01-22

## コンテキスト

くもたんアプリでは、英単語を日本語に翻訳する機能を提供している。現在はDeepL API（Free版）を使用しているが、以下の課題がある:

1. **ユーザー体験の障壁**
   - DeepL API Keyの取得・設定が必要（ユーザー離脱の原因）
   - オフライン環境では翻訳機能が使用不可
   - APIレスポンス待機時間（200-500ms）

2. **コスト・制限**
   - DeepL Free版は月間50万文字制限
   - ヘビーユーザーは制限に達する可能性

3. **ユースケース分析**（推定）
   ```
   単語（1語）:        85%    // "beautiful", "apple", "understand"
   短フレーズ（2-3語）: 12%    // "how are you", "thank you"
   文章（4語以上）:     3%     // Bluesky投稿の一部抜粋
   ```

### 技術的背景

- **SQLiteは導入済み**（expo-sqlite v16.0.10、ADR-003）
- 既存インフラ: words/daily_statsテーブル、マイグレーション管理、LRUキャッシュ
- Result型パターンでエラーハンドリング統一済み

### 選択肢1: DeepL API継続使用（現状維持）

- **メリット**:
  - 既に実装済み
  - 高品質な翻訳（文脈考慮）
- **デメリット**:
  - API Key設定必須（UX悪化）
  - オフライン非対応
  - 単語レベルの翻訳には過剰

### 選択肢2: JMdict辞書のみに置き換え

- **メリット**:
  - API Key不要
  - オフライン完全対応
  - 高速（<10ms）
- **デメリット**:
  - 文章翻訳は不可能
  - フレーズの翻訳品質が低下

### 選択肢3: JMdict辞書 + DeepLフォールバック（ハイブリッド）

- **メリット**:
  - 単語翻訳: 高速・オフライン・無料
  - 文章翻訳: DeepLで高品質
  - ユーザーはAPI Key設定なしで基本機能を使用可能
- **デメリット**:
  - アプリサイズ増加（+20MB）
  - 実装複雑性の増加

### 選択肢4: TranslateGemma（オンデバイスLLM）

- **メリット**:
  - 文章翻訳も可能
  - オフライン対応
- **デメリット**:
  - アプリサイズ大幅増加（+950MB〜2GB）
  - 初期化時間が長い
  - バッテリー消費
  - Phase 2での検討が適切

## 決定

**選択肢3: JMdict辞書 + DeepLフォールバック（ハイブリッド）を採用**

## 理由

1. **ユーザー体験の大幅改善**
   - 初回起動時からAPI Key設定なしで翻訳機能が使用可能
   - オフライン環境でも単語レベルの翻訳が可能
   - レスポンス時間: 200-500ms → <10ms（85%のケース）

2. **技術的障壁の低さ**
   - SQLiteは既に導入済み（ADR-003）
   - 既存のLRUCache実装を流用可能
   - Result型パターンに合わせた実装が容易

3. **段階的アプローチ**
   - Phase 1: JMdict統合（本ADR）
   - Phase 2: TranslateGemma検討（将来）
   - リスクの低いものから着手

4. **JMdictの信頼性**
   - 20年以上の実績ある辞書プロジェクト
   - 214,000エントリ以上
   - Creative Commons BY-SA 4.0ライセンス

5. **コスト効率**
   - DeepL API使用量を85%削減可能
   - 無料枠に収まりやすくなる

## 影響

### 新規ファイル

```
scripts/jmdict/
├── download-jmdict.ts      # JMdictデータダウンロード
└── convert-to-sqlite.ts    # SQLite変換

src/services/dictionary/
├── jmdict.ts               # JMdict検索サービス
└── translate.ts            # 統合翻訳サービス（フォールバック付き）

assets/jmdict/
├── jmdict-eng.json         # 元データ（ビルド時のみ）
└── jmdict.db               # SQLiteデータベース（バンドル）
```

### データベーススキーマ

```sql
-- JMdictエントリテーブル
CREATE TABLE IF NOT EXISTS entries (
  id INTEGER PRIMARY KEY,
  kanji TEXT,
  kana TEXT NOT NULL,
  is_common INTEGER DEFAULT 0,
  priority INTEGER DEFAULT 0
);

-- 英語の意味テーブル（英語→日本語検索用）
CREATE TABLE IF NOT EXISTS glosses (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  entry_id INTEGER NOT NULL,
  gloss TEXT NOT NULL,
  gloss_normalized TEXT NOT NULL,  -- 小文字・正規化済み
  part_of_speech TEXT,
  sense_index INTEGER DEFAULT 0,
  FOREIGN KEY (entry_id) REFERENCES entries(id)
);

-- インデックス
CREATE INDEX idx_glosses_normalized ON glosses(gloss_normalized);
CREATE INDEX idx_glosses_entry ON glosses(entry_id);
CREATE INDEX idx_entries_common ON entries(is_common);

-- FTS5全文検索（オプション）
CREATE VIRTUAL TABLE glosses_fts USING fts5(gloss, content='glosses');
```

### フォールバック戦略

```typescript
async function translateToJapaneseWithFallback(text: string): Promise<Result<...>> {
  const isWord = isWordLevel(text);  // スペース数で判定

  // 1. 単語の場合: JMdict優先
  if (isWord) {
    const jmdictResult = await translateWithJMdict(text);
    if (jmdictResult.success) {
      return jmdictResult;  // <10ms
    }
    // JMdictで見つからない場合、DeepLにフォールバック
  }

  // 2. 文章の場合、またはJMdictで見つからない場合: DeepL
  if (await hasDeepLApiKey()) {
    return await translateWithDeepL(text);  // 200-500ms
  }

  // 3. DeepL未設定の場合
  return { success: false, error: 'API Key未設定' };
}
```

### キャッシュ戦略

```typescript
// JMdict用キャッシュ（既存LRUCache流用）
const jmdictCache = new LRUCache<JMdictTranslateResult>(200, 30 * 60 * 1000);
// - maxSize: 200エントリ（DeepLの100より多め）
// - TTL: 30分（オフラインデータなので長め）
```

### ライセンス表示要件

JMdict/EDRDGライセンスに基づき、アプリ内に以下の帰属表示が必要:

```
This application uses the JMdict/EDICT dictionary files.
These files are the property of the Electronic Dictionary Research
and Development Group, and are used in conformance with the Group's licence.
```

**表示場所**: 設定画面 → ライセンス情報

### アプリサイズへの影響

| 項目 | 現在 | JMdict統合後 |
|------|------|-------------|
| アプリサイズ（iOS） | ~50MB | ~70MB (+20MB) |
| SQLiteデータ | ~5MB | ~25MB (+20MB) |

## トレードオフ

### 受け入れるデメリット

- **アプリサイズ増加（+20MB）**
  - 緩和策: 初回ダウンロード方式も検討可能（Phase 2）
  - 影響: ダウンロード時間増加、ストレージ使用量増加

- **フレーズ翻訳の品質低下**
  - JMdictは辞書であり、フレーズ翻訳は限定的
  - 緩和策: 2語以上はDeepLにフォールバック

### 得られるメリット

- **UX改善**: API Key不要で即座に翻訳機能を使用可能
- **オフライン対応**: ネットワーク接続なしで単語翻訳
- **高速化**: 85%のケースで10倍以上の高速化
- **コスト削減**: DeepL API使用量を85%削減

## リスク分析

| リスク | 確率 | 影響 | 対策 |
|--------|------|------|------|
| 辞書品質がDeepLに劣る | 中 | 中 | ユーザーテスト、フィードバック収集 |
| 新語・スラング未対応 | 高 | 低 | 定期的なJMdict更新、DeepLフォールバック |
| App Store審査遅延 | 低 | 低 | ライセンス帰属表示を明記 |
| 既存wordsテーブルとの競合 | 低 | 中 | 別DBファイル（jmdict.db）で分離 |
| 初回DB初期化の時間増加 | 中 | 低 | プログレス表示、バックグラウンド処理 |

## 実装計画

### Phase 1（本ADR）

1. JMdictデータ準備スクリプト作成
2. SQLite変換スクリプト作成
3. jmdict.ts検索サービス実装
4. translate.ts統合サービス実装
5. テスト作成
6. ライセンス表示追加

### Phase 2（将来検討）

- TranslateGemma-4B INT4の統合
- 文章レベルのオフライン翻訳対応

## 参照

- JMdict Project: https://www.edrdg.org/wiki/index.php/JMdict-EDICT_Dictionary_Project
- JMdict Simplified: https://github.com/scriptin/jmdict-simplified
- EDRDG License: https://www.edrdg.org/edrdg/licence.html
- ADR-003: SQLiteローカルストレージ採用
- translation-model-evaluation-2026.md: 詳細な技術評価レポート

## ステークホルダー

- **決定者**: RieTamura（開発者）
- **影響を受ける人**: くもたんアプリのすべてのユーザー

## レビュー日

次回レビュー予定: Phase 2開始時（TranslateGemma検討時）
