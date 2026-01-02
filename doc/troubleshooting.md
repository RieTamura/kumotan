# トラブルシューティング記録

このドキュメントは、開発中に発生した問題とその解決策を記録したものです。

---

## 1. Expo GO起動時に画面が真っ白になる問題

### 発生日
2026年1月2日

### 症状
- Expo GOでアプリを起動すると、画面が完全に真っ白になる
- ターミナルのログでは、データ取得やレンダリング処理は正常に完了している
- エラーメッセージは表示されない

### 調査過程

1. **LoginScreenの確認** - 最初はログイン画面の問題と思われたが、ログで`Auth check result: true`と表示されており、実際にはHomeScreenが表示されるべき状態だった

2. **HomeScreenのデバッグ** - console.logを追加して確認したところ、`Rendering main view with 50 posts`まで正常に実行されていた

3. **コンポーネントの段階的テスト**
   - PostCardの背景色を変更 → 効果なし
   - SafeAreaViewを削除してシンプルなViewに変更 → 効果なし
   - App.tsx自体をシンプルな`<View>`と`<Text>`だけに変更 → **緑の背景が表示された！**

4. **原因の特定** - App.tsxの初期化処理に問題があることが判明

### 原因
`expo-splash-screen`の`SplashScreen.preventAutoHideAsync()`が原因。

この関数はアプリ起動時にスプラッシュ画面を自動で非表示にしないようにするものだが、`hideAsync()`が正しく呼び出されず、画面が白いままになっていた。

### 解決策
App.tsxで`expo-splash-screen`関連の処理を一時的にコメントアウト：

```typescript
// 変更前
import * as SplashScreen from 'expo-splash-screen';
SplashScreen.preventAutoHideAsync();

// 変更後
// import * as SplashScreen from 'expo-splash-screen';  // 一時的に無効化
// SplashScreen.preventAutoHideAsync();  // 一時的に無効化
```

また、`onLayoutRootView`コールバックで呼び出していた`SplashScreen.hideAsync()`も削除。

### 修正後のApp.tsx構造

```typescript
export default function App(): React.JSX.Element {
  const [initState, setInitState] = useState<InitState>({
    isReady: false,
    error: null,
  });

  // 初期化処理...

  // エラー画面
  if (initState.error) {
    return (
      <SafeAreaProvider>
        <View style={styles.errorContainer}>
          {/* エラー表示 */}
        </View>
      </SafeAreaProvider>
    );
  }

  // 初期化中（独自のスプラッシュ画面）
  if (!initState.isReady) {
    return (
      <SafeAreaProvider>
        <View style={styles.splashContainer}>
          {/* スプラッシュ表示 */}
        </View>
      </SafeAreaProvider>
    );
  }

  // メインアプリ
  return (
    <SafeAreaProvider>
      <View style={styles.container}>
        <AppNavigator />
      </View>
    </SafeAreaProvider>
  );
}
```

### 今後の対応
- `expo-splash-screen`の正しい使い方を再調査する
- Expo SDK 54での変更点を確認する
- 必要であれば、独自のスプラッシュ画面実装を検討する

### 関連ファイル
- `App.tsx` - メインエントリーポイント
- `src/navigation/AppNavigator.tsx` - ナビゲーション設定

### 教訓
- 画面が真っ白になる問題は、必ずしもレンダリングエラーとは限らない
- スプラッシュ画面の制御が原因で、UIが表示されない場合がある
- デバッグ時は、最もシンプルな状態から段階的に機能を追加してテストすることが有効

---

## 2. 進捗ページのカレンダーで今日の日付が見づらい問題

### 発生日
2026年1月2日

### 症状
- 進捗ページのカレンダーで、今日の日付が薄い青の楕円形で表示される
- 文字色が青のままで、背景色との差が小さく見づらい

### 調査過程

1. **src/components/Calendar.tsx を修正** - 最初は共通コンポーネントのCalendar.tsxを修正したが、変更が反映されなかった

2. **キャッシュクリアを試行** - `npx expo start --clear`でキャッシュをクリアし、Expo GOアプリも再起動したが、変更は反映されなかった

3. **実際に使用されているコンポーネントの特定** - ProgressScreen.tsxを確認したところ、共通コンポーネントをインポートせず、画面内に独自の`CalendarDay`コンポーネントが定義されていた

### 原因
`src/screens/ProgressScreen.tsx`内に独自の`CalendarDay`コンポーネントとスタイルが定義されており、`src/components/Calendar.tsx`の共通コンポーネントは使用されていなかった。

### 解決策
ProgressScreen.tsx内の`CalendarDay`コンポーネントとスタイルを修正：

