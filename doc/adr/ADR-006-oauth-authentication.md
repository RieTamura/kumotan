# ADR-006: OAuth認証の実装（App Password併用）

## ステータス

採用 (Accepted)

## 日付

2026-01-08

## コンテキスト

くもたんアプリは現在、Bluesky認証にApp Password方式を使用している。しかし、以下の課題が顕在化している:

### 現状の課題

1. **ユーザー体験の問題**
   - App Passwordの作成手順が複雑（Bluesky設定 → App Passwords → 新規作成 → コピー → アプリに貼り付け）
   - ユーザーフィードバック「App Passwordが面倒」（検証済み）
   - 競合アプリ（Graysky、Skeets）はOAuth対応済み

2. **セキュリティ上の課題**
   - App Passwordは実質的にアカウント全権限を持つ
   - ユーザーがApp Passwordを適切に管理・削除しないリスク
   - パスワードの使い回しによるセキュリティリスク

3. **競争力の課題**
   - 他のBlueskyクライアントがOAuthに移行している
   - ユーザーはより簡便な認証方法を期待

### 検討する選択肢

#### 選択肢1: 現状維持（App Passwordのみ）
- **メリット**:
  - 実装済み、追加開発不要
  - シンプルな認証フロー（バックエンド不要）
- **デメリット**:
  - ユーザー体験が劣る
  - 競合との差別化が難しい
  - セキュリティリスクが高い

#### 選択肢2: OAuth完全移行（App Password廃止）
- **メリット**:
  - 最新の認証標準に準拠
  - ユーザー体験の大幅改善
  - より細かい権限制御が可能
- **デメリット**:
  - Bluesky OAuthがまだ安定していない可能性
  - 既存ユーザーの移行が必要
  - 後方互換性の喪失

#### 選択肢3: OAuth優先・App Password併用
- **メリット**:
  - ユーザーに選択肢を提供
  - 段階的な移行が可能
  - OAuthに問題があった場合のフォールバック
  - 既存ユーザーに影響なし
- **デメリット**:
  - 実装とメンテナンスのコストが高い
  - UI設計が複雑化

## 決定

**選択肢3: OAuth優先・App Password併用方式を採用**

### 実装方針

1. **OAuth優先UI設計**
   - ログイン画面のメインCTAはOAuthボタン
   - App Passwordフォームは「詳細オプション」として折りたたみ表示
   - 新規ユーザーにはOAuthを推奨

2. **後方互換性の確保**
   - 既存のApp Password認証コードはそのまま維持
   - 両方式が共存できるauth層の設計
   - 既存ユーザーは再ログイン不要

3. **段階的ロールアウト**
   - v1.1.0: OAuth実装、App Password併用（M2.6）
   - v1.2.0: ユーザーフィードバック収集、OAuth安定化
   - v2.0.0以降: App Password非推奨化を検討（最低6ヶ月後）

## 理由

### 1. ユーザー体験の向上

OAuth認証フロー:
```
1. ユーザーが「Blueskyでログイン」ボタンをタップ
2. Bluesky公式サイトに遷移
3. ログイン or 既にログイン済みなら自動認可
4. アプリにリダイレクト、自動ログイン完了
```

従来のApp Passwordフロー（比較用）:
```
1. Blueskyアプリを開く
2. 設定 → App Passwords → 新規作成
3. パスワード名を入力（例: kumotan）
4. 生成されたパスワードをコピー
5. くもたんアプリに戻る
6. ハンドル名とApp Passwordを入力
7. ログイン
```

→ **OAuthは4ステップ削減、コピペ作業も不要**

### 2. セキュリティの強化

- **OAuth PKCE (RFC 7636)**:
  - 認可コード横取り攻撃を防止
  - Code Verifier/Challenge方式でモバイルアプリに最適
  - トークンの有効期限管理が標準化

- **最小権限の原則**:
  - OAuth scopeで必要最小限の権限のみ要求
  - App Passwordは全権限を持つため危険性が高い

### 3. 競争力の維持

