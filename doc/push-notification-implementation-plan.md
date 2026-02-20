# プッシュ通知実装計画書

**作成日**: 2026-02-20
**対象バージョン**: v1.1.0（リリース前実装）

---

## 1. 概要

Bluesky のソーシャルアクション（いいね・返信・メンション・リポスト・フォロー）をプッシュ通知で受け取る機能を実装する。

### 採用アーキテクチャ

```
[くもたん アプリ]
    │ 起動時に Expo Push Token を POST
    ▼
[Hono on Cloudflare Workers]
    ├── POST /register    ← トークンを KV に保存
    └── scheduled（5分おき）← listNotifications をポーリング
            │ 新着あり
            ▼
    Expo Push Notification Service（EPNS）
            │
            ▼
    [iOS プッシュ通知]
```

### 選定理由

| 選択肢 | 採用 | 理由 |
|---|---|---|
| Jetstream WebSocket | ✗ | 永続接続が Workers 向きでない、個人アプリには過剰 |
| アプリ内ポーリング（expo-background-fetch） | ✗ | iOS のバックグラウンド制限により信頼性が低い |
| **Cloudflare Workers Cron ポーリング** | **✓** | 無料枠で完結・実装がシンプル・信頼性が高い |

### 無料枠の試算（1ユーザー）

| 項目 | 1日 | 無料枠/日 |
|---|---|---|
| Worker 実行回数 | 288回 | 100,000回 |
| KV 読み取り | 288回 | 100,000回 |
| KV 書き込み（新着時のみ更新） | 数〜数十回 | 1,000回 |

---

## 2. システム構成

### 2-1. くもたん アプリ側（React Native / Expo）

**新規ファイル**

```
src/
  hooks/
    useNotifications.ts       ← 通知許可・トークン取得・登録ロジック
  services/
    notifications/
      pushToken.ts            ← Workers へのトークン登録 API クライアント
  screens/
    NotificationSettingsScreen.tsx  ← 通知設定 ON/OFF 画面
```

**変更ファイル**

```
src/store/settingsStore.ts          ← 通知設定の状態追加
src/screens/SettingsScreen.tsx      ← 「通知設定」メニューへのリンク追加
src/navigation/                     ← NotificationSettingsScreen のルート追加
app.json                            ← expo-notifications プラグイン追加
```

### 2-2. バックエンド（Hono + Cloudflare Workers）

**別リポジトリとして管理**（例：`kumotan-notifications`）

```
kumotan-notifications/
  src/
    index.ts         ← Hono アプリ本体・エントリポイント
    polling.ts       ← listNotifications ポーリングロジック
    push.ts          ← Expo Push Notification Service 送信
    types.ts         ← 型定義
  wrangler.toml      ← Cloudflare Workers 設定
  package.json
```

---

## 3. 実装詳細

### 3-1. Cloudflare Workers（Hono）

#### KV スキーマ

```
キー: "token:{did}"
値:   {
        expoPushToken: string,   // ExponentPushToken[xxx]
        notificationsEnabled: boolean,
        seenAt: string,          // 最終確認日時（ISO 8601）
        registeredAt: string,
      }
```

#### POST /register エンドポイント

```typescript
// src/index.ts
import { Hono } from 'hono'

type Bindings = {
  NOTIFICATION_KV: KVNamespace
  BLUESKY_API_URL: string
}

const app = new Hono<{ Bindings: Bindings }>()

app.post('/register', async (c) => {
  const { did, expoPushToken, enabled } = await c.req.json()
  // バリデーション・KV 保存
  await c.env.NOTIFICATION_KV.put(`token:${did}`, JSON.stringify({
    expoPushToken,
    notificationsEnabled: enabled,
    seenAt: new Date().toISOString(),
    registeredAt: new Date().toISOString(),
  }))
  return c.json({ ok: true })
})

export default {
  fetch: app.fetch,
  async scheduled(event: ScheduledEvent, env: Bindings) {
    await pollNotifications(env)
  },
}
```

#### Cron ポーリングロジック

```typescript
// src/polling.ts
// 1. KV から全ユーザーのトークンを取得
// 2. 各ユーザーの DID で listNotifications を呼ぶ
//    （seenAt 以降の新着のみ取得）
// 3. 新着があれば Expo Push API に送信
// 4. seenAt を更新（新着があった場合のみ KV 書き込み）
```

#### 対応通知タイプ

| Bluesky reason | 通知タイトル |
|---|---|
| `like` | 「いいねされました」 |
| `reply` | 「返信が届きました」 |
| `mention` | 「メンションされました」 |
| `repost` | 「リポストされました」 |
| `follow` | 「フォローされました」 |

#### wrangler.toml

```toml
name = "kumotan-notifications"
main = "src/index.ts"
compatibility_date = "2025-01-01"

kv_namespaces = [
  { binding = "NOTIFICATION_KV", id = "<KV_NAMESPACE_ID>" }
]

[triggers]
crons = ["*/5 * * * *"]
```

---

### 3-2. くもたん アプリ側

#### expo-notifications 設定（app.json）

```json
{
  "plugins": [
    ["expo-notifications", {
      "icon": "./assets/notification-icon.png",
      "color": "#1DA1F2",
      "sounds": []
    }]
  ],
  "ios": {
    "infoPlist": {
      "NSUserNotificationsUsageDescription":
        "Bluesky のいいねや返信をお知らせするために通知を使用します。"
    }
  }
}
```

#### useNotifications フック

