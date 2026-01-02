# くもたん (Kumotan) - アーキテクチャ設計

**アプリ名**: くもたん (Kumotan)  
**コンセプト**: 雲から学ぶ、あなたの単語帳

## システム構成図

```
┌─────────────────────────────────────────────────┐
│               iOS App (Expo)                    │
│  ┌───────────────────────────────────────────┐ │
│  │         Presentation Layer               │ │
│  │  - React Native Components               │ │
│  │  - Navigation (React Navigation)         │ │
│  │  - UI/UX (React Native Paper/Native Base)│ │
│  └───────────────────────────────────────────┘ │
│  ┌───────────────────────────────────────────┐ │
│  │         Business Logic Layer             │ │
│  │  - Hooks (Custom Hooks)                  │ │
│  │  - State Management (Context API/Zustand)│ │
│  │  - Data Processing                       │ │
│  └───────────────────────────────────────────┘ │
│  ┌───────────────────────────────────────────┐ │
│  │         Data Access Layer                │ │
│  │  - Database Service (SQLite)             │ │
│  │  - API Service (Bluesky, DeepL, Dict)    │ │
│  │  - Cache Management                      │ │
│  └───────────────────────────────────────────┘ │
│  ┌───────────────────────────────────────────┐ │
│  │         Storage Layer                    │ │
│  │  - expo-sqlite (Local DB)                │ │
│  │  - expo-secure-store (Auth & API Keys)   │ │
│  │  - AsyncStorage (Settings)               │ │
│  └───────────────────────────────────────────┘ │
└─────────────────────────────────────────────────┘
                      │
        ┌─────────────┼─────────────┐
        │             │             │
   ┌────▼────┐  ┌────▼────┐  ┌────▼────┐
   │Bluesky  │  │ DeepL   │  │  Free   │
   │   API   │  │   API   │  │Dict API │
   └─────────┘  └─────────┘  └─────────┘
```

## ディレクトリ構成

```
soratan/
├── src/
│   ├── screens/              # 画面コンポーネント
│   │   ├── HomeScreen.tsx
│   │   ├── WordListScreen.tsx
│   │   ├── ProgressScreen.tsx
│   │   ├── SettingsScreen.tsx
│   │   ├── ApiKeySetupScreen.tsx  # DeepL API Key設定画面
│   │   ├── LicenseScreen.tsx
│   │   └── LoginScreen.tsx
│   ├── components/           # 再利用可能なコンポーネント
│   │   ├── PostCard.tsx
│   │   ├── WordPopup.tsx
│   │   ├── WordListItem.tsx
│   │   ├── Calendar.tsx
│   │   ├── StatsCard.tsx
│   │   ├── OfflineBanner.tsx  # オフライン状態表示
│   │   └── common/
│   │       ├── Button.tsx
│   │       ├── Input.tsx
│   │       └── Loading.tsx
│   ├── navigation/           # ナビゲーション設定
│   │   └── AppNavigator.tsx
│   ├── services/             # 外部サービス連携
│   │   ├── bluesky/
│   │   │   ├── auth.ts
│   │   │   ├── feed.ts
│   │   │   └── session.ts    # トークンリフレッシュ
│   │   ├── dictionary/
│   │   │   ├── deepl.ts
│   │   │   └── freeDictionary.ts
│   │   ├── database/
│   │   │   ├── init.ts
│   │   │   ├── words.ts
│   │   │   └── stats.ts
│   │   └── network/
│   │       └── monitor.ts    # ネットワーク状態監視
│   ├── hooks/                # カスタムフック
│   │   ├── useBlueskyFeed.ts
│   │   ├── useWords.ts
│   │   ├── useStats.ts
│   │   ├── useDictionary.ts
│   │   └── useNetworkStatus.ts
│   ├── store/                # 状態管理
│   │   ├── authStore.ts
│   │   ├── wordsStore.ts
│   │   └── settingsStore.ts
│   ├── types/                # TypeScript型定義
│   │   ├── bluesky.ts
│   │   ├── word.ts
│   │   ├── stats.ts
│   │   └── result.ts         # Result型定義
│   ├── utils/                # ユーティリティ関数
│   │   ├── textSelection.ts
│   │   ├── dateFormatter.ts
│   │   ├── validators.ts     # 入力バリデーション
│   │   └── errors.ts         # エラーハンドリング
│   └── constants/            # 定数
│       ├── colors.ts
│       ├── api.ts
│       └── config.ts
├── assets/                   # 静的ファイル
│   ├── fonts/
│   └── images/
├── app.json
├── package.json
└── tsconfig.json
```

