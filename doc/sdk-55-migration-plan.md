# Expo SDK 55 移行計画

作成日: 2026-03-01
対象バージョン: SDK 54 → SDK 55
参考: https://expo.dev/changelog/sdk-55

---

## 調査結果サマリー

SDK 55の破壊的変更のうち、**このアプリに実際に影響するのは1件のみ**。その他の変更は未使用パッケージ・未使用APIのため対応不要。

---

## 対応タスク

### ✅ 優先度: 高（Breaking Change）

#### 1. `newArchEnabled: false` を app.json から削除

- **ファイル**: `app.json` L37
- **理由**: SDK 55でLegacy Architectureのサポートが完全廃止。`newArchEnabled` オプション自体が削除された。`false`のままだとビルドエラーになる可能性がある。
- **変更内容**: `"newArchEnabled": false` を削除する

---

### ℹ️ 調査した結果、対応不要と判断した項目

| 変更内容 | 判断理由 |
|---|---|
| `removeSubscription` 廃止 → `subscription.remove()` | `expo-notifications` リスナー登録を行っていない（`useNotifications.ts`はスケジュール通知API等のみ使用） |
| `expo-status-bar` プロップ廃止 | `expo-status-bar` をAPIとしてimportしている箇所なし（`LicenseScreen.tsx`で文字列として記載のみ） |
| app.json の `notification` フィールド削除 | app.jsonに `notification` トップレベルフィールドは存在しない |
| `edgeToEdgeEnabled` 削除 | app.jsonに設定なし |
| `expo-av` 削除 | 未使用 |
| `expo-navigation-bar` 廃止 | 未使用 |
| `expo-clipboard` の `content` プロパティ削除 | `setStringAsync` のみ使用 |

---

### ⚠️ SDK 55移行後に要確認（破壊的変更ではないが注意）

#### 2. React Native 0.83 & React 19.2 対応

SDK 55ではReact 19.2とReact Native 0.83にアップグレードされる。メジャーバージョンアップのため、移行後に以下を確認する。

- `useEffect` / `useLayoutEffect` の動作変化（React 19でStrict Modeの挙動が変わる）
- 型定義の変更（TypeScriptエラーが出る可能性）
- `react-native-reanimated` などサードパーティライブラリのReact 19対応状況

#### 3. expo-file-system/legacy の継続利用確認

- 現在 `expo-file-system/legacy` を3ファイルで使用中（`feed.ts`, `linkPreview.ts`, `imageCompression.ts`）
- SDK 54時点で `readAsStringAsync` は `/legacy` 経由を推奨されていた
- SDK 55マイグレーションガイドで新API（`expo-file-system` v2）への移行が求められる場合は別途対応

#### 4. Node.js バージョン要件の変更

SDK 55から最小Node.jsバージョンがLTS版のみに変更。

| 対応バージョン |
|---|
| 20.19.4+ |
| 22.13.0+ |
| 24.3.0+ |

開発環境・CI環境のNode.jsバージョンを確認する。

#### 5. `eas update --environment` フラグ必須化

OTAアップデートを使用している場合、EASコマンドに `--environment` フラグが必要になった。
CIスクリプトや手動runbook等がある場合は更新する。

#### 6. Hermes v1 オプトイン（任意・パフォーマンス改善）

Hermes v1を有効にするとOTAアップデートのダウンロードサイズが約75%削減される見込み。
app.jsonの `"hermes"` 設定で有効化可能（オプトイン）。

---

## 実装ステップ

```
1. app.json から "newArchEnabled": false を削除
2. npm install / bun install で SDK 55 パッケージ更新
3. TypeScript型チェック (tsc --noEmit) でエラーがないことを確認
4. ローカルビルド (expo start) で動作確認
5. 実機ビルド (eas build) でネイティブ動作確認
6. Node.js バージョン・CIスクリプト確認
```

---

## 完了チェックリスト

- [ ] `app.json` から `newArchEnabled` 削除
- [ ] SDK 55 パッケージ更新 (`expo upgrade`)
- [ ] TypeScript エラーなし
- [ ] ローカル動作確認
- [ ] 実機ビルド確認
- [ ] Node.js バージョン確認
- [ ] CIスクリプト（`eas update` コマンド）確認
