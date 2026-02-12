# くもたん (Kumotan) 要件定義

## アプリ概要
- **アプリ名**: くもたん (Kumotan)
- **キャッチコピー**: 雲から学ぶ、あなたの単語帳
- **目的**: AT Protocolのタイムライン（Bluesky等）を見ながら、分からない英語の単語・熟語を日本語で学習する
- **ターゲット**: 英語を学習中の日本語話者、SNSを通じて楽しく語彙を増やしたい学習者
- **規模**: 個人開発、ユーザー数〜1000人想定
- **プラットフォーム**: iOS（Expo/React Native）

## 技術スタック
- **フレームワーク**: Expo (React Native)
- **言語**: TypeScript
- **ストレージ**: 
  - expo-sqlite（単語データ、学習統計）
  - expo-secure-store（DeepL API Key、Yahoo! Client ID）
  - AsyncStorage（UI設定、キャッシュ、認証トークン、OAuthセッション/ステート）
  - ※ 安定性と依存関係の最小化のため、`react-native-mmkv`は使用せず`AsyncStorage`ベースのカスタムアダプターを採用。
- **辞書API**:
  - Free Dictionary API（英語定義）
  - DeepL API Free（日本語翻訳、月50万文字まで無料）
  - Yahoo! JAPAN Text Analysis API（日本語単語の形態素解析・ふりがな）
- **認証**: 
  - Bluesky App Password（ユーザー名 + App Password）
  - ATProtocol OAuth（PKCE / DPoP対応正規フロー。`@atproto/oauth-client`を使用）
- **ネットワーク監視**: @react-native-community/netinfo

## MVP機能

### 1. HOMEページ（フィード表示＋単語登録）
- Blueskyタイムラインの投稿を表示（最新20〜50件）
- 投稿内の単語をロングタップで選択
- 選択時に単語の意味（日本語）が表示されるポップアップカード（下部からスライド）
  - 英単語
  - 日本語訳（DeepL API、API Key設定時のみ）
  - 英語の定義（Free Dictionary API）
  - 「単語帳に追加」ボタン
  - 「キャンセル」ボタン
- Pull to Refreshでフィード更新
- 初回起動時にBlueskyログイン画面表示
- オフライン時はオフラインバナー表示、フィード更新不可

### 2. 単語帳ページ
- 登録した単語・熟語の一覧表示
  - 英単語
  - 日本語訳（API Key未設定時は「-」または英語定義）
  - 登録日時
  - 既読/未読ステータス（チェックボックス）
- ソート機能
  - 登録日時（新しい順/古い順）
  - アルファベット順（A-Z/Z-A）
- フィルタリング機能
  - すべて/未読のみ/既読のみ
  - 日付範囲（今日/今週/今月/すべて）
- スワイプで削除
- タップで既読/未読切り替え
- 単語タップで詳細モーダル表示
- オフラインでも閲覧・操作可能（ローカルDB）

### 3. 進捗ページ
- 学習カレンダー
  - 月表示、既読した日にドット/色表示
  - 月の切り替え（前月/次月ボタン）
- 基本統計
  - 総単語数
  - 既読単語数
  - 既読率（%）
  - 今週の学習日数
  - 連続学習日数
- Blueskyシェアボタン
  - 「今日は○個の単語を学習しました！ #英語学習 #くもたん」
  - タップでBlueskyアプリに遷移（投稿画面）
- オフライン時はシェアボタン無効化

### 4. 設定ページ
- Blueskyアカウント情報表示（アバター、ハンドル名、DID）
- ログアウト
- **API設定**（→ API Key Setup Screen）
  - DeepL API Key：ステータス表示（設定済み / 未設定）
  - Yahoo! Client ID：ステータス表示（設定済み / 未設定）
- データエクスポート（JSON形式、Share Sheet経由）
- すべてのデータを削除（確認ダイアログ付き）
- アプリ情報（バージョン、開発者情報）
- 外部リンク
  - くもたん公式Blueskyアカウント
  - ソースコード（GitHub）
  - ライセンス情報

### 5. API Key設定ページ
- **DeepL API Key設定セクション**
  - API Keyの用途説明
  - 無料枠の説明（月50万文字）
  - 「API Keyの取得方法」リンク（外部ブラウザでDeepLサイトへ）
  - API Key入力フォーム（secureTextEntry）
  - 使用量表示（文字数、使用率）
  - 「Keyを検証して保存」ボタン
  - 「API Keyを削除」ボタン（設定済みの場合のみ）
- **Yahoo! JAPAN Client ID設定セクション**
  - Client IDの用途説明（日本語単語の解析・ふりがな）
  - 「Client IDの取得方法」リンク（外部ブラウザでYahoo!デベロッパーサイトへ）
  - Client ID入力フォーム（secureTextEntry）
  - 「IDを検証して保存」ボタン
  - 「Client IDを削除」ボタン（設定済みの場合のみ）
- セクション指定による自動スクロール機能（設定画面からの遷移時）

### 6. ライセンスページ
- 使用しているライブラリのライセンス表記
  - expo-sqlite
  - expo-secure-store
  - @atproto/api
  - @react-native-community/netinfo
  - Free Dictionary API
  - DeepL API
  - Yahoo! JAPAN Text Analysis API
- 利用規約（設定画面フッターからアクセス）
- プライバシーポリシー（設定画面フッターからアクセス）

### 7. 利用規約・プライバシーポリシーページ

- 設定画面のアプリ情報セクション（タグライン下）に「利用規約」「プライバシーポリシー」リンクを配置
- タップで各法的文書の専用画面に遷移（`LegalDocumentScreen`）
- 日本語・英語の多言語対応（i18n `legal` namespace）
- **利用規約（全16条）**
  - 適用、サービス定義、利用登録（Bluesky OAuth）
  - アカウント管理（Blueskyアカウント、APIキー）
  - データ保存と管理（ローカル保存、PDS同期）
  - 知的財産権、禁止事項
  - 外部サービスの利用（Bluesky、DeepL、Yahoo!、Free Dictionary API、JMdict）
  - Blueskyへの投稿機能（モデレーション・コンテンツラベル含む）
  - 提供停止、利用制限、免責事項
  - 準拠法・裁判管轄
- **プライバシーポリシー（全11条）**
  - 収集する情報（Blueskyアカウント、端末内データ、PDS同期、外部サービス送信、フィードバック）
  - 利用目的、第三者提供の制限
  - 安全管理措置（SecureStore暗号化、OAuth PKCE+DPoP、HTTPS通信）
  - アナリティクス・トラッキング不使用の明示
  - 端末アクセス権限（写真ライブラリ、カメラ）
  - データ削除方法

## データベース設計

### wordsテーブル
```sql
CREATE TABLE IF NOT EXISTS words (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  english TEXT NOT NULL,
  japanese TEXT,  -- API Key未設定時はNULL
  definition TEXT,
  post_url TEXT,
  post_text TEXT,
  is_read INTEGER DEFAULT 0 CHECK(is_read IN (0, 1)),
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  read_at DATETIME
);
```

### daily_statsテーブル
```sql
CREATE TABLE IF NOT EXISTS daily_stats (
  date TEXT PRIMARY KEY,
  words_read_count INTEGER DEFAULT 0
);
```

## セキュリティ設計

### 認証情報の管理

#### Bluesky認証

- **App Password**: 認証時のみ使用し、**保存しない**
- **ATProtocol OAuth**: 
  - `@atproto/oauth-client` を使用した正規の OAuth 2.0 フロー
  - **DPoP (Demonstrating Proof-of-Possession)**: `expo-crypto` を使用したハードウェア支援（可能な場合）による鍵生成と署名
  - **PKCE (Proof Key for Code Exchange)**: セキュアなコード交換
- **トークンとセッション**: 
  - 認証トークン（accessJWT, refreshJWT）および OAuth セッション/ステートは、安定性を考慮し `AsyncStorage` に保存（カスタムアダプター経由）
  - ネイティブモジュール依存（MMKV等）を最小限に抑え、Expo Managed Workflow での動作安定性を確保
- **トークンリフレッシュ**: 期限切れ時に自動リフレッシュ、失敗時は再ログインを要求

#### DeepL API Key
- **ユーザー入力方式**: 開発者のAPI Keyをアプリに埋め込まない
- **理由**:
  - アプリにAPI Keyを埋め込むと、逆コンパイルにより抽出される危険性がある
  - 第三者による不正利用で月間制限を超過するリスクがある
  - ユーザーごとに独立した無料枠（月50万文字）を利用できる
- **保存場所**: expo-secure-store（暗号化）
- **検証**: 保存前にDeepL APIで有効性を検証（usage APIを使用）
- **使用量監視**: 80%/95%で警告表示、100%でエラー表示
- **フォールバック**: API Key未設定時は翻訳をスキップ、英語定義のみ表示

#### Yahoo! JAPAN Client ID
- **ユーザー入力方式**: DeepL同様、開発者のClient IDをアプリに埋め込まない
- **用途**: 日本語単語の形態素解析、ふりがな付与
- **保存場所**: expo-secure-store（暗号化）
- **検証**: 保存前にYahoo! APIで有効性を検証（Furigana APIを使用）
- **フォールバック**: Client ID未設定時は日本語解析機能をスキップ

### 入力バリデーション
- すべての外部入力を検証
- SQLクエリはプレースホルダーを使用（SQLインジェクション対策）
- API Keyは形式チェック + API検証

### ログ出力
- トークン、API Key、パスワードなどの機密情報はログに出力しない

## 将来機能（Phase 2以降）