## 技術スタック詳細

### フロントエンド
- **React Native**: 0.74.x
- **Expo**: SDK 51+
- **TypeScript**: 5.x
- **React Navigation**: v6（タブ + スタックナビゲーション）
- **UI Library**: React Native Paper または NativeBase
- **状態管理**: Zustand（軽量でシンプル）

### ストレージ
- **expo-sqlite**: ローカルデータベース（単語データ、学習統計）
- **expo-secure-store**: 機密情報の暗号化保存（認証トークン、DeepL API Key）
- **@react-native-async-storage/async-storage**: 非機密設定（UI設定、キャッシュ）

### 外部API
- **Bluesky API**: AT Protocol（@atproto/api）
- **DeepL API**: 翻訳（ユーザーが自身のAPI Keyを入力）
- **Free Dictionary API**: 英語定義

### ネットワーク
- **@react-native-community/netinfo**: ネットワーク状態監視

### その他
- **Expo File System**: データエクスポート
- **Expo Sharing**: シェア機能
- **Expo Linking**: Blueskyアプリ連携
- **date-fns**: 日付操作

## データフロー

### 1. 単語登録フロー
```
User selects text
  → Check network status
  → Call Free Dictionary API (英語定義)
  → If DeepL API Key configured:
      → Call DeepL API (日本語翻訳)
  → Show WordPopup (翻訳なしの場合は英語定義のみ)
  → User confirms
  → Save to SQLite (words table)
  → Update UI
```

### 2. フィード取得フロー
```
User opens HomeScreen
  → Check network status
  → If offline:
      → Show offline banner
      → Return
  → Check auth token (Secure Store)
  → If token expired:
      → Attempt refresh
      → If refresh fails → Login screen
  → Apply rate limiting
  → Call Bluesky API (getTimeline)
  → Cache posts in memory
  → Render PostCards
  → User pulls to refresh → repeat
```

### 3. 進捗記録フロー
```
User marks word as read
  → Update words.is_read = 1
  → Update words.read_at = NOW()
  → Update daily_stats for today (in transaction)
  → Refresh calendar view
```

### 4. DeepL API Key設定フロー
```
User opens Settings → API Key Setup
  → User enters API Key
  → Validate format (client-side)
  → Verify with DeepL API (server-side check)
  → If valid:
      → Save to Secure Store
      → Show success message
  → If invalid:
      → Show error message
      → Keep input for correction
```

## セキュリティ設計

### 認証情報の保護

#### Bluesky認証
- **App Password**: 認証時のみ使用し、**保存しない**
- **認証トークン（accessJwt, refreshJwt）**: expo-secure-storeに暗号化保存
- **トークンリフレッシュ**: 自動的にリフレッシュ、失敗時は再ログインを要求

```typescript
// ✅ 正しい実装
async function login(identifier: string, appPassword: string) {
  const response = await agent.login({ identifier, password: appPassword });
  
  // トークンのみを保存（App Passwordは保存しない）
  await SecureStore.setItemAsync('access_token', response.data.accessJwt);
  await SecureStore.setItemAsync('refresh_token', response.data.refreshJwt);
  await SecureStore.setItemAsync('user_did', response.data.did);
  await SecureStore.setItemAsync('user_handle', response.data.handle);
  
  // appPasswordは保存しない
}
```

