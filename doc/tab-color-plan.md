# タブカラー機能 実装計画（フェーズ1）

## 概要

ホーム画面のインデックスタブ（Following / カスタムフィード / プロフィール）にタブごとの
アクセントカラーを付け、フィードエリア上部にそのカラーのグラデーションオーバーレイを表示する機能。
設定画面からプリセット8色を選択可能。

## 背景・目的

- タブに枠線のない純粋な色付きデザインに変更
- アクティブなタブが何であるかをフィード背景色で視覚的に伝える
- 保守コストを抑えるため `expo-linear-gradient` は使用しない（純 JS 実装）

---

## 実装範囲（フェーズ1）

### 新規作成ファイル

| ファイル | 役割 |
| --- | --- |
| `src/utils/colorUtils.ts` | `hexToRgba`・`isLightColor` ユーティリティ |
| `src/store/tabColorStore.ts` | タブカラー状態管理（Zustand + AsyncStorage） |
| `src/screens/TabColorSettingsScreen.tsx` | タブカラー設定画面 |

### 変更ファイル

| ファイル | 変更内容 |
| --- | --- |
| `src/components/IndexTabs.tsx` | `accentColor` 対応・枠線削除 |
| `src/screens/HomeScreen.tsx` | `accentColor` 付与・グラデーションオーバーレイ追加 |
| `src/navigation/AppNavigator.tsx` | `TabColorSettings` ルート追加 |
| `src/screens/SettingsScreen.tsx` | 設定項目追加 |
| `src/locales/ja/settings.json` | i18nキー追加 |
| `src/locales/en/settings.json` | i18nキー追加 |

---

## 設計詳細

### カラープリセット（`tabColorStore.ts`）

```
#3B82F6 Sky      ← Following デフォルト
#10B981 Emerald
#F59E0B Amber    ← カスタムフィード デフォルト
#F43F5E Rose
#8B5CF6 Violet   ← プロフィール デフォルト
#14B8A6 Teal
#F97316 Orange
#64748B Slate
```

### タブ背景色ロジック（`IndexTabs.tsx`）

```
accentColor あり:
  active   → accentColor（不透明）
  inactive → hexToRgba(accentColor, 0.30)

accentColor なし（フォールバック）:
  active   → colors.indexTabActive
  inactive → colors.indexTabInactive
```

### テキスト色

```
isLightColor(accentColor) = true  → '#14171A'（暗）
isLightColor(accentColor) = false → '#FFFFFF'（白）
```

### フィードグラデーション（純 JS・`HomeScreen.tsx`）

`expo-linear-gradient` 未使用。多段 View で近似：

```
opacity 12% → height 120px (一番上)
opacity  8% → height  90px
opacity  5% → height  60px
opacity  2% → height  30px
```

各 View は `position: 'absolute', top: 0` で重ねる。PagerView の上に `pointerEvents="none"` でオーバーレイ。

---

## 除外範囲（フェーズ2以降）

- アバター画像からの自動カラー取得（`react-native-image-colors` が必要）
- グラデーションのスムーズなアニメーション（タブ切り替え時の色トランジション）
- カラーピッカー（フリー入力）
