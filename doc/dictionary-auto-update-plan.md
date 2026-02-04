# 辞書データ自動更新計画書

## 概要

フィードバックから辞書データの修正を半自動化する仕組みを構築する。
GitHub Actionsを活用し、承認済みフィードバックを差分ファイル（JSON）として管理し、アプリ側で自動適用する。

## 現状のフロー

```
ユーザー → フィードバック送信 → GAS → GitHub Issue作成
                                    ↓
                              スプレッドシート保存
                                    ↓
                              開発者が手動で辞書修正
```

**課題**: 辞書修正が手動のため、対応に時間がかかる

## 新しいフロー（差分ファイル方式）

```
ユーザー → フィードバック送信 → GAS → GitHub Issue作成
                                         ↓
                                    開発者がレビュー
                                         ↓
                                「approved」ラベル付与
                                         ↓
                              GitHub Actions トリガー
                                         ↓
                              overrides.json に自動追記
                                         ↓
                              GitHub Pages で配信
                                         ↓
                              アプリが差分を適用
```

## 技術設計

### 1. 差分ファイル形式（overrides.json）

```json
{
  "version": "1.0.0",
  "updated_at": "2026-02-04T12:00:00Z",
  "entries": [
    {
      "id": "override_001",
      "type": "correction",
      "word": "example",
      "original_meaning": "誤った意味",
      "corrected_meaning": "正しい意味",
      "source_issue": 123,
      "approved_at": "2026-02-04T12:00:00Z"
    },
    {
      "id": "override_002",
      "type": "addition",
      "word": "newword",
      "meaning": "新しい単語の意味",
      "reading": "ニューワード",
      "source_issue": 124,
      "approved_at": "2026-02-04T13:00:00Z"
    }
  ]
}
```

**エントリタイプ**:
- `correction`: 既存の意味を修正
- `addition`: 新しい単語を追加
- `deletion`: 単語を非表示（将来対応）

### 2. GitHub Actions ワークフロー

**トリガー**: Issueに「approved」ラベルが付与されたとき

```yaml
# .github/workflows/dictionary-update.yml (kumotan-dictionaryリポジトリ)
name: Dictionary Auto Update

on:
  issues:
    types: [labeled]

jobs:
  update-overrides:
    if: github.event.label.name == 'approved' && contains(github.event.issue.labels.*.name, 'word_search')
    runs-on: ubuntu-latest
    permissions:
      contents: write
    steps:
      - uses: actions/checkout@v4

      - name: Parse Issue and Update overrides.json
        uses: actions/github-script@v7
        with:
          script: |
            const fs = require('fs');
            const issue = context.payload.issue;

            // Issue本文から情報を抽出
            const body = issue.body;
            const wordMatch = body.match(/\*\*対象\/件名\*\*: (.+)/);
            const correctionMatch = body.match(/\*\*詳細\/期待内容\*\*: (.+)/);

            if (!wordMatch || !correctionMatch) {
              console.log('Required fields not found in issue body');
              return;
            }

            const word = wordMatch[1].trim();
            const correctedMeaning = correctionMatch[1].trim();

            // overrides.json を読み込み
            let overrides = { version: "1.0.0", updated_at: "", entries: [] };
            const filePath = 'overrides.json';
            if (fs.existsSync(filePath)) {
              overrides = JSON.parse(fs.readFileSync(filePath, 'utf8'));
            }

            // 新しいエントリを追加
            const newEntry = {
              id: `override_${Date.now()}`,
              type: "correction",
              word: word,
              corrected_meaning: correctedMeaning,
              source_issue: issue.number,
              approved_at: new Date().toISOString()
            };

            overrides.entries.push(newEntry);
            overrides.updated_at = new Date().toISOString();

            // ファイルを保存
            fs.writeFileSync(filePath, JSON.stringify(overrides, null, 2));

      - name: Commit and Push
        run: |
          git config user.name "github-actions[bot]"
          git config user.email "github-actions[bot]@users.noreply.github.com"
          git add overrides.json
          git commit -m "chore: add dictionary override from issue #${{ github.event.issue.number }}" || exit 0
          git push
```

### 3. アプリ側の実装

#### 3.1 差分ファイルのダウンロード

`ExternalDictionaryService.ts` に追加:

