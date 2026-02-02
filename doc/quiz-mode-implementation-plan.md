# クイズモード（記述式）実装計画

## 概要
単語帳に登録された単語を使った記述式クイズ機能を実装する。

## ユーザー要件
- **出題方式**: 英語→日本語、日本語→英語、両方から選択可能
- **正解判定**: 表記ゆれ許容（スペース、ハイフン、大文字小文字の違いを許容）
- **統計保存**: 正答率、苦手単語などを記録し進捗画面で表示
- **出題数**: 5/10/20問からユーザー選択可能

---

## 実装フェーズ

### Phase 1: データベース基盤
**ファイル:**
- [init.ts](../src/services/database/init.ts) - マイグレーション追加
- [config.ts](../src/constants/config.ts) - DATABASE.VERSION を 5 に更新

**新規テーブル:**
```sql
-- quiz_attempts: 個別の回答記録
CREATE TABLE IF NOT EXISTS quiz_attempts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  word_id INTEGER NOT NULL,
  question_type TEXT NOT NULL CHECK(question_type IN ('en_to_ja', 'ja_to_en')),
  user_answer TEXT NOT NULL,
  correct_answer TEXT NOT NULL,
  is_correct INTEGER NOT NULL CHECK(is_correct IN (0, 1)),
  answered_at DATETIME DEFAULT (datetime('now', 'localtime')),
  FOREIGN KEY (word_id) REFERENCES words(id) ON DELETE CASCADE
);

-- quiz_sessions: セッション単位の統計
CREATE TABLE IF NOT EXISTS quiz_sessions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  question_type TEXT NOT NULL CHECK(question_type IN ('en_to_ja', 'ja_to_en', 'mixed')),
  total_questions INTEGER NOT NULL,
  correct_count INTEGER NOT NULL,
  started_at DATETIME DEFAULT (datetime('now', 'localtime')),
  completed_at DATETIME,
  time_spent_seconds INTEGER
);
```

---

### Phase 2: 型定義
**新規ファイル:** [quiz.ts](../src/types/quiz.ts)

主要な型:
- `QuestionType`: 'en_to_ja' | 'ja_to_en' | 'mixed'
- `QuizSettings`: 出題設定
- `QuizQuestion`: 問題データ
- `QuizAnswer`: 回答データ
- `QuizSession`: セッション状態
- `QuizResult`: 結果サマリー
- `QuizStats`: 統計データ

---

### Phase 3: サービス層
**新規ファイル:**
- [quiz.ts](../src/services/database/quiz.ts) - DB操作
- [answerValidator.ts](../src/services/quiz/answerValidator.ts) - 正解判定
- [quizEngine.ts](../src/services/quiz/quizEngine.ts) - クイズロジック

**正解判定アルゴリズム:**
1. 正規化（大文字小文字、スペース、ハイフン、句読点を統一）
2. 完全一致チェック
3. 代替回答チェック（日本語訳が複数ある場合）
4. Levenshtein距離による軽微なタイポ許容（長い単語で20%以内）

---

### Phase 4: 画面実装
**新規ファイル:**
- [QuizSetupScreen.tsx](../src/screens/QuizSetupScreen.tsx) - 設定画面
- [QuizScreen.tsx](../src/screens/QuizScreen.tsx) - クイズ実施画面
- [QuizResultScreen.tsx](../src/screens/QuizResultScreen.tsx) - 結果画面

**更新ファイル:**
- [AppNavigator.tsx](../src/navigation/AppNavigator.tsx) - ナビゲーション追加

**画面フロー:**
```
フッタータブ [クイズ] → QuizSetupScreen → QuizScreen → QuizResultScreen
                              ↑                              ↓
                              └──────── [もう一度] ──────────┘
```

**ナビゲーション構成：**

- フッタータブ： ホーム → 単語帳 → **クイズ** → 進捗 → 設定
- QuizSetupScreenはタブとして直接表示（独自ヘッダー付き）

---

### Phase 5: 多言語対応
**新規ファイル:**
- [quiz.json](../src/locales/ja/quiz.json) - 日本語
- [quiz.json](../src/locales/en/quiz.json) - 英語

---

### Phase 6: 進捗画面統合
**更新ファイル:** [ProgressScreen.tsx](../src/screens/ProgressScreen.tsx)

追加表示:
- 完了セッション数
- 総合正答率
- 苦手な単語リスト（正答率50%未満、3回以上回答）

---

## 変更ファイル一覧

| ファイル | 変更内容 |
|---------|---------|
| `src/constants/config.ts` | DATABASE.VERSION を 5 に更新 |
| `src/services/database/init.ts` | quiz_attempts, quiz_sessions テーブル追加 |
| `src/types/quiz.ts` | **新規** クイズ関連型定義 |
| `src/types/index.ts` | quiz.ts のエクスポート追加 |
| `src/services/database/quiz.ts` | **新規** クイズDB操作 |
| `src/services/quiz/answerValidator.ts` | **新規** 正解判定ロジック |
| `src/services/quiz/quizEngine.ts` | **新規** クイズエンジン |
| `src/screens/QuizSetupScreen.tsx` | **新規** 設定画面 |
| `src/screens/QuizScreen.tsx` | **新規** クイズ画面 |
| `src/screens/QuizResultScreen.tsx` | **新規** 結果画面 |
| `src/navigation/AppNavigator.tsx` | クイズタブ追加、3つのルート追加 |
| `src/screens/ProgressScreen.tsx` | クイズ統計セクション追加 |
| `src/screens/HomeScreen.tsx` | クイズボタン削除（フッタータブに移動） |
| `src/locales/ja/navigation.json` | クイズタブラベル追加 |
| `src/locales/en/navigation.json` | クイズタブラベル追加 |
| `src/locales/ja/quiz.json` | **新規** 日本語翻訳 |
| `src/locales/en/quiz.json` | **新規** 英語翻訳 |
| `src/locales/index.ts` | quiz名前空間追加 |

---

## 検証方法

1. **単体テスト**
   - answerValidator のテスト（表記ゆれ許容の確認）
   - quiz.ts DB操作のテスト

2. **統合テスト**
   - 単語登録 → クイズ実施 → 結果確認 → 統計表示の一連のフロー

3. **手動テスト**
   - 各出題方式（英→日、日→英、ミックス）で動作確認
   - 各出題数（5/10/20問）で動作確認
   - 表記ゆれ（スペース、ハイフン、大小文字）の許容確認
   - 進捗画面での統計表示確認
   - 日本語/英語切り替えでの表示確認

---

## 注意事項

- クイズには日本語訳が登録されている単語のみが対象
- 単語数が出題数未満の場合はエラーメッセージを表示
- クイズ中の誤操作防止（戻るジェスチャー無効、終了確認ダイアログ）

---

**作成日**: 2026-02-02
**関連要件**: doc/requirements.md Phase 2: 学習機能強化