主要Blueskyクライアントの認証方式（2026年1月時点）:

| アプリ名 | OAuth対応 | App Password対応 |
|---------|----------|-----------------|
| Graysky | ✅ | ✅ |
| Skeets | ✅ | ✅ |
| くもたん（現在） | ❌ | ✅ |
| くもたん（v1.1.0） | ✅ | ✅ |

### 4. リスク管理

**併用方式のメリット**:
- Bluesky OAuth APIに予期せぬ障害が発生してもApp Passwordで運用継続可能
- ユーザーが自分の好みに応じて選択可能
- 段階的移行によりリスクを最小化

## 実装詳細

### アーキテクチャ

```
┌─────────────────────────────────────────────┐
│          LoginScreen (UI Layer)             │
│  ┌─────────────┐  ┌─────────────────────┐  │
│  │ OAuth Button│  │ App Password Form   │  │
│  │  (Primary)  │  │ (Collapse/Advanced) │  │
│  └──────┬──────┘  └──────────┬──────────┘  │
└─────────┼────────────────────┼──────────────┘
          │                    │
          v                    v
┌─────────────────────────────────────────────┐
│         Auth Service Layer                  │
│  ┌──────────────┐  ┌──────────────────┐    │
│  │ loginWithOAuth│  │loginWithPassword │    │
│  └──────┬────────┘  └────────┬─────────┘    │
│         │                    │               │
│  ┌──────v────────────────────v──────┐       │
│  │      Token Storage (Unified)     │       │
│  │   expo-secure-store (encrypted)  │       │
│  └──────────────────────────────────┘       │
└─────────────────────────────────────────────┘
```

### OAuth実装（PKCE Flow）

```typescript
// 1. 認証開始
async function startOAuthFlow() {
  // PKCE Challenge生成
  const { verifier, challenge } = await generatePKCEChallenge();
  const state = await generateState();

  // State/Verifierを安全に保存
  await storeOAuthState({ state, codeVerifier: verifier });

  // 認証URLを構築
  const authUrl = buildAuthorizationUrl({
    state,
    codeChallenge: challenge,
    codeChallengeMethod: 'S256',
  });

  // ブラウザで開く
  await WebBrowser.openAuthSessionAsync(authUrl, redirectUri);
}

// 2. コールバック処理（Deep Link）
async function handleOAuthCallback(url: string) {
  const { code, state } = parseCallbackUrl(url);

  // State検証（CSRF対策）
  const storedState = await retrieveOAuthState();
  if (state !== storedState.state) {
    throw new Error('Invalid state parameter');
  }

  // トークン交換
  const tokens = await exchangeCodeForTokens({
    code,
    codeVerifier: storedState.codeVerifier,
  });

  // トークン保存（既存のstorage層を再利用）
  await saveAuthTokens(tokens);
}
```

### セキュリティ実装

1. **PKCE (Proof Key for Code Exchange)**
   - Code Verifier: 32バイト（256ビット）のランダム文字列
   - Code Challenge: SHA-256ハッシュ（base64url）
   - Challenge Method: `S256`（RFC 7636準拠）

2. **State Parameter（CSRF対策）**
   - 16バイト（128ビット）のランダム文字列
   - リクエストとコールバックで検証

3. **Secure Storage**
   - `expo-secure-store`で暗号化保存
   - State/Verifierは認証フロー完了後に削除

### Deep Link設定

[app.json](app.json):
```json
{
  "expo": {
    "scheme": "kumotan",
    "extra": {
      "oauth": {
        "redirectUri": "kumotan://oauth/callback"
      }
    }
  }
}
```

[App.tsx](App.tsx)でDeep Linkハンドリング:
```typescript
Linking.addEventListener('url', (event) => {
  const { url } = event;
  if (url.startsWith('kumotan://oauth/callback')) {
    handleOAuthCallback(url);
  }
});
```

## 影響

### ユーザー影響

**既存ユーザー（App Passwordでログイン済み）**:
- 影響なし
- 再ログインは不要
- 次回ログイン時にOAuthを選択可能

