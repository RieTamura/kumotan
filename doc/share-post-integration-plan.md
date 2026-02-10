# 進捗シェア → PostCreationModal 統合計画

## 背景

進捗画面のシェアモーダルは、投稿テキスト編集時にキーボードがボタンを隠すUIの問題がある。
ホーム画面の `PostCreationModal` はこの問題を解決済み（投稿ボタンがヘッダー上部、`KeyboardAvoidingView` 対応）のため、これを再利用して統合する。

## フェーズ

### フェーズA: テキスト投稿の統合（本タスク）

PostCreationModal を ProgressScreen から呼び出せるようにし、シェアテキストをプリフィルする。

#### 変更ファイル

| ファイル | 変更内容 |
|---|---|
| `src/hooks/usePostCreation.ts` | `initialText` パラメータ対応を追加 |
| `src/components/PostCreationModal.tsx` | `initialText` prop を追加し、hook に渡す |
| `src/screens/ProgressScreen.tsx` | カスタムシェアモーダルを `PostCreationModal` に差し替え。不要なロジック・スタイルを削除 |

#### 詳細手順

1. **usePostCreation に initialText 対応**
   - `usePostCreation(initialText?: string)` に引数追加
   - `initialText` が変更された際に `text` を設定する `useEffect` を追加

2. **PostCreationModal に initialText prop 追加**
   - props に `initialText?: string` を追加
   - `usePostCreation(initialText)` に渡す

3. **ProgressScreen のモーダル差し替え**
   - `PostCreationModal` を import
   - シェアアイコンタップ時: デフォルトテキスト（`t('share.text', { count })` ）を生成し、`PostCreationModal` を表示
   - 以下を削除:
     - `isCapturing` state
     - `shareText` state
     - `captureAndShare` 関数
     - `handleShareToBluesky` 関数
     - `shareToBlueskyWithImage` / `shareTodaysSession` の呼び出し
     - カスタムモーダルの JSX（L627-L744）
     - 関連スタイル（`shareTextContainer`, `shareText`, `shareTextCopyButton`, `shareCard*`, `modalButton*` 等）
     - 不要な import（`ViewShot`, `captureRef`, `Sharing`, `Clipboard`, `Copy`, `Image`）

#### 削除対象（ProgressScreen）

- **State**: `isCapturing`, `shareText`
- **Ref**: `shareCardRef`
- **関数**: `captureAndShare`, `handleShareToBluesky`
- **Import**: `ViewShot`, `captureRef`, `expo-sharing`, `expo-clipboard`, `Copy`, `Image`
- **Import (services)**: `shareToBlueskyWithImage`, `shareTodaysSession`
- **JSX**: カスタムシェアモーダル全体
- **Styles**: モーダル関連、シェアカード関連、ボタン関連

#### 実施状況

**ステータス: 完了（2026-02-10）**

すべての手順を実施済み。TypeScript 型チェックもエラーなし。

| 手順 | ステータス | 備考 |
|---|---|---|
| usePostCreation に initialText 対応 | 完了 | `useEffect` で `initialText` 変更時に `text` を設定 |
| PostCreationModal に initialText prop 追加 | 完了 | `usePostCreation(initialText)` に渡す |
| ProgressScreen モーダル差し替え | 完了 | `PostCreationModal` を使用 |
| 不要コード削除 | 完了 | import約10個、関数2個、JSX約130行、スタイル約120行を削除 |
| TypeScript 型チェック | 完了 | エラーなし |

#### 削除されたもの（ProgressScreen）

- **Import**: `TextInput`, `Modal`, `Image`, `ViewShot`, `captureRef`, `expo-sharing`, `expo-clipboard`, `Copy`, `useAuthStore`, `shareToBlueskyWithImage`, `shareTodaysSession`, `getAgent`, `ImageAspectRatio`
- **State/Ref**: `shareCardRef`, `isCapturing`, `shareText`
- **関数**: `captureAndShare`, `handleShareToBluesky`
- **JSX**: カスタムシェアモーダル全体
- **Styles**: `modalOverlay`, `modalContent`, `modalTitle`, `shareTextContainer`, `shareText`, `shareTextCopyButton`, `shareCard*`（10個）, `modalButtons`, `modalButton*`（5個）

---

### フェーズB: 画像添付機能

PostCreationModal に汎用的な画像添付機能を追加する。ホーム画面の通常投稿からも使えるようにする。

#### 変更ファイル

| ファイル | 変更内容 |
|---|---|
| `package.json` | `expo-image-picker` を追加 |
| `app.json` | expo-image-picker プラグイン設定、カメラ権限文字列を追加 |
| `src/services/bluesky/feed.ts` | `PostImageAttachment` 型、`buildImageEmbed` 関数を追加。`createPost` に `embed` パラメータを追加 |
| `src/hooks/usePostCreation.ts` | `images` state、`addImage`/`removeImage` アクション、`submitPost` に画像アップロード統合 |
| `src/components/PostCreationModal.tsx` | 画像ピッカーボタン（ツールバー）、画像プレビュー、削除UI |
| `src/locales/ja/home.json` | 画像関連の翻訳キー追加 |
| `src/locales/en/home.json` | 画像関連の翻訳キー追加 |

