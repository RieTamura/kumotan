# ストレージ戦略 - 補足資料

## ストレージの使い分け

このアプリでは3種類のストレージを目的に応じて使い分けます。

### 1. expo-secure-store（機密データ）

**用途**: 暗号化が必要な機密情報

**保存するデータ**:
- Bluesky認証トークン（accessJwt, refreshJwt）
- Blueskyユーザー情報（did, handle）
- DeepL API Key（ユーザーが入力したもの）

**⚠️ 保存しないデータ**:
- **App Password**: 認証時のみ使用し、保存しない（セキュリティ上の理由）
- 認証はトークンベースで行い、App Passwordの再入力が必要な場合は再ログインを要求

**特徴**:
- iOS: Keychain（ハードウェア暗号化）
- Android: EncryptedSharedPreferences + KeyStore
- 完全に暗号化されて保存
- アプリ削除時に自動削除

**実装例**:
```typescript
import * as SecureStore from 'expo-secure-store';

// ✅ 保存するもの: 認証トークン
await SecureStore.setItemAsync('access_token', response.data.accessJwt);
await SecureStore.setItemAsync('refresh_token', response.data.refreshJwt);
await SecureStore.setItemAsync('user_did', response.data.did);
await SecureStore.setItemAsync('user_handle', response.data.handle);

// ✅ 保存するもの: ユーザーが入力したDeepL API Key
await SecureStore.setItemAsync('deepl_api_key', userInputApiKey);

// ❌ 保存しないもの: App Password
// App Passwordは認証後に破棄し、保存しない
```

**制限**:
- データサイズ: 2048バイト（iOS）/ 無制限（Android）
- キー長: 無制限
- 大きなデータは保存不可

---

### 2. @react-native-async-storage/async-storage（非機密データ）

**用途**: 暗号化不要な設定・キャッシュ

**保存するデータ**:
- UIテーマ設定（ライト/ダーク）
- 言語設定
- 最終フィード更新日時
- チュートリアル完了フラグ
- その他キャッシュデータ

**⚠️ 保存してはいけないデータ**:
- API Key、トークン、パスワードなどの機密情報

**特徴**:
- 平文で保存（暗号化なし）
- シンプルなkey-value store
- 高速アクセス
- 大きなデータも保存可能

**実装例**:
```typescript
import AsyncStorage from '@react-native-async-storage/async-storage';

// ✅ 適切な使用例
await AsyncStorage.setItem('theme', 'dark');
await AsyncStorage.setItem('language', 'ja');
await AsyncStorage.setItem('tutorial_completed', 'true');
await AsyncStorage.setItem('last_feed_update', new Date().toISOString());

// ❌ 不適切な使用例（絶対に行わない）
// await AsyncStorage.setItem('api_key', apiKey); // 危険！
// await AsyncStorage.setItem('password', password); // 危険！
```

**制限**:
- データサイズ: 制限なし（但し大量データは非推奨）
- JSON化が必要: 複雑なオブジェクトはJSON.stringify/parse

---

### 3. expo-sqlite（構造化データ）

**用途**: 検索・集計が必要な構造化データ

**保存するデータ**:
- 単語データ（英語、日本語訳、定義、投稿情報など）
- 日別学習統計（カレンダー表示用）

**特徴**:
- SQLクエリで高度な検索・ソート・集計
- リレーショナルデータに最適
- インデックスによる高速化
- データ量が増えても性能維持

**実装例**:
```typescript
import * as SQLite from 'expo-sqlite';

const db = await SQLite.openDatabaseAsync('soratan.db');

// ✅ プレースホルダーを使用（SQLインジェクション対策）
const words = await db.getAllAsync(
  'SELECT * FROM words WHERE is_read = ? ORDER BY created_at DESC LIMIT ?',
  [0, 50]
);

// ❌ 文字列結合は禁止
// const words = await db.getAllAsync(
//   `SELECT * FROM words WHERE english = '${userInput}'`  // 危険！
// );

// トランザクション使用
await db.withTransactionAsync(async () => {
  await db.runAsync('UPDATE words SET is_read = 1 WHERE id = ?', [wordId]);
  await db.runAsync(
    'INSERT INTO daily_stats (date, words_read_count) VALUES (?, 1) ' +
    'ON CONFLICT(date) DO UPDATE SET words_read_count = words_read_count + 1',
    [new Date().toISOString().split('T')[0]]
  );
});
```

