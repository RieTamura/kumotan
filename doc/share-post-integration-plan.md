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
画像添付時にはコンテンツ警告ラベル（selfLabel）も付与できるようにする。

#### 変更ファイル

| ファイル | 変更内容 |
|---|---|
| `package.json` | `expo-image-picker` を追加 |
| `app.json` | expo-image-picker プラグイン設定、カメラ権限文字列を追加 |
| `src/services/bluesky/feed.ts` | `PostImageAttachment` 型、`buildImageEmbed` 関数を追加。`createPost` に `embed`・`selfLabels` パラメータを追加 |
| `src/hooks/usePostCreation.ts` | `images`・`selfLabels` state、`addImage`/`removeImage`/`setSelfLabels` アクション、`submitPost` に画像アップロード・ラベル統合 |
| `src/components/PostCreationModal.tsx` | 画像ピッカーボタン（ツールバー）、画像プレビュー、削除UI、ラベルボタン（画像添付時のみ表示） |
| `src/components/ContentLabelModal.tsx` | コンテンツ警告ラベル選択モーダル（新規作成、`ReplySettingsModal` と同様のパターン） |
| `src/locales/ja/home.json` | 画像・ラベル関連の翻訳キー追加 |
| `src/locales/en/home.json` | 画像・ラベル関連の翻訳キー追加 |

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
   - `createPost` に第3引数 `embed?: Record<string, unknown>`、第4引数 `selfLabels?: string[]` を追加
     - `postRecord` 構築時に `embed` があれば含める
     - `selfLabels` が指定された場合、`com.atproto.label.defs#selfLabels` を `postRecord.labels` に設定
     - 既存呼び出し元は影響なし

3. **usePostCreation.ts — Hook の拡張**
   - `PostCreationState` に `images: PostImageAttachment[]`、`selfLabels: string[]` を追加
   - `addImage(image)` — MAX_IMAGES(4) チェック付き
   - `removeImage(index)` — インデックス指定で削除
   - `canAddImage` — `images.length < 4`のcomputed値
   - `setSelfLabels(labels: string[])` — ラベル配列の設定
   - `submitPost`変更：`images.length > 0`なら`buildImageEmbed()` → `createPost(text, settings, embed, selfLabels)`
   - 画像がすべて削除された場合、`selfLabels`も自動リセット
   - `UsePostCreationReturn` に `images`, `canAddImage`, `addImage`, `removeImage`, `selfLabels`, `setSelfLabels` を追加

4. **PostCreationModal.tsx — UI**
   - import追加：`Image`, `ActionSheetIOS`(react-native), `expo-image-picker`, `ImagePlus`, `Tag`(lucide)
   - ツールバーにリプライ設定ボタンの右に `ImagePlus` アイコンボタン追加
   - タップ時：ActionSheetIOS（iOS）/ Alert（Android）で「ギャラリー/カメラ」選択
   - `ImagePicker.launchImageLibraryAsync` / `launchCameraAsync` を呼ぶ
   - オプション：`quality: 0.8`, `mediaTypes: ['images']`, `exif: false`
   - テキスト入力の下に水平ScrollViewで80×80サムネイルプレビュー表示
   - 各サムネイルにXボタン（削除）オーバーレイ
   - 画像カウント表示（例：`2/4`）
   - 画像が1枚以上添付されている場合のみ、ツールバーに `Tag` アイコンの「ラベル」ボタンを表示
   - タップで `ContentLabelModal` を開く

5. **ContentLabelModal.tsx — コンテンツ警告ラベル選択モーダル（新規）**
   - `ReplySettingsModal`と同じパターン（ボトムシートモーダル）で実装
   - props：`visible`, `labels: string[]`, `onSave: (labels: string[]) => void`, `onClose`
   - チェックボックス4つ：
     - `sexual`：きわどい / Suggestive
     - `nudity`：ヌード / Nudity
     - `porn`：成人向け（ポルノ等）/ Adult Content（Pornography）
     - `graphic-media`：生々しいメディア（グロ・事故・戦争・災害等）/ Graphic Media
   - 「成人向けコンテンツ」「その他」のセクション分け（Bluesky公式UIに準拠）
   - 「完了」ボタンで保存して閉じる