**コンポーネントの修正：**
```typescript
// 変更前
function CalendarDay({ day, hasActivity, isToday }: CalendarDayProps): React.JSX.Element {
  return (
    <View style={[styles.calendarDay, isToday && styles.calendarDayToday]}>
      <Text style={[styles.calendarDayText, isToday && styles.calendarDayTextToday]}>
        {day}
      </Text>
      {hasActivity && <View style={styles.calendarDayDot} />}
    </View>
  );
}

// 変更後 - 内側にViewを追加して円形背景を実現
function CalendarDay({ day, hasActivity, isToday }: CalendarDayProps): React.JSX.Element {
  return (
    <View style={styles.calendarDay}>
      <View style={[styles.calendarDayInner, isToday && styles.calendarDayInnerToday]}>
        <Text style={[styles.calendarDayText, isToday && styles.calendarDayTextToday]}>
          {day}
        </Text>
      </View>
      {hasActivity && <View style={styles.calendarDayDot} />}
    </View>
  );
}
```

**スタイルの修正：**
```typescript
// 変更前
calendarDayToday: {
  backgroundColor: Colors.primaryLight,
  borderRadius: BorderRadius.full,
},
calendarDayTextToday: {
  fontWeight: '700',
  color: Colors.primary,
},

// 変更後 - 固定サイズの円形コンテナと白文字
calendarDayInner: {
  width: 32,
  height: 32,
  justifyContent: 'center',
  alignItems: 'center',
  borderRadius: 16,
},
calendarDayInnerToday: {
  backgroundColor: Colors.primary,
},
calendarDayTextToday: {
  fontWeight: '700',
  color: Colors.card,  // 白色
},
```

### 関連ファイル
- `src/screens/ProgressScreen.tsx` - 進捗画面（実際に修正したファイル）
- `src/components/Calendar.tsx` - 共通カレンダーコンポーネント（未使用）

### 教訓
- 修正が反映されない場合、修正しているファイルが実際に使用されているか確認する
- 共通コンポーネントとして作成されていても、画面内に独自実装がある場合がある
- コンポーネントの構造を変更する際は、親要素のflex/aspectRatioが子要素のサイズ指定を上書きしないよう注意する

---

## 3. 進捗ページのカレンダーで「学習した日」の表示を変更

### 発生日
2026年1月2日

### 要望
- 学習した日が緑色の小さな点で表示されていた
- これを緑の円形背景＋白文字に変更したい

### 調査過程

1. **src/components/Calendar.tsx を修正** - 最初は共通コンポーネントのCalendar.tsxを修正したが、変更が反映されなかった

2. **トラブルシューティング#2の教訓を活用** - 前回の経験から、実際に使用されているのは`ProgressScreen.tsx`内の独自コンポーネントであることを把握していた

### 解決策
ProgressScreen.tsx内の`CalendarDay`コンポーネントとスタイルを修正：

**コンポーネントの修正：**
```typescript
// 変更前 - 緑の点で学習日を表示
function CalendarDay({ day, hasActivity, isToday }: CalendarDayProps): React.JSX.Element {
  return (
    <View style={styles.calendarDay}>
      <View style={[styles.calendarDayInner, isToday && styles.calendarDayInnerToday]}>
        <Text style={[styles.calendarDayText, isToday && styles.calendarDayTextToday]}>
          {day}
        </Text>
      </View>
      {hasActivity && <View style={styles.calendarDayDot} />}
    </View>
  );
}

// 変更後 - 緑の円形背景で学習日を表示
function CalendarDay({ day, hasActivity, isToday }: CalendarDayProps): React.JSX.Element {
  return (
    <View style={styles.calendarDay}>
      <View
        style={[
          styles.calendarDayInner,
          isToday && styles.calendarDayInnerToday,
          hasActivity && !isToday && styles.calendarDayInnerActivity,
        ]}
      >
        <Text
          style={[
            styles.calendarDayText,
            isToday && styles.calendarDayTextToday,
            hasActivity && !isToday && styles.calendarDayTextActivity,
          ]}
        >
          {day}
        </Text>
      </View>
    </View>
  );
}
```

**スタイルの追加：**
```typescript
// 学習した日用のスタイルを追加
calendarDayInnerActivity: {
  backgroundColor: Colors.success,  // 緑色の背景
},
calendarDayTextActivity: {
  fontWeight: '600',
  color: Colors.card,  // 白文字
},
```

**凡例のスタイル修正：**
```typescript
// 凡例の点も緑色に統一
legendDot: {
  width: 8,
  height: 8,
  borderRadius: 4,
  backgroundColor: Colors.success,
},
```

### 関連ファイル
- `src/screens/ProgressScreen.tsx` - 進捗画面（実際に修正したファイル）
- `src/components/Calendar.tsx` - 共通カレンダーコンポーネント（未使用だが同様に修正済み）

### 教訓
- 今日の日付（青の円形）と学習した日（緑の円形）で一貫したデザインを適用
- `!isToday`条件を追加することで、今日かつ学習した日の場合は今日のスタイル（青）を優先

---

## 問題報告テンプレート

新しい問題が発生した場合は、以下のテンプレートを使用して記録してください：

```markdown
## [番号]. [問題のタイトル]

### 発生日
YYYY年MM月DD日

### 症状
- 症状1
- 症状2

### 原因
原因の説明

### 解決策
解決策の説明

### 関連ファイル
- ファイル1
- ファイル2
```
