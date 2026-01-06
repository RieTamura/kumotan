# ADR-002: App Passwordを保存しない方針

## ステータス

採用 (Accepted)

## 日付

2026-01-06

## コンテキスト

くもたんアプリでは、BlueskyのタイムラインにアクセスするためにAT Protocol経由での認証が必要である。AT Protocolの認証では、以下の認証情報を扱う:

1. **App Password**: ユーザーがログイン時に入力するパスワード（メインアカウントパスワードとは別）
2. **Access JWT (accessJwt)**: 短期間有効なアクセストークン（24時間程度）
3. **Refresh JWT (refreshJwt)**: アクセストークンを更新するための長期トークン（数ヶ月）

認証フロー:
```
ユーザー名 + App Password
  ↓
Bluesky API: createSession
  ↓
{ accessJwt, refreshJwt, did, handle }
```

### 選択肢1: App Passwordをexpo-secure-storeに保存する
- **メリット**:
  - ユーザーが毎回ログインする必要がない
  - 自動再認証が容易
- **デメリット**:
  - パスワードがデバイスに保存されるセキュリティリスク
  - デバイス紛失時に第三者がアカウントにアクセス可能
  - セキュリティベストプラクティスに反する

### 選択肢2: App Passwordを保存せず、トークンのみ保存する
- **メリット**:
  - パスワードがデバイスに残らない
  - トークンリフレッシュで長期間のセッション維持が可能
  - セキュリティリスクの最小化
- **デメリット**:
  - Refresh Tokenが期限切れ時に再ログインが必要
  - 実装が若干複雑（トークンリフレッシュ機構）

### 選択肢3: App Passwordもトークンも保存せず、毎回ログインさせる
- **メリット**:
  - 最高レベルのセキュリティ
- **デメリット**:
  - ユーザー体験が極端に悪化
  - 実用的ではない

## 決定

**選択肢2: App Passwordを保存せず、トークン（accessJwt, refreshJwt）のみを保存する**

## 理由

1. **セキュリティベストプラクティス**
   - OAuth 2.0やJWTベースの認証では、パスワードを保存しないことが標準
   - パスワードは認証時のみ使用し、即座に破棄
   - トークンは有効期限があり、失効可能

2. **最小権限の原則**
   - App Passwordは全権限を持つクレデンシャル
   - トークンはスコープを制限でき、必要に応じて失効可能
   - Bluesky側でApp Passwordを変更/削除すると、保存されたパスワードは無効化されるが、アプリは気づかない

3. **デバイス紛失時のリスク軽減**
   - トークンのみ保存されている場合、ユーザーはBluesky設定画面で該当セッションを失効可能
   - App Passwordが保存されていると、第三者が新しいセッションを作成可能

4. **AT Protocolの設計思想に沿う**
   - AT ProtocolのcreateSessionエンドポイントは、App Passwordを受け取り、トークンを返す設計
   - refreshSessionエンドポイントでトークンを更新可能
   - この設計は「パスワードを保存しない」ことを前提としている

5. **実装の複雑性が許容範囲**
   - トークンリフレッシュは標準的なパターン（多くのライブラリが実装）
   - @atproto/api は自動リフレッシュをサポート

## 影響

### 実装

```typescript
// ログイン処理
export async function login(identifier: string, password: string): Promise<Result<void, AppError>> {
  try {
    const agent = new BskyAgent({ service: 'https://bsky.social' });

    // App Passwordで認証（パスワードは保存しない）
    const response = await agent.login({ identifier, password });

    // トークンのみ保存
    await SecureStore.setItemAsync('accessJwt', response.data.accessJwt);
    await SecureStore.setItemAsync('refreshJwt', response.data.refreshJwt);
    await SecureStore.setItemAsync('did', response.data.did);
    await SecureStore.setItemAsync('handle', response.data.handle);

    // passwordは即座に破棄（変数スコープ外に出る）

    return { success: true, data: undefined };
  } catch (error) {
    return { success: false, error: authError('ログインに失敗しました。', error) };
  }
}

// 自動ログイン処理（トークンからセッション復元）
export async function restoreSession(): Promise<Result<BskyAgent, AppError>> {
  try {
    const accessJwt = await SecureStore.getItemAsync('accessJwt');
    const refreshJwt = await SecureStore.getItemAsync('refreshJwt');
    const did = await SecureStore.getItemAsync('did');
    const handle = await SecureStore.getItemAsync('handle');

    if (!accessJwt || !refreshJwt || !did || !handle) {
      return { success: false, error: authError('セッションが見つかりません。') };
    }

    const agent = new BskyAgent({ service: 'https://bsky.social' });

    // セッションを復元
    await agent.resumeSession({ accessJwt, refreshJwt, did, handle });

    // @atproto/api が自動的にトークンをリフレッシュ

    return { success: true, data: agent };
  } catch (error) {
    return { success: false, error: authError('セッションの復元に失敗しました。', error) };
  }
}
```

