# ローカライゼーション対応計画

## 背景・目的

アプリ内のi18n（日英切り替え）は完成しているが、iOSシステムレベルのローカライゼーションとデバイスロケール自動検出が未対応。
英語デバイスのユーザーに日本語の権限ダイアログが表示される問題などを解消する。

| 項目 | 現状 |
|------|------|
| アプリ内テキスト (i18next) | ✅ 完全対応済み |
| iOS 権限説明文 (InfoPlist) | ❌ 日本語のみ |
| デバイスロケール自動検出 | ❌ 未対応（常に日本語起動） |
| 外部 HTML（利規・PP） | ❌ 日本語のみ |
| App Store メタデータ（英語） | ❌ 未登録 |

---

## Step 1: InfoPlist 権限説明文の英語化（必須）

### 対象ファイル
- `app.json` — `locales` 設定を追加
- `locales/ja.json` — 新規作成（プロジェクトルートに `locales/` フォルダを作成）
- `locales/en.json` — 新規作成

> 注: ここでいう `locales/` はプロジェクトルートの新規フォルダ。`src/locales/`（i18next 用）とは別物。
> ビルド時に `ja.lproj/InfoPlist.strings`・`en.lproj/InfoPlist.strings` として出力され、デバイス言語に応じて iOS が自動選択する。

### locales/ja.json
```json
{
  "NSPhotoLibraryUsageDescription": "投稿に添付する画像を選択するために写真ライブラリへのアクセスが必要です。",
  "NSCameraUsageDescription": "投稿に添付する写真を撮影するためにカメラへのアクセスが必要です。",
  "NSUserNotificationsUsageDescription": "クイズ・単語学習のリマインダーと、Blueskyのいいねや返信などのプッシュ通知に使用します。"
}
```

### locales/en.json
```json
{
  "NSPhotoLibraryUsageDescription": "Access to your photo library is needed to select images to attach to posts.",
  "NSCameraUsageDescription": "Access to your camera is needed to take photos to attach to posts.",
  "NSUserNotificationsUsageDescription": "Used for vocabulary learning reminders and Bluesky social notifications (likes, replies, etc.)."
}
```

### app.json の変更箇所
`expo` 直下に追加：
```json
"locales": {
  "ja": "./locales/ja.json",
  "en": "./locales/en.json"
}
```

### 検証
ビルド後、英語設定の iPhone で初回起動 → 権限ダイアログが英語表示になることを確認。

---

## Step 2: デバイスロケール自動検出（推奨）

### 対象ファイル
- `package.json` — `expo-localization` を追加
- `src/locales/index.ts` — 言語検出ロジックを更新

### 検出の優先順位
1. AsyncStorage に保存済みの言語設定（ユーザーが手動設定した場合）
2. デバイスのロケール（`expo-localization` の `getLocales()[0].languageCode`）
3. `'ja'`（最終フォールバック）

### src/locales/index.ts の変更箇所
```typescript
import { getLocales } from 'expo-localization';

// 変更前
detect: async (callback: (lang: Language) => void) => {
  try {
    const savedLanguage = await AsyncStorage.getItem(STORAGE_KEYS.LANGUAGE);
    if (savedLanguage === 'ja' || savedLanguage === 'en') {
      callback(savedLanguage);
    } else {
      callback('ja'); // Default to Japanese
    }
  } catch {
    callback('ja');
  }
},

// 変更後
detect: async (callback: (lang: Language) => void) => {
  try {
    const savedLanguage = await AsyncStorage.getItem(STORAGE_KEYS.LANGUAGE);
    if (savedLanguage === 'ja' || savedLanguage === 'en') {
      callback(savedLanguage);
      return;
    }
    // デバイスロケールから判定（'en' 以外はすべて 'ja' へフォールバック）
    const deviceLocale = getLocales()[0]?.languageCode ?? 'ja';
    const lang = deviceLocale === 'en' ? 'en' : 'ja';
    callback(lang);
  } catch {
    callback('ja');
  }
},
```

### 注意事項
- `expo-localization` はネイティブモジュールのため、**dev client の再ビルドが必要**
  - `eas build --profile production-dev --platform ios`

### 検証
- 未設定状態で英語デバイスからアプリ起動 → 英語で表示されることを確認
- 未設定状態で日本語デバイスからアプリ起動 → 日本語で表示されることを確認
- 設定画面で言語を手動変更 → 次回起動時もその設定が保持されることを確認

---

## Step 3: HTML に日英タブを追加（推奨）

### 対象ファイル
- `docs/privacy-policy.html`
- `docs/terms-of-service.html`

### 方針
- JavaScript + CSS でタブ切り替えを実装（外部ライブラリ不要）
- `localStorage` で選択言語を記憶
- デフォルト表示は日本語
- 英語コンテンツは `src/locales/en/legal.json` のテキストをベースに記述
- 既存の CSS デザイン（青 #1DA1F2）に合わせたタブスタイル

### 追加する CSS
```css
.lang-tabs { display: flex; gap: 8px; margin-bottom: 24px; }
.lang-tab { padding: 6px 16px; border-radius: 4px; border: 1px solid #1DA1F2;
            cursor: pointer; background: white; color: #1DA1F2; font-size: 14px; }
.lang-tab.active { background: #1DA1F2; color: white; }
.lang-en { display: none; }
```

### 追加する HTML 構造
```html
<!-- h1 の直前 -->
<div class="lang-tabs">
  <button class="lang-tab active" onclick="switchLang('ja')">日本語</button>
  <button class="lang-tab" onclick="switchLang('en')">English</button>
</div>

<div class="lang-ja">
  <!-- 既存の日本語コンテンツ -->
</div>
<div class="lang-en">
  <!-- 英語コンテンツ（legal.json ベース） -->
</div>
```

### 追加する JavaScript
```javascript
function switchLang(lang) {
  document.querySelectorAll('.lang-tab').forEach(b => b.classList.remove('active'));
  document.querySelector('.lang-' + lang).style.display = 'block';
  document.querySelector('.lang-' + (lang === 'ja' ? 'en' : 'ja')).style.display = 'none';
  event.target.classList.add('active');
  localStorage.setItem('kumotan-lang', lang);
}
// ページ読み込み時に前回の選択を復元
const saved = localStorage.getItem('kumotan-lang');
if (saved) switchLang(saved);
```

### 検証
ブラウザで HTML を開き、タブ切り替えが正常に動作することを確認。

---

## Step 4: App Store Connect に英語メタデータ登録（リリース前に必要）

**コード変更なし** — App Store Connect 管理画面での作業。
`doc/app-store/release-info.md` の "English Version" セクションの内容を使用。

### 登録項目

| 項目 | 内容 |
|------|------|
| App Name | Kumotan |
| Subtitle | Learn English on Bluesky |
| Promotional Text | Save interesting English words from your Bluesky timeline and build your own vocabulary list! |
| Keywords | vocabulary,English,Bluesky,learning,words,translation,language,SNS,flashcard |
| Description | `release-info.md` の "English Version" セクション全文 |

### 手順
1. App Store Connect にログイン
2. アプリを選択 → バージョン情報
3. 言語を「English」に切り替えて各項目を入力
4. 保存

---

## 実施状況

- [ ] Step 1: InfoPlist 権限説明文の英語化
- [ ] Step 2: デバイスロケール自動検出
- [ ] Step 3: HTML に日英タブを追加
- [ ] Step 4: App Store Connect に英語メタデータ登録
