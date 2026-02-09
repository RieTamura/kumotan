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

## 新しいフロー（ハイブリッド方式）

### フロー A：差分ファイル方式（単純な意味修正）

```text
ユーザー → フィードバック送信 → GAS → GitHub Issue作成
           （品詞・投稿リンク付き）        ↓
                                    開発者がレビュー
                                         ↓
                                「approved」ラベル付与
                                         ↓
                              GitHub Actions トリガー
                                         ↓
                              overrides.jsonに自動追記
                                         ↓
                              GitHub Pagesで配信
                                         ↓
                              アプリが差分を適用
```

### フロー B：PR方式（検索ロジック改善）

```text
ユーザー → フィードバック送信 → GAS → GitHub Issue作成
           （品詞・投稿リンク付き）        ↓
                                    開発者がトリアージ
                                         ↓
                              「search-improvement」ラベル付与
                                         ↓
                              GitHub ActionsでIssueからPR自動作成
                                         ↓
                              開発者がレビュー・マージ
                                         ↓
                              辞書データ再ビルド or 検索ロジック更新
```

### フロー使い分け基準

| ラベル | 方式 | 対象 |
| ------ | ---- | ---- |
| `approved` | フローA（差分ファイル） | 意味の修正・単語追加など単純な変更 |
| `search-improvement` | フローB（PR） | 検索ロジックの改善・複雑な変更 |

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

### 2. GitHub Actionsワークフロー

**トリガー**: Issueに「approved」または「search-improvement」ラベルが付与されたとき

#### 2.1 フローA：差分ファイル自動更新（approvedラベル）

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
            const posMatch = body.match(/\*\*品詞\*\*: (.+)/);
            const postUrlMatch = body.match(/\*\*投稿リンク\*\*: (.+)/);

            if (!wordMatch || !correctionMatch) {
              console.log('Required fields not found in issue body');
              return;
            }

            const word = wordMatch[1].trim();
            const correctedMeaning = correctionMatch[1].trim();
            const partOfSpeech = posMatch ? posMatch[1].trim() : null;
            const postUrl = postUrlMatch ? postUrlMatch[1].trim() : null;

            // overrides.jsonを読み込み
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
              part_of_speech: partOfSpeech,
              post_url: postUrl,
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

#### 2.2 フローB：PR自動作成（search-improvementラベル）

```yaml
  create-search-improvement-pr:
    if: github.event.label.name == 'search-improvement' && contains(github.event.issue.labels.*.name, 'word_search')
    runs-on: ubuntu-latest
    permissions:
      contents: write
      pull-requests: write
    steps:
      - uses: actions/checkout@v4

      - name: Create branch and PR from Issue
        uses: actions/github-script@v7
        with:
          script: |
            const issue = context.payload.issue;
            const branchName = `search-improvement/issue-${issue.number}`;

            // ブランチ作成
            const mainRef = await github.rest.git.getRef({
              owner: context.repo.owner,
              repo: context.repo.repo,
              ref: 'heads/main'
            });

            await github.rest.git.createRef({
              owner: context.repo.owner,
              repo: context.repo.repo,
              ref: `refs/heads/${branchName}`,
              sha: mainRef.data.object.sha
            });

            // PR作成
            await github.rest.pulls.create({
              owner: context.repo.owner,
              repo: context.repo.repo,
              title: `検索改善: ${issue.title}`,
              body: `Closes #${issue.number}\n\n${issue.body}`,
              head: branchName,
              base: 'main'
            });
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

1. **フィードバック受信**: ユーザーがアプリから送信（品詞・投稿リンク付き）
2. **Issue作成**: GAS経由でGitHub Issueが自動作成（ラベル: `word_search`、本文に品詞・投稿リンクを含む）
3. **開発者トリアージ**: 内容と投稿リンクを確認し、対応方針を決定
4. **ラベル付与**:
   - 単純な修正 →「approved」ラベル → フローA（overrides.json自動更新）
   - 検索改善が必要 →「search-improvement」ラベル → フローB（PR自動作成）
5. **配信/マージ**: フローAはGitHub Pagesで即配信、フローBはレビュー後マージ
6. **アプリ反映**: ユーザーのアプリが次回起動時に差分を取得

### Issue本文の例（品詞・投稿リンク追加後）

```text
### 報告内容 (word_search)
- **対象/件名**: example
- **詳細/期待内容**: 例、実例
- **品詞**: noun
- **投稿リンク**: https://bsky.app/profile/did:plc:abc123/post/xyz789
- **コメント**: なし

### レビューチェックリスト
- [ ] 他の辞書で意味を確認したか
  - https://kotobanomado.jp/
  - https://dictionary.cambridge.org/ja/
- [ ] 品詞・用途は正しいか
- [ ] 既存のoverridesに同じ単語の修正がないか
  - [overrides.json](https://rietamura.github.io/kumotan-dictionary/overrides.json) をブラウザで開き、対象の単語をページ内検索（Ctrl+F）で確認
```

## 実装ステップ

### Phase 1: 基盤構築（2-3時間）

1. [x] `kumotan-dictionary` リポジトリに `overrides.json` を作成（空の初期ファイル）
   - ファイル準備済み： `doc/kumotan-dictionary-files/overrides.json`
2. [x] GitHub Actions ワークフロー作成（`dictionary-update.yml`）
   - ファイル準備済み： `doc/kumotan-dictionary-files/.github/workflows/dictionary-update.yml`
   - [x] フローA: approvedラベルによるoverrides.json自動更新（品詞・投稿リンク対応済み）
   - [x] フローB: search-improvementラベルによるPR自動作成
3. [x] Issue作成ワークフロー（`create-issue-from-feedback.yml`）に品詞・投稿リンク・レビューチェックリスト追加
   - ファイル準備済み： `doc/kumotan-dictionary-files/.github/workflows/create-issue-from-feedback.yml`
4. [ ] 「approved」「search-improvement」ラベルを作成（手動でGitHubから設定）
5. [ ] 上記ファイルをkumotan-dictionaryリポジトリにコピー・配置

### Phase 2: アプリ側実装（3-4時間） ✅ 完了

1. [x] `ExternalDictionaryService.ts` に差分取得機能を追加
   - [x] `DictionaryOverride`に`part_of_speech`と`post_url`フィールド追加
2. [x] `jmdict.ts` に差分適用ロジックを追加
   - [x] オーバーライドの品詞情報を翻訳結果に反映
3. [x] 差分キャッシュ機能を実装
4. [x] `FeedbackModal.tsx` でフィードバック送信時に品詞・投稿リンクを含める
5. [x] `feedback-integration.yml` のIssue本文に品詞・投稿リンク・レビューチェックリストを追加

### Phase 3: テスト・検証（1-2時間）

1. [ ] テスト用Issueを作成し、承認→自動更新の動作確認
2. [ ] アプリ側で差分が正しく適用されるか確認
3. [ ] オフライン時の動作確認

### Phase 4: ドキュメント・運用準備（1時間） ✅ 完了

1. [x] 運用手順書の作成（`doc/kumotan-dictionary-files/README.md`）
2. [x] requirements.md の更新

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
**最終更新**: 2026-02-09
**ステータス**: Phase1-2完了、Phase3（テスト・検証）待ち
