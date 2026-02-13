# App Store リリースチェックリスト

## 優先度高

### 1. `NSAllowsArbitraryLoads: true` の削除
- **ファイル**: `app.json` (L23)
- **問題**: すべてのHTTP通信を許可する設定が有効になっている
- **リスク**: App Store審査でリジェクトされる可能性が高い
- **対応**: すべてのAPIがHTTPS通信のため、この設定を削除する
- [ ] `NSAllowsArbitraryLoads` を `infoPlist` から削除

### 2. App Storeスクリーンショットの準備
- **参照**: `doc/app-store/release-info.md` (L113〜)
- **問題**: シーン案はあるが、実際のスクリーンショット画像が未作成
- **対応**: App Store Connectへの提出に必要なスクリーンショットを作成する
- [ ] 6.7インチ（iPhone 15 Pro Max等）用スクリーンショット
- [ ] 6.1インチ（iPhone 15 Pro等）用スクリーンショット
- [ ] 最低3枚、推奨5〜6枚（以下のシーン案を参考）
  1. ホーム画面（タイムライン表示）
  2. 単語選択（WordPopupモーダル表示中）
  3. 単語帳画面（保存済み単語一覧）
  4. 進捗画面（カレンダー・統計）
  5. スレッド表示
  6. 設定画面

### 3. プライバシーポリシーのWebホスティング確認
- **URL**: `https://rietamura.github.io/kumotan/privacy-policy.html`
- **問題**: App Store Connectに設定するURLが審査時にアクセス可能である必要がある
- [ ] 上記URLでプライバシーポリシーがホスティングされているか確認
- [ ] 利用規約も同様にWebでアクセス可能か確認
- [ ] 未ホスティングの場合、GitHub Pagesにデプロイする

---

## 優先度中

### 4. console.log の整理
- **現状**: 本番コード全体で229箇所の `console.log/warn/error`（38ファイル）
- **多いファイル**:
  - `src/services/auth/oauth-client.ts`（29箇所）
  - `src/services/bluesky/feed.ts`（21箇所）
  - `src/services/bluesky/auth.ts`（19箇所）
  - `src/services/auth/crypto-implementation.ts`（15箇所）
- **対応**:
  - [ ] `__DEV__` ガードなしの `console.log/warn/error` を洗い出す
  - [ ] 不要なログを削除、または `__DEV__` ガードで囲む
  - [ ] 認証・暗号化関連のログは特にセキュリティ上のリスクがあるため優先的に対応

### 5. スキップされたテストの修正
- **ファイル**: `src/services/dictionary/__tests__/freeDictionary.test.ts` (L315)
- **問題**: `it.skip('should process words in batches of 5')` がスキップされている
- **原因**: Promise.allのタイミング問題
- [ ] テストを修正して全テストがパスする状態にする
- [ ] `npm test` で全テストがグリーンであることを確認

### 6. App Storeプライバシー情報の準備
- **問題**: App Store Connectの「App Privacy」セクションで申告が必要
- **対応**: 以下のデータ収集について申告内容を整理する
  - [ ] Blueskyアカウント情報（認証目的）
  - [ ] フィードバック送信データ（Google Apps Script経由）
  - [ ] 外部API通信先の整理（DeepL、Yahoo! JAPAN、Free Dictionary API）
  - [ ] 「アナリティクス・トラッキング不使用」の申告

---

## 優先度低

### 7. エラー監視の検討
- **現状**: Sentry等のクラッシュ報告ツール未導入（プライバシー方針として意図的）
- **代替**: ローカルログ（`src/utils/logger.ts`）は存在するが、ユーザーが明示的にシェアしない限り把握不可
- [ ] リリース後のバグ発見方法を決定（現状のフィードバック機能で十分か検討）

### 8. `APP_INFO.VERSION` の二重管理解消
- **ファイル**: `src/constants/config.ts` (L94) と `app.json` (L5)
- **問題**: バージョン番号が2箇所にハードコードされている
- [ ] `expo-constants` から動的に取得する仕組みに変更を検討

### 9. 審査用テストアカウントの準備
- **参照**: `doc/app-store/release-info.md` (L140〜)
- **対応**: Apple審査チームがすぐにテストできる環境を準備する
- [ ] 専用テスト用Blueskyアカウントを作成
- [ ] 審査メモにログイン手順とクレデンシャルを記載
- [ ] DeepL APIキーなしでも基本機能が動作することを審査メモに明記

---

## リリース前最終確認

- [ ] `npm test` で全テストパス
- [ ] `npm run type-check` でTypeScriptエラーなし
- [ ] `npm run lint` でESLintエラーなし
- [ ] 実機（TestFlight）での最終動作確認
- [ ] `eas build --profile production --platform ios` でビルド成功
- [ ] `eas submit --platform ios` でApp Store Connectへ提出
- [ ] App Store Connectで全メタデータ入力完了（スクリーンショット、説明文、プライバシー情報）
- [ ] 審査提出
