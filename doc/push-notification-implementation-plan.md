# プッシュ通知実装計画書

**作成日**: 2026-02-20
**改訂日**: 2026-02-22
**対象バージョン**: v1.1.0（リリース前実装）

---

## 1. 概要

Bluesky のソーシャルアクション（いいね・返信・メンション・リポスト・フォロー）をプッシュ通知で受け取る機能を実装する。

### 採用アーキテクチャ（最終版）

```
[くもたん アプリ]
    │ 起動時に DID + Expo Push Token を POST
    ▼
[Hono on Railway（Node.js 常時起動）]
    ├── POST /register      ← DID＋トークンを JSON ファイルに保存
    ├── DELETE /register/:did
    └── GET /health
    │
    │ 起動時に永続 WebSocket 接続（auto-reconnect 付き）
    ▼
wss://jetstream2.us-east.bsky.network/subscribe
    ?wantedCollections=app.bsky.feed.like
    &wantedCollections=app.bsky.feed.post
    &wantedCollections=app.bsky.feed.repost
    &wantedCollections=app.bsky.graph.follow
（認証不要・コレクション種別でフィルタリング）
    │ イベント受信 → 登録ユーザーに該当するか照合
    ▼
[Expo Push Notification Service（EPNS）]
    │
    ▼
[iOS プッシュ通知]
```

### 方式選定

| 選択肢 | 採用 | 理由 |
|---|---|---|
| `listNotifications` ポーリング（原案） | ✗ | ユーザーの App Password をサーバーに保存する必要があり漏洩リスクがある |
| Jetstream + Cloudflare Workers Cron | ✗ | `wantedDids` はイベントの発信者フィルタリングであり受信者には使えない。Cron は最大30秒のため常時接続不可 |
| Jetstream + Fly.io 常時接続 | ✗ | 技術的に適合するが新規登録に有効な無料枠がない（$7〜8/月） |
| **Jetstream + Railway 常時接続** | **✓** | 無料枠あり（クレカ不要）・Dockerfile そのまま使える・コスト予測が容易 |
| Firehose フル購読（Graysky 方式） | ✗ | 全イベントを購読するため帯域・処理コストが過大。個人アプリには過剰 |
| アプリ内ポーリング（expo-background-fetch） | ✗ | iOS のバックグラウンド制限により信頼性が低い |

> **設計の核心**: Jetstream の `wantedDids` は「そのDIDが作成したイベント」のフィルタリングであり、「そのDIDへの通知」には使えない。よって `wantedCollections` で通知種別を絞り、全イベントを受け取ってサーバー側で登録ユーザーへの該当を照合する。これには**永続的な WebSocket 接続**が必須。

### Railway プラン・コスト

| プラン | 月額 | クレカ | 特徴 |
|---|---|---|---|
| **Free** | $0（試用$5クレジット後は$1/月） | **不要** | 0.5 vCPU / 0.5GB RAM / 0.5GB ストレージ |
| Hobby | $5（$5クレジット込み） | 必要 | 48 vCPU / 48GB RAM / 5GB ストレージ |

くもたんの通知サーバー（Node.js、〜80MB RAM、JSONファイル数KB）は **Free プランで十分**。

---

## 2. システム構成

### 2-1. くもたん アプリ側（React Native / Expo）

**新規ファイル**

```
src/
  services/
    notifications/
      pushToken.ts            ← Railway へのトークン登録 API クライアント
  screens/
    NotificationSettingsScreen.tsx  ← 通知設定画面（Bluesky 通知＋リマインダー統合）
```

**変更ファイル**

```
src/store/notificationStore.ts     ← Bluesky 通知設定フィールドを追加
src/hooks/useNotifications.ts      ← Bluesky push 登録・解除ロジックを追加
src/screens/SettingsScreen.tsx     ← 通知セクションを NotificationSettingsScreen リンクに置き換え
src/navigation/AppNavigator.tsx    ← NotificationSettingsScreen のルート追加
src/constants/config.ts            ← NOTIFICATIONS_WORKER_URL を追加
app.json                           ← NSUserNotificationsUsageDescription を更新
```

### 2-2. バックエンド（Hono + Node.js on Railway）

**別ディレクトリとして管理**（`c:/Users/kapa3/kumotan-notifications/`）