### Phase 2: 学習機能強化
- フラッシュカード機能（ランダム出題、正解/不正解の記録）
- クイズモード（4択、記述式）
- 音声読み上げ機能（Text-to-Speech）
- **日本語訳ルビ振り機能**
  - Yahoo! JAPAN Text Analysis APIのFurigana機能を使用
  - 単語詳細画面・単語帳一覧で日本語訳にふりがな表示
  - 学年レベル指定機能（小学1〜6年生向け）
  - 漢字かな混じり文を自動で読み仮名付き表示
- 単語にメモ・例文を追加
- 習熟度レベル管理（覚えた/復習中/苦手など）
- 間隔反復学習（Spaced Repetition）アルゴリズム
- **TexTra® Web API統合（DeepLバックアップ用）**
  - DeepL API無料枠（月50万文字）超過時のフォールバック翻訳エンジン
  - OAuth 2.0認証が必要（Phase 3のOAuth実装後に検討）
  - 提供元：NICT（情報通信研究機構）
  - API仕様：https://mt-auto-minhon-mlt.ucri.jgn-x.jp/content/api/
  - 料金体系要調査（無料プラン有無、使用量制限）
  - 検討条件：
    - Bluesky OAuth実装完了後
    - 無料プランまたは低コストで利用可能な場合
    - DeepL使用量が上限に近いユーザーが一定数発生した場合
- **検索機能**
  - **Phase 1: 保存済み単語のキーワード検索**
    - 単語帳画面に検索バーを追加
    - SQLite LIKE検索で `english` / `japanese` / `definition` / `postText` を横断検索
    - 既存の `WordFilter` に `searchQuery` を追加、デバウンス付きインクリメンタル検索
  - **Phase 2: Bluesky投稿検索**
    - AT Protocol `app.bsky.feed.searchPosts` APIを利用
    - ホーム画面ヘッダーに検索アイコンを配置、スタック遷移で検索画面を表示
    - 検索結果は既存 `PostCard` で表示し、単語タップ→保存の既存フローを活用
    - 英語学習向けプリセットタグ（`#EnglishLearning` 等）のサジェスト
  - **Phase 3: ユーザー検索**
    - `app.bsky.actor.searchActors` APIを利用
    - 検索画面にタブ切替（投稿 / ユーザー）を追加
  - **詳細**: `doc/search-feature-implementation-plan.md` 参照

### Phase 2.5: 辞書フィードバック機能 ✅ 完了 (2026-01-30)

- **目的**: JMdict辞書の翻訳精度向上のためのユーザーフィードバック収集
- **アーキテクチャ**:

  ```text
  アプリ内フォーム → Google Apps Script → GitHub Issue作成
                          ↓
                   スプレッドシート（ログ保存）
  ```

- **アプリ内フィードバックフォーム**（WordPopup画面）
  - フィードバックアイコン設置
  - テンプレートフォーム表示
    - 検索語（自動入力）
    - 表示された訳（自動入力）
    - 正しい訳（ユーザー入力）
    - コメント（オプション）
  - 送信ボタン → GAS API呼び出し
- **Google Apps Script (GAS)**
  - POSTリクエスト受信
  - GitHub API経由でkumotan-dictionary Issueを自動作成
  - Google スプレッドシートにログ追記（バックアップ用）
- **GitHub Issue自動作成**
  - リポジトリ: `RieTamura/kumotan-dictionary`
  - ラベル: `dictionary-feedback`
  - テンプレート: 検索語、誤訳、正しい訳、コメント
- **運用コスト**: 無料（GAS + GitHub Actions + Google Sheets）
- **実装優先度**: 中（辞書精度改善の基盤として重要）
- **半自動更新機能**（v1.24実装）:
  - **概要**: フィードバックから辞書データの修正を半自動化
  - **フロー**:
    1. ユーザーがフィードバック送信 → GitHub Issue作成
    2. 開発者がレビュー後「approved」ラベル付与
    3. GitHub Actionsが`overrides.json`に自動追記
    4. GitHub Pagesで配信 → アプリが差分を自動適用
  - **差分ファイル形式**: `overrides.json`（correction/addition/deletionタイプ対応）
  - **キャッシュ**: AsyncStorage + メモリキャッシュ（1時間TTL）
  - **詳細**: `doc/dictionary-auto-update-plan.md`参照
- **将来の拡張計画**:
  - **バッチ統合**: 差分が一定数溜まったら辞書DBを再ビルド
  - **コミュニティ機能**: 複数ユーザーの承認を必要とする仕組み
  - **自動承認**: AIによる内容チェックで明らかに正しいものは自動承認
  - **日本語逆引き検索でのオーバーライド対応**: ✅ **計画策定完了** (2026-02-05)
    - 現在は英語→日本語方向のみオーバーライドが適用される
    - 日本語で検索した際にも`corrected_meaning`の内容でヒットするよう、`lookupJMdictReverse`にオーバーライド検索機能を追加予定
    - フィードバックからIssue作成ワークフロー（`.github/workflows/feedback-integration.yml`）を新規作成済み

### Phase 3: プラットフォーム拡張
- 日本語→英語の学習モード対応
- Android対応
- Web版（同じAPIで展開）
- OAuth認証対応

### Phase 4: AT Protocol連携強化
- ~~PDS（Personal Data Server）への学習データ保存~~ ✅ M7で実装完了（単語データ・学習進捗の同期・復元）
- 複数デバイス同期（双方向同期は未実装、現在はローカル→PDSの一方向）
- 他のAT Protocolクライアント対応（Bluesky以外）
- 特定ハッシュタグやユーザーのフィード取得
- カスタムフィード対応

### Phase 5: コミュニティ機能
- 学習リマインダー通知（プッシュ通知）
- 友達との学習進捗比較
- 共有単語帳（パブリック単語帳）
- 学習チャレンジ・イベント

### Phase 6: バックエンドプロキシ（スケール時）
- ユーザー数増加時にバックエンドプロキシを検討
- Cloudflare Workers / Vercel Edge Functions
- API Key管理の一元化
- レート制限の制御

## 開発マイルストーン

### M1: プロトタイプ（2〜3週間）
- [x] プロジェクトセットアップ
- [x] ログイン画面（バリデーション付き）
- [x] Blueskyフィード表示
- [x] 基本的なDB操作
- [x] オフライン状態検知

### M2: MVP完成（4〜6週間）
- [x] 単語登録機能（API連携）
- [x] DeepL API Key設定画面
- [x] Yahoo! Client ID設定画面
- [x] 単語帳ページ（ソート・フィルタ）
- [x] 進捗ページ（カレンダー・統計）
- [x] 設定ページ
- [x] トークンリフレッシュ機能

### M2.5: 品質改善・テスト実装（2〜3週間）

**目的**: CLAUDE.mdガイドラインに完全準拠し、本番リリースに向けた品質向上

#### フェーズ1: 即座に対応（1週間以内）✅ 完了

- [x] package.jsonメタデータ追加（name, description, author, license, repository）
- [x] package.jsonに有用なnpmスクリプト追加（type-check, test:coverage, build）
- [x] Jest設定（jest.config.js, jest.setup.js）
- [x] バリデーション関数テスト追加（src/utils/__tests__/validators.test.ts）
  - **38テスト全てパス**
  - **カバレッジ70.23%達成**（目標60%を超過）
  - XSS/SQLインジェクション対策を網羅
- [x] 使用されていないコード削除（WordListItem onPress、MIN_POPUP_HEIGHT）
- [x] メモリリーク修正（PostCard.tsx タイマークリーンアップ）

**フェーズ1成果**:

- テストファイル: 0件 → 1件（231行）
- テストケース: 0件 → 38件
- validators.tsカバレッジ: 0% → 70.23%
- セキュリティクリティカルな入力検証が完全テスト済み

#### フェーズ2: 短期（2〜4週間）✅ 完了

- [x] データベース操作テスト（src/services/database/__tests__/words.test.ts）
  - **28テスト全てパス**
  - **words.ts カバレッジ: 90.83%**（目標60%を大幅超過）
- [x] SQLインジェクション対策検証テスト
  - **プレースホルダー使用100%検証**
  - 悪意のある入力に対する防御をテスト完備
- [x] ADR作成（doc/adr/）
  - [x] ADR-001: DeepL API Keyのユーザー入力方式
  - [x] ADR-002: App Passwordを保存しない方針
  - [x] ADR-003: SQLiteローカルストレージ採用
  - [x] ADR-004: Zustand状態管理採用
  - [x] ADR-005: ローカル時刻での日時保存
- [x] API統合モックテスト（DeepL, Free Dictionary）
  - **deepl.test.ts：33テスト全てパス**（カバレッジ97.7%）
  - **freeDictionary.test.ts：60テスト全てパス**（カバレッジ89.36%）
  - タイムアウト、レート制限、認証失敗、ネットワークエラーをカバー
- [x] エラーケーステスト（ネットワークエラー、認証失敗、レート制限）
  - DeepL/FreeDictionary APIでエラーケース完全テスト済み
- [x] JSDocコメント追加（データベーストランザクション、複雑なビジネスロジック）
  - 全サービスファイルにJSDocコメント完備

**フェーズ2成果**：

- テストファイル：1件 → 3件（deepl, freeDictionary, words）
- テストケース：38件 → 121件
- APIサービスカバレッジ：DeepL 97.7%, FreeDictionary 89.36%, words.ts 90.83%
- セキュリティ：SQLインジェクション対策100%、API認証・エラーハンドリング完全テスト

#### フェーズ3: 中期（リファクタリング）🔄 進行中

**準備タスク**（2026-01-07完了）:

- [x] TypeScriptコンパイルエラー修正
  - [x] Input.tsx style型エラー解消（leftIcon/rightIcon条件式をundefinedに統一）
  - [x] types/word.ts 重複型定義削除（DailyStats, Stats）
