# GitHub更新チェック機能 実装計画

## ステータス

✅ **実装完了** (2026-03-01)

## 概要

アプリ起動時に GitHub API をポーリングし、以下の更新有無をチェックする。
更新があった場合は通知画面（BlueskyNotificationsScreen）の最上部にバナーとして表示し、
タップするとアプリ内モーダルでリリースノートや更新情報を確認できる。

- **アプリ更新チェック**: kumotan リポジトリの最新リリースと現在バージョンを比較
- **辞書更新チェック**: kumotan-Dictionary リポジトリの最新コミット SHA を前回と比較

## 方針

- バックエンド変更なし（起動時クライアントサイドポーリング）
- プッシュ通知なし（アプリを開いたときのみ確認）
- 設定トグルなし（常に有効・シンプル維持）
- アプリ外への遷移最小化（リリースノートはアプリ内モーダルで表示）
- 失敗しても起動を妨げない（fire-and-forget）

## 実装ファイル

| ファイル | 操作 | 概要 |
|---|---|---|
| `src/services/updates/githubUpdateChecker.ts` | 新規作成 | GitHub API ポーリングサービス |
| `src/store/notificationStore.ts` | 修正 | 更新状態フィールドを追加 |
| `src/constants/config.ts` | 修正 | APP_STORE_URL, GitHub URL 定数を追加 |
| `src/locales/ja/home.json` | 修正 | 日本語キー追加 |
| `src/locales/en/home.json` | 修正 | 英語キー追加 |
| `src/components/UpdateBanner.tsx` | 新規作成 | 通知画面のバナーUI |
| `src/components/UpdateNotesModal.tsx` | 新規作成 | リリースノート表示モーダル |
| `App.tsx` | 修正 | 起動時ポーリングを追加 |
| `src/screens/BlueskyNotificationsScreen.tsx` | 修正 | ListHeaderComponent にバナーを追加 |

## GitHub API

| 用途 | エンドポイント |
|---|---|
| アプリ最新リリース | `GET https://api.github.com/repos/RieTamura/kumotan/releases/latest` |
| 辞書最新コミット | `GET https://api.github.com/repos/RieTamura/kumotan-Dictionary/commits?per_page=1` |

- 認証不要（パブリックリポジトリ）
- レート制限: 未認証 60 req/h/IP（起動時1回のみのため問題なし）
- タイムアウト: 5 秒（AbortController）

## データフロー

```
App起動
  └─ initializeApp() 完了後
       └─ runUpdateChecks() [fire-and-forget]
            ├─ checkAppUpdate()
            │    → GitHub releases API
            │    → tag_name を semver 比較
            │    → 更新あり → store.setAppUpdate(version, notes, url)
            └─ checkDictionaryUpdate(lastKnownSha)
                 → GitHub commits API
                 → SHA を比較（初回は更新扱いにしない）
                 → 更新あり → store.setDictionaryUpdateAvailable(true, newSha)

通知画面を開く
  └─ BlueskyNotificationsScreen
       └─ FlatList の ListHeaderComponent
            └─ <UpdateBanner />
                 ├─ availableAppVersion が non-null → アプリ更新バナー
                 └─ dictionaryUpdateAvailable が true → 辞書更新バナー
                      └─ 「詳細」タップ → <UpdateNotesModal />
```

## UI 仕様

### UpdateBanner（通知画面ヘッダー）

```
┌──────────────────────────────────────────────────┐
│ 🔔 アプリ更新: v1.2.0 が利用可能   [詳細] [✕]   │
└──────────────────────────────────────────────────┘
┌──────────────────────────────────────────────────┐
│ 📖 辞書データが更新されました       [詳細] [✕]  │
└──────────────────────────────────────────────────┘
```

- 更新なしのときは何も描画しない（`null` を返す）
- テーマ対応（ライト/ダーク）
- ×ボタンでセッション内非表示（ストアの状態をクリア）

### UpdateNotesModal（アプリ内モーダル）

アプリ更新の場合:
```
┌────────────────────────────────────────┐
│  アプリ更新 v1.2.0                [✕] │
├────────────────────────────────────────┤
│  新機能                                │
│  - 〇〇機能を追加しました              │
│  - △△を改善しました                   │
│  （ScrollView でスクロール可）         │
├────────────────────────────────────────┤
│  [App Store で更新する]                │
└────────────────────────────────────────┘
```

辞書更新の場合:
```
┌────────────────────────────────────────┐
│  辞書データ更新                    [✕] │
├────────────────────────────────────────┤
│  最新のコミット:                       │
│  Add new vocabulary entries...         │
└────────────────────────────────────────┘
```

- リリースノートの Markdown は正規表現で軽くクリーニングしてプレーンテキスト表示
- 既存の FeedbackModal/TimePickerModal と同じ Modal パターンを使用

## ストア設計（notificationStore 追加フィールド）

```typescript
// アプリ更新情報
availableAppVersion: string | null;        // "1.2.0"、なければ null
availableAppReleaseNotes: string | null;   // リリースノート本文
availableAppReleaseUrl: string | null;     // GitHub release の html_url

// 辞書更新情報
dictionaryUpdateAvailable: boolean;
lastKnownDictionaryCommit: string | null;  // 前回チェック時の SHA（persist）
dictionaryLatestCommitMessage: string | null; // 最新コミットメッセージ

// セッター
setAppUpdate(version, notes, url): void
clearAppUpdate(): void
setDictionaryUpdateAvailable(available, sha, message): void
clearDictionaryUpdate(): void
```

`lastKnownDictionaryCommit` のみ persist（セッションをまたいで保持）。
その他の `available*` フィールドは persist しない（毎回起動時に再チェック）。

## 実装済みファイル

| ファイル | 内容 |
|---|---|
| `src/services/updates/githubUpdateChecker.ts` | GitHub API ポーリング・semver比較・Markdown除去 |
| `src/store/notificationStore.ts` | 更新状態フィールド追加（`partialize` で `lastKnownDictionaryCommit` のみ persist） |
| `src/constants/config.ts` | `GITHUB` 定数・`EXTERNAL_LINKS.APP_STORE` 追加（TODO: App Store URL 要差し替え） |
| `src/locales/ja/home.json` | `updates.*` キー追加 |
| `src/locales/en/home.json` | `updates.*` キー追加 |
| `src/components/UpdateBanner.tsx` | 通知画面ヘッダーバナー（更新なし時は null を返す） |
| `src/components/UpdateNotesModal.tsx` | アプリ内リリースノート表示モーダル |
| `App.tsx` | `runUpdateChecks()` を fire-and-forget で起動後に呼び出し |
| `src/screens/BlueskyNotificationsScreen.tsx` | `ListHeaderComponent={<UpdateBanner />}` を追加 |

## 検証方法

1. GitHub APIレスポンスをモックして`checkAppUpdate()`の動作確認（現バージョンより高いタグを返す）
2. `lastKnownDictionaryCommit`に古いSHAをセットして`checkDictionaryUpdate()`が`hasUpdate: true`を返すことを確認
3. アプリを起動し通知画面を開いてバナーが表示されること
4. 「詳細」タップでモーダルが開き、リリースノートが表示されること
5. ×ボタンでバナーが非表示になること
6. 再起動後、`lastKnownDictionaryCommit`がストアに永続化されていること

## TODO

- [ ] `EXTERNAL_LINKS.APP_STORE`をApp Store公開後に実際のURLへ差し替え（`src/constants/config.ts:120`）
