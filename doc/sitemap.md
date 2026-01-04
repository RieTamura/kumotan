# くもたん (Kumotan) - サイトマップ

**アプリ名**: くもたん (Kumotan)  
**コンセプト**: 雲から学ぶ、あなたの単語帳

## 画面遷移図

```
[Splash Screen]
      │
      ↓
  ┌───────────┐
  │  Login    │ (初回のみ)
  │  Screen   │
  └───────────┘
      │
      ↓
┌─────────────────────────────────────────────────┐
│              Tab Navigator                      │
│  (常に表示されるボトムナビゲーション)            │
├─────────────────────────────────────────────────┤
│  ┌─────┐  ┌──────┐  ┌────────┐  ┌──────────┐ │
│  │Home │  │Word  │  │Progress│  │ Settings │ │
│  │     │  │List  │  │        │  │          │ │
│  └─────┘  └──────┘  └────────┘  └──────────┘ │
└─────────────────────────────────────────────────┘
     │          │           │            │
     │          │           │            ├──→ [API Key Setup Screen]
     │          │           │            └──→ [License Screen]
     │          │           │
     │          │           └──→ [Blueskyアプリへ遷移]
     │          │
     │          └──→ [Word Detail Modal]
     │
     └──→ [Word Definition Popup]

┌─────────────────────────────────────────────────┐
│           [Offline Banner]                      │
│  (オフライン時に画面上部に表示)                  │
└─────────────────────────────────────────────────┘
```

---

## 画面一覧

### 1. Splash Screen（スプラッシュ画面）

**目的**: アプリ起動時のローディング・初期化

**表示内容**:
- アプリロゴ
- アプリ名
- バージョン番号
- ローディングインジケーター

**処理フロー**:
1. データベース初期化
2. 認証状態チェック（Secure Storeからトークン取得）
3. トークン有効性チェック（必要に応じてリフレッシュ）
4. ネットワーク状態チェック
5. 画面遷移判定

**遷移先**:
- 認証済み → HomeScreen（Tab Navigator）
- 未認証 → LoginScreen
- トークンリフレッシュ失敗 → LoginScreen

**表示時間**: 1〜3秒（初期化完了まで）

**ナビゲーション**: スタック（独立）

---

### 2. Login Screen（ログイン画面）

**目的**: Blueskyアカウント認証

**表示内容**:
- ヘッダー: アプリ名、ロゴ
- アプリ説明文
  - 「Blueskyで英語学習！タイムラインから単語を保存して、あなただけの単語帳を作ろう」
- 入力フォーム:
  - ユーザー名（例: username.bsky.social）
  - App Password
  - 「ログイン」ボタン
- フッター:
  - 「App Passwordの取得方法」リンク（外部ブラウザでBluesky設定ページへ）

**入力バリデーション**:

| フィールド | ルール | エラーメッセージ |
|-----------|--------|------------------|
| ユーザー名 | 必須 | ユーザー名を入力してください |
| ユーザー名 | ハンドル形式またはメール形式 | 正しい形式で入力してください（例: user.bsky.social） |
| App Password | 必須 | App Passwordを入力してください |
| App Password | xxxx-xxxx-xxxx-xxxx形式 | App Passwordの形式が正しくありません |

**バリデーション実装例**:
```typescript
const Validators = {
  // Blueskyハンドル: domain形式
  isValidHandle(handle: string): boolean {
    const trimmed = handle.trim();
    // ハンドル形式（例: user.bsky.social）
    const handlePattern = /^([a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?\.)+[a-zA-Z]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?$/;
    // メール形式
    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return handlePattern.test(trimmed) || emailPattern.test(trimmed);
  },
  
  // App Password: xxxx-xxxx-xxxx-xxxx形式
  isValidAppPassword(password: string): boolean {
    const pattern = /^[a-z0-9]{4}-[a-z0-9]{4}-[a-z0-9]{4}-[a-z0-9]{4}$/;
    return pattern.test(password.trim());
  },
};
```

