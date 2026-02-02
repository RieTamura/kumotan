# 明るさ設定（テーマ設定）実装計画書

## 1. 目的
ユーザーがアプリの外観を「ライトモード」「ダークモード」、または「システム設定連動」から選択できるようにし、視認性の向上とユーザーエクスペリエンス（UX）の最適化を図る。

## 2. 実装方針
現状のコード（ライトモード固定）を拡張し、動的にカラーパレットを切り替えられる仕組みを導入する。

### 構成要素
1.  **カラーシステムの拡張**: ライト/ダークそれぞれのカラーパレットを定義。
2.  **状態管理 (Zustand)**: ユーザーが選択したテーマ（`light` | `dark` | `system`）を保持し、永続化する。
3.  **テーマ切り替え用 Hook**: 現在適用すべき色を返す `useTheme` Hook を提供。
4.  **設定 UI**: 設定画面にテーマ選択用の項目を追加。

## 3. 実装詳細

### 3.1. カラーパレットの拡張
- **ファイル**: `src/constants/colors.ts`
- **内容**:
    - `LightColors` と `DarkColors` の2つのオブジェクトを定義。
    - `Colors` オブジェクトを、現在のテーマに基づいて動的に色を返す関数または Hook 経由での参照に変更する（既存コードの互換性を考慮）。

### 3.2. テーマ管理用の Store (新規)
- **ファイル**: `src/store/themeStore.ts`
- **内容**:
    - テーマ設定（`type ThemeMode = 'light' | 'dark' | 'system'`）の管理。
    - `persist` ミドルウェアを使用して `AsyncStorage` に設定を保存。

### 3.3. テーマ適用用の Hook (新規)
- **ファイル**: `src/hooks/useTheme.ts`
- **内容**:
    - `react-native` の `useColorScheme` を使用してシステムの設定を取得。
    - Store の設定とシステム設定を組み合わせて、最終的に使用する `Colors` オブジェクトを返す。

### 3.4. 設定画面の変更
- **ファイル**: `src/screens/SettingsScreen.tsx`
- **内容**:
    - 「外観」セクションを追加。
    - テーマ選択用の `SettingsItem` を設置し、タップ時に `Alert.alert` またはアクションシートを表示して切り替え可能にする。

### 3.5. 多言語対応
- **ファイル**: `src/locales/ja/settings.json`, `src/locales/en/settings.json`
- **内容**: テーマ選択用のテキストを追加（「外観」「ライト」「ダーク」「システム設定に従う」など）。

## 4. ステップ・バイ・ステップの作業予定

1.  **[Preparation]** `src/constants/colors.ts` にダークモード用の色定義（`DarkColors`）を追加。
2.  **[Store]** `themeStore.ts` を作成し、テーマ設定の状態管理を実装。
3.  **[Hook]** `useTheme.ts` を作成し、色を動的に提供する仕組みを構築。
4.  **[Settings]** `SettingsScreen.tsx` にテーマ切り替え UI を実装。
5.  **[Refactor]** 各画面（HomeScreen, PostCard など）でインライン定義されているスタイルや、`Colors` を直接参照している箇所を `useTheme` 経由に差し替える。
6.  **[Test]** ライト/ダーク/システム連動が正しく動作することを確認。

## 5. 考慮事項
- **グラデーション**: 一部のコンポーネントでグラデーションを使用している場合、それらの色もダークモードに対応させる。
- **WebView**: もし外部コンテンツを表示している箇所があれば、ダークモード対応が必要か検討する。

## 6. 進捗状況

### 基盤実装
- [x] **[Colors]** カラーシステムの拡張 (`src/constants/colors.ts`)
- [x] **[Store]** テーマ状態管理の実装 (`src/store/themeStore.ts`)
- [x] **[Hook]** テーマ切り替え用 Hook の実装 (`src/hooks/useTheme.ts`)
- [x] **[i18n]** 多言語対応 (`src/locales/ja/settings.json`, `src/locales/en/settings.json`)
- [x] **[UI/UX]** 設定画面の実装 (`src/screens/SettingsScreen.tsx`)

### コンポーネント・画面のテーマ適用
- [ ] **[Global]** `App.tsx` (StatusBar, 全体背景)
- [ ] **[Home]** `HomeScreen.tsx`
- [ ] **[Home]** `PostCard.tsx`
- [ ] **[Post]** `PostCreationModal.tsx`
- [ ] **[Thread]** `ThreadScreen.tsx`
- [ ] **[Word]** `WordListScreen.tsx`
- [ ] **[Word]** `WordListItem.tsx`
- [ ] **[Word]** `WordPopup.tsx`
- [ ] **[Common]** `Button.tsx`
- [ ] **[Common]** `Input.tsx`
- [ ] **[Common]** `Loading.tsx`
- [ ] **[Common]** `Toast.tsx`
- [ ] **[Common]** `OfflineBanner.tsx`
- [ ] **[Common]** `FeedbackModal.tsx`
- [ ] **[Tutorial]** `TutorialTooltip.tsx`
