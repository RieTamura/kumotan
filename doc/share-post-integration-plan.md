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

### フェーズB: 画像添付機能（将来タスク）

PostCreationModal に汎用的な画像添付機能を追加する。ホーム画面の通常投稿からも使えるようにする。

- 画像選択 / キャプチャ UI
- Bluesky への画像アップロード（`uploadImageToBluesky` 再利用）
- `app.bsky.embed.images` embed 生成
- 画像プレビュー / 削除 UI

## リスク

| リスク | 対策 |
|---|---|
| シェアカード画像が投稿できなくなる | フェーズBで対応。テキスト投稿だけでも十分機能する |
| PDS学習セッションレコードが作成されなくなる | `shareTodaysSession` は進捗シェア専用機能。必要であれば PostCreationModal の `onPostSuccess` コールバック内で別途呼び出す |
| HomeScreen 側の PostCreationModal 動作への影響 | `initialText` はオプショナル。未指定時は従来通り空文字で動作 |
