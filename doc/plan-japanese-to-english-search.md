# 日本語→英語検索機能 実装計画書

## 1. 概要

### 目的
JMdict辞書を使用して、日本語（ひらがな/カタカナ/漢字）から英語訳を取得する逆引き検索機能を実装する。

### 現状
- **英語→日本語**: JMdict + DeepLフォールバックで実装済み
- **日本語→英語**: 未実装

### ゴール
- 日本語入力から英語訳を取得できる
- 既存の英語→日本語と同等の検索体験を提供
- UIは自動検出で切り替え（追加操作不要）

---

## 2. 現状分析

### データベース構造（現在）

```sql
-- entries: 日本語エントリ
entries (id, kanji, kana, is_common, priority)
  - idx_entries_kanji ON entries(kanji)
  - idx_entries_kana ON entries(kana)

-- glosses: 英語訳
glosses (entry_id, gloss, gloss_normalized, part_of_speech, sense_index)
  - idx_glosses_normalized ON glosses(gloss_normalized) -- 英語検索用
  - glosses_fts (FTS5) -- 英語全文検索用
```

### 検索フロー（現在）

```
英語入力 → lookupJMdict()
         → 完全一致 (gloss_normalized = ?)
         → FTS5検索 (glosses_fts MATCH ?)
         → LIKE検索 (gloss_normalized LIKE ?)
         → JMdictResult[]
```

### 日本語→英語に必要な変更

| レイヤー | 変更内容 |
|---------|---------|
| **DB** | 日本語検索用インデックス（オプション、現状でも可） |
| **Service** | `lookupJMdictReverse()` 関数追加 |
| **translate.ts** | `translateToEnglishWithFallback()` 関数追加 |
| **UI** | 言語自動検出で検索方向を切り替え |

---

## 3. 実装アプローチ

### 方針: 最小限の変更で実装

1. **データベース変更なし**（Phase 1）
   - `kanji`/`kana`カラムには既存インデックスあり
   - 完全一致検索は既存構造で対応可能

2. **サービス層に逆引き関数を追加**
   - `lookupJMdictReverse(japaneseText)` → 英語訳を返す
   - `translateToEnglishWithFallback()` → DeepLフォールバック付き

3. **UI層は自動検出**
   - 入力テキストの言語を判定
   - 日本語なら逆引き、英語なら正引き

---

## 4. 実装フェーズ

### Phase 1: 基本実装（MVP）

#### 4.1.1 サービス層

**ファイル**: `src/services/dictionary/jmdict.ts`

```typescript
/**
 * 日本語からJMdictエントリを検索（逆引き）
 */
export async function lookupJMdictReverse(
  japaneseText: string
): Promise<Result<JMdictReverseResult[], AppError>>
```

**検索ロジック**:
1. 入力テキストを正規化（カタカナ→ひらがな変換）
2. `entries.kanji` で完全一致検索
3. `entries.kana` で完全一致検索
4. 結果から英語訳（glosses）を取得
5. 優先度でソート（is_common, priority）

**SQLクエリ例**:
```sql
SELECT e.id, e.kanji, e.kana, e.is_common, e.priority,
       g.gloss, g.part_of_speech
FROM entries e
JOIN glosses g ON e.id = g.entry_id
WHERE e.kanji = ? OR e.kana = ?
ORDER BY e.priority DESC, e.is_common DESC, g.sense_index ASC
LIMIT 20
```

#### 4.1.2 翻訳統合層

**ファイル**: `src/services/dictionary/translate.ts`

```typescript
/**
 * 日本語から英語に翻訳（統合版）
 */
export async function translateToEnglishWithFallback(
  text: string,
  options?: TranslateOptions
): Promise<Result<ExtendedTranslateResult, AppError>>
```

**フォールバック戦略**:
1. JMdict逆引き検索
2. DeepL API（target_lang: 'EN'）

#### 4.1.3 型定義

**ファイル**: `src/types/word.ts`

```typescript
export interface JMdictReverseResult {
  entry: JMdictEntry;
  englishGlosses: string[];
  partOfSpeech: string[];
}
```

---

### Phase 2: UI統合

#### 4.2.1 言語検出ユーティリティ

**ファイル**: `src/utils/languageDetect.ts`

```typescript
/**
 * テキストが日本語かどうかを判定
 */
export function isJapaneseText(text: string): boolean {
  // ひらがな、カタカナ、漢字を含むかチェック
  return /[\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF]/.test(text);
}
```