6. **i18n 翻訳キー追加**
   - 画像関連：
     - `imageSelectSource`：画像の追加 / Add Image
     - `imageFromGallery`：フォトライブラリから選択 / Choose from Library
     - `imageFromCamera`：カメラで撮影 / Take Photo
     - `imageCancel`：キャンセル / Cancel
     - `imagePermissionTitle`：アクセス許可が必要です / Permission Required
     - `imageGalleryPermissionMessage` / `imageCameraPermissionMessage`
   - ラベル関連：
     - `contentLabel`：コンテンツの警告を追加 / Add content warning
     - `contentLabelDone`：完了 / Done
     - `contentLabelAdult`：成人向けコンテンツ / Adult Content
     - `contentLabelOther`：その他 / Other
     - `contentLabelSexual`：きわどい / Suggestive
     - `contentLabelNudity`：ヌード / Nudity
     - `contentLabelPorn`：成人向け（ポルノ等）/ Adult Content（Pornography）
     - `contentLabelGraphicMedia`：生々しいメディア（グロ・事故・戦争・災害等）/ Graphic Media

#### 設計判断

| 判断 | 選択 | 理由 |
|---|---|---|
| 画像アップロード関数の配置 | `feed.ts` に新規 `buildImageEmbed` | `getAgent()` / `rateLimiter` / `Result` パターンを `createPost` と統一 |
| `session.ts` の `uploadImageToBluesky` 再利用 | しない | インターフェースが異なる（base64 vs URI、agent 直接渡し vs getAgent()、throw vs Result） |
| alt テキスト | 空文字（将来 UI 追加可能） | Hook に `updateImageAlt` は用意するが UI は将来対応 |
| テキスト必須維持 | はい | 既存動作と一貫性 |
| 圧縮戦略 | ImagePicker の `quality: 0.8` | 1MB 以下に収まる場合が多い。超過時はエラー表示 |
| アクションシート | iOS: ActionSheetIOS / Android: Alert | ネイティブ体験、追加依存なし |
| ラベルボタンの表示条件 | 画像が1枚以上添付されている場合のみ | テキストのみ投稿では不要。UXへの影響を最小限に |
| ラベルモーダルの構造 | `ReplySettingsModal`と同じボトムシートパターン | 既存パターンの再利用で実装コスト・保守コストを低減 |
| ラベルの自動リセット | 画像をすべて削除した場合にリセット | 画像なしでラベルだけ残る不整合を防止 |

#### 実施状況

**ステータス: 完了（2026-02-11）**

すべての手順を実施済み。TypeScript 型チェックもエラーなし。

| 手順 | ステータス | 備考 |
|---|---|---|
| expo-image-picker インストール | 完了 | app.json にプラグイン設定・カメラ権限も追加 |
| feed.ts サービス層拡張 | 完了 | `PostImageAttachment`型、`buildImageEmbed`関数、`createPost`にembed+selfLabels追加 |
| usePostCreation Hook 拡張 | 完了 | images/selfLabels state、addImage/removeImage/setSelfLabels アクション |
| PostCreationModal UI | 完了 | ImagePlus/Tagツールバーボタン、画像プレビュー、ActionSheet |
| ContentLabelModal 新規作成 | 完了 | ReplySettingsModalパターン準拠、4種類のラベル対応 |
| i18n 翻訳キー追加 | 完了 | 画像関連7キー + ラベル関連8キー（ja/en） |
| TypeScript 型チェック | 完了 | エラーなし |

---

### フェーズC: フィードのコンテンツラベル対応（モデレーション表示）

フェーズBで投稿時のラベル付与（作成側）を実装した。フェーズCでは閲覧側のラベル対応を行い、ラベル付き投稿の画像を適切にぼかし表示する。

#### 背景

Bluesky公式アプリではコンテンツラベル付き投稿の画像が非表示（ぼかし＋警告表示）になるが、kumotanアプリでは画像がそのまま表示されてしまう。原因は以下の3点が未実装であること：
1. `TimelinePost` 型にラベルフィールドがない
2. フィード取得時にAPIレスポンスからラベルを抽出していない
3. PostCard でラベルに基づく表示制御がない

#### アプローチ

**実用的な中間案（アプローチC）** を採用する。

| 比較軸 | A: 最小実装 | **C: 中間案（採用）** | B: 公式モデレーションAPI |
|---|---|---|---|
| 工数 | 1-2時間 | **3-5時間** | 2-4日 |
| 変更ファイル | 3 | **3** | 8+ |
| 追加行数 | ~50-60 | **~80-100** | 300+ |
| セルフラベル | 対応 | **対応** | 対応 |
| サービスラベル | 非対応 | **対応** | 対応 |
| ユーザー設定 | なし | **なし（一律ぼかし）** | あり |
| 将来のBへの移行 | 容易 | **容易** | — |

