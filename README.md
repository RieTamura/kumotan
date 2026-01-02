# くもたん (Kumotan) ☁️

**Blueskyで英語学習！タイムラインから単語を保存して、あなただけの単語帳を作ろう**

[![Expo](https://img.shields.io/badge/Expo-SDK%2054-blue)](https://expo.dev/)
[![React Native](https://img.shields.io/badge/React%20Native-0.81-green)](https://reactnative.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.9-blue)](https://www.typescriptlang.org/)

## 📱 概要

くもたん（Kumotan）は、Blueskyのタイムラインを活用した英語学習アプリです。フォローしているユーザーの投稿から英単語を選択して保存し、オリジナルの単語帳を作成できます。

## ✨ 機能

- 🔐 **Bluesky認証** - App Passwordによる安全なログイン
- 📰 **タイムライン表示** - Blueskyの投稿をリアルタイムで表示
- 📝 **単語保存** - 投稿から英単語を長押しで選択・保存
- 📚 **単語帳管理** - 保存した単語の一覧表示・既読管理
- 📊 **学習進捗** - 日別の学習統計とカレンダー表示
- 🌐 **オフライン対応** - ネットワーク状態の監視と表示
- 🔤 **翻訳・定義** - DeepL API / Free Dictionary APIによる翻訳と英語定義

## 🛠️ 技術スタック

| カテゴリ | 技術 |
|---------|------|
| フレームワーク | React Native + Expo (SDK 54) |
| 言語 | TypeScript |
| 状態管理 | Zustand |
| ナビゲーション | React Navigation v7 |
| データベース | SQLite (expo-sqlite) |
| セキュアストレージ | expo-secure-store |
| API | AT Protocol (@atproto/api) |

## 📂 プロジェクト構成

```
kumotan/
├── App.tsx                 # エントリーポイント
├── src/
│   ├── components/         # 再利用可能なコンポーネント
│   │   ├── common/         # 汎用コンポーネント (Button, Input, Loading)
│   │   ├── PostCard.tsx    # 投稿カード
│   │   └── ...
│   ├── screens/            # 画面コンポーネント
│   │   ├── HomeScreen.tsx  # ホーム（タイムライン）
│   │   ├── WordListScreen.tsx  # 単語帳
│   │   ├── ProgressScreen.tsx  # 学習進捗
│   │   └── SettingsScreen.tsx  # 設定
│   ├── services/           # 外部サービス連携
│   │   ├── bluesky/        # Bluesky API
│   │   ├── database/       # SQLite操作
│   │   └── dictionary/     # 翻訳・辞書API
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

1. **ログイン** - Blueskyのハンドル名とApp Passwordでログイン
2. **タイムライン閲覧** - ホーム画面でフォローユーザーの投稿を表示
3. **単語を保存** - 投稿内の英単語を長押しして単語帳に追加
4. **学習** - 単語帳タブで保存した単語を復習
5. **進捗確認** - 進捗タブで学習状況をチェック

## ⚙️ 設定

### DeepL API Key（オプション）

翻訳機能を使用するには、DeepL API Keyが必要です：

1. [DeepL](https://www.deepl.com/pro-api) でアカウント作成
2. 無料のAPI Keyを取得
3. アプリの設定画面でAPI Keyを入力

## 📚 ドキュメント

詳細なドキュメントは [doc/](./doc/) フォルダを参照してください：

- [要件定義](./doc/requirements.md)
- [アーキテクチャ](./doc/architecture.md)
- [API仕様](./doc/api.md)
- [データベース設計](./doc/database.md)
- [トラブルシューティング](./doc/troubleshooting.md)

## 🤝 コントリビューション

プルリクエストや Issue の報告を歓迎します！

## 📄 ライセンス

MIT License

## 🙏 謝辞

- [Bluesky](https://bsky.social/) - ソーシャルネットワークプラットフォーム
- [AT Protocol](https://atproto.com/) - 分散型ソーシャルプロトコル
- [Expo](https://expo.dev/) - React Native開発プラットフォーム
