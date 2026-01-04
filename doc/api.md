# くもたん (Kumotan) - API設計

**アプリ名**: くもたん (Kumotan)  
**コンセプト**: 雲から学ぶ、あなたの単語帳

## 外部API一覧

| API | 用途 | 認証 | 料金 | レート制限 |
|-----|------|------|------|-----------|
| Bluesky API | タイムライン取得 | App Password | 無料 | 3000req/5分 |
| DeepL API | 英日翻訳 | API Key（ユーザー入力） | 月50万文字無料 | 制限なし |
| Free Dictionary API | 英語定義 | 不要 | 無料 | 制限なし |

---

## 1. Bluesky API

公式ドキュメント: https://docs.bsky.app/

### 認証

#### エンドポイント
```
POST https://bsky.social/xrpc/com.atproto.server.createSession
```

#### リクエスト
```json
{
  "identifier": "username.bsky.social",
  "password": "app-password-xxxx-xxxx-xxxx-xxxx"
}
```

#### レスポンス（成功）
```json
{
  "accessJwt": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "refreshJwt": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "handle": "username.bsky.social",
  "did": "did:plc:abcdefghijklmnop",
  "email": "user@example.com"
}
```

#### エラーレスポンス
```json
{
  "error": "AuthenticationRequired",
  "message": "Invalid identifier or password"
}
```

#### 実装例（TypeScript）
```typescript
import { BskyAgent } from '@atproto/api';
import * as SecureStore from 'expo-secure-store';

const agent = new BskyAgent({ service: 'https://bsky.social' });

async function login(identifier: string, password: string): Promise<Result<LoginData, AppError>> {
  try {
    const response = await agent.login({ identifier, password });
    
    // 認証トークンをSecure Storeに保存（App Passwordは保存しない）
    await SecureStore.setItemAsync('access_token', response.data.accessJwt);
    await SecureStore.setItemAsync('refresh_token', response.data.refreshJwt);
    await SecureStore.setItemAsync('user_did', response.data.did);
    await SecureStore.setItemAsync('user_handle', response.data.handle);
    
    return {
      success: true,
      data: response.data,
    };
  } catch (error) {
    return {
      success: false,
      error: new AppError(
        ErrorCode.AUTH_FAILED,
        'ログインに失敗しました。ユーザー名またはパスワードを確認してください。',
        error
      ),
    };
  }
}

// 保存された認証トークンを取得
async function getStoredAuth(): Promise<StoredAuth | null> {
  const accessToken = await SecureStore.getItemAsync('access_token');
  const refreshToken = await SecureStore.getItemAsync('refresh_token');
  const did = await SecureStore.getItemAsync('user_did');
  const handle = await SecureStore.getItemAsync('user_handle');
  
  if (!accessToken || !refreshToken || !did || !handle) {
    return null;
  }
  
  return { accessToken, refreshToken, did, handle };
}

// 認証トークンを削除（ログアウト）
async function clearAuth(): Promise<void> {
  await SecureStore.deleteItemAsync('access_token');
  await SecureStore.deleteItemAsync('refresh_token');
  await SecureStore.deleteItemAsync('user_did');
  await SecureStore.deleteItemAsync('user_handle');
}
```

---

### セッションリフレッシュ

アクセストークンの有効期限切れに対応するため、リフレッシュ処理を実装します。

#### エンドポイント
```
POST https://bsky.social/xrpc/com.atproto.server.refreshSession
```

#### ヘッダー
```
Authorization: Bearer {refreshJwt}
```

#### レスポンス（成功）
```json
{
  "accessJwt": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "refreshJwt": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "handle": "username.bsky.social",
  "did": "did:plc:abcdefghijklmnop"
}
```

#### 実装例（TypeScript）
```typescript
/**
 * セッションをリフレッシュする
 * アクセストークンの期限切れ時に自動的に呼び出される
 */
async function refreshSession(): Promise<Result<void, AppError>> {
  const refreshToken = await SecureStore.getItemAsync('refresh_token');
  
  if (!refreshToken) {
    return {
      success: false,
      error: new AppError(
        ErrorCode.TOKEN_EXPIRED,
        'セッションが期限切れです。再度ログインしてください。'
      ),
    };
  }
  
  try {
    // @atproto/apiのresumeSessionを使用
    const storedAuth = await getStoredAuth();
    if (!storedAuth) {
      throw new Error('No stored auth data');
    }
    
    await agent.resumeSession({
      accessJwt: storedAuth.accessToken,
      refreshJwt: storedAuth.refreshToken,
      handle: storedAuth.handle,
      did: storedAuth.did,
      active: true,
    });
    
    // 新しいトークンを保存
    if (agent.session) {
      await SecureStore.setItemAsync('access_token', agent.session.accessJwt);
      await SecureStore.setItemAsync('refresh_token', agent.session.refreshJwt);
    }
    
    return { success: true, data: undefined };
  } catch (error) {
    // リフレッシュ失敗時は認証情報をクリアして再ログインを要求
    await clearAuth();
    return {
      success: false,
      error: new AppError(
        ErrorCode.TOKEN_EXPIRED,
        'セッションが期限切れです。再度ログインしてください。',
        error
      ),
    };
  }
}

/**
 * 認証付きAPIリクエストのラッパー
 * トークン期限切れ時に自動リフレッシュを試みる
 */
async function authenticatedRequest<T>(
  requestFn: () => Promise<T>
): Promise<Result<T, AppError>> {
  try {
    const result = await requestFn();
    return { success: true, data: result };
  } catch (error: any) {
    // トークン期限切れの場合はリフレッシュを試みる
    if (error.status === 401 || error.message?.includes('ExpiredToken')) {
      const refreshResult = await refreshSession();
      
      if (refreshResult.success) {
        // リフレッシュ成功後、元のリクエストを再実行
        try {
          const result = await requestFn();
          return { success: true, data: result };
        } catch (retryError) {
          return {
            success: false,
            error: new AppError(ErrorCode.API_ERROR, 'リクエストに失敗しました', retryError),
          };
        }
      }
      
      return { success: false, error: refreshResult.error };
    }
    
    return {
      success: false,
      error: new AppError(ErrorCode.API_ERROR, 'リクエストに失敗しました', error),
    };
  }
}
```