**エラー表示**:
- ネットワークエラー: 「ネットワーク接続を確認してください」
- 認証失敗: 「ユーザー名またはApp Passwordが間違っています」
- タイムアウト: 「接続がタイムアウトしました。再試行してください」
- バリデーションエラー: 各フィールドの下に赤文字で表示

**セキュリティ注意事項**:
- App Passwordは認証時のみ使用し、**保存しない**
- 認証成功後はトークン（accessJwt, refreshJwt）のみをSecure Storeに保存

**遷移先**: HomeScreen（ログイン成功後）

**ナビゲーション**: スタック（戻れない）

---

### 3. Home Screen（ホーム画面）

**目的**: Blueskyフィード表示と単語登録

**レイアウト**:
```
┌──────────────────────────────────┐
│ [Offline Banner] (オフライン時)  │
├──────────────────────────────────┤
│ Header                           │
│  [Title] [Refresh Icon]          │
├──────────────────────────────────┤
│                                  │
│  ┌────────────────────────────┐ │
│  │ @user                      │ │
│  │ This is a sample post      │ │
│  │ with English words.        │ │
│  │ 2 hours ago                │ │
│  └────────────────────────────┘ │
│                                  │
│  ┌────────────────────────────┐ │
│  │ @another_user              │ │
│  │ Another interesting        │ │
│  │ post here.                 │ │
│  │ 5 hours ago                │ │
│  └────────────────────────────┘ │
│                                  │
│  [Loading more...]               │
│                                  │
└──────────────────────────────────┘
```

**表示内容**:
- オフラインバナー（オフライン時のみ）
- ヘッダー:
  - タイトル「Home」
  - 更新ボタン（手動リフレッシュ）
- 投稿リスト（FlatList）:
  - アバター（丸形、48x48px）
  - ユーザー名（@handle）
  - 投稿テキスト
  - 投稿日時（相対時刻: "2 hours ago"）
- ローディングインジケーター（初回・更新時）
- Pull to Refresh（下にスワイプで更新）

**操作**:
1. **投稿テキストをロングタップ**:
   - テキスト選択モード
   - 選択した単語をハイライト
   - Word Definition Popupが下からスライド表示
2. **下にスワイプ**: フィード更新
3. **上にスクロール**: 過去の投稿を読み込み

**状態**:
- 初回ロード中
- データ表示中
- 更新中
- オフライン（バナー表示、更新不可）
- エラー（ネットワークエラー、認証エラー）

**オフライン時の動作**:
- オフラインバナーを表示
- フィード更新ボタンを無効化
- 「オフラインです。フィードを更新できません」メッセージ表示

**Word Definition Popup（モーダル）**:

**表示内容**:
```
┌──────────────────────────────────┐
│                                  │
│  serendipity                     │
│  /ˌsɛɹənˈdɪpɪti/                 │
│                                  │
│  【日本語訳】                    │
│  セレンディピティ                │
│  (API Key未設定時は非表示)       │
│                                  │
│  【英語定義】                    │
│  An unsought, unintended...      │
│                                  │
│  ┌────────────────────────────┐ │
│  │ 単語帳に追加               │ │
│  └────────────────────────────┘ │
│                                  │
│  [キャンセル]                    │
│                                  │
└──────────────────────────────────┘
```

**操作**:
- 「単語帳に追加」: DBに保存 → 成功トースト表示 → ポップアップを閉じる
- 「キャンセル」: ポップアップを閉じる
- 背景タップ: ポップアップを閉じる

**エラー処理**:
- 翻訳失敗（API Key未設定含む）: 英語定義のみ表示
- 定義取得失敗: 日本語訳のみ表示（API Key設定時）
- 両方失敗: エラーメッセージ表示
- オフライン: 「オフラインです。ネットワーク接続を確認してください」

**ナビゲーション**: タブナビゲーション（メイン）

---

### 4. Word List Screen（単語帳画面）

**目的**: 登録単語の一覧・管理

