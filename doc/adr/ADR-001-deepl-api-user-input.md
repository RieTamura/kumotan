# ADR-001: DeepL API Keyのユーザー入力方式

## ステータス

採用 (Accepted)

## 日付

2026-01-06

## コンテキスト

くもたんアプリでは、英単語を日本語に翻訳するためにDeepL APIを使用する必要がある。DeepL APIは月50万文字までの無料枠を提供しているが、API Keyの管理方法について以下の選択肢が存在する:

### 選択肢1: 開発者のAPI Keyをアプリに埋め込む
- **メリット**: ユーザー体験がシンプル（設定不要）
- **デメリット**:
  - アプリのリバースエンジニアリングでAPI Keyが抽出される危険性
  - 悪意のあるユーザーによる不正利用でAPI制限を超過するリスク
  - すべてのユーザーで開発者の月間50万文字の制限を共有
  - 予想外のコスト発生（有料プランへの強制移行）

### 選択肢2: バックエンドプロキシ経由でAPI Keyを管理
- **メリット**: API Keyがクライアントに露出しない
- **デメリット**:
  - 追加インフラストラクチャが必要（サーバー、ドメイン、SSL証明書）
  - 運用コスト（Cloudflare Workers、Vercel Edge Functionsなど）
  - 個人開発プロジェクトには過剰なアーキテクチャ
  - レート制限の実装が必要

### 選択肢3: ユーザーが自分のAPI Keyを入力する
- **メリット**:
  - 各ユーザーが独自の無料枠（月50万文字）を使用可能
  - 開発者側のコスト・リスクゼロ
  - スケーラビリティの問題がない
  - セキュリティリスクが各ユーザーに分散
- **デメリット**:
  - 初期設定の手間がユーザーにかかる
  - ユーザーがDeepLアカウントを作成する必要がある

## 決定

**選択肢3: ユーザーが自分のAPI Keyを入力する方式を採用**

## 理由

1. **セキュリティ**
   - React Native/Expoアプリはネイティブバンドルから文字列を抽出することが比較的容易
   - API Keyをアプリに埋め込むと、逆コンパイルや静的解析で簡単に抽出される
   - `expo-secure-store`を使用してユーザーごとにAPI Keyを暗号化保存することでリスクを分散

2. **コスト管理**
   - 月50万文字の制限を全ユーザーで共有するとすぐに枯渇
   - 想定ユーザー数（〜1000人）で開発者の無料枠を共有することは非現実的
   - ユーザーが個別に無料枠を持つことで持続可能な運用が可能

3. **個人開発プロジェクトとしての適切性**
   - バックエンドプロキシの運用コストは個人開発には過剰
   - ユーザー数が少ない初期段階では特に不要
   - 将来的にスケールした場合（Phase 6）に検討可能

4. **ユーザーへの透明性**
   - ユーザーが自分のAPI使用量を直接管理できる
   - アプリ設定画面でDeepL APIの使用量を表示（80%/95%で警告）
   - ユーザーの学習スタイルに応じて無料枠内で調整可能

5. **フォールバック対応**
   - API Key未設定時は翻訳をスキップし、英語定義のみ表示
   - アプリの基本機能（単語登録、統計表示など）は影響を受けない

## 影響

### ユーザー体験

- **初期設定フロー**:
  1. アプリ初回起動時、または設定画面からDeepL API Key設定画面に遷移
  2. DeepL公式サイトへの外部リンクで無料アカウント作成を案内
  3. API Keyを入力し、有効性を検証してから保存
  4. 使用量表示で残り枠を可視化

- **継続利用**:
  - 月間50万文字の制限内で使用（通常の学習では十分）
  - 80%超過で警告、95%超過で強い警告、100%でエラー表示
  - 必要に応じてユーザー自身で有料プランにアップグレード可能

### セキュリティ実装

```typescript
// expo-secure-storeでの暗号化保存
import * as SecureStore from 'expo-secure-store';

const DEEPL_API_KEY = 'deepl_api_key';

export async function saveDeepLApiKey(apiKey: string): Promise<void> {
  await SecureStore.setItemAsync(DEEPL_API_KEY, apiKey);
}

export async function getDeepLApiKey(): Promise<string | null> {
  return await SecureStore.getItemAsync(DEEPL_API_KEY);
}
```

### 検証フロー

```typescript
// API Key保存前の有効性検証
export async function validateDeepLApiKey(apiKey: string): Promise<boolean> {
  const response = await fetch('https://api-free.deepl.com/v2/usage', {
    headers: { 'Authorization': `DeepL-Auth-Key ${apiKey}` },
  });

  if (response.ok) {
    const usage = await response.json();
    return usage.character_limit > 0;
  }

  return false;
}
```

## トレードオフ

### 受け入れるデメリット

- **ユーザーオンボーディングの複雑化**: DeepLアカウント作成とAPI Key取得の手間
  - **緩和策**: 詳細な手順ガイドとスクリーンショット付きヘルプの提供

- **一部ユーザーが翻訳機能を使わない可能性**: API Key設定をスキップするユーザー
  - **緩和策**: 英語定義（Free Dictionary API）のみでも学習可能な設計

### 得られるメリット

- **持続可能な運用**: 開発者の追加コストゼロ
- **スケーラビリティ**: ユーザー数が増えてもAPI制限問題なし
- **セキュリティ**: 単一障害点（SPOF）の排除

## 代替案

### 将来的な拡張（Phase 6）

ユーザー数が1000人を超え、多くのユーザーがAPI Key設定の手間を避けたい場合:

- Cloudflare Workers / Vercel Edge Functionsでプロキシを実装
- 開発者が有料DeepL Pro APIを契約し、ユーザーは月額サブスクリプション（例: 200円/月）
- サブスクリプション収益でAPI使用料をカバー

この段階では以下を実装:
- レート制限（ユーザーごと1日1000リクエスト）
- 使用量監視とアラート
- ユーザー認証とトークン管理

## 参照

- DeepL API Free Tier Documentation: https://www.deepl.com/docs-api
- React Native Security Best Practices: https://reactnative.dev/docs/security
- expo-secure-store: https://docs.expo.dev/versions/latest/sdk/securestore/
- requirements.md セキュリティ設計セクション（L140-L175）

## ステークホルダー

- **決定者**: RieTamura（開発者）
- **影響を受ける人**: くもたんアプリのすべてのユーザー

## レビュー日

次回レビュー予定: 2026年6月（ローンチ後6ヶ月、Phase 6検討時期）
