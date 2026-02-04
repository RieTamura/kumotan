# kumotan-dictionary リポジトリ設定ファイル

このディレクトリには、kumotan-dictionaryリポジトリで辞書自動更新機能を有効にするためのファイルが含まれています。

## セットアップ手順

### 1. overrides.json を配置

`overrides.json` をkumotan-dictionaryリポジトリのルートにコピーします。

```bash
# kumotan-dictionaryリポジトリのルートで
cp /path/to/overrides.json .
git add overrides.json
git commit -m "chore: add overrides.json for dictionary auto-update"
git push
```

### 2. GitHub Actions ワークフローを配置

`.github/workflows/dictionary-update.yml` をkumotan-dictionaryリポジトリにコピーします。

```bash
# kumotan-dictionaryリポジトリで
mkdir -p .github/workflows
cp /path/to/.github/workflows/dictionary-update.yml .github/workflows/
git add .github/workflows/dictionary-update.yml
git commit -m "ci: add dictionary auto-update workflow"
git push
```

### 3. 「approved」ラベルを作成

1. kumotan-dictionaryリポジトリの「Issues」タブを開く
2. 「Labels」をクリック
3. 「New label」をクリック
4. 以下の情報を入力:
   - Label name: `approved`
   - Description: `Approved dictionary correction`
   - Color: 緑系の色を推奨（例: `#0e8a16`）
5. 「Create label」をクリック

### 4. 動作確認

1. テスト用のIssueを作成（`word_search`ラベル付き）
2. Issue本文に以下を含める:
   ```
   **対象/件名**: testword
   **詳細/期待内容**: テスト用の正しい意味
   ```
3. 「approved」ラベルを付与
4. GitHub Actionsが実行され、`overrides.json`が更新されることを確認
5. GitHub Pagesで配信されることを確認:
   `https://rietamura.github.io/kumotan-dictionary/overrides.json`

## ファイル説明

### overrides.json

辞書の差分データを格納するファイル。

```json
{
  "version": "1.0.0",
  "updated_at": "2026-02-04T12:00:00Z",
  "entries": [
    {
      "id": "override_001",
      "type": "correction",
      "word": "example",
      "corrected_meaning": "正しい意味",
      "source_issue": 123,
      "approved_at": "2026-02-04T12:00:00Z"
    }
  ]
}
```

**エントリタイプ**:
- `correction`: 既存の意味を修正
- `addition`: 新しい単語を追加
- `deletion`: 単語を非表示（将来対応）

### dictionary-update.yml

GitHub Actionsワークフロー。Issueに「approved」ラベルが付与されたときに自動実行されます。

**トリガー条件**:
- Issueに「approved」ラベルが付与される
- かつ、そのIssueが「word_search」ラベルを持っている

**処理内容**:
1. Issue本文から単語と修正内容を抽出
2. `overrides.json`に新しいエントリを追加
3. 変更をコミット・プッシュ

## 関連ドキュメント

- [辞書データ自動更新計画書](../dictionary-auto-update-plan.md)
- [要件定義 Phase 2.5](../requirements.md)
