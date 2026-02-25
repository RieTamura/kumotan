# 自動音声読み上げ設定 実装計画

## ステータス

### ✅ 実装完了（2026-02-25）

| ステップ | ファイル | 状態 |
| --- | --- | --- |
| 1 | `src/store/settingsStore.ts` | ✅ 完了 |
| 2 | `src/locales/ja/settings.json` | ✅ 完了 |
| 2 | `src/locales/en/settings.json` | ✅ 完了 |
| 3 | `src/screens/SettingsScreen.tsx` | ✅ 完了 |
| 4 | `src/components/WordPopup.tsx` | ✅ 完了 |
| 5 | `src/screens/QuizScreen.tsx` | ✅ 完了 |

### 実装上の差分（計画との相違点）

- **WordPopup.tsx**: `isJapanese` state は非同期で設定されるため、`useEffect` 内では `Validators.isJapanese(word)` を直接呼び出す方式に変更した（計画では state 参照）。
- **QuizScreen.tsx**: `questionText` スタイルに `flex: 1` を追加し、`questionRow`（横並び）・`speakButton` スタイルを新設して手動ボタンを配置した。
- 再ビルド不要。Development Build のホットリロードで動作確認可能。

---

## 概要

単語ポップアップ表示時・クイズ出題時に自動で音声読み上げを行う機能を追加する。
設定画面でオン/オフを切り替えられるようにし、クイズ画面では手動読み上げボタンも提供する。

既存の `useSpeech` フック・`settingsStore` の仕組みを活用するため、追加実装量は最小限。

---

## 機能要件

| 機能 | 詳細 |
|------|------|
| 単語ポップアップ自動読み上げ | ポップアップが開いたとき、表示された単語を自動で読み上げる |
| クイズ自動読み上げ | 問題が表示されたとき（問題切り替え時）、問題文を自動で読み上げる |
| クイズ手動読み上げ | クイズ画面の問題カードに Volume2 ボタンを常時表示し、タップで読み上げ |
| 設定オン/オフ | 上記2つを個別にオン/オフできるトグルを設定画面に追加 |

---

## アーキテクチャ

```
settingsStore.ts          ← autoSpeechOnPopup / autoSpeechOnQuiz フラグ追加
SettingsScreen.tsx        ← General セクションにトグル2つ追加
WordPopup.tsx             ← open 時に自動 speak() 追加
QuizScreen.tsx            ← currentIndex 変化時に自動 speak() + 手動ボタン追加
locales/ja/settings.json  ← 文言追加
locales/en/settings.json  ← 文言追加
```

既存の `src/hooks/useSpeech.ts` はそのまま流用。変更不要。

---

## 変更詳細

### 1. `settingsStore.ts` の拡張

既存の `hapticFeedbackEnabled` と同じパターンで2フラグを追加する。

```typescript
// 追加するフィールド
autoSpeechOnPopup: boolean;           // 単語ポップアップ自動読み上げ（デフォルト: false）
setAutoSpeechOnPopup: (v: boolean) => void;
autoSpeechOnQuiz: boolean;            // クイズ自動読み上げ（デフォルト: false）
setAutoSpeechOnQuiz: (v: boolean) => void;
```

デフォルトを `false` にする理由：読み上げは補助的な機能であり、初期状態でオフの方が邪魔にならない。

---

### 2. `SettingsScreen.tsx` の変更

General セクションに2つのトグルを追加する。

```
General セクション（現状）
  ├ 言語
  ├ テーマ
  └ いいね時の振動

General セクション（変更後）
  ├ 言語
  ├ テーマ
  ├ いいね時の振動
  ├ 単語ポップアップの自動読み上げ  ← 追加
  └ クイズの自動読み上げ            ← 追加
```

実装は既存の Haptic トグル（`SettingsScreen.tsx` 約390行目）と全く同じパターン。

---

### 3. `WordPopup.tsx` の変更

ポップアップが開いたタイミング（`word` prop が変化したとき）に自動読み上げする。

```typescript
const { autoSpeechOnPopup } = useSettingsStore();
const { speak } = useSpeech();

useEffect(() => {
  if (!autoSpeechOnPopup || !word) return;
  speak(word, { language: isJapanese ? 'ja-JP' : 'en-US' });
}, [word]); // word が変化 = ポップアップが新しい単語で開いた
```

