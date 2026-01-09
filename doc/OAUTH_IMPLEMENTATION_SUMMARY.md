# OAuth実装サマリー - AT Protocol対応

**作成日**: 2026-01-09
**ステータス**: Phase 4 実装完了（テスト待ち）

## 実施内容

### 問題発見

OAuth統合テストを開始したところ、**Phase 1-3の実装がAT Protocol仕様に非準拠**であることが判明しました。

#### 発見された問題

1. **存在しないエンドポイントの使用**
   - `https://bsky.social/oauth/authorize` (404)
   - `https://bsky.social/oauth/token` (404)
   - Blueskyは標準的なOAuth 2.0エンドポイントを提供していない

2. **AT Protocol独自仕様の未対応**
   - DPoP (Demonstrating Proof-of-Possession) 未実装
   - PDSの動的発見機構 (DID Document解決) 未実装
   - Pushed Authorization Request (PAR) 未対応

3. **手動実装の問題**
   - `src/utils/pkce.ts`: PKCE生成は実装済みだが、AT Protocol特有の要件に未対応
   - `src/services/bluesky/oauth.ts`: 標準OAuth 2.0を想定した実装
   - 手動でのトークン交換・検証が複雑で保守困難

### 解決策: @atproto/oauth-client-expo 採用

既にインストール済みの`@atproto/oauth-client-expo@0.0.7`を使用した正しいAT Protocol OAuth実装に全面修正しました。

## Phase 4 実装詳細

### Phase 4-1: クライアントメタデータ準備

#### 作成したファイル

**`assets/oauth-client-metadata.json`**

```json
{
  "client_id": "https://rietamura.github.io/kumotan/oauth-client-metadata.json",
  "client_name": "くもたん (Kumotan)",
  "application_type": "native",
  "redirect_uris": ["app.kumotan.com:/oauth/callback"],
  "scope": "atproto transition:generic",
  "token_endpoint_auth_method": "none",
  "response_types": ["code"],
  "grant_types": ["authorization_code", "refresh_token"],
  "dpop_bound_access_tokens": true
}
```

**重要な設定**:
- `client_id`: GitHub Pagesでホスティング予定のHTTPS URL
- `application_type`: "native" (React Nativeアプリ)
- `redirect_uris`: リバースドメイン形式 `app.kumotan.com:/oauth/callback`
- `dpop_bound_access_tokens`: true (必須)

#### app.json更新

```json
{
  "scheme": "app.kumotan.com",  // kumotan から変更
  "extra": {
    "oauth": {
      "clientId": "https://rietamura.github.io/kumotan/oauth-client-metadata.json",
      "redirectUri": "app.kumotan.com:/oauth/callback"
    }
  }
}
```

### Phase 4-2: ExpoOAuthClient統合

#### 新規作成ファイル

**`src/services/bluesky/oauth-client.ts`** (新規)

```typescript
import { ExpoOAuthClient } from '@atproto/oauth-client-expo';

const oauthClientInstance = new ExpoOAuthClient({
  handleResolver: 'https://bsky.social',
  clientMetadata: { /* メタデータ */ }
});

export function getOAuthClient(): ExpoOAuthClient {
  return oauthClientInstance;
}
```

**役割**:
- ExpoOAuthClientのシングルトンインスタンス管理
- クライアントメタデータの設定
- ハンドル解決エンドポイント設定

#### 既存ファイル修正

**`src/services/bluesky/auth.ts`** (大幅修正)

追加機能:
- `startOAuthFlow(handle: string)`: OAuth認証開始
  - `ExpoOAuthClient.signIn()`を使用
  - ブラウザ起動・コールバック処理を自動化
  - セッション成功・エラー・キャンセルを適切にハンドリング
- `restoreOAuthSession()`: DIDからセッション復元
  - `ExpoOAuthClient.restore()`を使用
  - 自動トークンリフレッシュ
- `clearOAuthSession()`: OAuthセッションデータ削除