```typescript
// 差分ファイルのURL
const OVERRIDES_URL = `${DICTIONARY_CONFIG.BASE_URL}/overrides.json`;

interface DictionaryOverride {
  id: string;
  type: 'correction' | 'addition' | 'deletion';
  word: string;
  corrected_meaning?: string;
  meaning?: string;
  reading?: string;
  source_issue: number;
  approved_at: string;
}

interface OverridesFile {
  version: string;
  updated_at: string;
  entries: DictionaryOverride[];
}

/**
 * 差分ファイルをダウンロード
 */
async function fetchOverrides(): Promise<OverridesFile | null> {
  try {
    const response = await fetch(OVERRIDES_URL);
    if (!response.ok) return null;
    return await response.json();
  } catch {
    return null;
  }
}
```

#### 3.2 辞書検索時の差分適用

`jmdict.ts` の検索ロジックを更新:

```typescript
/**
 * 辞書検索（差分適用版）
 */
async function lookupWord(word: string): Promise<DictionaryResult> {
  // 1. まず差分ファイルをチェック
  const overrides = await getOverrides();
  const override = overrides?.entries.find(
    e => e.word.toLowerCase() === word.toLowerCase()
  );

  if (override) {
    // 差分が見つかった場合は優先適用
    return {
      word: override.word,
      meaning: override.corrected_meaning || override.meaning,
      source: 'override',
    };
  }

  // 2. 差分がなければ通常の辞書検索
  return await searchJMdict(word);
}
```

#### 3.3 差分ファイルのキャッシュ

- アプリ起動時に差分ファイルをダウンロード
- AsyncStorageにキャッシュ（有効期限: 1時間）
- オフライン時はキャッシュを使用

### 4. 配信設定（kumotan-dictionary）

GitHub Pagesで `overrides.json` を配信:

```
https://rietamura.github.io/kumotan-dictionary/overrides.json
```

## 承認フロー

1. **フィードバック受信**: ユーザーがアプリから送信
2. **Issue作成**: GAS経由でGitHub Issueが自動作成（ラベル: `word_search`）
3. **開発者レビュー**: 内容を確認し、正しければ「approved」ラベルを付与
4. **自動更新**: GitHub Actionsが `overrides.json` を更新
5. **配信**: GitHub Pagesで即座に配信開始
6. **アプリ反映**: ユーザーのアプリが次回起動時に差分を取得

## 実装ステップ

### Phase 1: 基盤構築（2-3時間）

1. [ ] `kumotan-dictionary` リポジトリに `overrides.json` を作成（空の初期ファイル）
2. [ ] GitHub Actions ワークフロー作成（`dictionary-update.yml`）
3. [ ] 「approved」ラベルを作成

### Phase 2: アプリ側実装（3-4時間）

1. [ ] `ExternalDictionaryService.ts` に差分取得機能を追加
2. [ ] `jmdict.ts` に差分適用ロジックを追加
3. [ ] 差分キャッシュ機能を実装

### Phase 3: テスト・検証（1-2時間）

1. [ ] テスト用Issueを作成し、承認→自動更新の動作確認
2. [ ] アプリ側で差分が正しく適用されるか確認
3. [ ] オフライン時の動作確認

### Phase 4: ドキュメント・運用準備（1時間）

1. [ ] 運用手順書の作成
2. [ ] requirements.md の更新

**合計見積もり**: 7-10時間

## セキュリティ考慮

- **承認必須**: 「approved」ラベルは開発者のみ付与可能
- **差分のみ**: 辞書DB全体ではなく差分のみを管理
- **監査ログ**: 全ての変更がGitHub Issueに紐づく
- **ロールバック可能**: Gitの履歴から過去の状態に戻せる

## 将来の拡張

1. **バッチ統合**: 差分が一定数溜まったら辞書DBを再ビルド
2. **複数承認**: コミュニティ機能で複数ユーザーの承認を必要とする
3. **自動承認**: AIによる内容チェックで明らかに正しいものは自動承認

## 参考情報

- 現在のフィードバックワークフロー: `.github/workflows/feedback-integration.yml`
- 辞書配信URL: `https://rietamura.github.io/kumotan-dictionary/`
- 辞書設定: `src/constants/config.ts` の `DICTIONARY_CONFIG`

---

**作成日**: 2026-02-04
**ステータス**: 計画段階