**レイアウト**:
```
┌──────────────────────────────────┐
│ Header                           │
│  [Title] [Sort] [Filter]         │
├──────────────────────────────────┤
│ Sort: 登録日時（新しい順）▼      │
│ Filter: [すべて] [未読] [既読]   │
├──────────────────────────────────┤
│                                  │
│  ┌────────────────────────────┐ │
│  │ ☐ serendipity              │ │
│  │    セレンディピティ        │ │
│  │    2 days ago              │ │
│  └────────────────────────────┘ │
│                                  │
│  ┌────────────────────────────┐ │
│  │ ☑ ephemeral                │ │
│  │    儚い、一時的な          │ │
│  │    3 days ago              │ │
│  └────────────────────────────┘ │
│                                  │
│  [Empty State]                   │
│  単語がまだ登録されていません    │
│                                  │
└──────────────────────────────────┘
```

**表示内容**:
- ヘッダー:
  - タイトル「単語帳」
  - ソートボタン
  - フィルタボタン
- ソート選択（ドロップダウン）:
  - 登録日時（新しい順）
  - 登録日時（古い順）
  - アルファベット順（A-Z）
  - アルファベット順（Z-A）
- フィルタ選択（セグメントコントロール）:
  - すべて
  - 未読のみ
  - 既読のみ
- 単語リスト（FlatList）:
  - 既読チェックボックス（☐/☑）
  - 英単語（太字）
  - 日本語訳（API Key未設定時は「-」または英語定義）
  - 登録日時（相対時刻）
  - スワイプで削除アクション表示
- 空状態:
  - 「単語がまだ登録されていません」
  - 「HOMEからBlueskyの投稿で気になる単語を登録しましょう」

**操作**:
1. **チェックボックスタップ**: 既読/未読切り替え
2. **単語タップ**: Word Detail Modal表示
3. **左スワイプ**: 削除ボタン表示 → タップで削除確認ダイアログ
4. **ソート/フィルタ変更**: リスト更新（アニメーション付き）

**オフライン時の動作**:
- 通常通り閲覧・操作可能（ローカルDB）
- 既読/未読切り替え可能
- 削除可能

**Word Detail Modal（モーダル）**:

**表示内容**:
```
┌──────────────────────────────────┐
│ [×]                        Close │
├──────────────────────────────────┤
│                                  │
│  serendipity                     │
│  /ˌsɛɹənˈdɪpɪti/                 │
│                                  │
│  【日本語訳】                    │
│  セレンディピティ                │
│                                  │
│  【英語定義】                    │
│  An unsought, unintended,        │
│  and/or unexpected, but...       │
│                                  │
│  【元の投稿】                    │
│  "I had a serendipity moment     │
│  when I found this app!"         │
│  - @username                     │
│                                  │
│  登録日時: 2025-01-13 14:30      │
│                                  │
│  ┌────────────────────────────┐ │
│  │ 投稿を開く                 │ │
│  └────────────────────────────┘ │
│                                  │
└──────────────────────────────────┘
```

**操作**:
- 「投稿を開く」: Blueskyアプリへ遷移（Expo Linking）
- 「×」ボタン: モーダルを閉じる
- 背景タップ: モーダルを閉じる

**ナビゲーション**: タブナビゲーション

---

### 5. Progress Screen（進捗画面）

**目的**: 学習状況の可視化と共有

**レイアウト**:
```
┌──────────────────────────────────┐
│ Header                           │
│  [Title]              [Share]    │
├──────────────────────────────────┤
│                                  │
│  【統計】                        │
│  ┌────────┐ ┌────────┐          │
│  │ 総単語  │ │ 既読   │          │
│  │   42   │ │   28   │          │
│  └────────┘ └────────┘          │
│  ┌────────┐ ┌────────┐          │
│  │ 既読率  │ │今週の  │          │
│  │  67%   │ │学習日  │          │
│  │        │ │  5日   │          │
│  └────────┘ └────────┘          │
│  ┌────────┐                      │
│  │ 連続    │                      │
│  │学習日数 │                      │
│  │  12日  │                      │
│  └────────┘                      │
│                                  │
│  【カレンダー】                  │
│       2025年 1月                 │
│  [<]                  [>]        │
│                                  │
│  日 月 火 水 木 金 土             │
│        1  2  3  4                │
│  5  6  7  8  9 10 11             │
│ 12 13 14 15 16 17 18             │
│ 19 20 21 22 23 24 25             │
│ 26 27 28 29 30 31                │
│                                  │
│  ● = 学習した日                  │
│                                  │
└──────────────────────────────────┘
```