既存の `useSpeech` フックはマウント解除時に `Speech.stop()` を呼ぶため、
ポップアップを閉じると自動的に読み上げが停止する。追加のクリーンアップ不要。

---

### 4. `QuizScreen.tsx` の変更

#### 4-1. 自動読み上げ

`session.currentIndex` が変化したタイミング（= 次の問題に進んだとき）に自動読み上げする。

```typescript
const { autoSpeechOnQuiz } = useSettingsStore();
const { speak, stop, isSpeaking } = useSpeech();

useEffect(() => {
  if (!session || !autoSpeechOnQuiz) return;
  const q = session.questions[session.currentIndex];
  const lang = q.questionType === 'en_to_ja' ? 'en-US' : 'ja-JP';
  speak(q.question, { language: lang });
}, [session?.currentIndex, autoSpeechOnQuiz]);
```

#### 4-2. 手動読み上げボタン

問題カード（`questionCard`）内、問題文の右側に Volume2 アイコンボタンを配置する。

```
┌─────────────────────────────────┐
│  QUESTION                       │
│                                 │
│       "apple"              🔊   │  ← 手動ボタン（isSpeaking 中は VolumeX）
│                                 │
│  英語 → 日本語                  │
└─────────────────────────────────┘
```

```typescript
const handleSpeak = useCallback(() => {
  if (!session) return;
  if (isSpeaking) {
    stop();
    return;
  }
  const q = session.questions[session.currentIndex];
  const lang = q.questionType === 'en_to_ja' ? 'en-US' : 'ja-JP';
  speak(q.question, { language: lang });
}, [session, isSpeaking, speak, stop]);
```

`isSpeaking` 中は `Volume2` → `VolumeX` に切り替えて読み上げ状態を視覚的に伝える。
WordPopup の既存スピーカーボタン（`WordPopup.tsx` 約849行目）と同じパターン。

---

### 5. 翻訳ファイルの追加

**`locales/ja/settings.json`**

```json
"autoSpeech": {
  "popup": {
    "title": "単語ポップアップの自動読み上げ",
    "subtitle": "単語を選択したとき自動で読み上げる"
  },
  "quiz": {
    "title": "クイズの自動読み上げ",
    "subtitle": "問題が表示されたとき自動で読み上げる"
  }
}
```

**`locales/en/settings.json`**

```json
"autoSpeech": {
  "popup": {
    "title": "Auto-read Word Popup",
    "subtitle": "Speak word aloud when popup opens"
  },
  "quiz": {
    "title": "Auto-read Quiz Questions",
    "subtitle": "Speak question aloud when it appears"
  }
}
```

---

## 工数見積もり

| 作業 | 見積もり |
|------|---------|
| `settingsStore.ts` 拡張（2フラグ追加） | 10分 |
| `SettingsScreen.tsx` トグル2つ追加 | 20分 |
| `WordPopup.tsx` 自動読み上げ `useEffect` 追加 | 15分 |
| `QuizScreen.tsx` 自動 + 手動ボタン実装 | 30分 |
| 翻訳ファイル追加（ja/en） | 10分 |
| **合計** | **約1.5時間** |

---

## 保守性評価

### 良い点

- `useSpeech` フックに TTS ロジックが集約されているため、読み上げ速度・言語のデフォルト変更は1箇所で完結
- 設定フラグが `settingsStore` に集中するため、将来「読み上げ速度の設定追加」なども同じパターンで拡張可能
- `isSpeaking` の状態管理がフック内に閉じており、各画面は状態を持たない

### 注意点

- `WordPopup.tsx` はボトムシートのため、高速に開閉した場合に前の読み上げが残る可能性がある。
  ただし `useSpeech` の `speak()` が内部で `Speech.stop()` を先行実行するため実害はない。
- 自動読み上げ中にユーザーが手動ボタンを押した場合の挙動は「停止」とする（再読み上げではなく）。
  `isSpeaking` フラグで制御済み。

---

## 既知の制限

- 音声品質はデバイスの TTS エンジン依存（iOS > Android の傾向）
- `expo-speech` はネイティブモジュールだが、すでにインストール・ビルド済みのため再ビルド不要

---

## 実装順序（推奨）

1. `settingsStore.ts` と翻訳ファイルを追加（土台）
2. `SettingsScreen.tsx` にトグル追加（動作確認可能になる）
3. `WordPopup.tsx` に自動読み上げ追加
4. `QuizScreen.tsx` に自動 + 手動読み上げ追加