#### DeepL API Key
- **ユーザー入力方式**: 開発者のAPI Keyをアプリに埋め込まない
- **Secure Store保存**: ユーザーが入力したAPI Keyは暗号化して保存
- **検証**: 保存前にDeepL APIで有効性を検証
- **フォールバック**: API Key未設定時は翻訳をスキップ、英語定義のみ表示

```typescript
// ✅ 正しい実装（ユーザー入力方式）
async function saveDeepLApiKey(apiKey: string) {
  // 1. 形式バリデーション
  if (!validateDeepLApiKey(apiKey)) {
    throw new Error('Invalid API Key format');
  }
  
  // 2. APIで有効性を検証
  const isValid = await verifyWithDeepLAPI(apiKey);
  if (!isValid) {
    throw new Error('Invalid API Key');
  }
  
  // 3. Secure Storeに保存
  await SecureStore.setItemAsync('deepl_api_key', apiKey);
}

// ❌ 危険な実装（埋め込み方式）
// const DEEPL_API_KEY = process.env.EXPO_PUBLIC_DEEPL_KEY; // 絶対にNG
```

### データ保護
- **SQLiteデータベース**: デバイスローカル、サンドボックス内
- **ユーザーデータ**: 外部送信なし（APIリクエストを除く）
- **プライバシー重視**: 学習データは端末内に閉じた運用

### 入力バリデーション
すべての外部入力を検証し、SQLインジェクションを防止

```typescript
// ✅ プレースホルダーを使用
await db.runAsync(
  'SELECT * FROM words WHERE english = ?',
  [userInput]
);

// ❌ 文字列結合は禁止
// await db.runAsync(`SELECT * FROM words WHERE english = '${userInput}'`);
```

### APIレート制限対策
- **Bluesky API**: RateLimiterクラスで3000リクエスト/5分を管理
- **DeepL API**: 文字数カウント、使用量80%/95%でアラート
- **Free Dictionary API**: キャッシュ（同じ単語は再取得しない）

## オフライン対応

### ネットワーク状態監視

```typescript
import NetInfo from '@react-native-community/netinfo';

class NetworkMonitor {
  private isConnected: boolean = true;
  private listeners: Set<(isConnected: boolean) => void> = new Set();
  
  start() {
    NetInfo.addEventListener(state => {
      const wasConnected = this.isConnected;
      this.isConnected = state.isConnected ?? false;
      
      if (wasConnected !== this.isConnected) {
        this.notifyListeners();
      }
    });
  }
  
  getIsConnected(): boolean {
    return this.isConnected;
  }
  
  subscribe(listener: (isConnected: boolean) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }
}
```

### オフライン時の動作

| 機能 | オンライン | オフライン |
|------|-----------|-----------|
| フィード表示 | ✅ | ❌（バナー表示） |
| 単語登録 | ✅ | ❌（ネットワーク必要） |
| 単語帳閲覧 | ✅ | ✅ |
| 既読切り替え | ✅ | ✅ |
| 進捗表示 | ✅ | ✅ |
| 設定変更 | ✅ | ✅（一部） |

### UIフィードバック

```tsx
function OfflineBanner() {
  const isConnected = useNetworkStatus();
  
  if (isConnected) return null;
  
  return (
    <View style={styles.banner}>
      <Icon name="cloud-offline" />
      <Text>オフラインです。一部の機能が制限されています。</Text>
    </View>
  );
}
```

## パフォーマンス最適化

### メモリ管理
- FlatList使用（仮想スクロール）
- 画像キャッシュ（Expo Image）
- 不要なre-renderの防止（React.memo、useMemo）

### データベース最適化
- インデックス作成（english, created_at, is_read）
- ページネーション実装
- バックグラウンドでのクエリ実行