- [x] デバッグログ削除（本番コード）
  - [x] words.ts: insertWord()内の4つのconsole.log削除
  - [x] yahooJapan.ts: 3つのconsole.log削除
  - 注: __DEV__ガード内のログは開発用に保持

**リファクタリングタスク**:

- [x] WordPopup.tsxリファクタリング - モジュール分割完了（2026-01-07）
  - [x] types.ts作成（型定義の分離）
  - [x] useWordLookup.ts作成（英単語検索ロジック）
  - [x] useJapaneseMorphology.ts作成（日本語形態素解析ロジック）
  - [x] useSentenceLookup.ts作成（文レベル処理ロジック）
  - [x] SwipeableWordCard.tsx分離（スワイプカードUI）
  - [x] index.ts作成（モジュールエクスポート）
  - [x] WordPopupModal.tsx作成（メインコンポーネント簡略化）
  - [x] useReducerで状態管理統一（reducer.ts作成）
- [x] N+1問題解決
  - [x] API結果のキャッシュ実装（LRUCache）
    - [x] src/utils/cache.ts作成
    - [x] FreeDictionary APIにキャッシュ統合
    - [x] DeepL APIにキャッシュ統合
  - [x] レート制限対策（キャッシュによる重複リクエスト削減）
- [x] パフォーマンス最適化
  - [x] parseTextIntoTokensのメモ化（useMemo）
  - [x] PostCardのReact.memo化
  - [x] SwipeableWordCardのReact.memo化
- [x] READMEに開発者向けセクション追加
- [x] ドキュメント同期チェックリスト作成（doc/UPDATING.md）

**品質指標目標**:
- テストカバレッジ: 60%以上（バリデーション、DB操作、エラーハンドリング）
- セキュリティ: SQLインジェクション対策100%検証
- パフォーマンス: N+1問題ゼロ、メモリリークゼロ
- ドキュメント: ADR 5個作成、主要関数にJSDoc追加

### M2.6: OAuth認証実装（1週間）🔄 進行中

**目的**: App Password併用でOAuth認証を実装し、競合と同等の認証UXを提供

**背景**:
- ユーザーフィードバック「App Passwordが面倒」（検証済みの問題点）
- 競合BlueskyアプリがOAuth/PDS対応済み
- 段階的リリース戦略（v1.1.0 OAuth → v1.2.0 PDS）

#### Phase 1: 基盤セットアップ（8-10時間）✅ 完了

- [x] 依存関係インストール（`@atproto/oauth-client-expo`, `expo-crypto`）
- [x] `src/utils/pkce.ts` 作成（PKCE生成ユーティリティ）
- [x] PKCEユニットテスト作成（100%カバレッジ目標）
  - **24テスト全てパス**
  - **カバレッジ100%達成**
  - RFC 7636完全準拠
- [x] `app.json` Deep Link設定
- [x] `src/constants/config.ts` OAuth定数追加
- [x] 型定義更新（`src/types/bluesky.ts`）
- [x] ADR-006作成（OAuth認証設計判断記録）

**成果物**: PKCE動作、Deep Link設定完了

#### Phase 2: OAuthサービス層（12-15時間）✅ 完了

- [x] `src/services/bluesky/oauth.ts` 実装
  - `generatePKCEChallenge()` - PKCE生成
  - `buildAuthorizationUrl()` - 認証URL構築
  - `exchangeCodeForTokens()` - トークン交換
  - `storeOAuthState()` / `retrieveOAuthState()` - State管理
  - `startOAuthFlow()` / `completeOAuthFlow()` - フロー制御
  - `parseCallbackUrl()` - コールバック解析
- [x] OAuthサービステスト作成（90%カバレッジ目標）
  - **32テスト全てパス**
  - **カバレッジ93.87%達成**（目標90%超過）
  - CSRF保護、State期限、エラーハンドリング完全テスト
- [x] `src/services/bluesky/auth.ts` に `loginWithOAuth()` 追加
- [x] `src/store/authStore.ts` にOAuthアクション追加
- [ ] Bluesky Staging APIでテスト（Phase 3で実施）

**成果物**: OAuthトークン交換が動作

#### Phase 3: UI統合（10-12時間）⚠️ 実装誤り発見

- [x] `src/hooks/useOAuthFlow.ts` フック作成
- [x] `src/components/OAuthButton.tsx` コンポーネント作成
- [x] `src/screens/LoginScreen.tsx` UI更新
  - OAuthボタンを追加（メインCTA）
  - App Passwordフォームを「詳細オプション」に移動（折りたたみ可能）
- [x] `App.tsx` Deep Linkハンドラー追加
- [x] `src/store/authStore.ts` に `startOAuth` / `completeOAuth` アクション追加
- [x] `src/services/bluesky/auth.ts` に `storeAuth` ヘルパー関数追加
- [x] TypeScript型エラー修正（ErrorCode.OAUTH_ERROR追加）
- [ ] iOS実機テスト（Phase 4で実施）

**重大な問題発見（2026-01-09）**:

- ❌ Phase 1-3の実装が**AT Protocol OAuth仕様に非準拠**
- ❌ Blueskyは標準OAuth 2.0エンドポイントを提供していない
- ❌ `https://bsky.social/oauth/authorize` および `/oauth/token` は存在しない
- ✅ `@atproto/oauth-client-expo` パッケージは既にインストール済み
- 🔄 **Phase 4で正しいAT Protocol OAuth実装に全面修正が必要**

**成果物**: UI実装完了だが、OAuth仕様誤りのため動作不可

#### Phase 4: AT Protocol OAuth修正（12-16時間）✅ Phase 4-1～4-2完了

**目的**: `@atproto/oauth-client-expo`を使用した正しいAT Protocol OAuth実装

##### Phase 4-1: クライアントメタデータ準備（2-3時間）✅ 完了

- [x] OAuth client metadata JSON作成（`assets/oauth-client-metadata.json`）
  - `client_id`：`https://rietamura.github.io/kumotan/oauth-client-metadata.json`
  - `application_type`："native"
  - `redirect_uris`：`app.kumotan.com:/oauth/callback`（リバースドメイン形式）
  - `dpop_bound_access_tokens`：true
- [ ] メタデータファイルのホスティング設定（GitHub Pages）**← 次のステップ**
- [x] `app.json` scheme設定を更新（`app.kumotan.com`）

##### Phase 4-2: ExpoOAuthClient統合（8-10時間）✅ 完了

- [x] `src/services/bluesky/oauth-client.ts` 新規作成
  - ExpoOAuthClientシングルトンインスタンス管理
  - クライアントメタデータ設定
- [x] `src/services/bluesky/auth.ts` 修正
  - `startOAuthFlow(handle)`: ExpoOAuthClient.signIn()を使用
  - `restoreOAuthSession()`: ExpoOAuthClient.restore()を使用
  - `clearOAuthSession()`: AsyncStorageクリア
  - AsyncStorageにDID保存 (`@kumotan:user_did`)
- [x] `src/store/authStore.ts` 修正
  - `loginWithOAuth(handle)`：新シグネチャ、startOAuthFlow()を呼び出し
  - `resumeSession()`：App Password → OAuthのフォールバック実装
  - `logout()`：clearOAuthSession()追加
  - `startOAuth()`, `completeOAuth()` 削除
- [x] `App.tsx` Deep Linkハンドラー削除（ExpoOAuthClientが自動処理）
- [x] `src/hooks/useOAuthFlow.ts` 簡略化
  - ハンドル入力状態を内部管理
  - loginWithOAuth()を直接呼び出し
- [x] `src/components/OAuthButton.tsx` 修正
  - ハンドル入力フィールド追加
  - useOAuthFlowからhandle/setHandle取得
- [x] TypeScript型エラー修正（OAuth関連すべて解消）

**Phase 4-2 成果物**：

- 新規ファイル：`oauth-client.ts`, `oauth-client-metadata.json`
- 修正ファイル：`auth.ts`, `authStore.ts`, `useOAuthFlow.ts`, `OAuthButton.tsx`, `App.tsx`, `app.json`
- TypeScript型チェック：OAuth関連エラー0件
- 実装工数：**約5時間**（見積もり8-10時間より効率的）

##### Phase 4-3: テスト修正（2-3時間）⏭️ スキップ

- [ ] ~~`src/utils/__tests__/pkce.test.ts` 削除~~（テストとして保持）
- [ ] ~~`src/services/bluesky/__tests__/oauth.test.ts` 削除~~（テストとして保持）
- [ ] ~~ExpoOAuthClient統合テスト作成~~（Phase 4-4で実機テスト優先）

**判断**：既存のPKCE/OAuthテストは概念理解に有用なため保持。実機テストを優先。

##### Phase 4-4: 統合テスト（2-3時間）🔄 進行中

**必須タスク**：

- [x] **GitHub Pagesデプロイ**（30分）
  - `/docs/oauth-client-metadata.json` 配置
  - `/docs/icon.png` 配置（オプション）
  - リポジトリSettings → Pages有効化
  - `https://rietamura.github.io/kumotan/oauth-client-metadata.json` 疎通確認

**実機テストタスク**：

- [x] iOS本番ビルド作成（TestFlight配信済み）
  - `eas build --profile production --platform ios`
  - TestFlight配信完了
- [x] OAuth認証フロー初期テスト
  - TestFlightで「undefined is not a function」エラー発見
  - 原因診断：`@atproto/oauth-client-expo`のリダイレクト処理問題
- [x] OAuth redirect URI修正（PR #1）
  - 修正前：`app.kumotan.com:/oauth/callback`
  - 修正後：`io.github.rietamura:/oauth/callback`
  - 公式ドキュメント形式（reverse FQDN）に準拠
  - `oauth-client-metadata.json` と `oauth-client.ts` を統一
  - `app.json` scheme設定を `io.github.rietamura` に更新