---

### タイムライン取得

#### エンドポイント
```
GET https://bsky.social/xrpc/app.bsky.feed.getTimeline
```

#### パラメータ
| パラメータ | 型 | 必須 | 説明 |
|-----------|-----|------|------|
| limit | number | × | 取得件数（最大100、デフォルト50） |
| cursor | string | × | ページネーション用カーソル |

#### ヘッダー
```
Authorization: Bearer {accessJwt}
```

#### レスポンス
```json
{
  "feed": [
    {
      "post": {
        "uri": "at://did:plc:xxx/app.bsky.feed.post/xxx",
        "cid": "bafyreiabc123...",
        "author": {
          "did": "did:plc:xxx",
          "handle": "user.bsky.social",
          "displayName": "User Name",
          "avatar": "https://cdn.bsky.app/img/avatar/plain/..."
        },
        "record": {
          "text": "This is a sample post with some English words.",
          "createdAt": "2025-01-15T12:34:56.789Z",
          "$type": "app.bsky.feed.post"
        },
        "replyCount": 5,
        "repostCount": 10,
        "likeCount": 25,
        "indexedAt": "2025-01-15T12:35:00.000Z"
      }
    }
  ],
  "cursor": "1234567890"
}
```

#### 実装例
```typescript
interface TimelinePost {
  uri: string;
  text: string;
  author: {
    handle: string;
    displayName: string;
    avatar?: string;
  };
  createdAt: string;
}

async function getTimeline(limit: number = 50): Promise<Result<TimelinePost[], AppError>> {
  return await authenticatedRequest(async () => {
    // レート制限を考慮
    await rateLimiter.throttle();
    
    const response = await agent.getTimeline({ limit });
    
    return response.data.feed.map((item) => ({
      uri: item.post.uri,
      text: item.post.record.text,
      author: {
        handle: item.post.author.handle,
        displayName: item.post.author.displayName || item.post.author.handle,
        avatar: item.post.author.avatar,
      },
      createdAt: item.post.record.createdAt,
    }));
  });
}
```

---

### 投稿作成（シェア機能用）

#### エンドポイント
```
POST https://bsky.social/xrpc/com.atproto.repo.createRecord
```

#### リクエスト
```json
{
  "repo": "did:plc:xxx",
  "collection": "app.bsky.feed.post",
  "record": {
    "text": "今日は5個の単語を学習しました！ #英語学習",
    "createdAt": "2025-01-15T12:34:56.789Z",
    "$type": "app.bsky.feed.post"
  }
}
```

#### 実装例
```typescript
async function shareProgress(wordCount: number): Promise<Result<boolean, AppError>> {
  return await authenticatedRequest(async () => {
    await rateLimiter.throttle();
    
    await agent.post({
      text: `今日は${wordCount}個の単語を学習しました！ #英語学習 #くもたん`,
      createdAt: new Date().toISOString(),
    });
    
    return true;
  });
}
```

---

### レート制限

#### 仕様
- **制限**: 3000リクエスト/5分
- **ヘッダー**:
  - `RateLimit-Limit`: 制限値
  - `RateLimit-Remaining`: 残り回数
  - `RateLimit-Reset`: リセット時刻（Unix timestamp）

#### レート制限クラス
```typescript
class RateLimiter {
  private requestTimes: number[] = [];
  private readonly maxRequests: number;
  private readonly windowMs: number;
  private readonly minIntervalMs: number;

  constructor(
    maxRequests: number = 3000,
    windowMs: number = 5 * 60 * 1000, // 5分
    minIntervalMs: number = 100 // 最小リクエスト間隔
  ) {
    this.maxRequests = maxRequests;
    this.windowMs = windowMs;
    this.minIntervalMs = minIntervalMs;
  }

  async throttle(): Promise<void> {
    const now = Date.now();
    
    // ウィンドウ外の古いリクエストを削除
    this.requestTimes = this.requestTimes.filter(
      time => now - time < this.windowMs
    );

    // レート制限に達している場合は待機
    if (this.requestTimes.length >= this.maxRequests) {
      const oldestRequest = this.requestTimes[0];
      const waitTime = this.windowMs - (now - oldestRequest) + 1000; // 1秒余裕を持つ
      console.log(`Rate limit reached. Waiting ${waitTime}ms`);
      await new Promise(resolve => setTimeout(resolve, waitTime));
      // 再帰的に再チェック
      return this.throttle();
    }

    // 最小リクエスト間隔を確保
    const lastRequest = this.requestTimes[this.requestTimes.length - 1];
    if (lastRequest && now - lastRequest < this.minIntervalMs) {
      const waitTime = this.minIntervalMs - (now - lastRequest);
      await new Promise(resolve => setTimeout(resolve, waitTime));
    }

    this.requestTimes.push(Date.now());
  }