**表示内容**:
- ヘッダー:
  - タイトル「進捗」
  - シェアボタン（右上）
- 統計カード（2x2グリッド）:
  - 総単語数
  - 既読単語数
  - 既読率（%）
  - 今週の学習日数（過去7日間）
  - 連続学習日数（ストリーク）
- カレンダー:
  - 月表示（年月ヘッダー）
  - 前月/次月ボタン
  - 学習した日にドット表示（●）
  - 今日は枠線でハイライト

**操作**:
1. **シェアボタン**: Blueskyシェア処理
2. **前月/次月ボタン**: 月を切り替え
3. **カレンダーの日付タップ**: その日の詳細（将来機能）

**オフライン時の動作**:
- 統計・カレンダーは通常通り表示（ローカルDB）
- シェアボタンは無効化（オフラインではBluesky投稿不可）

**Blueskyシェア処理**:
1. 投稿テキスト生成: 「今日は○個の単語を学習しました！ #英語学習 #くもたん」
2. Expo Linkingで Blueskyアプリの投稿画面を開く
3. ユーザーが投稿を編集・送信

**ナビゲーション**: タブナビゲーション

---

### 6. Settings Screen（設定画面）

**目的**: アプリ設定と管理

**レイアウト**:
```
┌──────────────────────────────────┐
│ Header                           │
│  [Title]                         │
├──────────────────────────────────┤
│                                  │
│  【アカウント】                  │
│  ┌────────────────────────────┐ │
│  │ @username.bsky.social      │ │
│  └────────────────────────────┘ │
│  [ログアウト]                    │
│                                  │
│  【API設定】                     │
│  [DeepL API Key]           >     │
│  (設定済み / 未設定)             │
│                                  │
│  【データ管理】                  │
│  [データをエクスポート]          │
│  [すべてのデータを削除]          │
│                                  │
│  【その他】                      │
│  [ライセンス]              >     │
│                                  │
│  【アプリ情報】                  │
│  バージョン: 1.0.0               │
│                                  │
└──────────────────────────────────┘
```

**表示内容**:
- ヘッダー: タイトル「設定」
- アカウント情報:
  - ユーザー名表示（@handle）
  - 「ログアウト」ボタン
- API設定:
  - 「DeepL API Key」リンク（→ API Key Setup Screen）
  - ステータス表示（設定済み / 未設定）
- データ管理:
  - 「データをエクスポート」ボタン
  - 「すべてのデータを削除」ボタン（赤色、破壊的操作）
- その他:
  - 「ライセンス」リンク（→ License Screen）
- アプリ情報:
  - バージョン番号表示

**操作**:
1. **ログアウト**:
   - 確認ダイアログ表示
   - OK → Secure Store（トークン、ユーザー情報）をクリア → LoginScreenへ遷移
   - DeepL API Keyは削除しない（ユーザー設定として保持）
2. **DeepL API Key**:
   - API Key Setup Screenへ遷移
3. **データをエクスポート**:
   - JSON生成（単語データ、統計データ）
   - Share Sheet表示（メール、ファイル、AirDropなど）
4. **すべてのデータを削除**:
   - 確認ダイアログ表示（「この操作は取り消せません」）
   - OK → DB削除、Secure Store全削除 → 完了トースト表示
5. **ライセンスタップ**: License Screenへ遷移

**確認ダイアログ例**:
```
┌──────────────────────────────────┐
│ ログアウトしますか？             │
│                                  │
│ ※単語帳データは保持されます     │
│                                  │
│ [キャンセル]      [ログアウト]   │
└──────────────────────────────────┘
```

**ナビゲーション**: タブナビゲーション

---

### 7. API Key Setup Screen（API Key設定画面）

**目的**: DeepL API Keyの設定

