# 外部単語データ管理・配信実装案

`doc/kumotan-worddb-plane.md` で提示されたアーキテクチャは、アプリサイズの削減と柔軟なデータ更新を実現するために**実現可能であり、推奨される**構成です。
以下に詳細な実装案を記述します。

## 1. システム構成

-   **データソース**: JMdict (JSON) を SQLite データベース (`.db`) に変換して利用。
-   **配信**: Gzip 圧縮 (`.db.gz`) し、GitHub Pages でホスティング。
-   **クライアント (アプリ側)**:
    1.  **ダウンロード**: `expo-file-system` を使用して `.db.gz` を取得。
    2.  **解凍**: `react-native-gzip` (ネイティブモジュール) または `fflate` (JSライブラリ) で `.db` に展開。
        *   *推奨: 大規模なDBファイルのパフォーマンスを考慮し `react-native-gzip` を推奨。*
    3.  **保存**: `FileSystem.documentDirectory + 'SQLite/'` 配下に保存。
    4.  **アクセス**: `expo-sqlite` を使用して接続。

## 2. 変更提案

### 依存関係 (Dependencies)
-   解凍用ライブラリ `react-native-gzip` (または ZIP形式なら `react-native-zip-archive`) を追加。
    -   コマンド: `npm install react-native-gzip`
    -   *注: `expo-dev-client` を使用しているため、ネイティブモジュールの利用が可能です。*

### ビルドスクリプト (辞書生成)
`scripts/jmdict/` 配下のスクリプトを修正・追加し、圧縮ステップを含めます。
-   **現在**: `convert-to-sqlite.ts` -> `col.db` を生成
-   **追加**: `compress-db.ts` -> `col.db.gz` を生成するスクリプト

### アプリケーションロジック

#### [新規] `src/services/dictionary/ExternalDictionaryService.ts`
外部辞書データのライフサイクルを管理します。
-   `checkDatabaseExists()`: ローカルに辞書DBが存在するか確認。
-   `downloadDatabase(onProgress)`: GitHub Pages から `.gz` をダウンロード。
-   `installDatabase()`: 解凍し、SQLite用フォルダへ配置。
-   `getDictionaryVersion()`: リモートのバージョンを確認 (v1の段階ではオプション)。

#### [変更] `src/services/database/init.ts` (または DictionaryService)
-   ユーザーデータの `words.db` とは別に、読み取り専用として外部辞書DBを開けるように改修します。

## 3. ワークフロー

1.  **アプリ起動時**:
    -   `ExternalDictionaryService.isReady()` をチェック。
    -   `false` (未保持) の場合: 「辞書データの準備」画面またはモーダルを表示。
        -   ダウンロード開始 -> 解凍 -> 完了フラグ保存。
    -   `true` (保持済み) の場合: メイン画面へ遷移。
2.  **辞書検索時**:
    -   外部 SQLite DB に対してクエリを実行し、単語の意味を取得。

## 4. 検証計画

### 手動検証
1.  **ビルドフェーズ**: `npm run jmdict:convert` を実行後、ファイルを Gzip 圧縮し、ローカルサーバーまたはダミーURLに配置。
2.  **インストールフェーズ**: アプリを起動し、「データダウンロード中...」のUIが表示され、完了することを確認。
3.  **機能確認**: 単語検索 (例: "apple") を行い、ダウンロードしたDBから結果が返ることを確認。
4.  **永続化確認**: アプリを再起動し、再ダウンロードが発生せずに機能することを確認。