#### 詳細手順

1. **expo-image-picker インストール**
   - `npx expo install expo-image-picker`
   - `app.json` の `plugins` 配列に `expo-image-picker` を追加（権限文字列付き）
   - `ios.infoPlist` に `NSCameraUsageDescription` を追加

2. **feed.ts — サービス層の拡張**
   - `PostImageAttachment` 型を追加（`uri`, `mimeType`, `width`, `height`, `alt`）
   - `buildImageEmbed(images: PostImageAttachment[])` 関数を追加
     - `expo-file-system`で各画像をbase64として読み取り → `Uint8Array`変換 → `agent.uploadBlob()`へアップロード
     - 1MB 超過チェック、最大4枚チェック
     - `app.bsky.embed.images`embedオブジェクトを返す
     - `getAgent()` / `rateLimiter` / `Result` パターンを既存 `createPost` と統一
   - `createPost` に第3引数 `embed?: Record<string, unknown>` を追加
     - `postRecord` 構築時に `embed` があれば含める。既存呼び出し元は影響なし

3. **usePostCreation.ts — Hook の拡張**
   - `PostCreationState` に `images: PostImageAttachment[]` を追加
   - `addImage(image)` — MAX_IMAGES(4) チェック付き
   - `removeImage(index)` — インデックス指定で削除
   - `canAddImage` — `images.length < 4`のcomputed値
   - `submitPost`変更：`images.length > 0`なら`buildImageEmbed()` → `createPost(text, settings, embed)`
   - `UsePostCreationReturn` に `images`, `canAddImage`, `addImage`, `removeImage` を追加

4. **PostCreationModal.tsx — UI**
   - import追加：`Image`, `ActionSheetIOS`(react-native), `expo-image-picker`, `ImagePlus`(lucide)
   - ツールバーにリプライ設定ボタンの右に `ImagePlus` アイコンボタン追加
   - タップ時：ActionSheetIOS（iOS）/ Alert（Android）で「ギャラリー/カメラ」選択
   - `ImagePicker.launchImageLibraryAsync` / `launchCameraAsync` を呼ぶ
   - オプション：`quality: 0.8`, `mediaTypes: ['images']`, `exif: false`
   - テキスト入力の下に水平ScrollViewで80×80サムネイルプレビュー表示
   - 各サムネイルにXボタン（削除）オーバーレイ
   - 画像カウント表示（例：`2/4`）

5. **i18n 翻訳キー追加**
   - `imageSelectSource`：画像の追加 / Add Image
   - `imageFromGallery`：フォトライブラリから選択 / Choose from Library
   - `imageFromCamera`：カメラで撮影 / Take Photo
   - `imageCancel`：キャンセル / Cancel
   - `imagePermissionTitle`：アクセス許可が必要です / Permission Required
   - `imageGalleryPermissionMessage` / `imageCameraPermissionMessage`

#### 設計判断

| 判断 | 選択 | 理由 |
|---|---|---|
| 画像アップロード関数の配置 | `feed.ts` に新規 `buildImageEmbed` | `getAgent()` / `rateLimiter` / `Result` パターンを `createPost` と統一 |
| `session.ts` の `uploadImageToBluesky` 再利用 | しない | インターフェースが異なる（base64 vs URI、agent 直接渡し vs getAgent()、throw vs Result） |
| alt テキスト | 空文字（将来 UI 追加可能） | Hook に `updateImageAlt` は用意するが UI は将来対応 |
| テキスト必須維持 | はい | 既存動作と一貫性 |
| 圧縮戦略 | ImagePicker の `quality: 0.8` | 1MB 以下に収まる場合が多い。超過時はエラー表示 |
| アクションシート | iOS: ActionSheetIOS / Android: Alert | ネイティブ体験、追加依存なし |

#### 実施状況

**ステータス: 未着手**

| 手順 | ステータス | 備考 |
|---|---|---|
| expo-image-picker インストール | 未着手 | |
| feed.ts サービス層拡張 | 未着手 | |
| usePostCreation Hook 拡張 | 未着手 | |
| PostCreationModal UI | 未着手 | |
| i18n 翻訳キー追加 | 未着手 | |
| TypeScript 型チェック | 未着手 | |

## リスク

| リスク | 対策 |
|---|---|
| シェアカード画像が投稿できなくなる | フェーズBで対応。テキスト投稿だけでも十分機能する |
| PDS学習セッションレコードが作成されなくなる | `shareTodaysSession` は進捗シェア専用機能。必要であれば PostCreationModal の `onPostSuccess` コールバック内で別途呼び出す |
| HomeScreen 側の PostCreationModal 動作への影響 | `initialText` はオプショナル。未指定時は従来通り空文字で動作 |