- [x] OAuth redirect URI仕様完全準拠修正（PR #2）
  - 設定ファイル間の不一致を解消（パスあり/なしの混在）
  - パスなし形式（`io.github.rietamura:/`）に統一
  - AT Protocol OAuth仕様に完全準拠
  - 修正理由：シンプルさと保守性を優先、多くのネイティブアプリが採用
  - 修正ファイル：
    - `assets/oauth-client-metadata.json`: `io.github.rietamura:/`
    - `src/services/bluesky/oauth-client.ts`: `io.github.rietamura:/`
  - 確認済み：`app.json`と`docs/oauth-client-metadata.json`は既に正しい設定
- [x] **react-native-mmkv問題の診断と解決**（2026-01-10）
  - **問題**: TestFlightで「undefined is not a function at _construct」エラー
  - **根本原因**: `@atproto/oauth-client-expo`が依存する`react-native-mmkv`（ネイティブモジュール）がExpo managed workflowで動作しない
  - **解決策**: Expo Development Buildへの移行、および **New Architecture (TurboModules) の有効化**
  - **実施内容**:
    - `expo-dev-client`をインストール
    - `react-native-mmkv`をインストール（`@atproto/oauth-client-expo`の必須依存関係）
    - `eas.json`に`production-dev`プロファイル追加（developmentClient: true）
    - `.gitignore`に`android/`と`ios/`を追加
    - **[追加] `expo-build-properties`をインストールし、New Architectureを有効化**（`react-native-mmkv` v3+要件対応）
- [ ] Development Buildでの実機テスト
  - `eas build --profile production-dev --platform ios`でビルド
  - TestFlightに配信
  - OAuth認証フロー完全テスト（修正後）
  - ハンドル入力 → ブラウザ起動 → Blueskyログイン → アプリ復帰
  - セッション確立確認（DID, handle, tokens）
- [ ] セッション復元テスト
  - アプリ再起動後の自動ログイン
  - トークン自動リフレッシュ
- [ ] エラーケーステスト
  - ユーザーキャンセル（ブラウザ閉じる）
  - 無効なハンドル入力
  - ネットワークエラー
- [ ] App Passwordとの共存確認
  - OAuth → App Passwordログアウト/再ログイン
  - App Password → OAuthログアウト/再ログイン

**実装参考資料**：

