# くもたん (Kumotan) ☁️

**Blueskyで英語学習！タイムラインから単語を保存して、あなただけの単語帳を作ろう**

[![Expo](https://img.shields.io/badge/Expo-SDK%2054-blue)](https://expo.dev/)
[![React Native](https://img.shields.io/badge/React%20Native-0.81-green)](https://reactnative.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.9-blue)](https://www.typescriptlang.org/)

## 📱 概要

くもたん（Kumotan）は、Blueskyのタイムラインを活用した英語学習アプリです。フォローしているユーザーの投稿から英単語を選択して保存し、オリジナルの単語帳を作成できます。

## ✨ 機能

- 🔐 **Bluesky認証** - OAuthによる安全なログイン
- 📰 **タイムライン表示** - Following / カスタムフィード / プロフィールタブをスワイプで切り替え
- 📝 **単語保存** - 投稿から英単語を長押しで選択・保存
- 📚 **単語帳管理** - 保存した単語の一覧表示・既読管理・ソート・フィルタ・検索
- 🧠 **クイズモード** - 4択／テキスト入力形式のクイズで単語を復習・結果をBlueskyでシェア
- 📊 **学習進捗** - 日別の学習統計とカレンダー表示・Blueskyシェア機能
- 🔤 **翻訳・定義** - DeepL / Free Dictionary / Yahoo! JAPAN / JMdict（ローカル辞書）に対応
- 🔔 **Bluesky通知** - いいね・返信・メンション・フォロー等の通知フィード
- 🗣️ **テキスト読み上げ** - 単語の発音をネイティブ音声で確認
- 💾 **データ管理** - 単語データのエクスポート・インポート・PDS同期
- 🌐 **オフライン対応** - ネットワーク状態の監視と表示
- 📖 **スレッド表示** - 投稿スレッドと返信を展開して閲覧
- 🔔 **学習リマインダー** - 時刻・頻度を設定して学習通知
- 🌍 **多言語対応** - 日本語/英語UI切り替え
- 🌙 **ダークモード** - ライト/ダークテーマ対応
- ⬆️ **自動更新チェック** - GitHubからアプリ・辞書の更新を通知

## 🛠️ 技術スタック

| カテゴリ | 技術 |
|---------|------|
| フレームワーク | React Native + Expo (SDK 54) |
| 言語 | TypeScript 5.9 |
| 状態管理 | Zustand v5 |
| ナビゲーション | React Navigation v7 |
| データベース | SQLite (expo-sqlite) |
| セキュアストレージ | expo-secure-store |
| ファイル操作 | expo-file-system |
| 画像処理 | expo-image-manipulator |
| 音声読み上げ | expo-speech |
| ネットワーク監視 | @react-native-community/netinfo |
| 国際化 | i18next + react-i18next |
| アイコン | lucide-react-native |
| アニメーション | react-native-reanimated |
| API | AT Protocol (@atproto/api), DeepL, Yahoo! JAPAN, Free Dictionary |

## 📂 プロジェクト構成

```
kumotan/
├── App.tsx                 # エントリーポイント
├── src/
│   ├── components/         # 再利用可能なコンポーネント
│   │   ├── common/         # 汎用コンポーネント (Button, Input, Loading, Toast)
│   │   ├── PostCard.tsx    # 投稿カード
│   │   ├── WordPopup.tsx   # 単語選択・定義ポップアップ
│   │   ├── Calendar.tsx    # カレンダー（進捗画面）
│   │   ├── ShareCard.tsx   # シェア用画像カード
│   │   ├── QuizShareCard.tsx # クイズ結果シェアカード
│   │   └── ...
│   ├── screens/            # 画面コンポーネント
│   │   ├── HomeScreen.tsx          # ホーム（タイムライン）
│   │   ├── WordListScreen.tsx      # 単語帳
│   │   ├── QuizSetupScreen.tsx     # クイズ設定
│   │   ├── QuizScreen.tsx          # クイズ（ゲームプレイ）
│   │   ├── QuizResultScreen.tsx    # クイズ結果
│   │   ├── ProgressScreen.tsx      # 学習進捗
│   │   ├── SettingsScreen.tsx      # 設定
│   │   ├── ApiKeySetupScreen.tsx   # APIキー設定
│   │   ├── ThreadScreen.tsx        # 投稿スレッド
│   │   ├── BlueskyNotificationsScreen.tsx  # Bluesky通知
│   │   ├── NotificationSettingsScreen.tsx  # 学習リマインダー設定
│   │   ├── DictionarySetupScreen.tsx       # JMdict辞書管理
│   │   ├── DataManagementScreen.tsx        # データ管理
│   │   ├── TipsScreen.tsx          # 使い方ヒント
│   │   └── ...
│   ├── services/           # 外部サービス連携
│   │   ├── auth/           # OAuthクライアント
│   │   ├── bluesky/        # Bluesky API (feed, social)
│   │   ├── database/       # SQLite操作 (words, stats, quiz)
│   │   ├── dictionary/     # 翻訳・辞書API (DeepL, Free Dictionary, Yahoo, JMdict)
│   │   ├── quiz/           # クイズエンジン・回答バリデーション
│   │   ├── network/        # ネットワーク監視
│   │   ├── notifications/  # プッシュ通知
│   │   ├── updates/        # GitHubアップデートチェッカー
│   │   └── pds/            # Personal Data Server同期
│   ├── store/              # 状態管理 (Zustand)
│   ├── hooks/              # カスタムフック
│   ├── types/              # TypeScript型定義
│   ├── constants/          # 定数
│   └── utils/              # ユーティリティ
└── doc/                    # ドキュメント
```

## 🚀 セットアップ

### 必要条件

- Node.js 18以上
- npm または yarn
- Expo Go アプリ（iOS/Android）

### インストール

```bash
# リポジトリをクローン
git clone https://github.com/RieTamura/kumotan.git
cd kumotan

# 依存関係をインストール
npm install

# 開発サーバーを起動
npx expo start
```

### 実行方法

1. `npx expo start` を実行
2. 表示されたQRコードをExpo Goアプリでスキャン
3. アプリがデバイスで起動します

## 📖 使い方

1. **ログイン** - BlueskyアカウントでOAuth認証
2. **API設定（オプション）** - 設定画面からDeepL APIキーまたはYahoo! Client IDを設定
3. **タイムライン閲覧** - ホーム画面でFollowing・カスタムフード・プロフィールをスワイプで切り替え
4. **単語を保存** - 投稿内の英単語を長押しして単語帳に追加（翻訳・定義も表示）
5. **クイズで復習** - クイズタブから4択またはテキスト入力形式のクイズに挑戦
6. **単語帳を管理** - 単語帳タブで検索・フィルタ・ソート・既読管理
7. **進捗確認** - 進捗タブで学習カレンダー・統計をチェック・Blueskyでシェア

## ⚙️ 設定

### DeepL API Key（オプション）

英語→日本語の翻訳機能を使用する場合：

1. [DeepL API](https://www.deepl.com/pro-api) でアカウント作成
2. 無料のAPI Keyを取得（月50万文字まで無料）
3. アプリの設定 → API設定 → DeepL API Keyを入力

### Yahoo! JAPAN Client ID（オプション）

日本語単語の形態素解析・ふりがな機能を使用する場合：

1. [Yahoo!デベロッパーネットワーク](https://developer.yahoo.co.jp/) でアプリケーション登録
2. Client IDを取得（1日50,000リクエストまで無料）
3. アプリの設定 → API設定 → Yahoo! Client IDを入力

**注意**: どちらのAPIも設定しなくてもアプリは動作しますが、翻訳・解析機能が制限されます。

## 📚 ドキュメント

詳細なドキュメントは [doc/](./doc/) フォルダを参照してください：

- [要件定義](./doc/requirements.md)
- [アーキテクチャ](./doc/architecture.md)
- [API仕様](./doc/api.md)
- [データベース設計](./doc/database.md)
- [トラブルシューティング](./doc/troubleshooting.md)

## 👨‍💻 開発者向けガイド

### 開発環境セットアップ

```bash
# リポジトリをクローン
git clone https://github.com/RieTamura/kumotan.git
cd kumotan

# 依存関係をインストール
npm install

# 型チェック
npm run type-check

# テストを実行
npm test

# カバレッジ付きテスト
npm run test:coverage

# 開発サーバーを起動
npx expo start
```

### コード品質ツール

このプロジェクトは以下のツールで品質を維持しています：

- **TypeScript**：型安全性の確保
- **Jest**：ユニットテスト（目標カバレッジ：60%以上）
- **ESLint**：コードスタイルチェック
- **Prettier**：コードフォーマット（自動）

### テストガイドライン

テストは以下のファイルに記述してください：

```
src/
├── utils/__tests__/validators.test.ts          # バリデーション関数
├── services/database/__tests__/words.test.ts   # データベース操作
├── services/dictionary/__tests__/deepl.test.ts # DeepL API
└── services/dictionary/__tests__/freeDictionary.test.ts # Free Dictionary API
```

**テストコマンド:**

```bash
# すべてのテストを実行
npm test

# カバレッジレポート生成
npm run test:coverage

# ウォッチモード（開発時）
npm test -- --watch
```

### アーキテクチャ概要

#### 状態管理

- **Zustand**: グローバル状態管理（単語データ、認証状態）
- **React Hooks**: ローカル状態管理
- **useReducer**: 複雑なコンポーネント状態（WordPopup）

#### パフォーマンス最適化

- **React.memo**: コンポーネントの不要な再レンダリング防止（PostCard, SwipeableWordCard）
- **useMemo**: 高コストな計算のメモ化（parseTextIntoTokens）
- **LRUキャッシュ**: API結果のキャッシング（翻訳・辞書検索）

#### データフロー

```text
User Action → Screen Component → Service Layer → External API/Database
                                        ↓
                                   Store (Zustand)
                                        ↓
                                 UI Component Update
```

### 重要な設計判断（ADR）

プロジェクトの重要な設計判断は [doc/adr/](./doc/adr/) に記録されています：

- [ADR-001: DeepL API Keyのユーザー入力方式](./doc/adr/001-deepl-api-key-user-input.md)
- [ADR-002: App Passwordを保存しない方針](./doc/adr/002-no-app-password-storage.md)
- [ADR-003: SQLiteローカルストレージ採用](./doc/adr/003-sqlite-local-storage.md)
- [ADR-004: Zustand状態管理採用](./doc/adr/004-zustand-state-management.md)
- [ADR-005: ローカル時刻での日時保存](./doc/adr/005-local-datetime-storage.md)

### セキュリティガイドライン

- **APIキー**: 絶対にハードコードしない（ユーザー入力方式）
- **認証情報**: expo-secure-storeで暗号化保存
- **SQLインジェクション**: プレースホルダー使用を必須化
- **入力検証**: すべての外部入力を検証（Validators.tsを使用）

### コントリビューションワークフロー

1. **Issue作成**: 新機能やバグ修正の提案
2. **ブランチ作成**: `feature/機能名` または `fix/バグ名`
3. **コミット**: [Conventional Commits](https://www.conventionalcommits.org/)形式
   - `feat:` 新機能
   - `fix:` バグ修正
   - `docs:` ドキュメント変更
   - `test:` テスト追加・修正
   - `refactor:` リファクタリング
   - `chore:` ビルド・設定変更
4. **テスト**: 必ずテストを追加・更新
5. **プルリクエスト**: mainブランチへのPR作成

### よくある開発タスク

#### 新しいスクリーンを追加

1. `src/screens/` に新しいスクリーンコンポーネント作成
2. `src/types/navigation.ts` に型定義追加
3. `App.tsx` のNavigatorに画面を登録

#### 新しいAPIサービスを追加

1. `src/services/` に新しいサービスファイル作成
2. エラーハンドリングは `Result<T, AppError>` パターンを使用
3. タイムアウト処理を実装（TIMEOUT定数を使用）
4. ユニットテストを作成（`__tests__/` ディレクトリ）

#### データベーススキーマ変更

1. `src/services/database/schema.ts` を更新
2. マイグレーション処理を実装
3. 関連する型定義を `src/types/word.ts` で更新
4. テストを更新

### デバッグ Tips

```bash
# React Native Debugger
# Chrome DevToolsを開く
npx expo start --devClient

# ログ表示（開発モードのみ）
# __DEV__ガードでラップされたconsole.logを確認

# SQLite データベースを直接確認
# Expo SQLite Browser extension使用を推奨
```

## 🤝 コントリビューション

プルリクエストや Issue の報告を歓迎します！

### フィードバックをお寄せください

アプリを改善するために、皆さまのフィードバックをお待ちしています。

#### バグ報告・機能要望

[GitHub Issues](https://github.com/RieTamura/kumotan/issues/new/choose) から報告してください。以下のテンプレートをご用意しています：

- **🐛 バグ報告**: 不具合を発見した場合
- **💡 機能要望**: 新しい機能や改善のアイデア
- **❓ 質問**: 使い方や設定についての質問

#### Blueskyで連絡

[@kumotan.bsky.social](https://bsky.app/profile/kumotan.bsky.social) で直接フィードバックを送ることもできます。

#### アプリ内からのフィードバック

設定画面の「フィードバック」セクションから、GitHubやBlueskyにアクセスできます。

## 💝 サポート

くもたん（Kumotan）は完全無料のオープンソースアプリです。

もし気に入っていただけたら、開発を支援していただけると嬉しいです：

- **[GitHub Sponsors](https://github.com/sponsors/RieTamura)** で支援する
- **[GitHub](https://github.com/RieTamura/kumotan)** でリポジトリに ⭐ をつける
- **[Bluesky](https://bsky.app/profile/kumotan.bsky.social)** で感想をシェアする

いただいたサポートは、アプリの改善や新機能の開発に使わせていただきます。

## 📄 ライセンス

MIT License

## 🙏 謝辞

- [Bluesky](https://bsky.social/) - ソーシャルネットワークプラットフォーム
- [AT Protocol](https://atproto.com/) - 分散型ソーシャルプロトコル
- [Expo](https://expo.dev/) - React Native開発プラットフォーム