**レイアウト**:
```
┌──────────────────────────────────┐
│ [<] DeepL API Key設定            │
├──────────────────────────────────┤
│                                  │
│  【説明】                        │
│  単語の日本語翻訳にDeepL APIを   │
│  使用します。無料で月50万文字    │
│  まで翻訳できます。              │
│                                  │
│  API Keyを設定しない場合、       │
│  英語の定義のみ表示されます。    │
│                                  │
│  ┌────────────────────────────┐ │
│  │ API Keyの取得方法（3分） → │ │
│  └────────────────────────────┘ │
│                                  │
│  【API Key入力】                 │
│  ┌────────────────────────────┐ │
│  │ xxxxxxxx-xxxx-xxxx-...    │ │
│  └────────────────────────────┘ │
│  (入力時はマスク表示)            │
│                                  │
│  ┌────────────────────────────┐ │
│  │ Keyを検証して保存          │ │
│  └────────────────────────────┘ │
│                                  │
│  [API Keyを削除]                 │
│  (設定済みの場合のみ表示)        │
│                                  │
└──────────────────────────────────┘
```

**表示内容**:
- ヘッダー:
  - 戻るボタン（< Settings）
  - タイトル「DeepL API Key設定」
- 説明セクション:
  - DeepL APIの用途説明
  - 無料枠の説明（月50万文字）
  - API Key未設定時の動作説明
  - 「API Keyの取得方法」リンク（外部ブラウザでDeepLサイトへ）
- 入力フォーム:
  - API Key入力フィールド（secureTextEntry）
  - 「Keyを検証して保存」ボタン
- 削除オプション（設定済みの場合のみ）:
  - 「API Keyを削除」ボタン

**入力バリデーション**:

| ルール | エラーメッセージ |
|--------|------------------|
| 必須 | API Keyを入力してください |
| 形式（36文字以上、末尾が:fx） | API Keyの形式が正しくありません |
| API検証失敗 | API Keyが無効です。DeepLダッシュボードで確認してください |

**バリデーション実装例**:
```typescript
// DeepL API Keyのバリデーション
function isValidDeepLApiKey(apiKey: string): boolean {
  const trimmed = apiKey.trim();
  // Free版は末尾が:fxで終わる
  if (!trimmed.endsWith(':fx')) {
    return false;
  }
  // 基本的な形式チェック（36文字以上）
  const pattern = /^[a-zA-Z0-9-]{36,}:fx$/;
  return pattern.test(trimmed);
}

// APIで有効性を検証
async function verifyDeepLApiKey(apiKey: string): Promise<boolean> {
  try {
    const response = await fetch('https://api-free.deepl.com/v2/usage', {
      headers: { 'Authorization': `DeepL-Auth-Key ${apiKey}` },
    });
    return response.ok;
  } catch {
    return false;
  }
}
```

**操作**:
1. **「API Keyの取得方法」タップ**:
   - 外部ブラウザでDeepL APIサインアップページを開く
2. **「Keyを検証して保存」タップ**:
   - クライアント側バリデーション
   - DeepL APIで有効性を検証
   - 成功 → Secure Storeに保存 → 成功トースト → 設定画面に戻る
   - 失敗 → エラーメッセージ表示
3. **「API Keyを削除」タップ**:
   - 確認ダイアログ表示
   - OK → Secure Storeから削除 → 完了トースト
4. **戻るボタン**: Settings Screenへ

**セキュリティ注意事項**:
- API Keyは必ずSecure Storeに保存
- 入力時はマスク表示（secureTextEntry）
- ログには出力しない

**ナビゲーション**: スタック

---

### 8. License Screen（ライセンス画面）

**目的**: ライセンス・規約の表示

**レイアウト**:
```
┌──────────────────────────────────┐
│ [<] ライセンス                   │
├──────────────────────────────────┤
│                                  │
│  【オープンソースライセンス】    │
│                                  │
│  expo-sqlite                     │
│  MIT License                     │
│  Copyright (c) ...               │
│                                  │
│  expo-secure-store               │
│  MIT License                     │
│  Copyright (c) ...               │
│                                  │
│  @atproto/api                    │
│  MIT License                     │
│  Copyright (c) ...               │
│                                  │
│  React Navigation                │
│  MIT License                     │
│  ...                             │
│                                  │
│  【利用API】                     │
│                                  │
│  Bluesky API                     │
│  https://docs.bsky.app/          │
│                                  │
│  DeepL API                       │
│  https://www.deepl.com/          │
│  ※ユーザー自身のAPI Keyを使用   │
│                                  │
│  Free Dictionary API             │
│  https://dictionaryapi.dev/      │
│                                  │
│  【利用規約】                    │
│  本アプリは...                   │
│                                  │
│  【プライバシーポリシー】        │
│  当アプリは...                   │
│  - データはデバイス内にのみ保存  │
│  - 外部への送信はAPIリクエストのみ│
│                                  │
└──────────────────────────────────┘
```