**制限**:
- データサイズ: デバイスストレージ容量に依存
- 複雑なクエリは学習コストあり

---

## データの流れ

### アプリ起動時
```
1. Secure Store → 認証トークン取得
2. AsyncStorage → UI設定取得
3. SQLite → 単語データ読み込み
```

### ログイン時
```
1. ユーザーがApp Passwordを入力
2. Bluesky APIで認証
3. Secure Store → 認証トークンを保存（App Passwordは保存しない）
4. App Passwordをメモリから破棄
```

### 単語登録時
```
1. ネットワーク状態確認
2. Secure Store → DeepL API Key取得（設定済みの場合）
3. API → 翻訳・定義取得
4. SQLite → 単語データ保存（プレースホルダー使用）
```

### ログアウト時
```
1. Secure Store → 認証トークン削除
2. Secure Store → ユーザー情報削除
3. AsyncStorage → 設定はそのまま（UI設定は保持）
4. SQLite → データはそのまま（ユーザーが削除を選択するまで保持）
```

### データ完全削除時
```
1. Secure Store → 認証トークン削除
2. Secure Store → DeepL API Key削除
3. AsyncStorage → すべてクリア
4. SQLite → データベース削除
```

---

## セキュリティベストプラクティス

### ✅ やるべきこと

1. **機密情報はSecure Storeに保存**
   ```typescript
   // 認証トークン
   await SecureStore.setItemAsync('access_token', token);
   
   // ユーザーが入力したAPI Key
   await SecureStore.setItemAsync('deepl_api_key', apiKey);
   ```

2. **App Passwordは保存しない**
   ```typescript
   async function login(identifier: string, appPassword: string) {
     // 認証リクエスト
     const response = await agent.login({ identifier, password: appPassword });
     
     // トークンのみを保存
     await SecureStore.setItemAsync('access_token', response.data.accessJwt);
     await SecureStore.setItemAsync('refresh_token', response.data.refreshJwt);
     
     // appPasswordは保存しない、この関数終了後にメモリから解放される
   }
   ```

3. **DeepL API Keyはユーザー入力方式**
   ```typescript
   // ❌ 危険: アプリにAPI Keyを埋め込む
   // const API_KEY = process.env.EXPO_PUBLIC_DEEPL_KEY;
   
   // ✅ 安全: ユーザーに入力させる
   async function saveDeepLApiKey(userInputKey: string) {
     // 検証
     const isValid = await verifyDeepLApiKey(userInputKey);
     if (!isValid) {
       throw new Error('Invalid API Key');
     }
     // Secure Storeに保存
     await SecureStore.setItemAsync('deepl_api_key', userInputKey);
   }
   ```

4. **SQLクエリはプレースホルダーを使用**
   ```typescript
   // ✅ 安全
   await db.runAsync('SELECT * FROM words WHERE english = ?', [userInput]);
   ```

5. **ログアウト時に機密データを削除**
   ```typescript
   async function logout() {
     await SecureStore.deleteItemAsync('access_token');
     await SecureStore.deleteItemAsync('refresh_token');
     await SecureStore.deleteItemAsync('user_did');
     await SecureStore.deleteItemAsync('user_handle');
     // DeepL API Keyは削除しない（ユーザー設定として保持）
   }
   ```

### ❌ やってはいけないこと

1. **AsyncStorageに機密情報を保存**
   ```typescript
   // ❌ ダメ
   await AsyncStorage.setItem('password', userPassword);
   await AsyncStorage.setItem('api_key', apiKey);
   
   // ✅ 正しい
   await SecureStore.setItemAsync('api_key', apiKey);
   ```