- [AT Protocol OAuth Client Implementation](https://docs.bsky.app/docs/advanced-guides/oauth-client)
- [AT Protocol OAuth Introduction](https://atproto.com/guides/oauth)
- [@atproto/oauth-client-expo npm](https://www.npmjs.com/package/@atproto/oauth-client-expo)
- **詳細実装ガイド**：`doc/OAUTH_IMPLEMENTATION_SUMMARY.md`

##### Phase 4-5: TestFlightデバッグシステム構築（3-4時間）✅ 完了

**背景**：TestFlightでOAuth認証時に「undefined is not a function」エラーが発生。Windows環境ではiOSデバイスログを直接確認できないため、リモートデバッグシステムを構築。

**実装内容**：

- [x] ローカルログ収集システム（`src/utils/logger.ts`）
  - AsyncStorageにログ保存（最大200件）
  - info/warn/errorレベルでログ記録
  - タイムスタンプと詳細情報を含む
- [x] デバッグログ閲覧画面（`src/screens/DebugLogsScreen.tsx`）
  - ログ表示、コピー、共有、再読み込み、削除機能
  - TestFlight環境でのログ確認を可能に
- [x] 設定画面に「デバッグログ」項目追加
- [x] ナビゲーション統合（`AppNavigator.tsx`）
- [x] OAuth認証フローの詳細ログ記録
  - `auth.ts`に`oauthLogger`統合
  - エラー詳細（メッセージ、型、スタック）を記録
- [x] エラーメッセージに詳細情報を含める
  - ユーザーに表示されるエラーに具体的な情報を追加
- [x] トラブルシューティングドキュメント更新
  - `doc/troubleshooting.md`に問題30として記録
  - Windows環境でのデバッグ方法を記載

**成果物**：

- 新規ファイル：`logger.ts`, `DebugLogsScreen.tsx`
- 修正ファイル：`auth.ts`, `oauth-client.ts`, `SettingsScreen.tsx`, `AppNavigator.tsx`
- ドキュメント：`troubleshooting.md`（TestFlightデバッグ手順）
- 実装工数：**約3時間**

**次のステップ**：

1. 新しいビルドをTestFlightにアップロード
2. デバッグログから詳細エラー情報を収集
3. `@atproto/oauth-client-expo`の問題を特定・修正

**工数実績**：

- Phase 4-1：1時間
- Phase 4-2：3時間
- Phase 4-5（デバッグシステム）：3時間
- ドキュメント作成：1時間
- **合計：8時間**（見積もり12-16時間に対して効率的に完了）

#### 実装方針（更新）

- **App Password併用設計**: 後方互換性確保、両方式が共存
- **OAuth優先UI**: OAuthをデフォルト推奨、App Passwordは詳細オプション
- **リスク管理**: OAuth不安定時はApp Passwordで運用可能
- **セキュリティ**: PKCE (RFC 7636)、expo-secure-storeでトークン管理

**工数**: 30-37時間（MVP版 Phase 1-3のみ）= 4-5営業日

### M3: ベータリリース（v1.0.0）（2週間）

**注**: OAuth実装延期により、v1.0.0はApp Password専用版としてリリース

#### Phase 1: 品質保証と安定性 ✅ **完了** (2026-01-13)

**実装済み項目**:

- [x] TypeScriptエラー修正（32エラー → 0エラー）
  - WordPopupModal.tsx: API使用法の統一
  - auth.ts: ストレージキー名の修正
  - oauth.test.ts: TypeScriptコンパイル対象から除外
- [x] テスト修正と追加
  - freeDictionary.test.ts: キャッシュ問題の解決（6失敗 → 27成功）
  - authStore.test.ts: 新規作成（15テスト追加）
- [x] テストカバレッジの確保
  - validators: 38テスト通過
  - pkce: 24テスト通過
  - words: 28テスト通過
  - deepl: 33テスト通過
  - freeDictionary: 27テスト通過（1スキップ）
  - authStore: 15テスト通過
  - **合計**: 165+テスト通過

**成果**:

- TypeScript型安全性の確保
- 認証フローの完全なユニットテストカバレッジ
- API統合テストの安定化

#### Phase 2: UX改善 ✅ **完了** (2026-01-14)

**実装済み項目**:

- [x] トースト通知システムの実装
  - `src/components/common/Toast.tsx` - 4種類の通知タイプ（success/error/warning/info）
  - `src/hooks/useToast.ts` - トースト管理フック
  - スライドインアニメーション、自動消滅機能
- [x] SettingsScreen データ操作機能実装
  - データエクスポート（JSON形式、Share API使用）
  - データ削除（確認ダイアログ + トランザクション処理）
  - トースト通知統合
- [x] エラーハンドリング統一
  - WordListScreen - Alert.alertをトースト通知に置き換え
  - ApiKeySetupScreen - API Key保存/削除のフィードバックをトースト化
  - SettingsScreen - データ操作のフィードバックをトースト化

**成果**:

- 統一されたUX: 全画面で一貫したトースト通知
- ユーザーフィードバックの改善: Alert.alertの減少、非侵襲的な通知
- コード品質: TypeScript型安全性の確保

#### Phase 3: アクセシビリティとテスト ✅ **完了** (2026-01-14)

**実装済み項目**:

- [x] アクセシビリティラベル追加（主要コンポーネント）
  - ProgressScreen: シェアボタン、モーダルボタン（キャンセル、Bluesky投稿、画像シェア）
  - HomeScreen: タイムライン更新ボタン
  - WordListScreen: ソートボタン、フィルタータブ、削除ボタン
  - PostCard: 投稿カード全体にaccessible属性追加
- [x] 主要画面のスナップショットテスト実装
  - Button コンポーネント: 5スナップショット（Primary, Outline, Text, Disabled, Loading）
  - Loading コンポーネント: 4スナップショット（デフォルト、メッセージ、全画面、全画面+メッセージ）
  - Toast コンポーネント: 5スナップショット（Success, Error, Warning, Info, Hidden）
  - **合計**: 14スナップショット作成・検証済み
- [x] テスト環境の改善
  - jest-expo プリセット導入
  - react-test-renderer インストール（v19.1.0）
  - transformIgnorePatterns更新（expo-modules-core, lucide-react-native対応）
  - モック追加（react-native-view-shot, lucide-react-native）
- [x] TestFlight配信準備
  - App Password専用版（v1.0.0）をビルド
  - TestFlightに配信完了（実機テスト済み）
- [x] ユーザーフィードバック収集体制構築
  - GitHub Issuesテンプレート作成（バグ報告、機能要望、質問）
  - フィードバック導線の追加（設定画面にリンク）
  - Blueskyアカウントでのフィードバック受付準備

**成果**:

- アクセシビリティ対応: スクリーンリーダーユーザーに配慮したUI実装完了
- スナップショットテスト: UIの意図しない変更を検出可能に
- テストインフラ: React Nativeコンポーネントのテストが可能に

### M3.5: ベータフィードバック対応（v1.0.1）✅ **完了** (2026-01-21)

**実装済み項目**:

- [x] UIの改善
  - WordPopupモーダルのキャンセルボタン透過問題修正
  - ライセンス画面のYahoo! API表示修正
  - タブバーのラベル削除（アイコンのみ）
  - TOPへ戻るボタン実装
  - 投稿カードのBluesky風レイアウト変更
- [x] OAuth認証の安定化
  - ATProtocol OAuth正式実装（AsyncStorage + expo-crypto）
  - ログイン画面のOAuth一本化
  - PDS/Authorization Server混同問題の解消
- [x] 多言語対応
  - i18next統合（日本語/英語）
  - 投稿時間、選択ヒント、Alertの翻訳対応
- [x] 機能追加
  - 句読点なしの英文選択対応
  - BookSearchボタン（投稿全体を調べる）
  - 操作のヒント画面
  - シェア機能統合（画像付きBluesky投稿）
  - いいね機能
  - スレッド表示
  - 投稿内の画像・リンク表示

**詳細**: `doc/changelog/v1.0.1-beta-feedback.md` 参照

### M4: 正式リリース（v1.0.0）🔄 **進行中** (2026-01-22)
- [x] ベータフィードバック反映
- [x] バージョン番号更新（1.0.0）
- [x] App Store用説明文作成
- [x] 初回ログイン時チュートリアル機能
  - ツールチップ式ガイド（4ステップ）
  - 単語の長押し選択、BookSearchボタン、Tipsボタン、API設定への誘導
  - AsyncStorageで完了状態を保存
  - i18next対応（日本語/英語）
- [x] ホーム画面インデックスタブUI（Following | Profile）
  - プロフィール表示機能（アバター、表示名、フォロー/フォロワー数）
  - ユーザー投稿フィード表示（無限スクロール、Pull to Refresh）
  - プロフィールタブでの単語登録機能
  - プロフィールキャッシュ機能
  - 設定画面のアカウント情報セクションをプロフィールタブに移行
- [x] 投稿作成機能の強化
  - 画像添付機能（最大4枚、expo-image-picker）
  - コンテンツ警告ラベル付与（sexual, nudity, porn, graphic-media）
  - 返信制御（Threadgate）設定
  - 引用制御（Postgate）設定
  - ProgressScreenへのPostCreationModal統合
- [x] タイムラインのコンテンツラベル対応
  - NSFW画像のぼかし表示（タップで表示）
  - 返信制限アイコンの動的切り替え
- [x] PDS単語データ同期機能
  - 単語の自動PDS保存
  - 学習進捗（既読/未読）の同期
  - PDSからの単語データ復元
- [x] 投稿URLのアプリ内表示
- [ ] App Storeスクリーンショット準備
- [ ] 本番ビルド作成
- [ ] App Store申請
- [ ] 正式リリース

### M5: 軽量化・データ配信基盤 ✅ **完了** (2026-01-27)

- [x] 単語データの外部化アーキテクチャ設計
  - [x] 要件定義 (doc/kumotan-worddb-plane.md)
  - [x] 実装案作成 (doc/kumotan-worddb-implementation-proposal.md)
  - [x] リポジトリ最適化 (巨大データのGit管理除外と.gitignore設定)
- [x] 辞書データ配信基盤構築 (2026-01-26)
  - [x] 辞書ファイル圧縮 (jmdict.db.gz: 29MB)
  - [x] 別リポジトリ作成 ([RieTamura/kumotan-dictionary](https://github.com/RieTamura/kumotan-dictionary))
  - [x] GitHub Pages配信設定・疎通確認
    - [metadata.json](https://rietamura.github.io/kumotan-dictionary/metadata.json)
    - [jmdict.db.gz](https://rietamura.github.io/kumotan-dictionary/jmdict.db.gz)
- [x] アプリ側実装フェーズ (2026-01-27)
  - [x] DICTIONARY_CONFIG定数追加（`src/constants/config.ts`）
  - [x] ExternalDictionaryService.ts作成（ダウンロード・解凍）
  - [x] jmdict.tsを外部辞書対応に更新
  - [x] 初回起動時の辞書準備画面UI（`DictionarySetupScreen.tsx`）
  - [x] 設定画面に「辞書データ管理」追加
  - [x] 多言語対応（日本語/英語翻訳ファイル）

### M6: 辞書フィードバック機能 ✅ 完了 (2026-01-30)

- [x] `FeedbackModal.tsx` 実装（UIおよび送信ロジック）
- [x] GAS 中継サーバー構築（スプレッドシート保存＋GitHub Dispatch）
- [x] GitHub Actions 自動 Issue 作成ワークフロー構築 (`feedback-integration.yml`)
- [x] Issue クローズ時のスプレッドシート自動ステータス更新機能の構築

### M7: PDS同期機能 ✅ **完了** (2026-02-07)

**目的**: AT Protocol PDS（Personal Data Store）への単語データ保存と復元を実装し、デバイス間のデータポータビリティを実現

- [x] PDS同期計画策定（`doc/pds-vocabulary-sync-plan.md`）
- [x] Lexiconスキーマ定義（`lexicons/io/kumotan/vocabulary/word.json`）
  - コレクション: `io.kumotan.vocabulary.word`
- [x] PDS同期サービス実装（`src/services/pds/vocabularySync.ts`）
  - `syncWordToPds()`: 単語をPDSに保存、rkeyをローカルDBに記録
  - `restoreFromPds()`: PDSから全単語データを復元（重複スキップ）
  - `deleteWordFromPds()`: PDS上の単語レコードを削除
- [x] データベースマイグレーション（`pds_rkey` カラム追加）
- [x] 学習進捗同期（`doc/pds-read-status-sync-plan.md`）
  - `isRead` / `readAt` ステータスをPDSに反映
- [x] 設定画面に「PDSから復元」ボタン追加
- [x] 多言語対応（日本語/英語翻訳ファイル追加）

**設計方針**:
- ローカル → PDS の一方向同期（複雑な双方向同期は回避）
- PDS障害時もローカル操作は継続可能（障害耐性設計）
- 復元時は `english` フィールドで重複チェック

### M8: 投稿機能強化・コンテンツモデレーション ✅ **完了** (2026-02-11)

**目的**: Bluesky投稿作成機能の強化とコンテンツモデレーション対応

- [x] 画像添付機能（`PostCreationModal.tsx`）
  - expo-image-picker によるカメラ/ライブラリからの画像選択
  - 最大4枚の画像添付、プレビュー表示
  - Bluesky APIへの画像アップロード・embed構築
- [x] コンテンツ警告ラベル付与（`ContentLabelModal.tsx`）
  - self-label方式（sexual, nudity, porn, graphic-media）
  - 投稿作成時にラベル選択UI
- [x] タイムラインのNSFWコンテンツ対応
  - NSFW画像のぼかし表示（タップで表示）
  - AlertTriangleアイコンによる警告表示
  - `hasNsfwLabel()` ヘルパー関数
- [x] 投稿への反応設定（Threadgate / Postgate）
  - 返信制御: 誰でも / フォロワー / フォロー中 / メンションした人 / 返信不可
  - 引用制御: 許可 / 禁止
  - `ReplySettingsModal.tsx` 新規作成
  - タイムライン上の返信アイコン動的切り替え
- [x] ProgressScreenへのPostCreationModal統合
- [x] 設定画面にモデレーションセクション追加
  - Bluesky公式ラベラーアカウントへの外部リンク

### M9: 利用規約・プライバシーポリシー ✅ **完了** (2026-02-12)

**目的**: App Store公開に向けた法的文書の整備とアプリ内表示

- [x] 利用規約の作成（`doc/terms-of-service.md`、全16条）
  - サービス定義、Bluesky OAuth認証、PDS同期、外部サービス利用
  - 投稿機能・コンテンツモデレーション、免責事項、準拠法
- [x] プライバシーポリシーの作成（`doc/privacy-policy.md`、全11条）
  - 収集情報の5カテゴリ分類（Blueskyアカウント、端末内、PDS、外部サービス、フィードバック）
  - 安全管理措置、アナリティクス不使用の明示、データ削除方法
- [x] `LegalDocumentScreen` 新規作成（法的文書の表示画面）
- [x] 日英多言語対応（`legal` namespace: `ja/legal.json`, `en/legal.json`）
- [x] `AppNavigator` に `LegalDocument` ルート追加
- [x] 設定画面のアプリ情報セクション（タグライン下）にリンク配置

## 注意事項・制約

### API制限
- DeepL API Free枠：月50万文字まで（ユーザーごと、超過時はアラート表示）
- Yahoo! JAPAN API：1日50,000リクエストまで（アプリケーションID単位）
- Bluesky APIレート制限：3000リクエスト/5分（RateLimiterクラスで管理）
- Free Dictionary API：明示的な制限なし（常識的な範囲で使用、キャッシュ推奨）

### 技術的制約
- オフライン対応：フィード取得・単語登録以外はオフラインで動作
- 初回リリースはiOSのみ
- データはローカル保存のみ（Phase 4でクラウド同期予定）

### プライバシー・セキュリティ

- ユーザーデータはローカル保存 + ユーザー自身のPDSに同期（運営者サーバーへの保存なし）
- 認証トークンはexpo-secure-storeで暗号化保存
- **App Passwordは保存しない**（OAuth PKCE + DPoP方式）
- **DeepL API Keyはユーザー入力方式**（アプリ埋め込み禁止）
- SQLクエリはプレースホルダー必須
- アナリティクス・トラッキングSDK不使用
- 利用規約・プライバシーポリシーをアプリ内から閲覧可能

## 成功指標（KPI）

### ローンチ後1ヶ月
- ダウンロード数：50件
- DAU（デイリーアクティブユーザー）：10人
- 登録単語数（平均）：20単語/ユーザー

### ローンチ後3ヶ月
- ダウンロード数：200件
- DAU：40人
- 継続率（7日）：30%
- 登録単語数（平均）：50単語/ユーザー

### ローンチ後6ヶ月
- ダウンロード数：500件
- DAU：100人
- 継続率（7日）：40%
- Blueskyでの言及：月10件以上

## リスクと対策

### リスク1：DeepL API使用量超過
- **対策**: 
  - ユーザー入力方式により、各ユーザーが独自の無料枠を使用
  - 使用量80%/95%でアラート表示
  - 翻訳結果をDBにキャッシュ（再翻訳不要）

### リスク2：ユーザーが集まらない
- **対策**: Blueskyコミュニティでのプロモーション、オープンソース化

### リスク3：開発期間の遅延
- **対策**: MVP機能を最小限に絞る、Phase分けして段階的リリース

### リスク4：AT Protocol仕様変更
- **対策**: @atproto/apiの公式ライブラリ使用、定期的なアップデート

### リスク5：トークン期限切れによるUX低下
- **対策**: 自動リフレッシュ機能実装、失敗時は明確なメッセージで再ログインを促す

### リスク6：オフライン時の操作制限
- **対策**: オフラインバナーで状態を明示、可能な操作（閲覧、既読切り替え）は継続可能

## ライセンス

- ソースコード：MIT License（予定）
- アプリアイコン・デザイン：All Rights Reserved

---

**作成日**: 2025年1月1日
**最終更新日**: 2026年2月12日
**バージョン**: 1.28
**作成者**: RieTamura

## 変更履歴

### v1.28 (2026-02-11)

- **投稿作成時の画像添付機能**
  - expo-image-pickerによるカメラ/ライブラリからの画像選択
  - 最大4枚の画像添付、プレビュー表示・削除
  - Bluesky APIへの画像アップロード（`buildImageEmbed()`）
  - 変更ファイル:
    - `src/components/PostCreationModal.tsx`: 画像ピッカー・プレビューUI追加
    - `src/hooks/usePostCreation.ts`: 画像状態管理・アップロードロジック追加
    - `src/services/bluesky/feed.ts`: `PostImageAttachment`型、`buildImageEmbed()`関数追加
- **コンテンツ警告ラベル機能（投稿作成側）**
  - 投稿にself-labelを付与可能（sexual, nudity, porn, graphic-media）
  - `ContentLabelModal.tsx` 新規作成
  - 変更ファイル:
    - `src/components/ContentLabelModal.tsx`: コンテンツラベル選択モーダル
    - `src/components/PostCreationModal.tsx`: ラベル選択ボタン追加
- **タイムラインのNSFWコンテンツ警告表示**
  - NSFW画像のぼかし表示（タップで解除）
  - AlertTriangleアイコンによる警告バッジ
  - `hasNsfwLabel()` ヘルパー関数
  - 変更ファイル:
    - `src/components/PostCard.tsx`: NSFW検出・ぼかし表示ロジック追加

### v1.27 (2026-02-10)

- **投稿への反応設定（Threadgate / Postgate）機能の実装**
  - 投稿作成時に「返信できるユーザー」と「引用の許可/不許可」を設定可能に
  - Bluesky公式アプリと同等のUX（BottomSheetモーダル）を提供
  - 対応する返信制御: 誰でも / フォロワー / フォロー中の人 / メンションした人 / 返信不可
  - 引用制御: 引用を許可 / 引用を禁止
  - タイムライン上の返信アイコンをthreadgate設定に応じて切り替え
    - 制限なし: `MessageCircle`（通常）
    - 一部制限: `MessageCircleDashed`（破線）
    - 返信不可: `MessageCircleOff`（禁止）
  - 変更ファイル:
    - `src/services/bluesky/feed.ts`: 型定義追加、threadgate/postgate レコード作成ロジック、`getReplyRestriction()`ヘルパー
    - `src/hooks/usePostCreation.ts`: `replySettings` 状態管理追加
    - `src/components/ReplySettingsModal.tsx`: 新規作成（反応設定モーダルUI）
    - `src/components/PostCreationModal.tsx`: フッターに反応設定ボタン追加
    - `src/components/PostCard.tsx`: 返信アイコンの動的切り替え
    - `src/types/bluesky.ts`: `ReplyRestriction` 型、`TimelinePost.replyRestriction` 追加
    - `src/locales/ja/home.json`, `src/locales/en/home.json`: 翻訳キー追加
  - 詳細: `doc/threadgate-postgate-plan.md` 参照
- **設定画面に「モデレーション」セクションを追加**
  - Bluesky公式ラベラーアカウントへの外部リンクを設置
  - アプリ内でのモデレーション機能は実装せず、Bluesky公式アプリでの設定を誘導
  - 変更ファイル:
    - `src/constants/config.ts`: `EXTERNAL_LINKS.BLUESKY_MODERATION` 追加
    - `src/screens/SettingsScreen.tsx`: モデレーションセクション追加
    - `src/locales/ja/settings.json`, `src/locales/en/settings.json`: 翻訳キー追加
- **ProgressScreenへのPostCreationModal統合**
  - シェアテキストのプリフィル機能（学習成果テキストを自動入力）
  - 変更ファイル: `src/screens/ProgressScreen.tsx`
- **プロフィール画面のスクロール改善**
  - スクロール時のボタン表示制御を追加
- **辞書自動更新フローに品詞・投稿リンク対応とフローB（PR自動作成）を追加**
  - 「approved」ラベル → `overrides.json` 自動追記（Flow A）
  - 「search-improvement」ラベル → PR自動作成（Flow B）
  - 変更ファイル: `.github/workflows/feedback-integration.yml`

### v1.26 (2026-02-06)

- **useWordRegistration カスタムフック抽出 & プロフィールタブへの単語登録機能追加**
  - `src/hooks/useWordRegistration.ts` 新規作成
    - HomeScreenに密結合していた単語登録・文章モードのロジックをカスタムフックに抽出
    - `WordPopupState`、`handleWordSelect`、`handleSentenceSelect`、`closeWordPopup`、`handleAddWord` を管理
    - `addWord` DB呼び出しと `Alert` 表示のロジックを内包
  - `src/screens/HomeScreen.tsx` リファクタリング
    - インラインの状態管理・ハンドラ定義を `useWordRegistration()` フック呼び出しに置換
    - 未使用になった `Alert` import と `tc` 翻訳を削除
    - 既存動作に影響なし（同一インターフェースを維持）
  - `src/components/ProfileView.tsx` 機能追加
    - `useWordRegistration` フックと `WordPopup` コンポーネントを統合
    - `PostCard` に `onWordSelect`、`onSentenceSelect`、`clearSelection` を追加
    - `FlatList` を `View` でラップし `WordPopup` を配置
    - プロフィールタブの投稿フィードで単語登録・文章モードが利用可能に
  - 詳細：`doc/word-registration-hook-extraction-plan.md` 参照
- **PDS単語データ同期機能の実装**
  - `src/services/pds/vocabularySync.ts` 新規作成
    - `syncWordToPds()`: 単語保存時にPDSへ自動同期
    - `restoreFromPds()`: PDSから全単語データを復元（重複スキップ）
    - `deleteWordFromPds()`: PDS上のレコード削除
  - Lexiconスキーマ定義（`lexicons/io/kumotan/vocabulary/word.json`）
  - データベースマイグレーション（`pds_rkey` カラム追加）
  - 設定画面に「PDSから復元」ボタン追加
  - 詳細：`doc/pds-vocabulary-sync-plan.md` 参照
- **PDS学習進捗同期機能の追加**（2026-02-07）
  - `isRead` / `readAt` ステータスをPDSに反映
  - 既読/未読切り替え時にPDSレコードを更新
  - 詳細：`doc/pds-read-status-sync-plan.md` 参照
- **投稿URLをアプリ内で開く機能**
  - `WordListItem`の投稿リンクタップ時にスレッド画面へ遷移
  - 外部ブラウザ遷移からアプリ内ナビゲーションに変更
  - 変更ファイル: `src/components/WordListItem.tsx`, `src/screens/WordListScreen.tsx`
- **検索機能の実装計画策定**
  - 保存済み単語のキーワード検索（Phase 1）
  - Bluesky投稿検索（Phase 2）
  - ユーザー検索（Phase 3）
  - 詳細：`doc/search-feature-implementation-plan.md` 参照
- **フィードバック機能に品詞と投稿リンクの追加情報を拡張**
  - `FeedbackModal.tsx`に`partOfSpeech`、`postUrl`フィールド追加
  - 検索改善の判断材料を強化
- **Expo関連依存関係の最新パッチバージョン更新**

### v1.25 (2026-02-05)

- **ホーム画面インデックスタブUIの実装**
  - ファイルフォルダ風タブ（Following | Profile + アバター）
  - スワイプでタブ切り替え
  - 変更ファイル:
    - `src/screens/HomeScreen.tsx`: インデックスタブUI追加
    - `src/components/ProfileView.tsx`: 新規作成（プロフィール表示コンポーネント）
  - 詳細：`doc/home-index-tabs-plan.md` 参照
- **プロフィールタブにユーザー投稿フィード表示**
  - `getAuthorFeed()` APIでユーザー自身の投稿を取得
  - `useAuthorFeed.ts` カスタムフック（ページネーション、Pull to Refresh）
  - プロフィール情報表示（アバター、表示名、bio、フォロー/フォロワー数）
  - 変更ファイル:
    - `src/hooks/useAuthorFeed.ts`: 新規作成
    - `src/services/bluesky/feed.ts`: `getAuthorFeed()` 追加
  - 詳細：`doc/profile-author-feed-plan.md` 参照
- **プロフィールキャッシュ機能**
  - APIからのプロフィール取得を最適化
  - 変更ファイル: `src/services/bluesky/feed.ts`
- **設定画面からアカウント情報セクションを削除**
  - プロフィールタブへ移行に伴い、設定画面の重複表示を整理
- **フィードバックからIssue自動作成ワークフローの新規作成**
  - `.github/workflows/feedback-integration.yml`を追加
  - GAS経由でフィードバックを受信し、GitHub Issueを自動作成
  - Issueクローズ時にスプレッドシートのステータスを自動更新
  - フィードバックタイプ（bug/feature/word_search）に応じたラベル付け
- **日本語逆引き検索でのオーバーライド対応の計画策定**
  - Phase 2.5の将来の拡張計画に追加
  - `translateWithJMdictReverse`へのオーバーライド検索機能追加を予定

### v1.24 (2026-02-04)

- **辞書データ半自動更新機能の実装**
  - フィードバックから承認された修正を自動で辞書に反映する仕組み
  - 差分ファイル（`overrides.json`）方式を採用
  - アプリ側実装：
    - `src/constants/config.ts`: オーバーライド関連設定を追加
    - `src/services/dictionary/ExternalDictionaryService.ts`: 差分取得・キャッシュ機能
    - `src/services/dictionary/jmdict.ts`: 差分優先適用ロジック
    - `src/types/word.ts`: `source`フィールドに`'override'`タイプ追加
  - GitHub Actions設定（kumotan-dictionaryリポジトリ）：
    - 「approved」ラベル付与時に`overrides.json`を自動更新
    - GitHub Pagesで配信
  - 詳細：`doc/dictionary-auto-update-plan.md`参照

### v1.23 (2026-02-02)

- **クイズ機能のナビゲーション改善**
  - クイズアイコンをホーム画面ヘッダーからフッタータブに移動
  - タブ順序： ホーム → 単語帳 → **クイズ** → 進捗 → 設定
  - QuizSetupScreenに独自ヘッダーを追加（タブ表示用）
  - 変更ファイル：
    - `src/navigation/AppNavigator.tsx`： クイズタブ追加、TAB_CONFIG更新
    - `src/screens/QuizSetupScreen.tsx`： 独自ヘッダー追加
    - `src/screens/HomeScreen.tsx`： クイズボタン削除
    - `src/locales/ja/navigation.json`： クイズタブラベル追加
    - `src/locales/en/navigation.json`： クイズタブラベル追加

### v1.22 (2026-01-29)

- **Bluesky投稿機能：ハッシュタグ自動抽出機能の実装**
  - 投稿テキストに直接入力されたハッシュタグ（例：`#テスト投稿`）を自動検出
  - 抽出したハッシュタグを履歴に保存（次回投稿時に選択肢として表示）
  - 選択済みハッシュタグと抽出ハッシュタグを`Set`で結合（重複排除）
  - Unicode対応の正規表現 `/#[\p{L}\p{N}_]+/gu` を使用（日本語・英語両対応）
  - 変更ファイル：`src/hooks/usePostCreation.ts`
    - `extractHashtagsFromText()`関数を新規追加
    - `submitPost()`内で投稿成功後にハッシュタグを抽出・保存

### v1.21 (2026-01-27)

- **M5: 軽量化・データ配信基盤 完了**
  - アプリ側実装フェーズ完了
  - `DICTIONARY_CONFIG`定数を`src/constants/config.ts`に追加
  - `ExternalDictionaryService.ts`新規作成
    - GitHub Pagesから辞書データをダウンロード
    - fflateによるGzip解凍
    - expo-file-system/legacyによるファイル操作
    - インストール状態管理（AsyncStorage）
  - `jmdict.ts`を外部辞書対応に更新
  - `DictionarySetupScreen.tsx`新規作成（初回起動時の辞書準備画面）
    - ダウンロード進捗表示
    - オフライン検出・警告
    - Wi-Fi推奨メッセージ
  - 設定画面に「辞書データ管理」セクション追加
    - インストール状態表示
    - ダウンロード/削除機能
  - 多言語対応（日本語/英語翻訳ファイル追加）
  - 不要なsetup.ts削除（ExternalDictionaryServiceに統合）

### v1.19 (2026-01-22)

- **初回ログイン時チュートリアル機能**
  - ツールチップ式ガイド（4ステップ）
  - 単語の長押し選択、BookSearchボタン、Tipsボタン、API設定への誘導
  - `TutorialTooltip`コンポーネント新規作成
  - `useTutorial`フックによる状態管理
  - AsyncStorageで完了状態を永続化
  - i18next対応（日本語/英語翻訳ファイル追加）

### v1.20 (2026-01-26)

- **単語データ外部配信アーキテクチャ策定**
  - アプリサイズ軽量化とオフライン利用の両立を目指す
  - GitHub Pagesを利用したデータ配信、アプリ初回起動時のダウンロード方式を採用
  - 実装計画書を作成 (`doc/kumotan-worddb-implementation-proposal.md`)
  - **リポジトリ最適化**: 100MBを超える辞書データ（.db, .json）のGit追記を廃止し、`.gitignore`に追加。ビルド・配信用の圧縮スクリプト (`scripts/jmdict/compress-dictionary.js`) を導入。

### v1.18 (2026-01-21)

- **v1.0.0正式リリース準備**
  - ベータフィードバック対応完了（17項目）
  - app.jsonバージョンを1.0.0に更新
  - App Store用説明文作成（`doc/app-store/release-info.md`）
  - M3.5マイルストーン完了、M4進行中
- **追加機能**
  - いいね機能の実装（likePost/unlikePost API、オプティミスティックUI）
  - スレッド表示機能
  - 投稿内の画像・リンク表示

### v1.17 (2026-01-19)

- **OAuth認証の実機動作確認完了 - ログイン成功！**
  - 背景：v1.16でのOAuth基盤実装後、実機テストで「Bad token scope」および「Authentication Required」エラーが発生
  - 根本原因の特定：
    - **PDSとAuthorization Serverの混同**: `bsky.social`はAuthorization Server（Entryway）であり、PDS（Protected Resource）ではない
    - **DoPトークンとBskyAgentの非互換性**: DPoP-boundのOAuthトークンは`BskyAgent.resumeSession()`と互換性がない
  - 核心的な修正：
    - `customResolver`の修正：PLC Directoryから実際のDIDドキュメントを取得し、ユーザーの本当のPDS URLを解決
    - `setOAuthSession()`関数の導入：OAuth session の `fetchHandler` を使用してAPI呼び出しを行うように変更
    - `startOAuthFlow`と`resumeSession`の修正：`setOAuthSession()`を使用してエージェントを初期化
    - 不正確なProtected Resourceキャッシュエントリの削除
  - 成果：
    - **実機でのOAuthログイン成功を確認**
    - セッション復元、API呼び出し、トークンリフレッシュの動作安定性を確認
    - DPoP-boundトークンによるセキュアな認証フローの完成

### v1.16 (2026-01-18)

- **ATProtocol OAuth認証の正式・安定版実装**
  - 背景：前バージョンまでの `react-native-mmkv` 依存によるビルドエラーや認証失敗を根本解決
  - 核心的な修正：
    - `@atproto/oauth-client` コアライブラリへの移行と、`AsyncStorage` を使用したカスタムストレージアダプターの導入
    - `expo-crypto` を活用した DPoP 対応暗号化クラス `JoseKey` の自前実装
    - `react-native-mmkv` の完全排除による、Expo SDK 54 環境での絶対的な安定性を確保
  - 成果：
    - TypeScript エラーの完全解消
    - `authStore.test.ts` を含む全ユニットテストの通過を確認
    - 認証フロー、セッション復元、ログアウトの動作安定性を検証済み


### v1.15 (2026-01-14)

- **日本語辞書機能の実装計画を確定**
  - 背景：
    - `doc/japanese-dictionary-proposal.md`で詳細な技術調査を完了
    - 複数の実装方式を比較検討（iOS辞書、Wiktionary API、TexTra、SQLite DB、ATProtocol）
    - ユーザー決定：アプリサイズ +10-15 MB増加を許容、v1.0.0リリース後すぐに実装開始
  - 採用アプローチ：**ハイブリッド方式（Tier 1-2）**
    - **Tier 1**: オフライン辞書DB（SQLite）- 頻出5万語、10-15MB
      - 完全オフライン動作、超高速検索（数ミリ秒）
      - 90%以上のユースケースをカバー
      - データソース：日本語Wiktionary ダンプ（CC BY-SA 3.0）
    - **Tier 2**: Wiktionary APIフォールバック
      - オフラインDBに見つからない場合にオンライン検索
      - 残り10%の単語をカバー
    - **Tier 3**: iOS辞書ボタン（補助機能、オプション）
  - 実装スケジュール：
    - Week 1-2: v1.0.0リリース準備（App Password専用版）
    - Week 3-6: v1.1.0日本語辞書実装（Phase 1: オフラインDB、3-4週間）
    - Week 7-8: v1.1.1 Wiktionary APIフォールバック（Phase 2、1.5週間）
  - 技術的詳細：
    - データベース構築ツール作成（Wiktionaryダンプ → SQLite変換）
    - 頻出5万語の抽出ロジック（BCCWJ/JLPT基準）
    - expo-sqliteでの辞書DB統合
    - WordPopupコンポーネントへの日本語辞書検索機能統合
  - 期待される成果：
    - 英語単語：Free Dictionary API + DeepL翻訳（既存機能）
    - 日本語単語：オフライン辞書DB（90%）→ Wiktionary API（10%）
    - 完全オフライン対応、超高速検索、プライバシー保護
  - ライセンス遵守：
    - CC BY-SA 3.0準拠
    - About画面に帰属表記（日本語版Wiktionary）
  - 参考資料：
    - [doc/japanese-dictionary-proposal.md](japanese-dictionary-proposal.md) - 詳細な技術調査と実装提案
    - [日本語Wiktionary ダンプ](https://dumps.wikimedia.org/jawiktionary/)
    - [Kaikki.org - 処理済みWiktionaryデータ](https://kaikki.org/dictionary/rawdata.html)

### v1.14 (2026-01-13)

- **OAuth認証の延期決定 - App Password専用版としてリリース**
  - 背景：
    - iOS Podsインストールエラー（react-native-mmkv、react-native-reanimatedの互換性問題）
    - `@atproto/oauth-client-expo`がreact-native-mmkvに必須依存
    - react-native-mmkv v2/v3/v4すべてでExpo SDK 54 Old Architecture環境での動作に問題
  - 技術的調査結果：
    - **react-native-mmkv依存関係の問題**：
      - mmkv v2.12.2: `@atproto/oauth-client-expo`が要求するAPIと非互換
      - mmkv v3.3.3: New Architecture必須、Old Architectureで動作不可
      - mmkv v4.1.1: Nitro Modules必要、Expo managed workflowで不安定
    - **react-native-reanimatedの制約**：
      - reanimated v4: New Architecture必須
      - reanimated v3: Old Architecture対応（現在使用中）
      - New Architectureを有効にするとreanimated v4が必要だが、他パッケージとの互換性未検証
    - **Expo SDK 54の制約**：
      - Old/New両Architectureをサポートするが、New Architectureはまだ実験的
      - managed workflowでのTurboModules/Nitroサポートが不完全
  - ATProtocol認証方式の比較調査：
    - **App Password**: PDSへの読み書き可能、`@atproto/api`のBskyAgentで完全サポート
    - **OAuth**: 同様にPDSへの読み書き可能、より安全だが複雑な実装が必要
    - **結論**: 要件（PDS書き込み）はApp Passwordで十分に満たせる
  - 最終決定：
    - OAuth認証機能を延期し、**App Password専用版**でリリース
    - react-native-mmkvとreact-native-reanimatedをOld Architecture互換版にダウングレード
    - 変更内容：
      - react-native-mmkv: v4.1.1 → v2.12.2
      - react-native-reanimated: v4.1.1 → v3.17.5
      - react-native-worklets: 削除（reanimated v4のみ必要）
      - react-native-nitro-modules: 削除（mmkv v4のみ必要）
      - expo-build-properties: 削除（New Architecture設定不要）
  - 将来の展望：
    - Expo SDK 55以降でNew Architectureサポートが成熟すれば、OAuth再検討
    - React Native 0.82+でOld Architecture廃止後、必須移行
    - 現時点では安定性とリリーススピードを優先
  - 学習事項：
    - Expo managed workflowの制約を深く理解
    - New/Old Architectureの互換性問題を経験
    - ネイティブモジュール依存関係の複雑さを認識
  - 参考資料：
    - [Expo SDK 54 Changelog](https://expo.dev/changelog/sdk-54)
    - [React Native Reanimated Compatibility](https://docs.swmansion.com/react-native-reanimated/docs/guides/compatibility/)
    - [ATProtocol OAuth vs App Password比較](https://atproto.com/guides/oauth)

### v1.13 (2026-01-12) - 取り消し

**注**: このバージョンで試みたカスタムOAuth実装は、技術的制約により実現できませんでした。v1.14でApp Password専用版に方針転換しました。

### v1.7 (2026-01-10)

- OAuth設定のAT Protocol仕様完全準拠対応（PR #2予定）
  - redirect URIの設定ファイル間不一致を解消
  - パスなし形式（`io.github.rietamura:/`）に統一
  - AT Protocol OAuth仕様（https://atproto.com/specs/oauth）の分析結果を記録
  - 修正理由：
    - PR #1で部分的な修正（パスあり形式`/oauth/callback`への変更）
    - 実装時に`app.json`（パスなし）と`assets/oauth-client-metadata.json`（パスあり）の不一致が判明
    - AT Protocol仕様ではパスはオプションであることを確認
    - シンプルさと保守性を優先しパスなし形式を採用
  - 影響範囲：
    - `assets/oauth-client-metadata.json`: redirect_urisを`io.github.rietamura:/`に変更
    - `src/services/bluesky/oauth-client.ts`: REDIRECT_URI定数を`io.github.rietamura:/`に変更
    - `app.json`: 既に正しい設定（変更不要）
    - `docs/oauth-client-metadata.json`: 既に正しい設定（変更不要）
  - 仕様準拠の確認事項：
    - ✅ スキーム名: `io.github.rietamura`（client_idのreverse domain形式）
    - ✅ 形式: `スキーム:/` （スラッシュは1つのみ、`://`は無効）
    - ✅ パス: `/`（末尾スラッシュのみ、追加パスはオプション）
    - ✅ application_type: `native`
    - ✅ 全設定ファイルで統一
    - ✅ `@atproto/oauth-client-expo`公式仕様に準拠

### v1.12 (2026-01-11)

- New Architecture (TurboModules) への移行
  - 症状：Old Architectureでのビルド不整合、JSIエラーの頻発
  - 対応：`app.json`で`newArchEnabled: true`に設定。`react-native-mmkv`を`^3.2.0`にアップグレードし、`overrides`を削除。

### v1.11 (2026-01-11)

- Build Configuration修正
  - 症状：v1.10の修正でビルドエラー発生 (Install pods phase)
  - 原因：Expo SDK 54では`newArchEnabled`設定を`plugins`内ではなく`app.json`ルートに記述する必要があった
  - 対応：`newArchEnabled: false`を`expo`オブジェクト直下に移動

### v1.10 (2026-01-11)

- JSI初期化エラー (`React Native is not running on-device`) の修正
  - 症状：TestFlightで `Failed to create a new MMKV instance: React Native is not running on-device` エラーが発生
  - 原因：`app.json` でアーキテクチャ設定が省略されていたため、Expo SDK 54のデフォルト等によりJSIモジュールが正しくロードされなかった
  - 対応：`expo-build-properties` を設定し、`newArchEnabled: false` を明示的に指定

### v1.9 (2026-01-11)

- `react-native-mmkv` ネストされた依存関係バージョン競合の解決
  - 症状：v1.8の修正後もTestFlightで同じエラーが継続
  - 原因：`@atproto/oauth-client-expo@0.0.7`がネストされた依存として`react-native-mmkv@3.3.3`を持っていた
  - 対応：
    - `package.json`に`overrides`フィールドを追加
    - `react-native-mmkv`を`2.12.2`に強制固定（キャレットなし完全一致）
    - すべての依存関係（ネストされたものを含む）でv2.12.2を使用するように設定
  - 確認方法：`npm ls react-native-mmkv`で`deduped`または`overridden`が表示されれば成功

### v1.8 (2026-01-11)

- `react-native-mmkv` エラー対応のためダウングレードを実施
  - 症状：TestFlightでのOAuth認証時にエラー（`react-native-mmkv 3.x.x requires TurboModules`）
  - 原因：`react-native-mmkv` v3以降はNew Architecture (TurboModules) が必須だが、現在のExpo managed workflow設定と競合していたため
  - 対応：
    - `react-native-mmkv` を v2.x 系にダウングレード
    - `app.json` から `newArchEnabled` 設定を削除（Old Architectureに戻す）
    - OAuthクライアントの互換性を確保


### v1.6 (2026-01-10)

- PR #1「OAuth redirect URI修正」のマージを記録
  - OAuth redirect URIを公式ドキュメント形式（reverse FQDN）に修正
  - `oauth-client-metadata.json`と`oauth-client.ts`の設定を統一
  - `app.json` scheme設定を`io.github.rietamura`に更新
  - 詳細なエラーロギングを追加（デバッグ用）
  - expo-constants重複依存問題を解決
- Phase 4-4実機テストタスクを更新
  - OAuth redirect URI修正タスクを完了に変更
  - 次の実機テスト段階に進む準備完了

### v1.5 (2026-01-09)

- M2.6 OAuth認証実装のPhase 4-4とPhase 4-5を追加
- TestFlightデバッグシステム構築を記録
  - Windows環境でのリモートログ収集システム実装
  - `src/utils/logger.ts`によるローカルログ保存
  - `src/screens/DebugLogsScreen.tsx`によるログ閲覧・共有機能
  - TestFlightでのOAuth認証エラー診断体制を整備
- OAuth認証フロー実機テスト状況を更新
  - TestFlight配信完了
  - 「undefined is not a function」エラーを発見・診断中
- Phase 4工数実績を更新（5時間 → 8時間）

### v1.4 (2026-01-06)
- Jisho.org API統合を削除
  - 日本語単語の処理はYahoo! APIの形態素解析のみに変更
  - 英語単語はFree Dictionary APIで引き続き対応
  - src/services/dictionary/jisho.ts削除
  - JishoResult型定義削除
  - WordPopup.tsxからJisho API呼び出しを削除

### v1.3 (2026-01-05)
- M2.5品質改善・テスト実装マイルストーンを追加
- CLAUDE.mdガイドライン完全準拠を目標に設定
- フェーズ1の即座対応タスクを完了
  - package.jsonメタデータ・npmスクリプト追加
  - Jest設定ファイル作成
  - バリデーション関数テスト追加（セキュリティクリティカル）
  - メモリリーク修正（PostCard.tsx）
  - 未使用コード削除

### v1.2 (2026-01-04)
- Yahoo! JAPAN Text Analysis API統合を追加
- API Key設定ページにYahoo! Client ID管理機能を追加
- セクション指定による自動スクロール機能を追加
- M1、M2の実装状況を完了に更新
- 設定ページの機能詳細を更新
- DeepL APIの使用量監視機能を追加

### v1.1 (2025-01-15)
- DeepL API Key管理方針をユーザー入力方式に変更
- App Password保存ポリシーを明確化（保存しない）
- API Key設定画面を追加
- トークンリフレッシュ機能を追加
- オフライン対応を詳細化
- 入力バリデーションを詳細化
- セキュリティ設計セクションを追加

### v1.0 (2025-01-01)
- 初版作成