### トークンリフレッシュ

@atproto/api の BskyAgent は自動的にトークンリフレッシュを処理する:

1. Access Token が期限切れになると、自動的に Refresh Token で更新
2. 更新されたトークンはメモリ内に保持される
3. アプリは定期的に（例: アプリ終了時、フィード更新時）トークンを永続化

```typescript
// トークン更新時のコールバック
agent.on('sessionUpdate', async (session) => {
  if (session) {
    await SecureStore.setItemAsync('accessJwt', session.accessJwt);
    await SecureStore.setItemAsync('refreshJwt', session.refreshJwt);
  }
});
```

### Refresh Token期限切れ時の処理

Refresh Tokenも期限切れになった場合（通常数ヶ月後）:

1. アプリはログイン画面を表示
2. ユーザーに再度App Passwordの入力を要求
3. 新しいトークンペアを取得して保存

```typescript
export async function handleTokenExpired(): Promise<void> {
  // トークンをクリア
  await SecureStore.deleteItemAsync('accessJwt');
  await SecureStore.deleteItemAsync('refreshJwt');

  // ユーザーをログイン画面にリダイレクト
  navigation.navigate('Login');

  // ユーザーフレンドリーなメッセージ
  Alert.alert(
    'セッション期限切れ',
    'セキュリティのため、再度ログインしてください。'
  );
}
```

## トレードオフ

### 受け入れるデメリット

- **Refresh Token期限切れ時の再ログイン**: 数ヶ月に一度、ユーザーがApp Passwordを再入力
  - **緩和策**: Refresh Tokenの有効期限は十分長い（AT Protocolの仕様による）
  - **影響範囲**: ほとんどのユーザーは日常的に使用するため、期限切れは稀

- **トークンリフレッシュ実装の複雑性**: 自動リフレッシュ機構が必要
  - **緩和策**: @atproto/api が標準でサポート
  - **影響範囲**: 実装者（開発者）のみ

### 得られるメリット

- **セキュリティ向上**: パスワード漏洩リスクの排除
- **ユーザーの安心感**: デバイス紛失時にセッションを失効可能
- **ベストプラクティス遵守**: 業界標準のセキュリティパターン

## 代替案

### 生体認証と組み合わせたパスワード保存

一部のアプリは、生体認証（Face ID、Touch ID）を必須化し、その上でパスワードを保存する方法を採用している。

- **メリット**: デバイスへの物理アクセスだけではパスワードを取得できない
- **デメリット**:
  - 生体認証非対応デバイスでは使用不可
  - 生体認証の誤検知や故障時のフォールバックが複雑
  - くもたんの規模では過剰なセキュリティ対策

この方式は、Phase 3以降でユーザーからの要望があれば検討可能。

## 参照

- AT Protocol Authentication: https://atproto.com/specs/xrpc#authentication
- OAuth 2.0 Best Current Practice: https://datatracker.ietf.org/doc/html/draft-ietf-oauth-security-topics
- @atproto/api Documentation: https://github.com/bluesky-social/atproto/tree/main/packages/api
- expo-secure-store: https://docs.expo.dev/versions/latest/sdk/securestore/
- requirements.md セキュリティ設計セクション（L144-L148）

## セキュリティ監査

| 脅威 | 軽減策 | 残存リスク |
|------|--------|------------|
| デバイス紛失/盗難 | トークンのみ保存、Bluesky側でセッション失効可能 | 低 |
| マルウェアによるトークン窃取 | expo-secure-storeで暗号化、OSレベルのキーストア使用 | 中（OSの脆弱性に依存） |
| 中間者攻撃 (MitM) | HTTPS必須、証明書ピンニング（将来検討） | 低 |
| トークンリプレイ攻撃 | AT Protocolのトークン検証機構、短い有効期限 | 低 |

## ステークホルダー

- **決定者**: RieTamura（開発者）
- **影響を受ける人**: くもたんアプリのすべてのユーザー
- **参照された専門知識**: AT Protocol仕様、OAuth 2.0セキュリティガイドライン

## レビュー日

次回レビュー予定: 2026年3月（M3ベータリリース時、セキュリティ監査実施）