#### 4.2.2 WordPopup統合

**ファイル**: `src/components/WordPopup/hooks/useWordLookup.ts`

- 入力言語を自動検出
- 日本語なら `translateToEnglishWithFallback()` を呼び出し
- 結果表示を切り替え（日本語訳セクション → 英語訳セクション）

#### 4.2.3 表示コンポーネント

**変更点**:
- 日本語入力時: 「英語の意味」セクションを表示
- 読み仮名、品詞情報も表示

---

### Phase 3: 拡張機能（将来）

- **形態素解析統合**: 活用形→基本形変換（kuromoji.js）
- **あいまい検索**: ひらがな部分一致
- **FTS5日本語対応**: 日本語全文検索インデックス追加

---

## 5. 詳細タスク

### Phase 1 タスク

| # | タスク | ファイル | 工数目安 |
|---|--------|----------|----------|
| 1-1 | `JMdictReverseResult` 型定義追加 | `src/types/word.ts` | 小 |
| 1-2 | カタカナ→ひらがな変換関数 | `src/utils/japanese.ts`（新規） | 小 |
| 1-3 | `lookupJMdictReverse()` 実装 | `src/services/dictionary/jmdict.ts` | 中 |
| 1-4 | `translateWithJMdictReverse()` 実装 | `src/services/dictionary/jmdict.ts` | 小 |
| 1-5 | `translateToEnglishWithFallback()` 実装 | `src/services/dictionary/translate.ts` | 中 |
| 1-6 | 単体テスト作成 | `__tests__/jmdict.test.ts` | 中 |

### Phase 2 タスク

| # | タスク | ファイル | 工数目安 |
|---|--------|----------|----------|
| 2-1 | `isJapaneseText()` 実装 | `src/utils/languageDetect.ts`（新規） | 小 |
| 2-2 | `useWordLookup` フック拡張 | `src/components/WordPopup/hooks/useWordLookup.ts` | 中 |
| 2-3 | 英語訳表示セクション追加 | `src/components/WordPopup/WordPopupModal.tsx` | 中 |
| 2-4 | E2Eテスト作成 | - | 中 |

---

## 6. テスト戦略

### 単体テスト

```typescript
describe('lookupJMdictReverse', () => {
  it('漢字で検索できる', async () => {
    const result = await lookupJMdictReverse('美しい');
    expect(result.success).toBe(true);
    expect(result.data[0].englishGlosses).toContain('beautiful');
  });

  it('ひらがなで検索できる', async () => {
    const result = await lookupJMdictReverse('うつくしい');
    expect(result.success).toBe(true);
  });

  it('カタカナをひらがなに変換して検索', async () => {
    const result = await lookupJMdictReverse('ウツクシイ');
    expect(result.success).toBe(true);
  });

  it('存在しない単語はエラー', async () => {
    const result = await lookupJMdictReverse('あああああ');
    expect(result.success).toBe(false);
    expect(result.error.code).toBe(ErrorCode.WORD_NOT_FOUND);
  });
});
```

### 統合テスト

- 言語検出 → 適切な検索関数の呼び出し
- DeepLフォールバックの動作確認
- キャッシュ動作確認

---

## 7. リスクと軽減策

| リスク | 影響 | 軽減策 |
|--------|------|--------|
| 完全一致のみでは検索ヒット率が低い | ユーザー体験低下 | Phase 3で形態素解析を追加 |
| 漢字の読み方が複数ある | 意図しない結果 | 複数候補を表示、優先度でソート |
| DB検索が遅い | パフォーマンス低下 | LRUキャッシュ活用（既存） |
| DeepLフォールバック頻発 | API使用量増加 | JMdictの検索改善を優先 |

---

## 8. 成功基準

- [ ] 日本語（漢字/ひらがな/カタカナ）で英語訳を取得できる
- [ ] 検索結果に品詞情報が含まれる
- [ ] JMdictで見つからない場合、DeepLにフォールバック
- [ ] 既存の英語→日本語検索に影響なし
- [ ] 単体テストカバレッジ 80%以上

---

## 9. 参考リンク

- [JMdict](https://www.edrdg.org/wiki/index.php/JMdict-EDICT_Dictionary_Project)
- [ADR-007: JMdict辞書統合](./adr/ADR-007-jmdict-dictionary-integration.md)
- [kumotan-dictionary リポジトリ](https://github.com/RieTamura/kumotan-dictionary)