  getRemainingRequests(): number {
    const now = Date.now();
    this.requestTimes = this.requestTimes.filter(
      time => now - time < this.windowMs
    );
    return this.maxRequests - this.requestTimes.length;
  }
}

// シングルトンインスタンス
const rateLimiter = new RateLimiter();
```

---

## 2. DeepL API

公式ドキュメント: https://www.deepl.com/docs-api

### ⚠️ 重要: API Key管理方針

**DeepL API Keyはユーザーが自分で取得し、アプリ内で入力する方式を採用します。**

**理由:**
- アプリにAPI Keyを埋め込むと、逆コンパイルにより抽出される危険性がある
- 第三者による不正利用で月間制限を超過するリスクがある
- ユーザーごとに独立した無料枠（月50万文字）を利用できる

**ユーザーへの案内:**
1. [DeepL API](https://www.deepl.com/pro-api) で無料アカウント登録（クレジットカード不要）
2. ダッシュボードからAPIキーをコピー
3. アプリの設定画面で入力

**フォールバック:**
API Keyが未設定の場合、翻訳機能はスキップし、英語定義（Free Dictionary API）のみを表示します。

---

### API Key管理

```typescript
import * as SecureStore from 'expo-secure-store';

const DEEPL_API_KEY_STORAGE_KEY = 'deepl_api_key';

/**
 * DeepL API Keyを保存
 */
async function saveDeepLApiKey(apiKey: string): Promise<Result<void, AppError>> {
  // バリデーション: DeepL API Keyの形式チェック
  if (!validateDeepLApiKey(apiKey)) {
    return {
      success: false,
      error: new AppError(
        ErrorCode.VALIDATION_ERROR,
        'API Keyの形式が正しくありません。'
      ),
    };
  }
  
  // API Keyの有効性を検証
  const isValid = await verifyDeepLApiKey(apiKey);
  if (!isValid) {
    return {
      success: false,
      error: new AppError(
        ErrorCode.VALIDATION_ERROR,
        'API Keyが無効です。DeepLダッシュボードで確認してください。'
      ),
    };
  }
  
  await SecureStore.setItemAsync(DEEPL_API_KEY_STORAGE_KEY, apiKey);
  return { success: true, data: undefined };
}

/**
 * DeepL API Keyを取得
 */
async function getDeepLApiKey(): Promise<string | null> {
  return await SecureStore.getItemAsync(DEEPL_API_KEY_STORAGE_KEY);
}

/**
 * DeepL API Keyを削除
 */
async function clearDeepLApiKey(): Promise<void> {
  await SecureStore.deleteItemAsync(DEEPL_API_KEY_STORAGE_KEY);
}

/**
 * DeepL API Keyが設定済みか確認
 */
async function hasDeepLApiKey(): Promise<boolean> {
  const key = await getDeepLApiKey();
  return key !== null && key.length > 0;
}

/**
 * API Keyの形式を検証（基本的な形式チェック）
 */
function validateDeepLApiKey(apiKey: string): boolean {
  // DeepL API Key: 36文字以上、英数字とハイフン
  const pattern = /^[a-zA-Z0-9-]{36,}$/;
  return pattern.test(apiKey.trim());
}

/**
 * API Keyの有効性をDeepL APIで検証
 */
async function verifyDeepLApiKey(apiKey: string): Promise<boolean> {
  try {
    const response = await fetch('https://api-free.deepl.com/v2/usage', {
      headers: {
        'Authorization': `DeepL-Auth-Key ${apiKey}`,
      },
    });
    return response.ok;
  } catch {
    return false;
  }
}
```

---

### 翻訳

#### エンドポイント
```
POST https://api-free.deepl.com/v2/translate
```

#### ヘッダー
```
Authorization: DeepL-Auth-Key {USER_API_KEY}
Content-Type: application/json
```

#### リクエスト
```json
{
  "text": ["serendipity"],
  "source_lang": "EN",
  "target_lang": "JA"
}
```

#### レスポンス
```json
{
  "translations": [
    {
      "detected_source_language": "EN",
      "text": "セレンディピティ"
    }
  ]
}
```

#### エラーレスポンス
```json
{
  "message": "Quota Exceeded"
}
```

#### 実装例
```typescript
const DEEPL_ENDPOINT = 'https://api-free.deepl.com/v2/translate';

interface TranslateResult {
  text: string;
  detectedLanguage: string;
}

/**
 * 英語を日本語に翻訳
 * API Keyが未設定または翻訳失敗時はnullを返す
 */