```
kumotan-notifications/
  src/
    index.ts         ← Hono アプリ本体・エントリポイント・サーバー起動
    jetstream.ts     ← Jetstream WebSocket 常時接続・イベント処理
    push.ts          ← Expo Push Notification Service 送信
    storage.ts       ← JSON ファイル永続化（登録ユーザー管理）
    types.ts         ← 型定義
  railway.toml       ← Railway デプロイ設定
  Dockerfile         ← コンテナ定義（node:22-alpine）
  .dockerignore
  package.json
  tsconfig.json
```

---

## 3. 実装詳細

### 3-1. バックエンド（Railway）

#### ストレージスキーマ（JSON ファイル）

`/data/tokens.json` に保存（Railway volume にマウント）：

```json
{
  "users": {
    "did:plc:xxxx": {
      "expoPushToken": "ExponentPushToken[...]",
      "notifyOnLike": true,
      "notifyOnReply": true,
      "notifyOnMention": true,
      "notifyOnRepost": true,
      "notifyOnFollow": true,
      "registeredAt": "2026-02-22T00:00:00.000Z"
    }
  }
}
```

#### API エンドポイント

```typescript
// src/index.ts
POST   /register        ← { did, expoPushToken, settings } を upsert
DELETE /register/:did   ← 登録解除
GET    /health          ← ヘルスチェック（{ ok: true, users: N }）
```

#### Jetstream 接続ロジック（概要）

```
起動時:
  1. /data/tokens.json を読み込む
  2. startJetstreamSubscription() を呼ぶ

startJetstreamSubscription():
  wss://jetstream2.us-east.bsky.network/subscribe
    ?wantedCollections=app.bsky.feed.like
    &wantedCollections=app.bsky.feed.post
    &wantedCollections=app.bsky.feed.repost
    &wantedCollections=app.bsky.graph.follow
  に接続 → メッセージ受信ループ
  切断時: 5秒後に再接続（auto-reconnect）

processEvent(event):
  1. イベントの種別（like / post / repost / follow）を判定
  2. ターゲット DID（通知を受け取るべきユーザー）を抽出
     - like / repost: record.subject.uri の DID 部分
     - follow:        record.subject（DID 直接）
     - post（reply）: record.reply.parent.uri の DID 部分
     - post（mention）: record.facets から app.bsky.richtext.facet#mention を抽出
  3. targetDid が登録ユーザーか照合
  4. 自己アクション（did === targetDid）はスキップ
  5. ユーザーの preference フラグを確認
  6. bsky.app API でアクション実行者のプロフィール名を取得（10分キャッシュ）
  7. EPNS に Push 送信
  8. DeviceNotRegistered エラー時は自動的に登録解除
```

#### 対応通知タイプ

| Jetstream collection | 通知タイトル |
|---|---|
| `app.bsky.feed.like` | 「○○さんがいいねしました」 |
| `app.bsky.feed.post`（reply） | 「○○さんから返信が届きました」 |
| `app.bsky.feed.post`（mention） | 「○○さんにメンションされました」 |
| `app.bsky.feed.repost` | 「○○さんがリポストしました」 |
| `app.bsky.graph.follow` | 「○○さんにフォローされました」 |

#### railway.toml

```toml
[build]
builder = "DOCKERFILE"

[deploy]
startCommand = "npx tsx src/index.ts"
healthcheckPath = "/health"
healthcheckTimeout = 300
restartPolicyType = "ON_FAILURE"
restartPolicyMaxRetries = 10
```

#### 環境変数（Railway dashboard で設定）

| 変数名 | 値 | 説明 |
|---|---|---|
| `PORT` | `3000` | サーバーポート |
| `DATA_DIR` | `/data` | JSON ファイル保存ディレクトリ |

---

### 3-2. くもたん アプリ側

#### app.json の変更

```json
{
  "ios": {
    "infoPlist": {
      "NSUserNotificationsUsageDescription":
        "クイズ・単語学習のリマインダーと、Bluesky のいいねや返信などのプッシュ通知に使用します。"
    }
  }
}
```

> `expo-notifications` は既にインストール済み・app.json 設定済みのため、追加インストールおよび dev クライアント再ビルドは不要。

#### notificationStore への追加

