# フィードバック・機能提案・バグ報告 統合実装計画書

## 1. 目的
ユーザーが「検索不具合」「バグ報告」「機能の提案」をアプリ内からシームレスに行える仕組みを導入する。
既存の検索不具合報告の仕組みを拡張し、スプレッドシート経由で GitHub Issue に集約することで、開発管理を効率化する。

## 2. システム構成
以下のフローで、ユーザーのフィードバックを GitHub Issue に統合する。

```mermaid
graph TD
    A[Settings / WordPopup] -->|タップ| B[FeedbackModal]
    B -->|送信 {type, ...}| C[Google Apps Script]
    C -->|追記| D[Googleスプレッドシート]
    C -->|Dispatch with type| E[GitHub Actions]
    E -->|作成 with Label=type| F[GitHub Issue]
    F -->|手動| G[不具合解決・機能実装]
```

### 構成要素
1.  **Frontend (React Native / Expo)**:
    - 汎用化された `FeedbackModal` を使用し、`type` を指定して各種報告を送信。
    - 設定ページ（`SettingsScreen`）から「バグ報告」「機能を提案」の導線を追加。
2.  **Middleman (Google Apps Script - GAS)**:
    - アプリからのデータ（`type` を含む）を受信。
    - スプレッドシートへのログ保存（種別列の追加）。
    - GitHub Actions を起動（`repository_dispatch`）。
3.  **Automation (GitHub Actions)**:
    - 届いたデータの `type` をそのまま GitHub Issue のラベルとして適用。
    - タイトルや本文を種別に応じて動的に整形。
4.  **Backend (GitHub Issues)**:
    - ラベル（`bug`, `feature`, `word_search`）によって自動分類された課題の管理。

## 3. 実装詳細

### 3.1. フロントエンドの変更
- **ファイル**: `src/components/FeedbackModal.tsx`
- **種別 (Type)**:
    - `word_search`: 検索不具合報告（既存）
    - `bug`: バグ報告（新規）
    - `feature`: 機能を提案（新規）
- **UI**: `type` にに応じてタイトルやラベル、プレースホルダーを切り替える。
- **設定画面**: `src/screens/SettingsScreen.tsx` から GitHub への直リンクを廃止し、モダルを起動するように変更。

### 3.2. GAS の設定
- **機能**:
    - スプレッドシートに「タイプ（Type）」列を追加。
    - アプリから `type` を受け取り、スプレッドシートに記録。
    - GitHub Actions へのペイロードに `type` を含める。

### 3.3. GitHub Actions の設定
- **ワークフロー定義**: `.github/workflows/feedback-integration.yml`
- **変更点**:
    - `client_payload.type` を `labels` に適用。
    - `type` に応じて Issue タイトルの接頭辞（`【バグ報告】` など）を切り替える。

### 3.4. フィードバック追加情報の拡張（word_search 専用）

`word_search` タイプのフィードバックに以下の情報を追加し、検索改善の判断材料とする。

#### 追加フィールド

| フィールド | 説明 | データソース |
|-----------|------|------------|
| `partOfSpeech` | 品詞（noun, verb 等） | `WordPopup` 内の `definition.partOfSpeech` |
| `postUrl` | 投稿リンク（Bluesky URL） | `WordPopup` 内の `postUri` を変換 |

#### AT Protocol URI → Bluesky URL 変換

`postUri`はAT Protocol形式のため、Bluesky Web URLに変換して送信する。

```text
at://did:plc:abc123/app.bsky.feed.post/xyz789
  ↓
https://bsky.app/profile/did:plc:abc123/post/xyz789
```

#### 変更箇所

**1. FeedbackModal（`src/components/FeedbackModal.tsx`）**

- propsに`partOfSpeech?: string`と`postUrl?: string`を追加
- `word_search`タイプ時のみ、送信ペイロードに含める（UI上は非表示）
- 送信ペイロード：

  ```json
  {
    "type": "word_search",
    "word": "example",
    "expectation": "...",
    "comment": "...",
    "partOfSpeech": "noun",
    "postUrl": "https://bsky.app/profile/did:plc:abc123/post/xyz789"
  }
  ```

**2. WordPopup（`src/components/WordPopup.tsx`）**

- `FeedbackModal`へのprops受け渡しに`partOfSpeech`と`postUrl`を追加
- `postUri` → Bluesky URLへの変換ユーティリティを作成

**3. GAS（Google Apps Script）**

- スプレッドシートに「品詞」「投稿リンク」列を追加
- `repository_dispatch`の`client_payload`に`part_of_speech`, `post_url`を含める

**4. GitHub Actions（`.github/workflows/feedback-integration.yml`）**

- Issue本文テンプレートに追加：

  ```text
  - **品詞**: ${part_of_speech || '不明'}
  - **投稿リンク**: ${post_url || 'なし'}
  ```

### 3.5. バグ報告時のデバッグログ自動添付（エラー監視のオプトイン実装）

`type='bug'` のフィードバック送信時に、デバッグログとデバイス情報を自動で添付する。
ユーザーが「バグを報告する」ボタンを能動的に押す必要があるため、**完全にオプトイン**となる。
Sentry / Firebase 等の外部クラッシュレポートツールは不要で、プライバシー申告への追加影響もない。

