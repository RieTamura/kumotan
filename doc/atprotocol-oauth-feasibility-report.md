# ATProtocol OAuth 実装可能性調査レポート

**作成日**: 2026-01-18
**判定**: **実装可能 (Feasible)**

## 結論

**「現在のアプリ構成 (Expo SDK 54 / Old Architecture) でも、ATProtocol OAuth認証は実装可能です。」**

@[doc/atprotocol-oauth-tech-stack-guide.md] の記録は、**「公式ラッパーライブラリ (`@atproto/oauth-client-expo`) をそのまま利用しようとした場合」** においては正しいですが、より柔軟な **「Coreライブラリ (`@atproto/oauth-client`) の直接利用」** という選択肢が考慮されていませんでした。このアプローチにより、最大の障壁であった `react-native-mmkv` への依存を排除できます。

---

## 技術的な根拠

### 1. `react-native-mmkv` は必須ではない

調査の結果、ATProtocol認証のコアロジックを担当する `@atproto/oauth-client` ライブラリは、ストレージの実装を抽象化しており、**非同期処理 (Promise) を返すストレージ** をサポートしていることが確認できました。

- **確認されたインターフェース**:
  ```typescript
  // SimpleStore (node_modules/@atproto-labs/simple-store/dist/simple-store.d.ts)
  export interface SimpleStore<K, V> {
      get: (key: K) => Awaitable<undefined | V>;
      set: (key: K, value: V) => Awaitable<void>;
      del: (key: K) => Awaitable<void>;
  }
  ```
  ※ `Awaitable` は `Promise` を含むため、`AsyncStorage` や `Expo SecureStore` がそのまま利用可能です。

### 2. プロトコルの複雑さ (DPoP, PAR, DID解決) は Coreライブラリが解決する

以前の「手動実装」での失敗原因であった DPoP や PAR といった複雑なプロトコル処理は、`@atproto/oauth-client-expo` ではなく、ベースとなる `@atproto/oauth-client` が担当しています。したがって、ラッパーを使わずに Coreライブラリを直接使っても、これらの機能は失われません。

---

## 提案する実装アーキテクチャ

`@atproto/oauth-client-expo` の代わりに、以下のような構成で実装することを提案します。

| コンポーネント | 推奨技術 | 解説 |
|---|---|---|
| **コアロジック** | `@atproto/oauth-client` | 公式のCoreライブラリを直接利用します。 |
| **ストレージ** | `AsyncStorage` / `SecureStore` | `react-native-mmkv` の代わりに、既存のストレージを使用するアダプターを自作します。 |
| **暗号化 (Crypto)** | `expo-crypto` + JS Polyfill | DPoPに必要な鍵生成や署名を行います。Native Modules (React Native Quick Crypto) の導入も検討可能です。 |
| **ブラウザ制御** | `expo-web-browser` | 認証画面の表示に使用します。 |
| **ディープリンク** | `expo-linking` | 認証コールバックの受信に使用します。 |

### 実装イメージ

```typescript
import { OAuthClient } from '@atproto/oauth-client';
import AsyncStorage from '@react-native-async-storage/async-storage';

// 1. AsyncStorageを用いたカスタムストアの実装
const asyncStorageAdapter = {
  set: async (key: string, val: any) => {
    await AsyncStorage.setItem(key, JSON.stringify(val));
  },
  get: async (key: string) => {
    const val = await AsyncStorage.getItem(key);
    return val ? JSON.parse(val) : undefined;
  },
  del: async (key: string) => {
    await AsyncStorage.removeItem(key);
  },
};

// 2. クライアントの初期化 (MMKVを使わない)
const client = new OAuthClient({
  clientMetadata: { ... },
  stateStore: asyncStorageAdapter, // ここでAsyncStorageを注入
  sessionStore: asyncStorageAdapter,
  runtimeImplementation: { ... } // 暗号化処理の実装
});
```

---

## メリットとデメリット

### メリット
- **New Architecture への移行が不要**: 現行の安定した Old Architecture のまま実装できます。
- **`react-native-mmkv` のバージョン問題からの解放**: 依存関係の競合を気にする必要がありません。
- **Expo SDK 55 を待つ必要がない**: 今すぐ開発・リリースが可能です。

### デメリット
- **実装工数の増加**: `ExpoOAuthClient` が隠蔽していた「ブラウザ起動」や「暗号化機能のセットアップ」を自分で記述する必要があります（ただし、以前の完全手動実装に比べればはるかに容易です）。
- **暗号化処理の選定**: React Native 環境で動く適切な Crypto 実装を選定・セットアップする必要があります。

## 結論

以前の記録は「公式ラッパーを使う場合」の記録としては正しいですが、**「現在のアプリで実装可能か？」という問いに対しては、「YES（ただし構成を変える工夫が必要）」が答えとなります。**

このアプローチを採用することで、New Architectureへの強制移行というリスクを冒さずに、ATProtocol OAuth認証を実現できます。
