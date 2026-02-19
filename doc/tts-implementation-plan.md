# 音声読み上げ（Text-to-Speech）実装計画 ✅ 完了 (2026-02-19)

## 概要

英語単語・文章の音声読み上げ機能を追加する。
デバイス内蔵TTSエンジン（`expo-speech`）を使用し、外部API不要・完全オフラインで動作する。

## 対象コンポーネント

| 箇所 | ファイル | 読み上げ内容 |
|---|---|---|
| WordPopup ヘッダー | `src/components/WordPopup.tsx` | 単語 or 文章（言語自動判定） |
| WordListItem 展開時 | `src/components/WordListItem.tsx` | 登録済み英語単語 |

## アーキテクチャ

```
src/hooks/useSpeech.ts   ← TTSロジックをカプセル化（新規作成）
WordPopup.tsx            ← スピーカーボタンをヘッダーに追加
WordListItem.tsx         ← スピーカーボタンを展開時に追加
```

### useSpeech フック API

```typescript
const { speak, stop, isSpeaking } = useSpeech();

speak(text: string, options?: { language?: string; rate?: number });
stop();
isSpeaking: boolean;
```

- コンポーネントアンマウント時に自動 `stop()`（useEffect クリーンアップ）
- `onStart` / `onDone` / `onStopped` / `onError` コールバックで `isSpeaking` を管理

## 言語設定

| 状況 | 言語コード |
|---|---|
| 英語単語・文章 | `en-US` |
| 日本語単語・文章（`isJapanese === true`） | `ja-JP` |

`WordPopup` に既存の `isJapanese` フラグを流用する。

## UI設計

### WordPopup ヘッダー
- `Volume2`（再生中）/ `VolumeX`（停止中）アイコンを既存フィードバックボタン横に配置
- タップで読み上げ開始/停止をトグル
- ポップアップ閉鎖時（`visible === false`）に自動停止

### WordListItem
- 展開時の英語テキスト横に `Volume2` アイコンボタンを配置
- 常に英語（`en-US`）で読み上げ

## 依存パッケージ

```
expo-speech  （Expo SDK 54 対応版）
```

- `expo-speech` はネイティブモジュール（`ExpoSpeech`）を含むため、**EASビルドの再ビルドが必要**
  - 実機：`eas build --profile production-dev --platform ios`
  - シミュレータ：`eas build --profile development --platform ios`
- `lucide-react-native` の `Volume2` / `VolumeX` アイコンを使用（既にインストール済み）

## 実装ステップ

1. `expo-speech` インストール
2. `src/hooks/useSpeech.ts` 作成
3. `WordPopup.tsx` にスピーカーボタン追加
4. `WordListItem.tsx` にスピーカーボタン追加

## 既知の制限

- 音声品質はデバイスのTTSエンジン依存（iOS > Android の傾向）
- 文章モードで文章全体を読み上げるため、長文は時間がかかる場合がある
- `isSentenceMode` 時は文章全体（`word` prop）を読み上げる（個別単語は対象外）