**新規ユーザー**:
- より簡単なログイン体験
- App Passwordの作成手順をスキップ可能

### 開発影響

**Phase 1（M2.6: 基盤セットアップ）**:
- 依存関係追加（`@atproto/oauth-client-expo`, `expo-crypto`）
- PKCE実装とテスト
- Deep Link設定
- 型定義追加

**Phase 2（OAuthサービス層）**:
- OAuth認証フロー実装
- State/Verifier管理
- トークン交換API
- 既存auth層との統合

**Phase 3（UI統合）**:
- ログイン画面のUI更新
- OAuthボタン追加
- App Passwordフォームの折りたたみ化
- Deep Linkハンドリング

**工数**: 30-37時間（4-5営業日）

### テスト戦略

1. **Unit Tests**:
   - PKCE生成関数（100%カバレッジ）
   - State生成・検証
   - URL構築ロジック

2. **Integration Tests**:
   - OAuth完全フロー（モック使用）
   - エラーハンドリング
   - State検証

3. **Manual Tests**:
   - iOS実機でのOAuthフロー
   - App Passwordフローの後方互換性
   - Deep Linkハンドリング

## トレードオフ

### 受け入れるデメリット

1. **実装複雑性の増加**
   - 2つの認証方式の維持
   - テストケースの増加
   - **緩和策**: Auth層の抽象化、共通インターフェース設計

2. **UI/UXの複雑化**
   - 選択肢が増えることでユーザーが迷う可能性
   - **緩和策**: OAuthを視覚的に優先、App Passwordは「詳細」として配置

3. **メンテナンスコスト**
   - 両方式のサポートとバグ修正
   - **緩和策**: 6ヶ月後にOAuth使用率を分析、App Password非推奨化を検討

### 得られるメリット

1. **ユーザー満足度向上**
   - ログイン手順の簡素化
   - 競合アプリと同等の体験

2. **セキュリティ強化**
   - 最新の認証標準（PKCE）
   - 細かい権限制御

3. **リスク分散**
   - OAuth障害時のフォールバック
   - 段階的移行による安定性

## 代替案

### 将来的な拡張

**v2.0.0（6ヶ月後）**: OAuth使用率が80%を超えた場合
- App Passwordを「レガシー認証」として警告表示
- 新規ユーザーにはOAuthのみ提供
- 既存App Passwordユーザーには移行を促すバナー表示

**v3.0.0（12ヶ月後）**: OAuth使用率が95%を超えた場合
- App Password完全廃止を検討
- 最低6ヶ月前に非推奨化アナウンス
- 移行ガイドとサポートの提供

## 参照

- RFC 7636: Proof Key for Code Exchange (PKCE): https://www.rfc-editor.org/rfc/rfc7636
- AT Protocol OAuth Specification: https://atproto.com/specs/oauth
- Expo WebBrowser: https://docs.expo.dev/versions/latest/sdk/webbrowser/
- expo-secure-store: https://docs.expo.dev/versions/latest/sdk/securestore/
- requirements.md M2.6セクション（L329-L380）
- ADR-002: App Passwordを保存しない方針

## ステークホルダー

- **決定者**: RieTamura（開発者）
- **影響を受ける人**:
  - くもたんアプリの全ユーザー（既存 + 新規）
  - 特に新規ユーザーのオンボーディング体験が向上

## メトリクス

### 成功指標（v1.1.0リリース後3ヶ月）

- OAuth使用率: 60%以上
- ログイン完了率: 90%以上（現在85%から改善）
- 認証関連のサポート問い合わせ: 50%削減
- OAuth関連のクリティカルバグ: ゼロ

### モニタリング

```typescript
// 匿名化された使用状況トラッキング
analytics.track('login_method', {
  method: 'oauth' | 'app_password',
  success: boolean,
  error_type?: string,
});
```

## レビュー日

次回レビュー予定: 2026年7月（v1.1.0リリース後6ヶ月、App Password非推奨化判断時期）
