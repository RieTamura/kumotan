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
  - expo-secure-store（認証トークン、DeepL API Key、Yahoo! Client ID）
  - AsyncStorage（UI設定、キャッシュ）
- **辞書API**:
  - Free Dictionary API（英語定義）
  - DeepL API Free（日本語翻訳、月50万文字まで無料）
  - Yahoo! JAPAN Text Analysis API（日本語単語の形態素解析・ふりがな）
- **認証**: Bluesky App Password（ユーザー名 + App Password）
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
- 利用規約
- プライバシーポリシー

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
- **認証トークン（accessJwt, refreshJwt）**: expo-secure-storeに暗号化保存
- **ユーザー情報（did, handle）**: expo-secure-storeに保存
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

### Phase 3: プラットフォーム拡張
- 日本語→英語の学習モード対応
- Android対応
- Web版（同じAPIで展開）
- OAuth認証対応

### Phase 4: AT Protocol連携強化
- PDS（Personal Data Server）への学習データ保存
- 複数デバイス同期
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
- [ ] OAuth認証フロー完全テスト（デバッグ後）
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

### M3: ベータリリース（v1.1.0）（2週間）
- [ ] OAuth統合テスト
- [ ] UI/UXの洗練
- [ ] エラーハンドリング統一
- [ ] バグフィックス
- [ ] TestFlight配信
- [ ] OAuth/App Password両方テスト
- [ ] ユーザーフィードバック収集

### M4: 正式リリース（v1.2.0）（1〜2週間）
- [ ] ベータフィードバック反映
- [ ] App Store申請
- [ ] プロモーション準備
- [ ] ドキュメント整備
- [ ] 正式リリース

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
- ユーザーデータは外部送信なし（APIリクエストを除く）
- 認証トークンはexpo-secure-storeで暗号化保存
- **App Passwordは保存しない**（トークンのみ保持）
- **DeepL API Keyはユーザー入力方式**（アプリ埋め込み禁止）
- SQLクエリはプレースホルダー必須

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
**最終更新日**: 2026年1月9日
**バージョン**: 1.5
**作成者**: RieTamura

## 変更履歴

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