**import追加**:
```typescript
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Agent } from '@atproto/api';
import { getOAuthClient } from './oauth-client';
```

**ストレージ**:
- AsyncStorageにユーザーDIDを保存 (`@kumotan:user_did`)
- expo-secure-storeに認証トークンを保存 (既存実装維持)

**`src/store/authStore.ts`** (修正)

変更点:
- `loginWithOAuth(handle: string)`: 新しいシグネチャ
  - `startOAuthFlow()`を呼び出し
  - セッション・キャンセル・エラーを適切に処理
- `resumeSession()`: OAuth復元のフォールバック追加
  - App Passwordセッション → OAuthセッションの順で試行
- `logout()`: OAuthセッションクリア追加
- `startOAuth()`, `completeOAuth()`: **削除** (不要)

**`src/hooks/useOAuthFlow.ts`** (簡略化)

変更点:
- ハンドル入力状態を内部管理
- `setHandle(handle: string)`: ハンドル設定
- `startOAuthFlow()`: 簡略化
  - `authStore.loginWithOAuth()`を直接呼び出し
  - ブラウザ起動・Deep Linkは`ExpoOAuthClient`が処理
- Linking API呼び出しを削除 (自動処理)

**`src/components/OAuthButton.tsx`** (修正)

変更点:
- ハンドル入力フィールドを追加
- `useOAuthFlow`から`handle`, `setHandle`を取得
- ボタンクリックで`startOAuthFlow()`を呼び出すだけ

**`App.tsx`** (修正)

変更点:
- **Deep Linkハンドラーを削除**
  - `Linking.addEventListener()` 削除
  - `Linking.getInitialURL()` 削除
  - `completeOAuth()` 呼び出し削除
- ExpoOAuthClientが内部で処理するためコメント追加

### Phase 4-3: 削除不要の判断

以下のファイルは削除せず、**既存のテストとして保持**:

- `src/utils/__tests__/pkce.test.ts`: PKCE仕様のテストとして有用
- `src/services/bluesky/__tests__/oauth.test.ts`: OAuth概念の理解に有用
- `src/utils/pkce.ts`: テストで使用中
- `src/services/bluesky/oauth.ts`: export削除で影響なし (auth.tsから参照削除済み)

**理由**: テストカバレッジを維持し、将来的な参照として保持

## 技術的詳細

### AT Protocol OAuth vs 標準 OAuth 2.0

| 項目 | 標準 OAuth 2.0 | AT Protocol OAuth |
|------|---------------|-------------------|
| エンドポイント | 固定URL | PDS動的発見 |
| 認証方式 | Client Secret | DPoP (公開鍵暗号) |
| トークンバインディング | なし | DPoP必須 |
| ハンドル解決 | N/A | DID Document解決 |
| 実装複雑度 | 中 | 高 |

### ExpoOAuthClient の動作フロー

```
1. signIn(handle) 呼び出し
   ↓
2. ハンドル → DID 解決
   ↓
3. DID → PDS エンドポイント発見
   ↓
4. PAR (Pushed Authorization Request) 送信
   ↓
5. ブラウザで認証URL を開く (自動)
   ↓
6. ユーザー認証 (Blueskyログイン画面)
   ↓
7. Deep Link コールバック受信 (自動)
   ↓
8. 認証コード → トークン交換 (自動)
   ↓
9. DPoP トークンバインディング (自動)
   ↓
10. OAuthSession 返却
```

**開発者が実装すること**:
- `signIn()`を呼び出すだけ
- 結果を処理する

**ExpoOAuthClientが自動処理すること**:
- DID解決
- エンドポイント発見
- ブラウザ起動
- コールバック処理
- トークン交換
- DPoP実装
- セッション管理

## 残タスク

### Phase 4-4: 統合テスト (未実施)

以下のテストが必要:

1. **クライアントメタデータのホスティング**
   - GitHub Pagesに`oauth-client-metadata.json`をデプロイ
   - HTTPS経由でアクセス可能か確認