```typescript
// src/store/notificationStore.ts に追加
interface NotificationState {
  // 既存（リマインダー設定）...

  // 追加（Bluesky ソーシャル通知）
  blueskyNotificationsEnabled: boolean
  setBlueskyNotificationsEnabled: (value: boolean) => void
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

#### pushToken.ts（新規）

```typescript
// src/services/notifications/pushToken.ts
import { NOTIFICATIONS_WORKER_URL } from '@/constants/config'

export async function registerPushToken(
  did: string,
  expoPushToken: string,
  settings: BlueskyNotificationSettings
): Promise<void> {
  await fetch(`${NOTIFICATIONS_WORKER_URL}/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ did, expoPushToken, settings }),
  })
}

export async function unregisterPushToken(did: string): Promise<void> {
  await fetch(`${NOTIFICATIONS_WORKER_URL}/register/${encodeURIComponent(did)}`, {
    method: 'DELETE',
  })
}
```

#### NotificationSettingsScreen（新規）

SettingsScreen から通知設定を切り出し、Bluesky ソーシャル通知設定を追加した統合画面。

```
[Bluesky 通知]
  通知を受け取る       [Switch]  ← blueskyNotificationsEnabled
  ─ ON 時のみ表示 ─
  いいね               [Switch]
  返信                 [Switch]
  メンション           [Switch]
  リポスト             [Switch]
  フォロー             [Switch]

[リマインダー]        （SettingsScreen から移動）
  クイズリマインダー   [Switch]
  単語リマインダー     [Switch]
  通知時刻             [Time Picker]
```

---

## 4. プライバシー対応（必須）

### 4-1. プライバシーポリシー更新（doc/privacy-policy.md）

**追記内容**：

- 第2条「収集する情報」に「プッシュ通知トークン」セクションを追加
  - Expo Push Token（デバイス識別子）を運営者管理サーバー（Railway）に送信・保存することを明記
  - Bluesky DID（公開識別子）を通知フィルタリングのために保存することを明記
- 第3条「情報の利用目的」に「通知の送信」を追記
- 外部サービスに「Expo Push Notification Service」「Railway」「Bluesky Jetstream」を追加

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
| Railway（運営者管理） | Bluesky DID、Expo Push Token | プッシュ通知の管理 |
| Expo Push Notification Service | Expo Push Token、通知内容 | iOS プッシュ通知の配信 |
| Bluesky Jetstream（公式） | なし（受信のみ） | イベント取得 |

---

## 5. 実装ステップ

### Phase 1：バックエンド（Railway）

1. [x] `kumotan-notifications/` ディレクトリ作成・Hono + Node.js プロジェクト初期化
2. [x] `src/types.ts` 型定義
3. [x] `src/storage.ts` JSON ファイル永続化（登録ユーザー管理）
4. [x] `src/push.ts` Expo Push API 送信 + プロフィール名キャッシュ
5. [x] `src/jetstream.ts` Jetstream 常時接続・イベント処理
6. [x] `src/index.ts` Hono エントリポイント（POST /register, DELETE /register/:did, GET /health）
7. [x] `Dockerfile` 作成
8. [x] Railway アカウント作成・プロジェクト作成（ユーザー作業）
9. [x] `fly.toml` を削除し `railway.toml` を追加
10. [x] Railway volume を作成し `/data` にマウント
11. [x] Railway へデプロイ・動作確認

### Phase 2：アプリ側（くもたん）

12. [x] `src/constants/config.ts` に `NOTIFICATIONS_WORKER_URL` を追加
13. [x] `src/store/notificationStore.ts` に Bluesky 通知フィールドを追加
14. [x] `src/services/notifications/pushToken.ts` を新規作成
15. [x] `src/hooks/useNotifications.ts` に Bluesky push 登録ロジックを追加
16. [x] `src/screens/NotificationSettingsScreen.tsx` を新規作成
17. [x] `src/screens/SettingsScreen.tsx` の通知セクションをリンクに置き換え
18. [x] `src/navigation/AppNavigator.tsx` にルートを追加
19. [x] `app.json` の `NSUserNotificationsUsageDescription` を更新
20. [x] `NOTIFICATIONS_WORKER_URL` を Railway デプロイ URL に更新

### Phase 3：プライバシー対応

21. [x] `doc/privacy-policy.md` 更新
22. [x] `doc/app-store/privacy-declaration.md` 更新
23. [x] GitHub Pages のプライバシーポリシー HTML 更新（`docs/privacy-policy.html`）

### Phase 4：テスト・リリース

24. [x] バックエンド単体テスト（Jetstream 接続・イベント処理・Push 送信）
25. [ ] アプリ実機テスト（通知許可フロー・受信確認）

    **事前準備**
    - テスト用Blueskyアカウントを用意（操作側）
    - Railwayダッシュボード → Deployments → View Logsを開いておく

    **A. 通知許可フロー**
    - [ ] A-1: アプリ起動 → 設定 → 通知設定を開く
    - [ ] A-2:「Bluesky通知を受け取る」スイッチをON → iOS許可ダイアログが出る
    - [ ] A-3:「許可」を選択 → スイッチがONのまま、サブ項目が展開される
    - [ ] A-4: Railwayログに`Registered user: did:plc:xxxxx`が出る
    - [ ] A-5: `/health`エンドポイントで`users`が1以上になっている

    **B. プッシュ通知の受信確認（テスト用アカウントで操作）**
    - [ ] B-1: 自分のポストに**いいね**する →「いいねされました」通知が届く
    - [ ] B-2: 自分のポストに**リプライ**する →「返信が届きました」通知が届く
    - [ ] B-3: 自分を**フォロー**する →「フォローされました」通知が届く
    - [ ] B-4: 自分のポストを**リポスト**する →「リポストされました」通知が届く
    - [ ] B-5: 自分のDIDを**メンション**する →「メンションされました」通知が届く

    **C. 設定変更の反映確認**
    - [ ] C-1:「いいね」スイッチをOFF → Railwayログに再登録ログ（notifyOnLike: false）が出る
    - [ ] C-2: テスト用アカウントからいいね → 通知が**来ない**
    - [ ] C-3:「いいね」スイッチをONに戻す → 再度いいねすると通知が届く

    **D. バックグラウンド受信確認**
    - [ ] D-1: アプリをバックグラウンドに移した状態でいいね → 通知バナーが届く
    - [ ] D-2: アプリを完全に終了した状態でいいね → 通知が届く

26. [ ] 通知を拒否した場合の動作確認（アプリが正常動作すること）
27. [ ] App Store Connect プライバシー申告更新
28. [ ] TestFlight 配信・動作確認

---

## 6. 工数見積もり

| フェーズ | 工数 | 状態 |
|---|---|---|
| Phase 1（バックエンド実装） | 7〜10h | **完了** |
| Phase 2（アプリ側） | 4〜5.5h | **完了** |
| Phase 3（プライバシー対応） | 1〜2h | **完了** |
| Phase 4（テスト・リリース） | 2〜3h | 進行中（24完了） |
| **合計** | **14〜20.5h** | |

---

## 7. 注意事項・既知の制限

- **Expo Push Token の失効**：アプリ再インストール時にトークンが変わる。EPNS からの `DeviceNotRegistered` エラー時に JSON から自動削除する処理を実装済み
- **Jetstream イベントの取りこぼし**：切断〜再接続の間（数秒）のイベントは取りこぼす。`cursor`（`time_us`）による再接続からの取得は未実装。個人アプリとして許容範囲と判断
- **Jetstream エンドポイントの変更リスク**：`jetstream2.us-east.bsky.network` は現時点での公式 URL。`src/jetstream.ts` の定数として管理し変更に備える
- **dev クライアント再ビルド不要**：`expo-notifications` は既導入済みのため、EAS ビルドの再実行は不要
- **Railway Free プランのスリープ**：Free プランは一定時間リクエストがないとスリープする可能性がある。Jetstream の WebSocket 接続が切れた場合の auto-reconnect で対応。スリープが問題になる場合は Hobby プラン（$5/月）に移行

---

## 8. スケールアップ計画

ユーザー数が増えた場合の移行パス：

| ユーザー数 | 対応 |
|---|---|
| 〜数十人 | Railway Free プランで対応 |
| 数十〜数百人 | Railway Hobby プラン（$5/月）に移行 |
| 数百人以上 | Firehose フル購読 + 専用サーバーへの移行を検討 |