**表示内容**:
- ヘッダー:
  - 戻るボタン（< Settings）
  - タイトル「ライセンス」
- セクション（スクロール可能）:
  - オープンソースライセンス
    - expo-sqlite（MIT License）
    - expo-secure-store（MIT License）
    - @atproto/api（MIT License）
    - React Navigation（MIT License）
    - @react-native-community/netinfo（MIT License）
    - その他依存ライブラリ
  - 利用API
    - Bluesky API
    - DeepL API（ユーザー自身のAPI Keyを使用）
    - Free Dictionary API
  - 利用規約（簡潔な説明）
  - プライバシーポリシー
    - データの取り扱い
    - 外部送信はAPIリクエストのみ
    - ローカル保存のみ

**操作**:
- スクロール
- 戻るボタン → Settings Screenへ

**ナビゲーション**: スタック

---

### 9. Offline Banner（オフラインバナー）

**目的**: オフライン状態のユーザー通知

**表示条件**:
- ネットワーク接続がない場合に画面上部に表示

**レイアウト**:
```
┌──────────────────────────────────┐
│ ⚠️ オフラインです               │
└──────────────────────────────────┘
```

**表示内容**:
- オフラインアイコン（cloud-offline）
- 「オフラインです」テキスト
- 背景色: 警告色（オレンジまたはグレー）

**実装例**:
```typescript
import { useNetworkStatus } from '../hooks/useNetworkStatus';

function OfflineBanner() {
  const isConnected = useNetworkStatus();
  
  if (isConnected) return null;
  
  return (
    <View style={styles.banner}>
      <Icon name="cloud-offline" size={16} color="#fff" />
      <Text style={styles.text}>オフラインです</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    backgroundColor: '#f59e0b',
    padding: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: {
    color: '#fff',
    marginLeft: 8,
    fontWeight: '600',
  },
});
```

**各画面での影響**:

| 画面 | オフライン時の動作 |
|------|-------------------|
| Home | バナー表示、フィード更新不可 |
| Word List | 通常通り操作可能 |
| Progress | 統計表示可能、シェア不可 |
| Settings | 通常通り操作可能 |
| API Key Setup | 検証不可（保存のみ） |

---

## ナビゲーション構造

### AppNavigator（TypeScript実装例）

```typescript
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

const Tab = createBottomTabNavigator();
const Stack = createNativeStackNavigator();

// メインタブナビゲーション
function MainTabs() {
  return (
    <Tab.Navigator
      screenOptions={{
        tabBarActiveTintColor: '#1DA1F2',
        tabBarInactiveTintColor: '#657786',
      }}
    >
      <Tab.Screen
        name="Home"
        component={HomeScreen}
        options={{
          tabBarIcon: ({ color }) => <HomeIcon color={color} />,
          tabBarLabel: 'ホーム',
        }}
      />
      <Tab.Screen
        name="WordList"
        component={WordListScreen}
        options={{
          tabBarIcon: ({ color }) => <BookIcon color={color} />,
          tabBarLabel: '単語帳',
        }}
      />
      <Tab.Screen
        name="Progress"
        component={ProgressScreen}
        options={{
          tabBarIcon: ({ color }) => <ChartIcon color={color} />,
          tabBarLabel: '進捗',
        }}
      />
      <Tab.Screen
        name="Settings"
        component={SettingsScreen}
        options={{
          tabBarIcon: ({ color }) => <SettingsIcon color={color} />,
          tabBarLabel: '設定',
        }}
      />
    </Tab.Navigator>
  );
}

// ルートスタックナビゲーション
function AppNavigator() {
  return (
    <Stack.Navigator>
      <Stack.Screen
        name="Splash"
        component={SplashScreen}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="Login"
        component={LoginScreen}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="Main"
        component={MainTabs}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="ApiKeySetup"
        component={ApiKeySetupScreen}
        options={{
          title: 'DeepL API Key設定',
          headerBackTitle: '設定',
        }}
      />
      <Stack.Screen
        name="License"
        component={LicenseScreen}
        options={{
          title: 'ライセンス',
          headerBackTitle: '設定',
        }}
      />
    </Stack.Navigator>
  );
}
```