2. **iOS実機テスト**
   - Expo Goまたは開発ビルドで動作確認
   - OAuth認証フロー完全テスト
     - ハンドル入力 → ブラウザ起動
     - Blueskyログイン → アプリ復帰
     - セッション確立確認
   - セッション復元テスト
     - アプリ再起動後の自動ログイン
   - エラーケーステスト
     - キャンセル
     - 無効なハンドル
     - ネットワークエラー

3. **App Passwordとの共存確認**
   - OAuth認証済みユーザーの動作
   - App Password認証済みユーザーの動作
   - 両方式の切り替え

## ファイル変更サマリー

### 新規作成

- `assets/oauth-client-metadata.json` (クライアントメタデータ)
- `src/services/bluesky/oauth-client.ts` (ExpoOAuthClientラッパー)

### 修正

- `app.json` (scheme, extra.oauth設定)
- `src/services/bluesky/auth.ts` (OAuth関数3つ追加)
- `src/store/authStore.ts` (loginWithOAuth簡略化、セッション復元更新)
- `src/hooks/useOAuthFlow.ts` (ハンドル管理追加、簡略化)
- `src/components/OAuthButton.tsx` (ハンドル入力追加)
- `App.tsx` (Deep Linkハンドラー削除)
- `doc/requirements.md` (Phase 3問題記録、Phase 4追加)

### 削除なし

- 既存のPKCE/OAuth実装ファイルは保持 (テスト目的)

## デプロイ要件

### 1. GitHub Pagesセットアップ

リポジトリに以下を追加:

```
/docs/oauth-client-metadata.json  (assets/からコピー)
/docs/icon.png                     (アプリアイコン)
```

GitHub Pages設定:
- リポジトリ Settings → Pages
- Source: Deploy from a branch
- Branch: main, /docs

### 2. DNS設定 (オプション)

カスタムドメイン使用時:
- `rietamura.github.io` → `kumotan.app` など
- `client_id` URLを更新

### 3. app.jsonの最終確認

デプロイ前に`client_id`が正しいHTTPS URLであることを確認。

## 次のステップ

### M2.6 Phase 4完了のために

1. **GitHub Pagesデプロイ** (30分)
   - `/docs/`ディレクトリ作成
   - メタデータファイル配置
   - GitHub Pages有効化

2. **iOS開発ビルド作成** (1-2時間)
   - `eas build --profile development --platform ios`
   - TestFlight配信またはローカルインストール

3. **実機テスト実施** (2-3時間)
   - OAuth認証フロー検証
   - エラーハンドリング確認
   - パフォーマンス確認

4. **バグ修正** (変動)
   - テスト中に発見された問題の修正

### M3: ベータリリース (v1.1.0)

Phase 4完了後:
- OAuth/App Password両認証方式の統合テスト
- UI/UX洗練
- TestFlight配信
- ユーザーフィードバック収集

## 参考資料

- [AT Protocol OAuth Client Implementation](https://docs.bsky.app/docs/advanced-guides/oauth-client)
- [AT Protocol OAuth Introduction](https://atproto.com/guides/oauth)
- [@atproto/oauth-client-expo npm](https://www.npmjs.com/package/@atproto/oauth-client-expo)
- [OAuth for AT Protocol | Bluesky](https://docs.bsky.app/blog/oauth-atproto)

## 所感

標準OAuth 2.0の知識のみでAT Protocol OAuthを実装するのは困難でした。公式SDKの`@atproto/oauth-client-expo`を使用することで、以下のメリットがあります:

- **複雑な仕様の隠蔽**: DPoP、PAR、DID解決などを意識不要
- **保守性の向上**: 公式実装の更新に追従可能
- **セキュリティの確保**: 暗号化・検証ロジックが正しく実装済み
- **開発効率**: 手動実装の1/10の工数で完了

手動実装したPhase 1-3 (PKCE, oauth.ts) はテストとして残し、実際のOAuth処理は公式SDKに任せるアプローチが最適です。