### APIキャッシュ戦略
- Free Dictionary: 永続キャッシュ（words.definition）
- Bluesky Feed: メモリキャッシュ（5分間）
- DeepL翻訳: 結果をDBに保存（再翻訳不要）

## エラーハンドリング

### 統一されたResult型

```typescript
type Result<T, E = AppError> =
  | { success: true; data: T }
  | { success: false; error: E };
```

### エラー分類と対応

| エラー種別 | 対応 |
|-----------|------|
| ネットワークエラー | オフラインバナー表示、リトライ提案 |
| 認証エラー | ログイン画面へ遷移 |
| トークン期限切れ | 自動リフレッシュ、失敗時は再ログイン |
| レート制限 | 待機時間表示、自動リトライ |
| DeepL制限超過 | アラート表示、翻訳スキップ |
| データベースエラー | エラーログ記録、ユーザー通知 |

### リトライ戦略

```typescript
async function safeApiCall<T>(
  operation: () => Promise<T>,
  options: { maxRetries: number; retryDelayMs: number }
): Promise<Result<T, AppError>> {
  for (let attempt = 0; attempt <= options.maxRetries; attempt++) {
    try {
      const result = await operation();
      return { success: true, data: result };
    } catch (error) {
      const appError = mapToAppError(error);
      
      if (attempt < options.maxRetries && appError.isRetryable()) {
        await delay(options.retryDelayMs * (attempt + 1));
        continue;
      }
      
      return { success: false, error: appError };
    }
  }
}
```

## 主要コンポーネント設計

### WordService

```typescript
class WordService {
  // 単語登録（翻訳オプション）
  async addWord(
    english: string,
    postUrl?: string,
    postText?: string
  ): Promise<Result<Word, AppError>> {
    // 1. 入力バリデーション
    // 2. 重複チェック
    // 3. DeepL APIで翻訳（API Key設定時のみ）
    // 4. Free Dictionary APIで定義取得
    // 5. DBに保存（プレースホルダー使用）
  }
  
  // 単語一覧取得
  async getWords(filter: WordFilter): Promise<Result<Word[], AppError>>;
  
  // 既読切り替え（トランザクション使用）
  async toggleRead(id: number): Promise<Result<Word, AppError>>;
  
  // 単語削除
  async deleteWord(id: number): Promise<Result<void, AppError>>;
}
```

### StatsService

```typescript
class StatsService {
  // 統計情報取得
  async getStats(): Promise<Result<Stats, AppError>>;
  
  // カレンダーデータ取得
  async getCalendarData(year: number, month: number): Promise<Result<DailyStats[], AppError>>;
  
  // 連続学習日数計算
  private async calculateStreak(): Promise<number>;
}
```

### AuthService

```typescript
class AuthService {
  // ログイン（App Passwordは保存しない）
  async login(identifier: string, appPassword: string): Promise<Result<void, AppError>>;
  
  // セッションリフレッシュ
  async refreshSession(): Promise<Result<void, AppError>>;
  
  // ログアウト
  async logout(): Promise<void>;
  
  // 認証状態チェック
  async isAuthenticated(): Promise<boolean>;
}
```

## スケーラビリティ考慮

### 将来の拡張性
- マルチ言語対応の基盤（i18n）
- テーマ切り替え対応（ダークモード）
- プラグインアーキテクチャ（将来の機能追加）

### パフォーマンス目標
- 起動時間: 2秒以内
- フィード読み込み: 3秒以内
- 単語登録: 5秒以内（API待機含む）
- UI応答性: 60 FPS維持

### 監視とログ

```typescript
class AppError extends Error {
  constructor(code: ErrorCode, message: string, originalError?: unknown) {
    super(message);
    // エラーログを記録（デバッグ用）
    console.error(`[${new Date().toISOString()}] ${code}: ${message}`, originalError);
    
    // 本番環境では外部サービス（Sentry等）への送信を検討
  }
}
```