```typescript
// src/hooks/useNotifications.ts
// - 通知許可リクエスト
// - Expo Push Token 取得
// - Workers /register へ POST
// - 通知受信時のフォアグラウンド処理
```

#### settingsStore への追加

```typescript
interface SettingsState {
  // 既存...
  notificationsEnabled: boolean
  setNotificationsEnabled: (value: boolean) => void
  notifyOnLike: boolean
  setNotifyOnLike: (value: boolean) => void
  notifyOnReply: boolean
  setNotifyOnReply: (value: boolean) => void
  notifyOnMention: boolean
  setNotifyOnMention: (value: boolean) => void
  notifyOnRepost: boolean
  setNotifyOnRepost: (value: boolean) => void
  notifyOnFollow: boolean
  setNotifyOnFollow: (value: boolean) => void
}
```

---

## 4. プライバシー対応（必須）

### 4-1. プライバシーポリシー更新（doc/privacy-policy.md）

**追記内容**：

- 第2条「収集する情報」に「プッシュ通知トークン」セクションを追加
  - Expo Push Token（デバイス識別子）を運営者管理サーバー（Cloudflare Workers）に送信・保存することを明記
- 第3条「情報の利用目的」に「通知の送信」を追記
- 外部サービスに「Expo Push Notification Service」「Cloudflare Workers」を追加

**現状からの変化点**：

> 現在「運営者のサーバーに送信されることはありません」と記載しているが、通知機能の追加により初めて開発者管理サーバーへのデータ送信が発生するため、この記述を修正する。

### 4-2. App Store Connect プライバシー申告更新

**追加するデータカテゴリ**：

| カテゴリ | データ | 目的 | ユーザーIDと紐づく |
|---|---|---|---|
| 識別子 → デバイス ID | Expo Push Token | App Functionality（通知送信） | Yes（DID と紐づけて保存） |

**外部送信先一覧（doc/app-store/privacy-declaration.md）への追記**：

| 外部サービス | 送信データ | 目的 |
|---|---|---|
| Cloudflare Workers（運営者管理） | Bluesky DID、Expo Push Token | プッシュ通知の管理 |
| Expo Push Notification Service | Expo Push Token、通知内容 | iOS プッシュ通知の配信 |

---

## 5. 実装ステップ

### Phase 1：バックエンド（Cloudflare Workers）

1. [ ] Cloudflare アカウント設定・Wrangler インストール
2. [ ] `kumotan-notifications` リポジトリ作成
3. [ ] Hono プロジェクト初期化
4. [ ] Workers KV ネームスペース作成
5. [ ] `POST /register` エンドポイント実装
6. [ ] Cron ポーリングロジック実装（`listNotifications` 呼び出し）
7. [ ] Expo Push API 送信実装
8. [ ] Cloudflare Workers へデプロイ・動作確認

### Phase 2：アプリ側（くもたん）

9. [ ] `expo-notifications` インストール・app.json 設定
10. [ ] devクライアント再ビルド（`eas build --profile production-dev --platform ios`）
11. [ ] `useNotifications.ts` フック作成
12. [ ] `pushToken.ts` サービス作成（Workers 登録 API クライアント）
13. [ ] `settingsStore.ts` に通知設定を追加
14. [ ] `NotificationSettingsScreen.tsx` 作成
15. [ ] `SettingsScreen.tsx` に通知設定メニュー追加
16. [ ] ナビゲーション追加

### Phase 3：プライバシー対応

17. [ ] `doc/privacy-policy.md` 更新
18. [ ] `doc/app-store/privacy-declaration.md` 更新
19. [ ] GitHub Pages のプライバシーポリシー HTML 更新

### Phase 4：テスト・リリース

20. [ ] バックエンド単体テスト（通知ポーリング・送信）
21. [ ] アプリ実機テスト（通知許可フロー・受信確認）
22. [ ] 通知を拒否した場合の動作確認（アプリが正常動作すること）
23. [ ] App Store Connect プライバシー申告更新
24. [ ] TestFlight 配信・動作確認

---

## 6. 工数見積もり

| フェーズ | 工数目安 |
|---|---|
| Phase 1（バックエンド） | 6.5〜9.5 時間 |
| Phase 2（アプリ側） | 5〜7 時間 |
| Phase 3（プライバシー対応） | 1〜2 時間 |
| Phase 4（テスト・リリース） | 2〜3 時間 |
| **合計** | **14.5〜21.5 時間** |

---

## 7. 既知の制限・注意事項

- **Expo Push Token の失効**：アプリ再インストール時にトークンが変わる。失効トークンは EPNS からエラーが返るため、そのタイミングで KV から削除する処理を実装する
- **ユーザー増加時の KV 書き込み上限**：無料枠は 1,000 書き込み/日。3〜4 ユーザーが上限。ユーザー増加時は Cloudflare Workers 有料プラン（$5/月）に移行する
- **Bluesky API の認証**：`listNotifications` はユーザーの認証トークンが必要。Workers 側でユーザーのトークンを管理する必要はなく、公開情報（DID ベース）での通知判定方法を検討する（または別途 App Password を使用する）
- **devクライアント再ビルド**：`expo-notifications` はネイティブモジュールを含むため、インストール後に EAS ビルドの再実行が必要

---

## 8. スケールアップ計画

ユーザー数が増えた場合の移行パス：

| ユーザー数 | 対応 |
|---|---|
| 1〜3人 | Cloudflare Workers 無料枠で対応 |
| 4人以上 | Cloudflare Workers 有料プラン（$5/月）に移行 |
| 数百人以上 | Jetstream ベースのリアルタイム通知に移行を検討 |