2. **トークンやAPI Keyをログに出力**
   ```typescript
   // ❌ ダメ
   console.log('Token:', accessToken);
   console.log('API Key:', apiKey);
   
   // ✅ 正しい
   console.log('Token obtained:', !!accessToken);
   console.log('API Key configured:', !!apiKey);
   ```

3. **Secure Storeに大きなデータを保存**
   ```typescript
   // ❌ ダメ（iOSは2048バイト制限）
   await SecureStore.setItemAsync('all_words', JSON.stringify(words));
   
   // ✅ 正しい（SQLiteを使う）
   await db.runAsync('INSERT INTO words ...');
   ```

4. **App Passwordを保存**
   ```typescript
   // ❌ 絶対にダメ
   await SecureStore.setItemAsync('app_password', appPassword);
   
   // ✅ トークンのみ保存
   await SecureStore.setItemAsync('access_token', accessJwt);
   await SecureStore.setItemAsync('refresh_token', refreshJwt);
   ```

5. **API Keyをアプリにハードコード**
   ```typescript
   // ❌ 絶対にダメ（逆コンパイルで抽出可能）
   const DEEPL_API_KEY = 'xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx:fx';
   
   // ❌ 環境変数も危険（ビルド時に埋め込まれる）
   const DEEPL_API_KEY = process.env.EXPO_PUBLIC_DEEPL_KEY;
   
   // ✅ ユーザーに入力させる
   const apiKey = await SecureStore.getItemAsync('deepl_api_key');
   ```

---

## パフォーマンス最適化

### AsyncStorage

**キャッシュ戦略**:
```typescript
// メモリキャッシュで高速化
let themeCache: string | null = null;

async function getTheme(): Promise<string> {
  if (themeCache) return themeCache;
  
  themeCache = await AsyncStorage.getItem('theme');
  return themeCache || 'light';
}
```

### SQLite

**インデックス活用**:
```sql
-- よく検索するカラムにインデックス
CREATE INDEX idx_words_english ON words(english);
CREATE INDEX idx_words_created_at ON words(created_at DESC);

-- 複合インデックス
CREATE INDEX idx_words_read_date ON words(is_read, created_at DESC);
```

**プリペアドステートメント**:
```typescript
// 同じクエリを繰り返す場合
const statement = await db.prepareAsync(
  'SELECT * FROM words WHERE is_read = ? LIMIT ?'
);

for (const isRead of [0, 1]) {
  const result = await statement.executeAsync([isRead, 50]);
  // 処理...
}

await statement.finalizeAsync();
```

---

## トラブルシューティング

### Secure Storeエラー

**エラー**: `SecureStore is not available on this platform`
- **原因**: Expoシミュレータの一部で未対応
- **解決**: 実機でテストするか、開発時はAsyncStorageで代用（ただし本番では必ずSecure Store）

### SQLiteエラー

**エラー**: `database is locked`
- **原因**: 複数の同時書き込み
- **解決**: トランザクションを使用

```typescript
await db.withTransactionAsync(async () => {
  // 複数の操作をまとめる
});
```

### AsyncStorageサイズ制限

**エラー**: データが大きすぎる
- **原因**: 6MB以上のデータ
- **解決**: SQLiteに移行するか、データを分割

---

## まとめ

| ストレージ | 用途 | 暗号化 | サイズ制限 | 推奨度 |
|----------|------|--------|-----------|--------|
| **Secure Store** | 認証トークン、API Key | ⭐⭐⭐ | 2KB（iOS） | 認証情報に必須 |
| **AsyncStorage** | UI設定 | なし | 6MB推奨 | 簡単な設定に便利 |
| **SQLite** | 構造化データ | なし | 無制限 | 検索が必要なデータに最適 |

### 重要なセキュリティポリシー

1. **App Passwordは保存しない** - トークンベースの認証を使用
2. **DeepL API Keyはユーザー入力** - アプリへの埋め込み禁止
3. **SQLクエリはプレースホルダー必須** - SQLインジェクション対策
4. **機密情報はログ出力禁止** - デバッグ時も注意

正しいストレージを選択し、セキュリティポリシーを遵守することで、安全なアプリを構築できます。