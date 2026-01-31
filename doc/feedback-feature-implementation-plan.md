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

## 4. セキュリティ
- GitHub PAT は GAS 側で安全に保持。
- アプリ側は公開された外部リポジトリへの直接的な書き込み権限を持たない。

## 5. ステップ・バイ・ステップの作業予定

1.  **[Frontend]** `FeedbackModal.tsx` を拡張し、`type` プロパティでの表示切り替えを実装。
2.  **[Frontend]** `SettingsScreen.tsx` のリンクをモダル起動に差し替え。
3.  **[GAS]** `type` 列の追加と、GitHub Actions へのペイロード拡張。
4.  **[GitHub Actions]** `type` に基づくラベル付与と、タイトルの動的生成の実装。
5.  **[Test]** 各種報告（バグ、提案、検索不具合）が適切なラベルで Issue 化されることを確認。

## 6. 備考
- フロントエンドの `type` 名と GitHub のラベル名を統一することで、開発フローの透明性を確保する。
- 既存の「検索不具合報告（全工程完了）」をベースに拡張するため、迅速な導入が可能。