---

## ディープリンク・外部連携

### URL Scheme

#### Blueskyアプリへの投稿
```
bluesky://intent/compose?text={encoded_text}
```

実装例:
```typescript
import * as Linking from 'expo-linking';

async function shareToBluesky(text: string) {
  const encodedText = encodeURIComponent(text);
  const url = `bluesky://intent/compose?text=${encodedText}`;
  
  const canOpen = await Linking.canOpenURL(url);
  if (canOpen) {
    await Linking.openURL(url);
  } else {
    // Blueskyアプリがインストールされていない場合
    // Web版を開く
    await Linking.openURL(`https://bsky.app/intent/compose?text=${encodedText}`);
  }
}
```

#### 投稿を開く
```
https://bsky.app/profile/{handle}/post/{postId}
```

実装例:
```typescript
async function openPost(postUrl: string) {
  await Linking.openURL(postUrl);
}
```

#### DeepL APIサインアップページを開く
```typescript
async function openDeepLSignup() {
  await Linking.openURL('https://www.deepl.com/pro-api');
}
```

#### App Password取得ページを開く
```typescript
async function openBlueskyAppPasswordPage() {
  await Linking.openURL('https://bsky.app/settings/app-passwords');
}
```

---

## 画面遷移ルール

### 認証フロー
1. アプリ起動 → Splash Screen
2. 認証チェック:
   - 未認証 → Login Screen
   - 認証済み（トークン有効）→ Main Tabs（Home Screen）
   - 認証済み（トークン期限切れ）→ リフレッシュ試行
     - リフレッシュ成功 → Main Tabs
     - リフレッシュ失敗 → Login Screen
3. ログアウト → Login Screen（スタックをリセット）

### タブ切り替え
- ボトムタブナビゲーションで4画面を切り替え
- タブタップで即座に画面遷移（アニメーションあり）
- 各タブは独立した状態を保持

### モーダル表示
- Word Definition Popup: 画面下からスライドイン
- Word Detail Modal: フェードイン + スライドアップ
- 確認ダイアログ: フェードイン + スケール

### スタック遷移
- Settings → API Key Setup: 右からスライドイン
- Settings → License: 右からスライドイン
- 戻るボタン: 左へスライドアウト

---

## 状態管理

### グローバル状態
- 認証状態（ログイン中/未ログイン）
- ユーザー情報（handle, did）
- ネットワーク状態（オンライン/オフライン）
- DeepL API Key設定状態（設定済み/未設定）

### ローカル状態
- 各画面のUI状態（ローディング、エラー）
- フォーム入力値
- バリデーションエラー
- モーダル表示/非表示

### 永続化
- **expo-secure-store**: 認証トークン、ユーザー情報、DeepL API Key
- **AsyncStorage**: UI設定、キャッシュ
- **SQLite**: 単語データ、統計データ

---

## バリデーションまとめ

| 画面 | フィールド | ルール | 形式 |
|------|-----------|--------|------|
| Login | ユーザー名 | 必須、ハンドルまたはメール形式 | `user.bsky.social` または `user@example.com` |
| Login | App Password | 必須、16文字、ハイフン区切り | `xxxx-xxxx-xxxx-xxxx` |
| API Key Setup | DeepL API Key | 必須、36文字以上、末尾:fx | `xxxxxxxx-xxxx-....:fx` |
| Home | 選択単語 | 英字、1文字以上、100文字以下 | 英字、ハイフン、アポストロフィ |