#### 追加フィールド（`bug` タイプ専用）

| フィールド | 説明 | データソース |
|-----------|------|------------|
| `logs` | 直近200件のデバッグログ（全文） | `logger.ts` の `getLogsAsString()` |
| `app_version` | アプリバージョン | `APP_INFO.VERSION` |
| `os_version` | OS バージョン | `Platform.Version` |
| `platform` | `ios` / `android` | `Platform.OS` |

#### 送信ペイロード（`bug` タイプ）

```json
{
  "type": "bug",
  "title": "ログインできない",
  "description": "1. アプリを起動する 2. ログインボタンを押す ...",
  "comment": "昨日まで使えていました",
  "app_version": "1.0.0",
  "platform": "ios",
  "os_version": "18.2",
  "logs": "[2026-02-20T10:00:00.000Z] [ERROR] [OAuth] Token refresh failed\n..."
}
```

#### UI上の表示

- フォームの説明文に「送信時にデバッグログ（直近の動作記録）が自動添付されます」と記載する。
- ログの内容に個人情報が含まれないことをプライバシーポリシーと整合させる。

#### 実装対象ファイルと変更内容

##### 1. FeedbackModal（`src/components/FeedbackModal.tsx`）

- `getLogsAsString` を `logger.ts` からインポート。
- `APP_INFO` を `constants/config.ts` からインポート。
- `handleSend` 内で `type === 'bug'` 時のみログ・デバイス情報をペイロードに追加。

##### 2. GAS

- `bug` タイプの `client_payload` に `logs`, `app_version`, `os_version`, `platform` を追加。
- スプレッドシートに「バージョン」「プラットフォーム」列を追加（ログは長いためIssueのみに掲載）。

##### 3. GitHub Actions（`.github/workflows/feedback-integration.yml`）

- `bug` タイプのIssue本文にデバイス情報・デバッグログセクションを以下の形式で追加する。

  ```text
  ## デバイス情報
  - **アプリバージョン**: 1.0.0
  - **プラットフォーム**: iOS 18.2

  ## デバッグログ
  \`\`\`
  [ログ全文]
  \`\`\`
  ```

## 4. セキュリティ
- GitHub PAT は GAS 側で安全に保持。
- アプリ側は公開された外部リポジトリへの直接的な書き込み権限を持たない。
- デバッグログには認証トークン等の機密情報をログ出力しないこと（`logger.ts` の運用ルール）。

## 5. ステップ・バイ・ステップの作業予定

1.  **[Frontend]** `FeedbackModal.tsx` を拡張し、`type` プロパティでの表示切り替えを実装。
2.  **[Frontend]** `SettingsScreen.tsx` のリンクをモダル起動に差し替え。
3.  **[Frontend]** `FeedbackModal`に`partOfSpeech`, `postUrl` propsを追加し、送信ペイロードに含める。
4.  **[Frontend]** `WordPopup`から`FeedbackModal`へ品詞・投稿リンクを受け渡す。
5.  **[Frontend]** `postUri`（AT Protocol）→ Bluesky URL変換ユーティリティを作成。
6.  **[Frontend]** `FeedbackModal` の `bug` タイプ送信時に `getLogsAsString()` でログを添付、デバイス情報を追加。 ✅。
7.  **[GAS]** `type`列の追加と、GitHub Actionsへのペイロード拡張。 ✅。
8.  **[GAS]** スプレッドシートに「品詞」「投稿リンク」列を追加し、`client_payload`に含める。 ✅。
9.  **[GAS]** `bug` タイプの `client_payload` に `logs`, `app_version`, `os_version`, `platform` を追加。スプレッドシートにJ列（アプリバージョン）・K列（OS/プラットフォーム）を追加。 ✅。
10. **[GitHub Actions]** `type`に基づくラベル付与と、タイトルの動的生成の実装。
11. **[GitHub Actions]** Issue本文に品詞・投稿リンクを表示。
12. **[GitHub Actions]** `bug` タイプのIssue本文にデバイス情報・デバッグログセクションを追加。
13. **[Test]** 各種報告（バグ、提案、検索不具合）が適切なラベルでIssue化されることを確認。
14. **[Test]** `word_search`フィードバックに品詞・投稿リンクが含まれることを確認。
15. **[Test]** `bug` フィードバックにデバッグログ・デバイス情報が含まれることを確認。

## 6. 備考

- フロントエンドの`type`名とGitHubのラベル名を統一することで、開発フローの透明性を確保する。
- 既存の「検索不具合報告（全工程完了）」をベースに拡張するため、迅速な導入が可能。
- `partOfSpeech`と`postUrl`は`word_search`タイプ専用。`bug` / `feature`タイプでは送信しない。
- 投稿リンクにより、Issueレビュー時に「どの文脈で検索したか」を即座に確認できる。
- `logs`, `app_version`, `os_version`, `platform` は `bug` タイプ専用。他のタイプでは送信しない。
- ユーザーが能動的に「バグを報告する」を押す必要があるため、オプトインとして成立する。Sentry等の外部ツール不要。
