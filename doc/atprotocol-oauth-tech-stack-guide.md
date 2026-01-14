# ATProtocol OAuth認証 技術選定ガイド

**作成日**: 2026-01-14
**ステータス**: 参考資料
**対象**: ATProtocol OAuth認証を実装したいReact Native開発者

---

## 目次

1. [はじめに](#はじめに)
2. [なぜATProtocol OAuth認証が動作しなかったのか](#なぜatprotocol-oauth認証が動作しなかったのか)
3. [ATProtocol OAuth認証を実装するための技術選択肢](#atprotocol-oauth認証を実装するための技術選択肢)
4. [比較と推奨アプローチ](#比較と推奨アプローチ)
5. [まとめ](#まとめ)

---

## はじめに

このドキュメントは、くもたんアプリでATProtocol OAuth認証の実装を試みた際に直面した技術的課題と、将来的にOAuth認証を実装する場合の技術選択肢をまとめたものです。

### 背景

- Expo SDK 54 managed workflowで`@atproto/oauth-client-expo`を使用したOAuth実装を試行
- 複数の技術的制約により、現時点での実装は困難と判断
- 詳細な調査結果は[OAUTH_IMPLEMENTATION_SUMMARY.md](./OAUTH_IMPLEMENTATION_SUMMARY.md)を参照

### このドキュメントの目的

- ATProtocol OAuth認証の技術的課題を理解する
- 将来的にOAuth認証を実装する際の技術選択肢を提示する
- 各選択肢のメリット・デメリットを比較する

---

## なぜATProtocol OAuth認証が動作しなかったのか

ATProtocol OAuthの実装は**3つの連鎖的な技術的問題**により失敗しました。

### 問題1: ATProtocol独自の仕様に未対応

#### 最初の実装の誤解

当初、標準的なOAuth 2.0を想定して実装しましたが、**BlueskyのOAuthは全く異なる仕様**でした。

**想定していたこと（標準OAuth 2.0）**:
```
https://bsky.social/oauth/authorize  → 404 Not Found
https://bsky.social/oauth/token      → 404 Not Found
```

**実際に必要だったこと（ATProtocol OAuth）**:
- **PAR (Pushed Authorization Request)**: 認証リクエストをサーバーにプッシュ
- **DPoP (Demonstrating Proof-of-Possession)**: トークンの所有証明
- **DID Document解決**: ユーザーのハンドルから動的にPDSを発見
- **Client Metadata**: 公開されたクライアントメタデータJSON（HTTPS URL）

#### エラーの内容

```
送信データが正しくありません。
フォームをチェックしてもう一度お試しください。
```

**原因**: カスタム実装がATProtocol仕様に準拠していなかったため、Blueskyサーバーが拒否

#### ATProtocol OAuth vs 標準 OAuth 2.0

| 項目 | 標準 OAuth 2.0 | ATProtocol OAuth |
|------|---------------|-------------------|
| エンドポイント | 固定URL | PDS動的発見 |
| 認証方式 | Client Secret | DPoP (公開鍵暗号) |
| トークンバインディング | なし | DPoP必須 |
| ハンドル解決 | N/A | DID Document解決 |
| 実装複雑度 | 中 | 高 |

---

### 問題2: react-native-mmkvの三すくみ問題

公式ライブラリ `@atproto/oauth-client-expo` を使えば解決できる…はずでしたが、このライブラリは **react-native-mmkv** というストレージライブラリに依存していました。

#### バージョン問題のジレンマ

| mmkvバージョン | 問題 | `@atproto/oauth-client-expo`互換性 |
|--------------|------|-----------------------------------|
| **v2.12.2** | APIが古く、必要な機能がない | ❌ 非互換 |
| **v3.3.3** | **New Architecture必須**<br>Old Architectureで動作不可 | ✅ 互換 |
| **v4.1.1** | Nitro Modules必要<br>Expo managed workflowで不安定 | ✅ 互換 |

#### エラーの内容（v3使用時）

```
[ERROR] React Native is not running on-device.
MMKV can only be used when synchronous method invocations (JSI) are possible.

[ERROR] undefined is not a function
at construct (native)
```

**原因**: mmkv v3がNew Architectureを要求するが、アプリはOld Architectureで動作

---

### 問題3: New Architectureの連鎖的影響

「じゃあNew Architectureを有効にすれば？」と思いましたが…

#### アーキテクチャ選択のジレンマ

**Old Architectureを維持する場合**:
- ✅ react-native-reanimated v3が動作（アニメーション）
- ✅ 他のパッケージが安定（screens, gesture-handlerなど）
- ❌ mmkv v3/v4が動作しない
- ❌ `@atproto/oauth-client-expo`が使用不可

**New Architectureを有効化する場合**:
- ✅ mmkv v3/v4が動作
- ✅ `@atproto/oauth-client-expo`が使用可能
- ❌ react-native-reanimated v4が必須（v3非対応）
- ❌ 他パッケージの互換性が未検証（高リスク）
- ❌ Expo SDK 54のNew Architectureサポートは実験的

#### エラーの内容（New Architecture有効時）

```
Error: Unknown error. See logs of the Install pods build phase for more information.
```

**原因**: react-native-reanimatedがNew Architecture必須をチェックし、設定の矛盾でビルド失敗

---

### 問題の連鎖フロー

```
ATProtocol OAuth を動かすには…
  ↓
@atproto/oauth-client-expo が必要
  ↓
react-native-mmkv v3/v4 が必要
  ↓
New Architecture が必要
  ↓
react-native-reanimated v4 が必要
  ↓
他のパッケージとの互換性問題が発生
  ↓
Expo SDK 54 managed workflowでは実現困難 ❌
```

---

## ATProtocol OAuth認証を実装するための技術選択肢

将来的にATProtocol OAuth認証を実装する場合、以下の4つの選択肢があります。

---

### 選択肢1: React Native CLI + New Architecture（推奨）

#### 技術スタック

```json
{
  "フレームワーク": "React Native CLI (Expo不使用)",
  "React Native": "0.76以降（New Architecture安定版）",
  "アーキテクチャ": "New Architecture有効",
  "ストレージ": "react-native-mmkv 4.1.1以降",
  "OAuth": "@atproto/oauth-client-react-native",
  "アニメーション": "react-native-reanimated 4.x",
  "ナビゲーション": "react-navigation 7.x",
  "ビルド": "Fastlane/Xcode/Android Studio"
}
```

#### メリット

- ✅ **完全なネイティブコード制御**: react-native-mmkvのネイティブ統合が確実
- ✅ **New Architectureの安定版**: React Native 0.76以降はTurboModules完全対応
- ✅ **ATProtocol OAuth完全準拠**: DPoP、PAR、DID解決すべて動作
- ✅ **実績あり**: Grayskyなど他のBlueskyクライアントが同様の構成

#### デメリット

- ❌ **開発体験の低下**: Expoの便利機能（OTA更新、簡単ビルド等）が使えない
- ❌ **ビルド設定が複雑**: Xcode/Android Studioの手動設定が必要
- ❌ **移行コスト**: 現在のExpoプロジェクトから移行が必要

#### 具体的なセットアップ

```bash
# 1. 新規React Native CLIプロジェクト作成
npx @react-native-community/cli@latest init KumotanOAuth --version 0.76.5

cd KumotanOAuth

# 2. ATProtocol関連パッケージ
npm install @atproto/api@^0.13.0
npm install @atproto/oauth-client-react-native

# 3. react-native-mmkv v4 + Nitro Modules
npm install react-native-mmkv@^4.1.1
npm install react-native-nitro-modules

# 4. その他の依存関係
npm install react-native-reanimated@^4.x
npm install @react-navigation/native @react-navigation/native-stack
npm install @react-native-async-storage/async-storage
npm install zustand

# 5. iOS依存関係
cd ios && pod install && cd ..
```

#### OAuth Client実装例

```typescript
// src/services/oauth/client.ts
import { OAuthClient } from '@atproto/oauth-client-react-native';
import { MMKV } from 'react-native-mmkv';

const storage = new MMKV({
  id: 'oauth-storage',
});

const oauthClient = new OAuthClient({
  clientMetadata: {
    client_id: 'https://yourdomain.com/oauth-client-metadata.json',
    client_name: 'くもたん (Kumotan)',
    redirect_uris: ['io.github.rietamura:/oauth/callback'],
    scope: 'atproto transition:generic',
    token_endpoint_auth_method: 'none',
    application_type: 'native',
    dpop_bound_access_tokens: true,
  },
  storage: {
    get: (key: string) => storage.getString(key) ?? null,
    set: (key: string, value: string) => storage.set(key, value),
    delete: (key: string) => storage.delete(key),
  },
});

export async function signInWithOAuth(handle: string) {
  try {
    const session = await oauthClient.signIn(handle);
    return { success: true, session };
  } catch (error) {
    return { success: false, error };
  }
}

export async function restoreSession(did: string) {
  return await oauthClient.restore(did);
}
```

#### New Architecture設定

```json
// package.json
{
  "react-native": {
    "newArchEnabled": true
  }
}
```

---

### 選択肢2: Expo Bare Workflow + New Architecture

#### 技術スタック

```json
{
  "フレームワーク": "Expo Bare Workflow",
  "Expo SDK": "54（Bare Workflowでは制約が少ない）",
  "React Native": "0.81.5",
  "アーキテクチャ": "New Architecture有効",
  "ストレージ": "react-native-mmkv 4.1.1",
  "OAuth": "@atproto/oauth-client-expo 0.0.7",
  "ビルド": "EAS Build（Expoの利点維持）"
}
```

#### メリット

- ✅ **Expoの便利機能を一部維持**: EAS Build、expo-updateなど
- ✅ **段階的な移行**: managed → bare workflowへの移行パス
- ✅ **ネイティブコード編集可**: ios/androidディレクトリにアクセス可

#### デメリット

- ⚠️ **New Architecture対応が不安定**: Expo SDK 54ではまだ実験的
- ⚠️ **Bare Workflowの複雑さ**: managedの簡潔さは失われる
- ⚠️ **パッケージ互換性のリスク**: 個別にテストが必要

#### 具体的な移行手順

```bash
# Bare Workflowに移行
npx expo prebuild

# New Architectureを有効化（app.json）
{
  "expo": {
    "newArchEnabled": true,
    "plugins": [
      "expo-secure-store",
      "expo-sqlite",
      [
        "expo-build-properties",
        {
          "ios": { "newArchEnabled": true },
          "android": { "newArchEnabled": true }
        }
      ]
    ]
  }
}

# react-native-mmkv 4.x + nitro-modulesをインストール
npm install react-native-mmkv@4.1.1 react-native-nitro-modules
npm install react-native-reanimated@4.x

# ネイティブ依存関係を再ビルド
cd ios && pod install
cd android && ./gradlew clean
```

---

### 選択肢3: Expo SDK 55以降を待つ（最も簡単）

#### 技術スタック

```json
{
  "フレームワーク": "Expo Managed Workflow",
  "Expo SDK": "55以降（2026年Q2予定）",
  "React Native": "0.82以降",
  "アーキテクチャ": "New Architecture（デフォルト）",
  "ストレージ": "react-native-mmkv 4.x",
  "OAuth": "@atproto/oauth-client-expo"
}
```

#### メリット

- ✅ **最も簡単**: Expo managed workflowの簡潔さを維持
- ✅ **New Architecture正式サポート**: Expo SDK 55でTurboModules完全対応予定
- ✅ **追加の設定不要**: `newArchEnabled`がデフォルトで有効

#### デメリット

- ❌ **待ち時間**: Expo SDK 55のリリースを待つ必要がある（数ヶ月）
- ❌ **不確実性**: SDK 55で確実に動作する保証はない（β版での検証が必要）

#### 期待される将来の設定

```json
// package.json（Expo SDK 55以降）
{
  "dependencies": {
    "expo": "~55.0.0",
    "react-native": "0.82.0",
    "react-native-mmkv": "^4.1.1",
    "@atproto/oauth-client-expo": "^0.1.0",
    "react-native-reanimated": "^4.x"
  }
}
```

**注**: Expo SDK 55のリリーススケジュールは未定（通常3-4ヶ月周期）

---

### 選択肢4: 別のフレームワーク（Flutter等）

#### 技術スタック（Flutter例）

```yaml
# pubspec.yaml
dependencies:
  flutter:
    sdk: flutter
  http: ^1.1.0
  oauth2: ^2.0.0
  flutter_secure_storage: ^9.0.0

  # ATProtocol用パッケージ
  # （Dart用ATProtocol SDKは非公式のみ）
```

#### メリット

- ✅ **クロスプラットフォーム**: iOS/Android同時対応
- ✅ **パフォーマンス**: ネイティブコンパイル
- ✅ **安定性**: Flutterエコシステムは成熟

#### デメリット

- ❌ **言語の違い**: TypeScript → Dartへの移行
- ❌ **ATProtocol SDKが非公式**: 公式Dart SDKが存在しない
- ❌ **全面的な書き直し**: 既存コードの再利用不可

---

## 比較と推奨アプローチ

### 選択肢の比較表

| 選択肢 | 実現性 | 開発体験 | 移行コスト | OAuth対応 | 推奨度 |
|--------|--------|----------|-----------|----------|--------|
| **1. RN CLI + New Arch** | ⭐⭐⭐⭐⭐ | ⭐⭐⭐ | 高 | ✅ 完全対応 | **⭐⭐⭐⭐⭐** |
| **2. Expo Bare + New Arch** | ⭐⭐⭐⭐ | ⭐⭐⭐⭐ | 中 | ✅ 対応可能 | **⭐⭐⭐⭐** |
| **3. Expo SDK 55待ち** | ⭐⭐⭐ | ⭐⭐⭐⭐⭐ | 低 | ✅ 将来対応 | **⭐⭐⭐** |
| **4. Flutter等** | ⭐⭐⭐⭐ | ⭐⭐⭐⭐ | 最高 | ⚠️ 要カスタム実装 | **⭐⭐** |

### 推奨アプローチ

#### すぐにOAuth対応したい場合

**選択肢1: React Native CLI + New Architecture**

**理由**:
- 他のBlueskyクライアント（Graysky等）で実績あり
- 最も確実にATProtocol OAuth実装可能
- New Architecture環境が安定している（RN 0.76以降）

#### 開発体験を重視する場合

**選択肢2: Expo Bare Workflow + New Architecture**

**理由**:
- EAS Buildなど Expoの便利機能を維持
- Bare WorkflowならNew Architectureの設定が可能
- 段階的な移行が可能

#### リスクを最小化したい場合

**選択肢3: Expo SDK 55を待つ**

**理由**:
- 現在のmanaged workflowを維持
- Expo公式のNew Architectureサポートを待つ
- それまでApp Password版を運用

---

## まとめ

### くもたんプロジェクトの判断

**Expo SDK 55を待つ**（選択肢3）ことを決定しました。

#### 決定理由

1. **App Passwordで機能要件を満たせる**
   - PDS（Personal Data Server）への読み書きが可能
   - OAuth認証がなくても、コア機能は実装できる

2. **技術環境の成熟を待つ**
   - Expo SDK 55でNew Architectureサポートが改善される見込み
   - リスクの高いNew Architecture移行を今行う必要はない

3. **開発体験を優先**
   - Expo managed workflowの簡潔さを維持
   - ユーザーフィードバックを早期に収集することを優先

4. **段階的な改善**
   - v1.0: App Password版リリース
   - v1.1: Expo SDK 55でOAuth再評価
   - v2.0: OAuth完全移行（ユーザー需要に応じて）

### 技術選定の学び

今回のATProtocol OAuth実装の試行を通じて得られた知見：

#### 1. 依存関係の連鎖を理解する

1つのライブラリ選択が、複数のライブラリに波及することを常に意識する。特に：
- ネイティブモジュール依存の場合
- 新しいアーキテクチャ（New Architecture）を要求する場合
- 実験的機能（beta版）の場合

#### 2. ドキュメントと現実のギャップ

「対応」と書いてあっても、実際には：
- ベータ版や実験的機能の可能性
- 特定の環境でのみ動作
- バージョンによって挙動が異なる

実際に検証してから判断することが重要。

#### 3. タイミングの重要性

- **Bleeding Edge（最先端）**: 不安定、リスク高
- **安定版**: 実績あり、リスク低
- **レガシー**: 非推奨、将来性なし

プロジェクトの段階に応じて適切なタイミングを選ぶ。

#### 4. フォールバックプランの重要性

理想的な実装ができない場合でも：
- 代替手段を検討（App Password）
- 段階的な改善計画を立てる（Expo SDK 55待ち）
- 完璧を求めすぎず、動作する製品を優先

### 将来の展望

#### Expo SDK 55リリース後（2026年Q2予定）

1. **β版での検証**
   - New Architectureの安定性確認
   - react-native-mmkv動作確認
   - 主要パッケージの互換性テスト

2. **OAuth実装の再挑戦**
   - `@atproto/oauth-client-expo`を使用
   - managed workflowで動作確認
   - 問題があればBare Workflowへの移行を検討

3. **ユーザー移行計画**
   - App Password → OAuth へのスムーズな移行
   - 既存ユーザーへの告知
   - 段階的なロールアウト

#### React Native 0.82以降（Old Architecture廃止後）

Old Architectureが廃止されるタイミングで：
- New Architecture移行は必須
- その時点でOAuth認証を実装
- または選択肢1（React Native CLI）への移行を検討

---

## 参考資料

### ATProtocol OAuth仕様

- [AT Protocol OAuth Client Implementation](https://docs.bsky.app/docs/advanced-guides/oauth-client)
- [AT Protocol OAuth Introduction](https://atproto.com/guides/oauth)
- [OAuth for AT Protocol | Bluesky](https://docs.bsky.app/blog/oauth-atproto)

### React Native New Architecture

- [React Native New Architecture](https://reactnative.dev/docs/the-new-architecture/landing-page)
- [TurboModules](https://reactnative.dev/docs/the-new-architecture/pillars-turbomodules)
- [Expo New Architecture Support](https://docs.expo.dev/guides/new-architecture/)

### パッケージ

- [@atproto/oauth-client-expo npm](https://www.npmjs.com/package/@atproto/oauth-client-expo)
- [react-native-mmkv v4 Release Notes](https://github.com/mrousavy/react-native-mmkv/releases/tag/v4.0.0)
- [Nitro Modules Documentation](https://github.com/mrousavy/nitro)

### 内部ドキュメント

- [OAUTH_IMPLEMENTATION_SUMMARY.md](./OAUTH_IMPLEMENTATION_SUMMARY.md) - OAuth実装の詳細な調査記録
- [ADR-006: OAuth認証の実装](./adr/ADR-006-oauth-authentication.md) - OAuth認証の意思決定記録
- [requirements.md](./requirements.md) - プロジェクト要件

---

**作成者**: RieTamura
**最終更新**: 2026-01-14