async function translate(text: string): Promise<Result<TranslateResult | null, AppError>> {
  const apiKey = await getDeepLApiKey();
  
  // API Keyが未設定の場合はスキップ（エラーではない）
  if (!apiKey) {
    console.log('DeepL API Key not configured, skipping translation');
    return { success: true, data: null };
  }
  
  try {
    const response = await fetch(DEEPL_ENDPOINT, {
      method: 'POST',
      headers: {
        'Authorization': `DeepL-Auth-Key ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        text: [text],
        source_lang: 'EN',
        target_lang: 'JA',
      }),
    });
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      
      if (response.status === 403) {
        return {
          success: false,
          error: new AppError(
            ErrorCode.AUTH_FAILED,
            'DeepL API Keyが無効です。設定画面で確認してください。'
          ),
        };
      }
      
      if (response.status === 456 || errorData.message?.includes('Quota')) {
        return {
          success: false,
          error: new AppError(
            ErrorCode.QUOTA_EXCEEDED,
            'DeepL APIの月間使用量上限に達しました。'
          ),
        };
      }
      
      return {
        success: false,
        error: new AppError(
          ErrorCode.API_ERROR,
          '翻訳に失敗しました。',
          errorData
        ),
      };
    }
    
    const data = await response.json();
    return {
      success: true,
      data: {
        text: data.translations[0].text,
        detectedLanguage: data.translations[0].detected_source_language,
      },
    };
  } catch (error) {
    if (error instanceof TypeError && error.message.includes('Network')) {
      return {
        success: false,
        error: new AppError(
          ErrorCode.NETWORK_ERROR,
          'ネットワーク接続を確認してください。'
        ),
      };
    }
    
    return {
      success: false,
      error: new AppError(ErrorCode.API_ERROR, '翻訳に失敗しました。', error),
    };
  }
}
```

---

### 使用量確認

#### エンドポイント
```
GET https://api-free.deepl.com/v2/usage
```

#### ヘッダー
```
Authorization: DeepL-Auth-Key {USER_API_KEY}
```

#### レスポンス
```json
{
  "character_count": 123456,
  "character_limit": 500000
}
```

#### 実装例
```typescript
interface UsageInfo {
  used: number;
  limit: number;
  percentage: number;
  remaining: number;
}

async function checkUsage(): Promise<Result<UsageInfo | null, AppError>> {
  const apiKey = await getDeepLApiKey();
  
  if (!apiKey) {
    return { success: true, data: null };
  }
  
  try {
    const response = await fetch('https://api-free.deepl.com/v2/usage', {
      headers: {
        'Authorization': `DeepL-Auth-Key ${apiKey}`,
      },
    });
    
    if (!response.ok) {
      return {
        success: false,
        error: new AppError(ErrorCode.API_ERROR, '使用量の取得に失敗しました。'),
      };
    }
    
    const data = await response.json();
    const used = data.character_count;
    const limit = data.character_limit;
    
    return {
      success: true,
      data: {
        used,
        limit,
        percentage: Math.round((used / limit) * 100),
        remaining: limit - used,
      },
    };
  } catch (error) {
    return {
      success: false,
      error: new AppError(ErrorCode.API_ERROR, '使用量の取得に失敗しました。', error),
    };
  }
}
```

---

### 使用量アラート

```typescript
const USAGE_WARNING_THRESHOLD = 80; // 80%で警告
const USAGE_CRITICAL_THRESHOLD = 95; // 95%で危険

async function checkUsageAndAlert(): Promise<void> {
  const result = await checkUsage();
  
  if (!result.success || !result.data) {
    return;
  }
  
  const { percentage } = result.data;
  
  if (percentage >= USAGE_CRITICAL_THRESHOLD) {
    // 危険レベル: 翻訳を自動停止
    console.warn(`DeepL API usage critical: ${percentage}%`);
    // UI通知を表示
    showAlert({
      title: 'API使用量上限間近',
      message: `DeepL APIの月間使用量が${percentage}%に達しました。翻訳機能を一時停止します。`,
      type: 'error',
    });
  } else if (percentage >= USAGE_WARNING_THRESHOLD) {
    // 警告レベル
    console.warn(`DeepL API usage warning: ${percentage}%`);
    showAlert({
      title: 'API使用量警告',
      message: `DeepL APIの月間使用量が${percentage}%に達しました。`,
      type: 'warning',
    });
  }
}
```

---

## 3. Free Dictionary API

公式ドキュメント: https://dictionaryapi.dev/

### 単語検索

#### エンドポイント
```
GET https://api.dictionaryapi.dev/api/v2/entries/en/{word}
```

#### リクエスト例
```
GET https://api.dictionaryapi.dev/api/v2/entries/en/serendipity
```

#### レスポンス（成功）
```json
[
  {
    "word": "serendipity",
    "phonetic": "/ˌsɛɹənˈdɪpɪti/",
    "phonetics": [
      {
        "text": "/ˌsɛɹənˈdɪpɪti/",
        "audio": "https://api.dictionaryapi.dev/media/pronunciations/en/serendipity-us.mp3"
      }
    ],
    "meanings": [
      {
        "partOfSpeech": "noun",
        "definitions": [
          {
            "definition": "An unsought, unintended, and/or unexpected, but fortunate, discovery and/or learning experience.",
            "example": "My life is full of serendipities.",
            "synonyms": ["chance", "fortune"],
            "antonyms": []
          }
        ]
      }
    ]
  }
]
```

#### エラーレスポンス（404）
```json
{
  "title": "No Definitions Found",
  "message": "Sorry pal, we couldn't find definitions for the word you were looking for.",
  "resolution": "You can try the search again at later time or head to the web instead."
}
```

#### 実装例
```typescript
interface DictionaryResult {
  word: string;
  phonetic?: string;
  definition: string;
  example?: string;
  partOfSpeech: string;
  audio?: string;
}

async function getDefinition(word: string): Promise<Result<DictionaryResult | null, AppError>> {
  // 入力のサニタイズ
  const sanitizedWord = word.trim().toLowerCase();
  
  if (!sanitizedWord || sanitizedWord.length === 0) {
    return {
      success: false,
      error: new AppError(ErrorCode.VALIDATION_ERROR, '単語を入力してください。'),
    };
  }
  
  try {
    const response = await fetch(
      `https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(sanitizedWord)}`
    );
    
    if (response.status === 404) {
      // 単語が見つからない場合はnull（エラーではない）
      return { success: true, data: null };
    }
    
    if (!response.ok) {
      return {
        success: false,
        error: new AppError(ErrorCode.API_ERROR, '辞書APIでエラーが発生しました。'),
      };
    }
    
    const data = await response.json();
    const entry = data[0];
    const firstMeaning = entry.meanings[0];
    const firstDefinition = firstMeaning.definitions[0];
    
    return {
      success: true,
      data: {
        word: entry.word,
        phonetic: entry.phonetic || entry.phonetics?.[0]?.text,
        definition: firstDefinition.definition,
        example: firstDefinition.example,
        partOfSpeech: firstMeaning.partOfSpeech,
        audio: entry.phonetics?.find((p: any) => p.audio)?.audio,
      },
    };
  } catch (error) {
    if (error instanceof TypeError && error.message.includes('Network')) {
      return {
        success: false,
        error: new AppError(
          ErrorCode.NETWORK_ERROR,
          'ネットワーク接続を確認してください。'
        ),
      };
    }
    
    return {
      success: false,
      error: new AppError(ErrorCode.API_ERROR, '辞書の検索に失敗しました。', error),
    };
  }
}
```

---

### キャッシュ戦略
- **制限**: 明示的な制限なし
- **推奨**: 常識的な範囲で使用
- **対策**:
  - 取得した定義をDBに保存（永続キャッシュ）
  - 同じ単語は再リクエストしない
  - SQLiteにキャッシュして再利用

---

## 4. 内部サービス層API

### 統一されたResult型

```typescript
/**
 * 統一されたResult型
 * 成功時はdataを、失敗時はerrorを返す
 */
type Result<T, E = AppError> =
  | { success: true; data: T }
  | { success: false; error: E };
```

### Word型定義

```typescript
interface Word {
  id: number;
  english: string;
  japanese: string | null; // API Key未設定時はnull
  definition: string | null;
  postUrl: string | null;
  postText: string | null;
  isRead: boolean;
  createdAt: string;
  readAt: string | null;
}

interface WordFilter {
  isRead?: boolean | null;
  sortBy: 'created_at' | 'english';
  sortOrder: 'asc' | 'desc';
  limit?: number;
  offset?: number;
}
```

### WordService

```typescript
class WordService {
  /**
   * 単語を登録
   */
  async addWord(
    english: string,
    postUrl?: string,
    postText?: string
  ): Promise<Result<Word, AppError>> {
    // 入力バリデーション
    const sanitizedEnglish = english.trim().toLowerCase();
    if (!sanitizedEnglish) {
      return {
        success: false,
        error: new AppError(ErrorCode.VALIDATION_ERROR, '単語を入力してください。'),
      };
    }
    
    // 1. 重複チェック
    const existingResult = await this.findByEnglish(sanitizedEnglish);
    if (existingResult.success && existingResult.data) {
      return {
        success: false,
        error: new AppError(ErrorCode.DUPLICATE_WORD, 'この単語は既に登録されています。'),
      };
    }
    
    // 2. DeepL APIで翻訳（オプション）
    let japanese: string | null = null;
    const translationResult = await translate(sanitizedEnglish);
    if (translationResult.success && translationResult.data) {
      japanese = translationResult.data.text;
    }
    
    // 3. Free Dictionary APIで定義取得（オプション）
    let definition: string | null = null;
    const dictionaryResult = await getDefinition(sanitizedEnglish);
    if (dictionaryResult.success && dictionaryResult.data) {
      definition = dictionaryResult.data.definition;
    }
    
    // 4. 翻訳も定義も取得できなかった場合はエラー
    if (!japanese && !definition) {
      return {
        success: false,
        error: new AppError(
          ErrorCode.API_ERROR,
          '単語の情報を取得できませんでした。ネットワーク接続を確認してください。'
        ),
      };
    }
    
    // 5. DBに保存（プレースホルダーを使用してSQLインジェクション対策）
    try {
      const word = await db.runAsync(
        `INSERT INTO words (english, japanese, definition, post_url, post_text)
         VALUES (?, ?, ?, ?, ?)`,
        [sanitizedEnglish, japanese, definition, postUrl ?? null, postText ?? null]
      );
      
      const insertedWord = await db.getFirstAsync<Word>(
        'SELECT * FROM words WHERE id = ?',
        [word.lastInsertRowId]
      );
      
      if (!insertedWord) {
        throw new Error('Failed to retrieve inserted word');
      }
      
      return { success: true, data: insertedWord };
    } catch (error) {
      return {
        success: false,
        error: new AppError(ErrorCode.DATABASE_ERROR, '単語の保存に失敗しました。', error),
      };
    }
  }
  
  /**
   * 単語一覧を取得
   */
  async getWords(filter: WordFilter): Promise<Result<Word[], AppError>> {
    try {
      const words = await db.getWords(filter);
      return { success: true, data: words };
    } catch (error) {
      return {
        success: false,
        error: new AppError(ErrorCode.DATABASE_ERROR, '単語の取得に失敗しました。', error),
      };
    }
  }
  
  /**
   * 単語を検索（重複チェック用）
   */
  async findByEnglish(english: string): Promise<Result<Word | null, AppError>> {
    try {
      const word = await db.getFirstAsync<Word>(
        'SELECT * FROM words WHERE english = ? LIMIT 1',
        [english.trim().toLowerCase()]
      );
      return { success: true, data: word ?? null };
    } catch (error) {
      return {
        success: false,
        error: new AppError(ErrorCode.DATABASE_ERROR, '単語の検索に失敗しました。', error),
      };
    }
  }
  
  /**
   * 既読状態を切り替え
   */
  async toggleRead(id: number): Promise<Result<Word, AppError>> {
    try {
      const word = await db.getFirstAsync<Word>(
        'SELECT * FROM words WHERE id = ?',
        [id]
      );
      
      if (!word) {
        return {
          success: false,
          error: new AppError(ErrorCode.WORD_NOT_FOUND, '単語が見つかりません。'),
        };
      }
      
      await db.withTransactionAsync(async () => {
        const newIsRead = word.isRead ? 0 : 1;
        const readAt = newIsRead ? new Date().toISOString() : null;
        
        await db.runAsync(
          'UPDATE words SET is_read = ?, read_at = ? WHERE id = ?',
          [newIsRead, readAt, id]
        );
        
        // 統計を更新
        if (newIsRead) {
          await db.runAsync(
            `INSERT INTO daily_stats (date, words_read_count)
             VALUES (date('now'), 1)
             ON CONFLICT(date) DO UPDATE SET
             words_read_count = words_read_count + 1`
          );
        } else {
          await db.runAsync(
            `UPDATE daily_stats
             SET words_read_count = MAX(0, words_read_count - 1)
             WHERE date = date('now')`
          );
        }
      });
      
      const updatedWord = await db.getFirstAsync<Word>(
        'SELECT * FROM words WHERE id = ?',
        [id]
      );
      
      return { success: true, data: updatedWord! };
    } catch (error) {
      return {
        success: false,
        error: new AppError(ErrorCode.DATABASE_ERROR, '既読状態の更新に失敗しました。', error),
      };
    }
  }
  
  /**
   * 単語を削除
   */
  async deleteWord(id: number): Promise<Result<void, AppError>> {
    try {
      await db.runAsync('DELETE FROM words WHERE id = ?', [id]);
      return { success: true, data: undefined };
    } catch (error) {
      return {
        success: false,
        error: new AppError(ErrorCode.DATABASE_ERROR, '単語の削除に失敗しました。', error),
      };
    }
  }
}
```

---

### StatsService

```typescript
interface Stats {
  totalWords: number;
  readWords: number;
  readPercentage: number;
  thisWeekDays: number;
  streak: number;
  todayCount: number;
}

interface DailyStats {
  date: string;
  wordsReadCount: number;
}

class StatsService {
  /**
   * 統計情報を取得
   */
  async getStats(): Promise<Result<Stats, AppError>> {
    try {
      const [totalResult, readResult, thisWeekResult, streakResult, todayResult] =
        await Promise.all([
          db.getFirstAsync<{ count: number }>('SELECT COUNT(*) as count FROM words'),
          db.getFirstAsync<{ count: number }>(
            'SELECT COUNT(*) as count FROM words WHERE is_read = 1'
          ),
          db.getFirstAsync<{ count: number }>(
            `SELECT COUNT(DISTINCT date) as count FROM daily_stats
             WHERE date >= date('now', '-7 days')`
          ),
          this.calculateStreak(),
          db.getFirstAsync<{ count: number }>(
            `SELECT COUNT(*) as count FROM words
             WHERE date(read_at) = date('now')`
          ),
        ]);
      
      const total = totalResult?.count ?? 0;
      const read = readResult?.count ?? 0;
      
      return {
        success: true,
        data: {
          totalWords: total,
          readWords: read,
          readPercentage: total > 0 ? Math.round((read / total) * 100) : 0,
          thisWeekDays: thisWeekResult?.count ?? 0,
          streak: streakResult,
          todayCount: todayResult?.count ?? 0,
        },
      };
    } catch (error) {
      return {
        success: false,
        error: new AppError(ErrorCode.DATABASE_ERROR, '統計の取得に失敗しました。', error),
      };
    }
  }
  
  /**
   * 連続学習日数を計算
   */
  private async calculateStreak(): Promise<number> {
    let streak = 0;
    let currentDate = new Date();
    
    while (true) {
      const dateStr = currentDate.toISOString().split('T')[0];
      const result = await db.getFirstAsync<{ count: number }>(
        'SELECT COUNT(*) as count FROM daily_stats WHERE date = ? AND words_read_count > 0',
        [dateStr]
      );
      
      if (result?.count === 0) {
        // 今日の場合は、まだ学習していなくても昨日からの連続を確認
        if (streak === 0 && dateStr === new Date().toISOString().split('T')[0]) {
          currentDate.setDate(currentDate.getDate() - 1);
          continue;
        }
        break;
      }
      
      streak++;
      currentDate.setDate(currentDate.getDate() - 1);
    }
    
    return streak;
  }
  
  /**
   * カレンダーデータを取得
   */
  async getCalendarData(year: number, month: number): Promise<Result<DailyStats[], AppError>> {
    try {
      const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
      const endDate = new Date(year, month, 0).toISOString().split('T')[0];
      
      const results = await db.getAllAsync<{ date: string; words_read_count: number }>(
        `SELECT date, words_read_count FROM daily_stats
         WHERE date BETWEEN ? AND ?
         ORDER BY date`,
        [startDate, endDate]
      );
      
      return {
        success: true,
        data: results.map(r => ({
          date: r.date,
          wordsReadCount: r.words_read_count,
        })),
      };
    } catch (error) {
      return {
        success: false,
        error: new AppError(ErrorCode.DATABASE_ERROR, 'カレンダーデータの取得に失敗しました。', error),
      };
    }
  }
  
  /**
   * 今日の進捗をシェア
   */
  async shareProgress(): Promise<Result<boolean, AppError>> {
    const statsResult = await this.getStats();
    if (!statsResult.success) {
      return statsResult;
    }
    
    return await shareProgress(statsResult.data.todayCount);
  }
}
```

---

## エラーハンドリング

### エラーコード定義

```typescript
enum ErrorCode {
  // ネットワークエラー
  NETWORK_ERROR = 'NETWORK_ERROR',
  TIMEOUT = 'TIMEOUT',
  
  // 認証エラー
  AUTH_FAILED = 'AUTH_FAILED',
  TOKEN_EXPIRED = 'TOKEN_EXPIRED',
  
  // API エラー
  RATE_LIMIT = 'RATE_LIMIT',
  QUOTA_EXCEEDED = 'QUOTA_EXCEEDED',
  API_ERROR = 'API_ERROR',
  
  // バリデーションエラー
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  
  // データエラー
  DUPLICATE_WORD = 'DUPLICATE_WORD',
  WORD_NOT_FOUND = 'WORD_NOT_FOUND',
  DATABASE_ERROR = 'DATABASE_ERROR',
  
  // 不明なエラー
  UNKNOWN = 'UNKNOWN',
}

class AppError extends Error {
  readonly code: ErrorCode;
  readonly originalError?: unknown;
  readonly timestamp: string;
  
  constructor(
    code: ErrorCode,
    message: string,
    originalError?: unknown
  ) {
    super(message);
    this.name = 'AppError';
    this.code = code;
    this.originalError = originalError;
    this.timestamp = new Date().toISOString();
    
    // エラーログを記録（本番環境では外部サービスへ送信を検討）
    console.error(`[${this.timestamp}] ${code}: ${message}`, originalError);
  }
  
  /**
   * ユーザー向けのエラーメッセージを取得
   */
  getUserMessage(): string {
    return this.message;
  }
  
  /**
   * エラーが再試行可能かどうか
   */
  isRetryable(): boolean {
    return [
      ErrorCode.NETWORK_ERROR,
      ErrorCode.TIMEOUT,
      ErrorCode.API_ERROR,
    ].includes(this.code);
  }
  
  /**
   * 認証エラーかどうか
   */
  isAuthError(): boolean {
    return [
      ErrorCode.AUTH_FAILED,
      ErrorCode.TOKEN_EXPIRED,
    ].includes(this.code);
  }
}
```

### 統一されたAPIコールラッパー

```typescript
interface RetryOptions {
  maxRetries?: number;
  retryDelayMs?: number;
  shouldRetry?: (error: AppError) => boolean;
}

async function safeApiCall<T>(
  operation: () => Promise<T>,
  context: string,
  options: RetryOptions = {}
): Promise<Result<T, AppError>> {
  const {
    maxRetries = 2,
    retryDelayMs = 1000,
    shouldRetry = (error) => error.isRetryable(),
  } = options;
  
  let lastError: AppError | null = null;
  
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const result = await operation();
      return { success: true, data: result };
    } catch (error: unknown) {
      lastError = mapToAppError(error, context);
      
      // 再試行可能かつ最大試行回数に達していない場合
      if (attempt < maxRetries && shouldRetry(lastError)) {
        console.log(`Retrying ${context} (attempt ${attempt + 2}/${maxRetries + 1})`);
        await new Promise(resolve => setTimeout(resolve, retryDelayMs * (attempt + 1)));
        continue;
      }
      
      break;
    }
  }
  
  return {
    success: false,
    error: lastError ?? new AppError(ErrorCode.UNKNOWN, '不明なエラーが発生しました。'),
  };
}

/**
 * 各種エラーをAppErrorにマッピング
 */
function mapToAppError(error: unknown, context: string): AppError {
  if (error instanceof AppError) {
    return error;
  }
  
  if (error instanceof TypeError) {
    if (error.message.includes('Network') || error.message.includes('fetch')) {
      return new AppError(
        ErrorCode.NETWORK_ERROR,
        'ネットワーク接続を確認してください。',
        error
      );
    }
  }
  
  if (error instanceof Error) {
    if (error.message.includes('timeout') || error.message.includes('Timeout')) {
      return new AppError(
        ErrorCode.TIMEOUT,
        'リクエストがタイムアウトしました。',
        error
      );
    }
    
    if (error.message.includes('401') || error.message.includes('Unauthorized')) {
      return new AppError(
        ErrorCode.AUTH_FAILED,
        '認証に失敗しました。再度ログインしてください。',
        error
      );
    }
    
    if (error.message.includes('429') || error.message.includes('rate limit')) {
      return new AppError(
        ErrorCode.RATE_LIMIT,
        'リクエストが多すぎます。しばらく待ってから再試行してください。',
        error
      );
    }
  }
  
  return new AppError(
    ErrorCode.UNKNOWN,
    `${context}でエラーが発生しました。`,
    error
  );
}
```

---

## 入力バリデーション

```typescript
/**
 * バリデーションユーティリティ
 */
const Validators = {
  /**
   * Blueskyハンドルのバリデーション
   * 例: user.bsky.social, user@example.com
   */
  isValidHandle(handle: string): boolean {
    const trimmed = handle.trim();
    // ハンドル形式（domain形式）
    const handlePattern = /^([a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?\.)+[a-zA-Z]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?$/;
    // メール形式
    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    
    return handlePattern.test(trimmed) || emailPattern.test(trimmed);
  },
  
  /**
   * Bluesky App Passwordのバリデーション
   * 形式: xxxx-xxxx-xxxx-xxxx（英小文字と数字）
   */
  isValidAppPassword(password: string): boolean {
    const pattern = /^[a-z0-9]{4}-[a-z0-9]{4}-[a-z0-9]{4}-[a-z0-9]{4}$/;
    return pattern.test(password.trim());
  },
  
  /**
   * DeepL API Keyのバリデーション
   * 形式: 36文字以上の英数字とハイフン、末尾が:fx（Free版）
   */
  isValidDeepLApiKey(apiKey: string): boolean {
    const trimmed = apiKey.trim();
    // Free版は末尾が:fxで終わる
    if (!trimmed.endsWith(':fx')) {
      return false;
    }
    // 基本的な形式チェック
    const pattern = /^[a-zA-Z0-9-]{36,}:fx$/;
    return pattern.test(trimmed);
  },
  
  /**
   * 英単語のバリデーション
   */
  isValidEnglishWord(word: string): boolean {
    const trimmed = word.trim();
    // 1文字以上、英字・ハイフン・アポストロフィ・スペースを許可
    const pattern = /^[a-zA-Z][a-zA-Z'\s-]*$/;
    return trimmed.length > 0 && trimmed.length <= 100 && pattern.test(trimmed);
  },
};

/**
 * バリデーションエラーのResult生成
 */
function validationError(message: string): Result<never, AppError> {
  return {
    success: false,
    error: new AppError(ErrorCode.VALIDATION_ERROR, message),
  };
}
```

---

## オフライン対応

```typescript
import NetInfo, { NetInfoState } from '@react-native-community/netinfo';

class NetworkMonitor {
  private isConnected: boolean = true;
  private listeners: Set<(isConnected: boolean) => void> = new Set();
  private unsubscribe: (() => void) | null = null;
  
  /**
   * ネットワーク監視を開始
   */
  start(): void {
    this.unsubscribe = NetInfo.addEventListener((state: NetInfoState) => {
      const wasConnected = this.isConnected;
      this.isConnected = state.isConnected ?? false;
      
      if (wasConnected !== this.isConnected) {
        console.log(`Network status changed: ${this.isConnected ? 'online' : 'offline'}`);
        this.notifyListeners();
      }
    });
  }
  
  /**
   * ネットワーク監視を停止
   */
  stop(): void {
    this.unsubscribe?.();
    this.unsubscribe = null;
  }
  
  /**
   * 現在のネットワーク状態を取得
   */
  getIsConnected(): boolean {
    return this.isConnected;
  }
  
  /**
   * ネットワーク状態の変更を購読
   */
  subscribe(listener: (isConnected: boolean) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }
  
  private notifyListeners(): void {
    this.listeners.forEach(listener => listener(this.isConnected));
  }
  
  /**
   * ネットワーク接続が必要な操作をラップ
   */
  async requireNetwork<T>(
    operation: () => Promise<T>,
    offlineMessage: string = 'この操作にはネットワーク接続が必要です。'
  ): Promise<Result<T, AppError>> {
    if (!this.isConnected) {
      return {
        success: false,
        error: new AppError(ErrorCode.NETWORK_ERROR, offlineMessage),
      };
    }
    
    try {
      const result = await operation();
      return { success: true, data: result };
    } catch (error) {
      return {
        success: false,
        error: mapToAppError(error, 'network operation'),
      };
    }
  }
}

// シングルトンインスタンス
export const networkMonitor = new NetworkMonitor();
```

---

## API使用量モニタリング

```typescript
class ApiMonitor {
  private lastUsageCheck: number = 0;
  private readonly CHECK_INTERVAL_MS = 60 * 60 * 1000; // 1時間
  
  /**
   * 定期的な使用量チェック
   */
  async checkUsageIfNeeded(): Promise<void> {
    const now = Date.now();
    
    if (now - this.lastUsageCheck < this.CHECK_INTERVAL_MS) {
      return;
    }
    
    this.lastUsageCheck = now;
    await checkUsageAndAlert();
  }
  
  /**
   * 翻訳前のチェック
   * 使用量が危険レベルの場合はfalseを返す
   */
  async canTranslate(): Promise<boolean> {
    const result = await checkUsage();
    
    if (!result.success || !result.data) {
      // API Key未設定の場合は翻訳をスキップ
      return false;
    }
    
    // 95%以上使用している場合は翻訳を停止
    return result.data.percentage < 95;
  }
}

export const apiMonitor = new ApiMonitor();
```
