# クイズ NGSL/NGSL-S フィルター機能 実装計画

## 概要

クイズ設定画面に「単語の種類」選択を追加し、NGSL（New General Service List）または NGSL-S（Spoken）に収録された単語のみを出題できる機能を実装する。

## 背景・目的

- 単語帳には一般単語・熟語・文章など様々な種別の単語が登録されている
- NGSL は日常英語の約90%をカバーする2,801語のリスト
- NGSL-S は英語の日常会話でよく使われる1,000語を収録したリスト
- 「英語の基礎語彙を重点的に学びたい」というユーザーニーズに応える

## 実装方針

### フィルタリング方式

NGSL データは既存の `getNgslBand()` / `getNgslsBand()` 関数（`src/constants/ngslWords.ts` / `src/constants/ngslsWords.ts`）で `Map<string, band>` によるO(1)ルックアップが可能。

DBクエリではなく**インメモリフィルタリング**を採用する：
1. DB から日本語訳を持つ全単語を取得
2. JS 側で NGSL フィルターを適用
3. Fisher-Yates シャッフル後、必要数を取得

### 選択肢

| 値 | 表示 | 説明 |
|----|------|------|
| `null` | すべて | フィルターなし（現在の挙動） |
| `'ngsl'` | NGSL | NGSL に収録された単語のみ |
| `'ngsl-s'` | NGSL-S | NGSL-S に収録された単語のみ |
| `'ngsl_any'` | NGSL/S両方 | NGSL または NGSL-S に収録された単語 |

## 変更ファイル一覧

### 1. `src/types/quiz.ts`

- `NgslWordFilter` 型を追加
- `QuizSettings` に `ngslFilter: NgslWordFilter` フィールドを追加

### 2. `src/services/database/quiz.ts`

- `rowToWord()` に `wordType` マッピングを追加（既存のバグ修正）
- `getAllQuizableWords()` 関数を追加（フィルター用に全単語取得）
- `getQuizableWordCount(ngslFilter?)` に optional パラメータを追加

### 3. `src/services/quiz/quizEngine.ts`

- `generateQuiz()` にインメモリ NGSL フィルタリングを追加
- `getNgslBand` / `getNgslsBand` をインポート

### 4. `src/screens/QuizSetupScreen.tsx`

- `ngslFilter` state を追加
- 「単語の種類」セクション UI を追加（既存の `OptionButton` を流用）
- `handleStartQuiz` に `ngslFilter` を含める
- `loadWordCount` が NGSL フィルター対応の件数を表示

### 5. `src/locales/ja/quiz.json` / `src/locales/en/quiz.json`

- `wordFilter` セクションを追加

## 工数見積もり

| 作業 | 工数 |
|------|------|
| 型定義 | 5分 |
| DB サービス更新 | 15分 |
| クイズエンジン更新 | 15分 |
| UI 追加 | 20分 |
| i18n 追加 | 5分 |
| **合計** | **約1時間** |

## 注意事項

- NGSL フィルター適用後の対象単語が `questionCount` を下回る場合は、既存のエラーメッセージ（`notEnoughWordsHint`）を表示
- クイズ設定画面の「出題可能な単語数」は選択中の NGSL フィルターに応じてリアルタイム更新
- `wordType !== 'word'` の単語（熟語・文章）は NGSL に収録されないため、`ngslFilter` 設定時は自動的に除外される