Aではなく C を選択する理由：変更ファイル数は同じだが、`post.labels` を丸ごと抽出することでセルフラベル・サービスラベル両方に対応でき、実用性が大幅に向上する。ユーザー設定（表示/警告/非表示の切り替え）は将来フェーズBへの段階的移行時に追加する。

#### 変更ファイル

| ファイル | 変更内容 |
|---|---|
| `src/types/bluesky.ts` | `TimelinePost` に `labels` フィールドを追加 |
| `src/services/bluesky/feed.ts` | `getTimeline()` と `getAuthorFeed()` でAPIレスポンスからラベルを抽出 |
| `src/components/PostCard.tsx` | ラベル付き画像にぼかしオーバーレイ＋「タップで表示」UI を追加 |

#### 詳細手順

1. **TimelinePost 型にラベルフィールド追加**
   - `src/types/bluesky.ts` の `TimelinePost` に `labels?: Array<{ val: string }>` を追加
   - Bluesky APIの `PostView.labels` は `Array<{ val: string; src?: string; uri?: string; ... }>` だが、表示判定には `val` のみ必要

2. **フィード取得時のラベル抽出**
   - `src/services/bluesky/feed.ts` の `getTimeline()` マッピング処理（L166-L233）で `item.post.labels` を抽出
   - `getAuthorFeed()` のマッピング処理（L759-L826）でも同様に抽出
   - 抽出ロジック：
     ```typescript
     const rawLabels = item.post.labels as Array<{ val: string }> | undefined;
     const labels = rawLabels && rawLabels.length > 0
       ? rawLabels.map((l) => ({ val: l.val }))
       : undefined;
     ```
   - return オブジェクトに `labels` を追加

3. **PostCard にぼかし表示UI追加**
   - 対象ラベル定数を定義：`NSFW_LABELS = ['sexual', 'nudity', 'porn', 'graphic-media']`
   - ヘルパー関数：`hasNsfwLabel(labels)` — 投稿のラベルにNSFWラベルが含まれるか判定
   - `renderImages()` 内で、NSFWラベルがある場合にぼかしオーバーレイを表示：
     - 画像の上に半透明オーバーレイ（`backgroundColor: 'rgba(0,0,0,0.85)'`）
     - 警告アイコン（`AlertTriangle` from lucide-react-native）
     - 警告テキスト（「コンテンツの警告」）
     - 「タップして表示」テキスト
   - `useState` で `showNsfwContent` を管理（デフォルト: `false`）
   - タップでオーバーレイを解除して画像を表示
   - 再度隠す機能は不要（Bluesky公式アプリと同じ挙動）

#### 設計判断

| 判断 | 選択 | 理由 |
|---|---|---|
| ラベルデータの保持 | `val` のみ抽出 | 表示判定には `val` で十分。`src`（ラベル発行元）等は将来必要になった時点で追加 |
| 対象ラベル | `sexual`, `nudity`, `porn`, `graphic-media` | Bluesky公式のコンテンツ警告ラベル4種。フェーズBで投稿時に付与可能なものと一致 |
| ぼかし方式 | 不透明オーバーレイ | React Native標準のViewで実装可能。`blurRadius`はプラットフォーム差異があるため不採用 |
| ユーザー設定 | なし（一律ぼかし） | MVP段階では安全側に倒す。将来設定画面から制御可能にする拡張ポイントは意識 |
| タップ状態の管理 | PostCard内の`useState` | 投稿単位で独立管理。フィードスクロールで再マウント時にリセットされる（安全側） |
| 外部リンクのサムネイル | 対象外 | 画像embed のみ対応。外部リンクのサムネイルはラベル対象外（Bluesky公式と同じ） |

#### 実施状況

**ステータス: 未着手**

| 手順 | ステータス | 備考 |
|---|---|---|
| TimelinePost 型にラベル追加 | 未着手 | |
| getTimeline / getAuthorFeed でラベル抽出 | 未着手 | |
| PostCard にぼかしUI追加 | 未着手 | |
| TypeScript 型チェック | 未着手 | |
| 実機テスト（ラベル付き投稿の表示確認） | 未着手 | |

---

## リスク

| リスク | 対策 |
|---|---|
| シェアカード画像が投稿できなくなる | フェーズBで対応。テキスト投稿だけでも十分機能する |
| PDS学習セッションレコードが作成されなくなる | `shareTodaysSession` は進捗シェア専用機能。必要であれば PostCreationModal の `onPostSuccess` コールバック内で別途呼び出す |
| HomeScreen 側の PostCreationModal 動作への影響 | `initialText` はオプショナル。未指定時は従来通り空文字で動作 |
