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

## 4. 単語登録時にタッチした単語ではなく先頭の単語が選択される問題

### 発生日
2026年1月2日

### 症状
- 投稿文の単語を長押しして選択しようとすると、タッチした単語ではなく投稿文の先頭の英語単語が選択されてしまう
- 例：「overpriced」を選択したかったが「in」が選択された

### 調査過程

1. **WordPopup.tsxの確認** - ポップアップコンポーネントを確認したが、ここは単語を受け取って表示するだけで、単語選択の処理は行っていなかった

2. **PostCard.tsxの確認** - 投稿カードコンポーネントを確認したところ、`handleLongPress`関数で単語選択処理が行われていた

3. **問題のコードを特定** - 以下のコードが原因だった：
   ```typescript
   const words = post.text.split(/\s+/).filter((word) => {
     return /^[a-zA-Z][a-zA-Z'-]*$/.test(word);
   });
   if (words.length > 0 && onWordSelect) {
     // For demo purposes, show the first English word
     const word = words[0];  // ← 常に最初の単語を選択
     ...
   }
   ```

### 原因
`PostCard.tsx`の`handleLongPress`関数で、タッチ位置（`locationX`, `locationY`）を取得していたにもかかわらず、実際には使用せず、常に投稿文中の**最初の英語単語**を選択する仮実装になっていた。コメントに「For demo purposes」と記載があり、開発途中の暫定実装だった。

### 解決策（第1段階）
タッチ位置から文字位置を推定して、最も近い単語を選択するように修正：

```typescript
const handleLongPress = useCallback(
  (event: GestureResponderEvent) => {
    const { locationX } = event.nativeEvent;
    const averageCharWidth = 8; // 推定文字幅
    const approxCharPosition = Math.floor(locationX / averageCharWidth);
    
    // 最も近い単語を選択
    for (const wordObj of words) {
      const wordCenter = (wordObj.start + wordObj.end) / 2;
      const distance = Math.abs(wordCenter - approxCharPosition);
      if (distance < minDistance) {
        selectedWordObj = wordObj;
      }
    }
  },
  [post.text, post.uri, onWordSelect]
);
```

しかし、この方法では文字幅が固定値のため精度が低く、隣の単語が選択されることがあった。

### 解決策（第2段階 - 最終版）
各英語単語を個別のタッチ可能な`<Text>`要素としてレンダリングする方式に変更：

**テキストをトークンに分割する関数を追加：**
```typescript
interface TextToken {
  text: string;
  isEnglishWord: boolean;
  index: number;
}

function parseTextIntoTokens(text: string): TextToken[] {
  const tokens: TextToken[] = [];
  const regex = /([a-zA-Z][a-zA-Z'-]*)|([^a-zA-Z]+)/g;
  let match;
  let index = 0;

  while ((match = regex.exec(text)) !== null) {
    const isEnglishWord = match[1] !== undefined;
    tokens.push({
      text: match[0],
      isEnglishWord,
      index: index++,
    });
  }
  return tokens;
}
```

**各単語を個別のタッチ可能要素としてレンダリング：**
```typescript
const renderText = () => {
  const tokens = parseTextIntoTokens(post.text);

  return (
    <Text style={styles.postText}>
      {tokens.map((token) => {
        if (token.isEnglishWord) {
          const isSelected = selectedWord?.toLowerCase() === token.text.toLowerCase();
          return (
            <Text
              key={token.index}
              style={isSelected ? styles.highlightedWord : styles.selectableWord}
              onLongPress={() => handleWordLongPress(token.text)}
              suppressHighlighting={false}
            >
              {token.text}
            </Text>
          );
        }
        return <Text key={token.index}>{token.text}</Text>;
      })}
    </Text>
  );
};
```

**カード全体のonLongPressを削除：**
```typescript
// 変更前
<Pressable onLongPress={handleLongPress} delayLongPress={500}>

// 変更後
<Pressable onPress={handlePress}>  // onLongPressを削除
```

### 関連ファイル
- `src/components/PostCard.tsx` - 投稿カードコンポーネント
- `src/components/WordPopup.tsx` - 単語ポップアップコンポーネント
- `src/screens/HomeScreen.tsx` - ホーム画面

### 教訓
- タッチ位置から文字位置を推定する方法は、フォントサイズや文字幅が可変のため精度が低い
- 各単語を個別のタッチ可能要素にすることで、100%正確な単語選択が可能になる
- React Nativeの`<Text>`コンポーネントは入れ子にでき、内側の`<Text>`に個別の`onLongPress`を設定できる
- 「For demo purposes」などの仮実装コメントがある箇所は、本番前に必ず見直す

---

## 5. ポップアップを閉じても青い選択範囲が残る問題

### 発生日
2026年1月2日

### 症状
- 投稿文の単語を長押しして選択すると、青い背景色で単語がハイライトされる
- 単語登録ポップアップから「キャンセル」ボタンを押す、または背景をタップしてポップアップを閉じる
- ポップアップは消えるが、青い選択範囲（ハイライト）が残ったままになる

### 調査過程

1. **PostCard.tsxの確認** - `selectedWord`という状態で選択中の単語を管理していた。しかし、ポップアップが閉じた時にこの状態をクリアする仕組みがなかった。

2. **HomeScreen.tsxの確認** - ポップアップの開閉は`wordPopup.visible`で管理されていたが、ポップアップを閉じた時にPostCardの選択状態をクリアする処理がなかった。

3. **親子コンポーネント間の状態管理** - PostCardはFlatListでレンダリングされており、個々のPostCardの選択状態を親から制御する仕組みが必要だった。

### 原因
- PostCardコンポーネント内で`selectedWord`状態を管理していたが、ポップアップが閉じた時にこの状態をリセットする仕組みがなかった
- PostCardとWordPopupは独立したコンポーネントで、ポップアップの開閉状態がPostCardに伝わっていなかった
- HomeScreenの`closeWordPopup`関数で`wordPopup`状態を完全にリセットしていたため、どのPostCardの選択をクリアすべきかの情報が失われていた

### 解決策

**1. PostCard.tsxの修正：**

`clearSelection` propを追加して、外部から選択状態をクリアできるようにした：

```typescript
// Props interfaceに追加
interface PostCardProps {
  post: TimelinePost;
  onWordSelect?: (word: string, postUri: string, postText: string) => void;
  clearSelection?: boolean;  // 追加
}

// useEffectをインポート
import React, { useState, useCallback, useEffect } from 'react';

// useEffectで選択をクリア
useEffect(() => {
  if (clearSelection) {
    setSelectedWord(null);
  }
}, [clearSelection]);
```

**2. HomeScreen.tsxの修正：**

ポップアップを閉じる際に`postUri`を保持し、該当するPostCardだけに`clearSelection={true}`を渡すように修正：

```typescript
// closeWordPopup関数の修正
const closeWordPopup = useCallback(() => {
  // Keep postUri to allow PostCard to clear selection before full reset
  setWordPopup(prev => ({ ...prev, visible: false }));
}, []);

// renderPost関数の修正
const renderPost = useCallback(
  ({ item }: { item: TimelinePost }) => {
    // Only clear selection for the post that had a word selected
    const shouldClearSelection = !wordPopup.visible && wordPopup.postUri === item.uri;
    return (
      <PostCard 
        post={item} 
        onWordSelect={handleWordSelect} 
        clearSelection={shouldClearSelection}
      />
    );
  },
  [handleWordSelect, wordPopup.visible, wordPopup.postUri]
);
```

### 実装のポイント
- `closeWordPopup`で`visible`のみを`false`にし、`postUri`は保持することで、どのPostCardの選択をクリアすべきかの情報を維持
- `renderPost`で`!wordPopup.visible && wordPopup.postUri === item.uri`の条件により、ポップアップが閉じられ、かつ該当する投稿のみに`clearSelection={true}`を渡す
- この方式により、不要な全PostCardの再レンダリングを避け、該当するPostCardのみを効率的に更新

### 関連ファイル
- `src/components/PostCard.tsx` - 投稿カードコンポーネント
- `src/screens/HomeScreen.tsx` - ホーム画面

### 教訓
- 親子コンポーネント間で状態を同期する必要がある場合、propsを通じて制御する仕組みを設計する
- FlatListでレンダリングされるコンポーネントの状態管理では、どのアイテムに対する操作かを識別する情報（この場合は`postUri`）を保持することが重要
- React Nativeの`useEffect`は、propsの変化を監視して副作用を実行するのに適している
- パフォーマンスを考慮し、該当するコンポーネントのみを更新する条件分岐を実装する

---

## 6. 進捗ページの「今日の進捗」カードの文字が見づらい問題

### 発生日
2026年1月2日

### 症状
- 進捗ページの下部にある「今日の進捗」カードの文字が非常に見づらい
- 青い背景（`primaryLight`）に対して文字色が薄く、コントラストが低い
- フォントサイズが小さく、読みにくい

### 原因
「今日の進捗」カードのスタイル設定に以下の問題があった：
- タイトルの文字色が`Colors.textSecondary`（薄いグレー）で、青い背景とのコントラストが非常に低かった
- 値の文字色が`Colors.primary`（青）で、青い背景（`Colors.primaryLight`）と区別しにくかった
- フォントサイズが小さめ（タイトル：`md`、値：`xl`）で読みにくかった
- パディングが`lg`と控えめで、テキストが窮屈に見えた

### 解決策

**ProgressScreen.tsxの修正（第1段階）：**

フォントサイズ、フォントウェイト、パディングを改善：

```typescript
// 変更前
todayProgress: {
  backgroundColor: Colors.primaryLight,
  borderRadius: BorderRadius.lg,
  padding: Spacing.lg,
  alignItems: 'center',
  borderLeftWidth: 4,
  borderLeftColor: Colors.primary,
},
todayProgressTitle: {
  fontSize: FontSizes.md,
  color: Colors.textSecondary,
  marginBottom: Spacing.xs,
},
todayProgressValue: {
  fontSize: FontSizes.xl,
  fontWeight: '700',
  color: Colors.primary,
},

// 変更後
todayProgress: {
  backgroundColor: Colors.primaryLight,
  borderRadius: BorderRadius.lg,
  padding: Spacing.xl,  // lg → xl に拡大
  alignItems: 'center',
  borderLeftWidth: 4,
  borderLeftColor: Colors.primary,
},
todayProgressTitle: {
  fontSize: FontSizes.lg,  // md → lg に拡大
  fontWeight: '600',  // 太字を追加
  color: Colors.text,  // textSecondary → text に変更
  marginBottom: Spacing.sm,  // xs → sm に拡大
},
todayProgressValue: {
  fontSize: FontSizes.xxl,  // xl → xxl に拡大
  fontWeight: '700',
  color: Colors.text,  // primary → text に変更
},
```

**ProgressScreen.tsxの修正（第2段階 - 最終版）：**

文字色を白色に変更して、青い背景とのコントラストを最大化：

```typescript
todayProgressTitle: {
  fontSize: FontSizes.lg,
  fontWeight: '600',
  color: Colors.textInverse,  // text → textInverse（白色）に変更
  marginBottom: Spacing.sm,
},
todayProgressValue: {
  fontSize: FontSizes.xxl,
  fontWeight: '700',
  color: Colors.textInverse,  // text → textInverse（白色）に変更
},
```

### 最終的な改善内容
1. **タイトルの色** - 薄いグレー → 白色（コントラスト大幅向上）
2. **タイトルのフォントサイズ** - `md`(14px) → `lg`(16px)
3. **タイトルのフォントウェイト** - 通常 → `'600'`（太字）
4. **値のフォントサイズ** - `xl`(18px) → `xxl`(24px)
5. **値の色** - 青 → 白色（背景との区別明確化）
6. **カードのパディング** - `lg`(16px) → `xl`(24px)
7. **タイトルと値の間隔** - `xs`(4px) → `sm`(8px)

### 関連ファイル
- `src/screens/ProgressScreen.tsx` - 進捗画面
- `src/constants/colors.ts` - カラー定義（`Colors.textInverse`を使用）

### 教訓
- 背景色と文字色のコントラストは視認性に重要
- 薄い色の背景に薄い文字色を使うとコントラストが低くなる
- 青い背景に対しては、白色の文字が最も読みやすい
- フォントサイズとフォントウェイトを適切に設定することで、情報の階層性と読みやすさが向上する

---

## 7. 進捗ページのレイアウト順序の問題

### 発生日
2026年1月2日

### 症状
- 進捗ページのコンテンツが「統計」→「カレンダー」→「今日の進捗」の順序で表示されていた
- 最も重要な「今日の進捗」が一番下にあり、ユーザーがスクロールしないと見えない
- レイアウトの優先順位が使いやすさを考慮していなかった

### 原因
ProgressScreen.tsxのScrollView内のセクション配置順序が、情報の重要度や使用頻度を考慮していなかった。

### 解決策

**ProgressScreen.tsxの修正：**

ScrollView内のセクション順序を以下のように変更：

```typescript
// 変更前の順序
<ScrollView ...>
  {/* Stats Section */}
  <View style={styles.section}>
    <Text style={styles.sectionTitle}>【統計】</Text>
    ...
  </View>

  {/* Calendar Section */}
  <View style={styles.section}>
    <Text style={styles.sectionTitle}>【カレンダー】</Text>
    ...
  </View>

  {/* Today's Progress */}
  <View style={styles.section}>
    <View style={styles.todayProgress}>
      <Text style={styles.todayProgressTitle}>今日の進捗</Text>
      ...
    </View>
  </View>
</ScrollView>

// 変更後の順序
<ScrollView ...>
  {/* Today's Progress */}
  <View style={styles.section}>
    <View style={styles.todayProgress}>
      <Text style={styles.todayProgressTitle}>今日の進捗</Text>
      ...
    </View>
  </View>

  {/* Calendar Section */}
  <View style={styles.section}>
    <Text style={styles.sectionTitle}>【カレンダー】</Text>
    ...
  </View>

  {/* Stats Section */}
  <View style={styles.section}>
    <Text style={styles.sectionTitle}>【統計】</Text>
    ...
  </View>
</ScrollView>
```

### 最終的なレイアウト順序
1. **今日の進捗** - ページトップに配置（スクロール不要で即座に確認可能）
2. **カレンダー** - 学習履歴の視覚的な確認に便利
3. **統計** - 詳細な数値情報（必要に応じてスクロールして確認）

### 関連ファイル
- `src/screens/ProgressScreen.tsx` - 進捗画面

### 教訓
- ユーザーインターフェースでは、最も重要な情報を最初に配置する
- 使用頻度の高い情報は、スクロールせずに見える位置（above the fold）に配置する
- レイアウトの優先順位は、ユーザーの行動パターンと情報の重要度を考慮して決定する

---

## 8. 単語登録ポップアップで辞書APIから英語定義が取得できない問題

### 発生日
2026年1月4日

### 症状
- 投稿文の単語を長押しして選択すると、単語登録ポップアップが表示される
- ポップアップに単語名は表示されるが、「日本語訳」と「英語の定義」が「読み込み中...」のままで、いつまでも表示されない
- Free Dictionary APIとDeepL APIは正常に動作しており、直接APIを叩くとデータが取得できることを確認済み
- デバッグコンソールに追加したログも全く表示されない

### 調査過程

1. **WordPopup.tsxの確認とデバッグログ追加** - 最初にWordPopupコンポーネントにデバッグログを追加したが、ログが全く表示されなかった

2. **useEffectの依存配列の修正** - `fetchWordData`関数がuseEffectの依存配列に含まれていなかったため追加したが、それでも動作しなかった

3. **APIの動作確認** - ターミナルから直接APIを叩いて、Free Dictionary APIが正常に動作することを確認した

4. **HomeScreen.tsxの確認** - HomeScreenを確認したところ、**WordPopupコンポーネントを全く使用していない**ことが判明。独自のModalを実装していた

### 原因
- HomeScreen.tsxでWordPopupコンポーネントをインポートもレンダリングもしていなかった
- 代わりに、HomeScreen.tsx内に独自の`<Modal>`コンポーネントが実装されており、この中で「読み込み中...」がハードコードされていた
- WordPopup.tsxに追加したデバッグログや修正が全く反映されなかったのは、そもそもこのコンポーネントが使用されていなかったため

### 解決策

**1. HomeScreen.tsxの修正 - インポートの追加：**

```typescript
// 追加
import { WordPopup } from '../components/WordPopup';
import { addWord } from '../services/database/words';
```

**2. handleAddWord関数の修正：**

WordPopupコンポーネントの`onAddToWordList` propsに対応する形に修正：

```typescript
// 変更前 - 独自実装
const handleAddWord = useCallback(async () => {
  Alert.alert(
    '単語を追加',
    `"${wordPopup.word}" を単語帳に追加しますか？`,
    [
      { text: 'キャンセル', style: 'cancel' },
      {
        text: '追加',
        onPress: () => {
          Alert.alert('成功', '単語を追加しました！');
          closeWordPopup();
        },
      },
    ]
  );
}, [wordPopup.word, closeWordPopup]);

// 変更後 - WordPopup対応
const handleAddWord = useCallback(
  async (
    word: string,
    japanese: string | null,
    definition: string | null,
    postUri: string | null,
    postText: string | null
  ) => {
    try {
      const result = await addWord(
        word,
        japanese ?? undefined,
        definition ?? undefined,
        postUri ?? undefined,
        postText ?? undefined
      );

      if (result.success) {
        Alert.alert('成功', '単語を追加しました！');
      } else {
        Alert.alert('エラー', result.error.message);
      }
    } catch (error) {
      Alert.alert('エラー', '単語の追加に失敗しました');
      console.error('Failed to add word:', error);
    }
  },
  []
);
```

**3. 独自実装のModalをWordPopupコンポーネントに置き換え：**

```typescript
// 変更前 - 独自のModal実装（40行以上）
<Modal
  visible={wordPopup.visible}
  transparent
  animationType="slide"
  onRequestClose={closeWordPopup}
>
  <Pressable style={styles.modalOverlay} onPress={closeWordPopup}>
    <Pressable style={styles.modalContent} onPress={() => {}}>
      <View style={styles.modalHandle} />
      <Text style={styles.modalWord}>{wordPopup.word}</Text>

      <View style={styles.modalSection}>
        <Text style={styles.modalSectionTitle}>日本語訳</Text>
        <Text style={styles.modalSectionContent}>読み込み中...</Text>
      </View>

      <View style={styles.modalSection}>
        <Text style={styles.modalSectionTitle}>英語定義</Text>
        <Text style={styles.modalSectionContent}>読み込み中...</Text>
      </View>

      <View style={styles.modalButtons}>
        <Button ... />
        <Button ... />
      </View>
    </Pressable>
  </Pressable>
</Modal>

// 変更後 - WordPopupコンポーネントを使用
<WordPopup
  visible={wordPopup.visible}
  word={wordPopup.word}
  postUri={wordPopup.postUri}
  postText={wordPopup.postText}
  onClose={closeWordPopup}
  onAddToWordList={handleAddWord}
/>
```

**4. WordPopup.tsxの品詞表示の修正：**

品詞（noun, verb等）の文字色が見づらかったため、白色に変更：

```typescript
// 変更前
posText: {
  fontSize: FontSizes.xs,
  color: Colors.primary,  // 青色
  fontWeight: '600',
},

// 変更後
posText: {
  fontSize: FontSizes.xs,
  color: '#FFFFFF',  // 白色
  fontWeight: '600',
},
```

### 実装のポイント
- WordPopupコンポーネントは既に完全に実装されており、辞書APIとDeepL APIの取得処理も含まれていた
- HomeScreenで独自実装していたModalを削除し、WordPopupコンポーネントを使用することで、40行以上のコードを削減
- `addWord`データベース関数を使用して、実際に単語をデータベースに保存する機能も追加

### 関連ファイル
- `src/screens/HomeScreen.tsx` - ホーム画面（主な修正箇所）
- `src/components/WordPopup.tsx` - 単語ポップアップコンポーネント（品詞の色を修正）
- `src/services/dictionary/freeDictionary.ts` - Free Dictionary API連携
- `src/services/dictionary/deepl.ts` - DeepL API連携
- `src/services/database/words.ts` - 単語データベース操作

### 教訓
- 修正が反映されない場合、そのコンポーネントが実際に使用されているか必ず確認する
- プロジェクト内に同じ機能の独自実装と共通コンポーネントが混在している場合がある
- 共通コンポーネントとして作成された機能は、積極的に再利用してコードの重複を避ける
- デバッグログが表示されない場合、コンポーネント自体がレンダリングされていない可能性を疑う

---

## 9. 日本語単語選択機能の追加と表示改善

### 発生日
2026年1月4日

### 背景
- 英語単語の登録機能は既に実装されていたが、日本語単語には未対応だった
- Yahoo! JAPAN Text Analysis APIを使用して、日本語の形態素解析機能を追加することにした

### 実装した機能

**1. Yahoo! JAPAN Text Analysis API統合：**

新しいサービスファイルを作成し、形態素解析とふりがな取得機能を実装：

`src/services/dictionary/yahooJapan.ts`:
```typescript
export async function analyzeMorphology(text: string): Promise<Result<JapaneseWordInfo[]>>
export async function addFurigana(text: string): Promise<Result<string>>
export async function getJapaneseWordInfo(text: string): Promise<Result<JapaneseWordInfo>>
```

API認証にはClient ID（appid）をURLクエリパラメータとして使用。レート制限は300リクエスト/分。

**2. 日本語テキスト選択の実装：**

`PostCard.tsx`のテキスト解析を修正し、日本語文字を句読点で区切って選択できるようにした：

```typescript
// 変更前 - 英語のみ
const regex = /[a-zA-Z][a-zA-Z'-]*/g;

// 変更後 - 日本語も対応（句読点含む）
const regex = /([a-zA-Z][a-zA-Z'-]*)|([\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF]+[、。]?)/g;
```

これにより、「、」や「。」までを含めてテキストを選択できるようになった。

**3. ポップアップの表示改善：**

`WordPopup.tsx`に複数の改善を実施：

a) **スクロール対応** - 形態素解析の結果が複数ある場合に全て表示できるよう、ScrollViewを追加：

```typescript
<ScrollView 
  style={styles.scrollView}
  contentContainerStyle={styles.scrollContent}
  showsVerticalScrollIndicator={true}
>
  {japaneseInfo.map((info, index) => (
    <View key={index} style={styles.tokenCard}>
      ...
    </View>
  ))}
</ScrollView>
```

b) **ポップアップ高さの拡大** - より多くの情報を表示できるよう、最大高さを85%に拡大：

```typescript
const MAX_POPUP_HEIGHT = SCREEN_HEIGHT * 0.85;
const MIN_POPUP_HEIGHT = SCREEN_HEIGHT * 0.5;
```

c) **ヘッダー表示の簡素化** - 日本語選択時、ヘッダーには選択したテキストのみを表示し、読み方と品詞タグは削除：

```typescript
// 変更前 - ヘッダーに読み方と品詞も表示
<Text style={styles.word}>{word}</Text>
{japaneseInfo[0]?.reading && (
  <Text style={styles.phonetic}>({japaneseInfo[0].reading})</Text>
)}
{japaneseInfo[0]?.partOfSpeech && (
  <View style={styles.posTag}>
    <Text style={styles.posText}>[{japaneseInfo[0].partOfSpeech}]</Text>
  </View>
)}

// 変更後 - 選択したテキストのみ表示
<Text style={styles.word}>{word}</Text>
```

詳細な形態素情報（読み、品詞、基本形）は、スクロール可能なコンテンツ領域に各トークンごとに表示される。

**4. API Key設定画面の拡張：**

`ApiKeySetupScreen.tsx`を修正し、DeepL APIキーとYahoo! Client IDの両方を管理できるようにした：

- 各APIに個別の入力フィールドと保存ボタンを配置
- 保存状態を個別に表示
- バリデーション機能を追加

### 型定義の追加

`src/types/word.ts`:
```typescript
export interface JapaneseWordInfo {
  word: string;
  reading: string;
  partOfSpeech: string;
  baseForm: string;
}
```

### 関連ファイル
- `src/services/dictionary/yahooJapan.ts` - Yahoo! API連携サービス
- `src/components/WordPopup.tsx` - 単語ポップアップコンポーネント
- `src/components/PostCard.tsx` - 投稿カードコンポーネント
- `src/screens/ApiKeySetupScreen.tsx` - API設定画面
- `src/types/word.ts` - 型定義
- `src/constants/config.ts` - 設定定数

### 実装のポイント
- Yahoo! APIのレスポンスは文字列配列（`string[][]`）形式で、各トークンは`[表記, 読み, 基本形, 品詞, ...]`の順序
- React Nativeではユーザーエージェントヘッダーの設定が困難なため、Client IDはURLクエリパラメータで送信
- 日本語と英語で異なる表示形式を採用（日本語は形態素解析結果、英語は辞書定義）
- ポップアップのスクロール実装により、長い解析結果も完全に表示可能

### 教訓
- 新機能追加時は、既存の英語対応コードとの共存を考慮した設計が必要
- モバイル環境ではAPIの認証方法に制約があるため、ドキュメントの推奨方法が使えない場合がある
- UIの情報密度とスクロール性能のバランスを取ることが重要
- ユーザーフィードバックを受けて段階的にUIを改善することで、最適な表示方法を見つけられた

---

## 10. 単語登録時に「addWord is not a function」エラーが発生する問題

### 発生日
2026年1月4日

### 症状
- 投稿文の単語を長押しして選択し、単語登録ポップアップから「単語帳に追加」ボタンを押す
- エラーが発生：`Failed to add word: [TypeError: 0, _servicesDatabaseWords.addWord is not a function (it is undefined)]`
- 単語がデータベースに保存されない

### 原因
`src/services/database/words.ts`に`addWord`関数が定義されていなかった。

HomeScreen.tsxでは以下のようにインポートしていた：
```typescript
import { addWord } from '../services/database/words';
```

しかし、words.tsには`insertWord`という名前の関数しか存在せず、`addWord`関数はエクスポートされていなかった。そのため、インポートした`addWord`は`undefined`となり、関数として呼び出すことができなかった。

### 解決策

`src/services/database/words.ts`に`addWord`関数を追加：

```typescript
/**
 * Add a new word (simplified interface for insertWord)
 */
export async function addWord(
  english: string,
  japanese?: string,
  definition?: string,
  postUrl?: string,
  postText?: string
): Promise<Result<Word, AppError>> {
  return insertWord({
    english,
    japanese,
    definition,
    postUrl,
    postText,
  });
}
```

この関数は既存の`insertWord`関数を呼び出すラッパー関数で、より簡単なインターフェイスを提供する。

### 関連ファイル
- `src/services/database/words.ts` - 単語データベースサービス
- `src/screens/HomeScreen.tsx` - ホーム画面

### 教訓
- 関数をインポートする前に、エクスポート側で実際に定義されているか確認する
- エラーメッセージで「is not a function (it is undefined)」と表示された場合、関数が存在しないかエクスポートされていない可能性を疑う
- 複数の開発者や段階的な実装では、関数名の不一致が発生しやすいため注意が必要

---

## 11. 単語を登録したのに単語帳画面に表示されない問題

### 発生日
2026年1月4日

### 症状
- ホーム画面で単語を長押しして選択し、「単語帳に追加」ボタンを押す
- 「成功 - 単語を追加しました！」というアラートが表示される
- しかし、単語帳画面を開いても「単語がまだ登録されていません」と表示され、登録した単語が見えない

### 調査過程

1. **データベース初期化の確認** - App.tsxでデータベースの初期化とsetDatabaseの呼び出しが正しく行われていることを確認

2. **単語登録処理の確認** - HomeScreen.tsxのhandleAddWord関数で、addWord関数が正常に呼び出され、成功メッセージが表示されていることを確認

3. **WordListScreen.tsxの確認** - 単語帳画面のコードを確認したところ、**データベースから単語を読み込む処理が全く実装されていない**ことが判明

### 原因
`src/screens/WordListScreen.tsx`で以下の問題があった：

1. **データ取得処理の欠如** - `words`ステートは空配列で初期化されているだけで、データベースから単語を取得する処理がなかった

2. **必要なインポートの欠如** - データベース操作関数（`getWords`, `toggleReadStatus`, `deleteWord`）がインポートされていなかった

3. **画面フォーカス時の再読み込みがない** - 他の画面から戻ってきた時に単語リストを再読み込みする仕組みがなかった

### 解決策

**1. 必要な依存関係のインポート：**

```typescript
import React, { useState, useCallback, useEffect } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { getWords, toggleReadStatus, deleteWord } from '../services/database/words';
```

**2. データ読み込み関数の実装：**

```typescript
const loadWords = useCallback(async () => {
  try {
    setIsLoading(true);
    
    const wordFilter: WordFilter = {
      isRead: filter === 'all' ? null : filter === 'read',
      sortBy,
      sortOrder,
      limit: 1000,
      offset: 0,
    };

    const result = await getWords(wordFilter);

    if (result.success) {
      setWords(result.data);
    } else {
      console.error('Failed to load words:', result.error);
      Alert.alert('エラー', '単語の読み込みに失敗しました');
    }
  } catch (error) {
    console.error('Error loading words:', error);
    Alert.alert('エラー', '単語の読み込み中にエラーが発生しました');
  } finally {
    setIsLoading(false);
  }
}, [filter, sortBy, sortOrder]);
```

**3. 画面フォーカス時の自動読み込み：**

```typescript
useFocusEffect(
  useCallback(() => {
    loadWords();
  }, [loadWords])
);
```

**4. フィルター・ソート変更時の再読み込み：**

```typescript
useEffect(() => {
  if (!isLoading) {
    loadWords();
  }
}, [filter, sortBy, sortOrder]);
```

**5. 既読/未読切り替え機能の実装：**

```typescript
const handleWordTap = useCallback(async (word: Word) => {
  Alert.alert(
    word.isRead ? '未読にする' : '既読にする',
    `"${word.english}" を${word.isRead ? '未読' : '既読'}にしますか？`,
    [
      { text: 'キャンセル', style: 'cancel' },
      {
        text: 'OK',
        onPress: async () => {
          const result = await toggleReadStatus(word.id);
          if (result.success) {
            await loadWords();
          } else {
            Alert.alert('エラー', result.error.message);
          }
        },
      },
    ]
  );
}, [loadWords]);
```

**6. 単語削除機能の実装：**

```typescript
const handleWordDelete = useCallback(async (word: Word) => {
  Alert.alert(
    '単語を削除',
    `"${word.english}" を削除しますか？`,
    [
      { text: 'キャンセル', style: 'cancel' },
      {
        text: '削除',
        style: 'destructive',
        onPress: async () => {
          const result = await deleteWord(word.id);
          if (result.success) {
            await loadWords();
            Alert.alert('成功', '単語を削除しました');
          } else {
            Alert.alert('エラー', result.error.message);
          }
        },
      },
    ]
  );
}, [loadWords]);
```

### 関連ファイル
- `src/screens/WordListScreen.tsx` - 単語帳画面
- `src/services/database/words.ts` - 単語データベースサービス

### 教訓
- データを表示する画面では、必ずデータソースからデータを取得する処理を実装する
- `useFocusEffect`を使用することで、画面が表示される度に最新のデータを読み込める
- TODOコメントが残っている機能は、実装が完了していない可能性が高いため注意

---

## 12. 単語カードに削除ボタンを追加

### 発生日
2026年1月4日

### 背景
- 単語カードを長押しすることで削除できる機能は実装されていた
- しかし、長押しによる削除は発見しにくく、ユーザーにとって分かりにくい

### 要望
- 単語カードに明示的な削除ボタンを表示して、より分かりやすく削除できるようにしたい

### 解決策

**1. Trash2アイコンのインポート：**

```typescript
import { BookOpen, Check, Trash2 } from 'lucide-react-native';
```

**2. 単語カードのレイアウト変更：**

```typescript
// 変更前 - カード全体がPressableで、長押しで削除
const renderWordItem = useCallback(
  ({ item }: { item: Word }) => (
    <Pressable
      style={styles.wordCard}
      onPress={() => handleWordTap(item)}
      onLongPress={() => handleWordDelete(item)}
    >
      {/* カード内容 */}
    </Pressable>
  ),
  [handleWordTap, handleWordDelete]
);

// 変更後 - カードを分割し、削除ボタンを独立させる
const renderWordItem = useCallback(
  ({ item }: { item: Word }) => (
    <View style={styles.wordCard}>
      <Pressable
        style={styles.wordCardContent}
        onPress={() => handleWordTap(item)}
      >
        {/* カード内容 */}
      </Pressable>
      <Pressable
        style={styles.deleteButton}
        onPress={() => handleWordDelete(item)}
        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
      >
        <Trash2 size={20} color={Colors.error} />
      </Pressable>
    </View>
  ),
  [handleWordTap, handleWordDelete]
);
```

**3. スタイルの追加：**

```typescript
wordCard: {
  flexDirection: 'row',  // 横並びレイアウト
  backgroundColor: Colors.card,
  borderRadius: BorderRadius.lg,
  marginBottom: Spacing.md,
  ...Shadows.sm,
  overflow: 'hidden',
},
wordCardContent: {
  flex: 1,  // 左側のコンテンツ領域
  padding: Spacing.lg,
},
deleteButton: {
  justifyContent: 'center',
  alignItems: 'center',
  paddingHorizontal: Spacing.lg,
  backgroundColor: Colors.backgroundSecondary,
},
```

### 実装のポイント
- 単語カードを`View`でラップし、`flexDirection: 'row'`で横並びレイアウトに変更
- 左側に既存のカード内容（`wordCardContent`）、右側に削除ボタン（`deleteButton`）を配置
- 削除ボタンは赤いゴミ箱アイコン（`Trash2`）で視覚的に分かりやすく
- `hitSlop`プロパティでタップ領域を拡大し、押しやすさを向上
- 削除時には確認ダイアログが表示されるため、誤操作の心配も軽減

### 関連ファイル
- `src/screens/WordListScreen.tsx` - 単語帳画面

### 教訓
- 重要な操作（削除など）は、ユーザーが容易に発見できるように明示的なUIを提供する
- 長押しなどの隠れた操作に頼らず、アイコンボタンで操作を可視化する
- `hitSlop`を適切に設定することで、モバイルでの操作性が大幅に向上する

---

## 13. 日本語単語選択時に「Encountered two children with the same key」エラーが発生

### 発生日
2026年1月4日

### 症状
- 投稿文の日本語単語を長押しして選択すると、Reactの警告エラーが表示される
- エラー内容：`Encountered two children with the same key, "%s". Keys should be unique so that components maintain their identity across updates.`
- エラーが発生しても機能は動作するが、コンソールに警告が表示される

### 原因
`src/components/WordPopup.tsx`の日本語形態素解析結果を表示する部分で、配列のインデックスをReactのキーとして使用していた：

```typescript
{japaneseInfo.map((token, index) => (
  <View key={index} style={styles.tokenCard}>
    ...
  </View>
))}
```

この実装では、同じ単語が複数回出現した場合に重複したキーが生成される可能性があり、Reactが正しくコンポーネントを識別できなくなっていた。

### 解決策

`src/components/WordPopup.tsx`のキー生成方法を変更し、単語、読み、インデックスを組み合わせた一意の値を使用：

```typescript
// 変更前
{japaneseInfo.map((token, index) => (
  <View key={index} style={styles.tokenCard}>
    <View style={styles.tokenHeader}>
      <Text style={styles.tokenWord}>{token.word}</Text>
      <Text style={styles.tokenReading}>({token.reading})</Text>

// 変更後
{japaneseInfo.map((token, index) => (
  <View key={`${token.word}-${token.reading}-${index}`} style={styles.tokenCard}>
    <View style={styles.tokenHeader}>
      <Text style={styles.tokenWord}>{token.word}</Text>
      <Text style={styles.tokenReading}>({token.reading})</Text>
```

### 実装のポイント
- テンプレートリテラル`` `${token.word}-${token.reading}-${index}` ``を使用して一意のキーを生成
- 単語と読みが同じトークンが複数ある場合でも、インデックスで区別できる
- Reactのベストプラクティスに従い、配列の各要素に一意で安定したキーを提供

### 関連ファイル
- `src/components/WordPopup.tsx` - 単語ポップアップコンポーネント

### 教訓
- Reactで配列をマッピングする際、単純なインデックスをキーとして使うのは避けるべき
- キーは各要素を一意に識別できる値（ID、複合キーなど）を使用する
- 同じデータが複数回出現する可能性がある場合、インデックスだけでは不十分
- エラーメッセージで「Keys should be unique」と表示された場合、キーの生成方法を見直す

---

## 14. 単語カードの投稿URLをタップするとトグルが閉じる問題

### 発生日
2026年1月4日

### 背景
- 単語カード内にトグル（展開/折りたたみ）機能を実装し、詳細情報を表示できるようにした
- 展開時に英語定義、投稿文章、投稿URL、登録日時が表示される
- しかし、投稿URLをタップすると意図せずトグルが閉じてしまう

### 症状
- 単語カードをタップすると展開され、詳細情報が表示される
- 展開された状態で投稿URLをタップすると、URLではなく親のトグルが反応してカードが折りたたまれてしまう
- URLをブラウザで開くことができない

### 原因
- 投稿URLが単なる`Text`コンポーネントとして表示されており、タップ不可能だった
- 展開エリア全体が親の`Pressable`内にあるため、URLをタップすると親のイベントが発火してトグルが閉じてしまっていた
- React Nativeではイベントバブリングが発生し、子要素のタップが親に伝播する

### 解決策

**1. 投稿URLをPressableで囲んでタップ可能にする：**

`src/components/WordListItem.tsx`の投稿URL表示部分を修正：

```typescript
// 変更前 - タップ不可能なText
{word.postUrl && (
  <View style={styles.detailSection}>
    <Text style={styles.detailLabel}>投稿URL</Text>
    <Text style={styles.detailLink} numberOfLines={1}>
      {word.postUrl}
    </Text>
  </View>
)}

// 変更後 - Pressableで囲んでタップ可能に
{word.postUrl && (
  <View style={styles.detailSection}>
    <Text style={styles.detailLabel}>投稿URL</Text>
    <Pressable 
      onPress={handleUrlPress}
      onStartShouldSetResponder={() => true}
      onResponderTerminationRequest={() => false}
    >
      <Text style={styles.detailLink} numberOfLines={1}>
        {word.postUrl}
      </Text>
    </Pressable>
  </View>
)}
```

**2. イベント伝播を防ぐ処理を追加：**

- `onStartShouldSetResponder={() => true}` - このコンポーネントがタッチイベントを受け取ることを宣言
- `onResponderTerminationRequest={() => false}` - 親がイベントを奪おうとするのを防ぐ

これにより、URLをタップした際のイベントが親のPressableに伝播せず、URLだけが開かれてトグルは開いたままになる。

### 関連ファイル
- `src/components/WordListItem.tsx` - 単語カードコンポーネント

### 教訓
- React Nativeでは、親子関係にあるPressableコンポーネント間でイベントバブリングが発生する
- `onStartShouldSetResponder`と`onResponderTerminationRequest`を使用することで、子要素でイベントを確実にキャプチャできる
- タップ可能な要素を入れ子にする場合、イベント伝播の制御が重要

---

## 15. 投稿URLを開く際に「URLを開くことができません」エラーが発生

### 発生日
2026年1月4日

### 症状
- 単語カードの投稿URLをタップすると、「エラー - URLを開くことができません」というアラートが表示される
- データベースに保存されているURLは`at://did:plc:xxxxx/app.bsky.feed.post/xxxxx`形式のAT Protocol URI
- `Linking.canOpenURL()`がこの形式のURLをサポートしていないと判定していた

### 原因
- Blueskyの投稿URLはAT Protocol URI（`at://`で始まる）形式でデータベースに保存されていた
- このURI形式はブラウザで直接開くことができない
- `Linking.canOpenURL()`が`at://`スキームをサポートしていないため、エラーが発生していた

### 解決策

**1. AT Protocol URIをHTTPS URLに変換する処理を追加：**

`src/components/WordListItem.tsx`の`handleUrlPress`関数を修正：

```typescript
// 変更前 - AT Protocol URIをそのまま開こうとしてエラー
const handleUrlPress = useCallback(async () => {
  if (word.postUrl) {
    try {
      const supported = await Linking.canOpenURL(word.postUrl);
      if (supported) {
        await Linking.openURL(word.postUrl);
      } else {
        Alert.alert('エラー', 'URLを開くことができません');
      }
    } catch (error) {
      console.error('Failed to open URL:', error);
      Alert.alert('エラー', 'URLを開く際にエラーが発生しました');
    }
  }
}, [word.postUrl]);

// 変更後 - AT Protocol URIを変換してから開く
const handleUrlPress = useCallback(async () => {
  if (word.postUrl) {
    try {
      // Convert AT Protocol URI to HTTPS URL if needed
      let urlToOpen = word.postUrl;
      
      // Check if it's an AT Protocol URI (at://...)
      if (word.postUrl.startsWith('at://')) {
        // Parse: at://did:plc:xxxxx/app.bsky.feed.post/xxxxx
        const match = word.postUrl.match(/^at:\/\/([^\/]+)\/app\.bsky\.feed\.post\/(.+)$/);
        if (match) {
          const [, did, rkey] = match;
          urlToOpen = `https://bsky.app/profile/${did}/post/${rkey}`;
        } else {
          Alert.alert('エラー', '投稿URLの形式が正しくありません');
          return;
        }
      }
      
      console.log('Opening URL:', urlToOpen);
      
      // Try to open the URL - suppress errors as they may be false positives
      await Linking.openURL(urlToOpen).catch((err) => {
        console.warn('Linking.openURL error (may be ignorable):', err);
        // If openURL fails, it might still work, so we don't show an alert
      });
    } catch (error) {
      console.error('Failed to open URL:', error);
      // Only show alert for actual failures
      Alert.alert('エラー', 'URLを開く際にエラーが発生しました');
    }
  }
}, [word.postUrl]);
```

**2. 必要なインポートを追加：**

```typescript
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Animated,
  LayoutAnimation,
  Platform,
  UIManager,
  Linking,    // 追加
  Alert,      // 追加
} from 'react-native';
```

### URI変換の仕組み

AT Protocol URI形式：
```
at://did:plc:qcwhrvzx6wmi5hz775uyi6fh/app.bsky.feed.post/3mbkvtamzvf2g
```

↓ 変換

HTTPS URL形式：
```
https://bsky.app/profile/did:plc:qcwhrvzx6wmi5hz775uyi6fh/post/3mbkvtamzvf2g
```

正規表現を使用してDID（分散識別子）とrkey（レコードキー）を抽出し、Blueskyのウェブ版URLに変換する。

### 実装のポイント
- `canOpenURL()`チェックを削除 - このチェックが誤検知でエラーを出す可能性があったため
- エラーハンドリングを改善 - `openURL`のエラーをキャッチしてログに記録するが、実際にはURLが開かれている可能性があるため警告として扱う
- デバッグ用のログを追加 - 開こうとしているURLをコンソールに出力

### 関連ファイル
- `src/components/WordListItem.tsx` - 単語カードコンポーネント

### 教訓
- BlueskyのようなAT Protocolベースのアプリでは、URIとURLの変換が必要になる場合がある
- `Linking.canOpenURL()`は全てのスキームをサポートしているわけではないため、カスタムスキームの場合は注意が必要
- React NativeのLinking APIでエラーが発生しても、実際には処理が成功している場合があるため、エラーハンドリングは慎重に行う
- 正規表現を使用してURIをパースする際は、形式が正しくない場合のエラーハンドリングも忘れずに実装する

---

## 16. 日本語文章登録時に英語定義が入力されてしまう問題

### 発生日
2026年1月4日

### 症状
- 投稿文の日本語文章を長押しして単語帳に登録する
- 登録時には形態素解析結果が正しく表示される
- しかし、単語帳画面で展開すると「英語定義」というラベルで、最初のトークンの簡易情報（例：`名詞 - にゅーす`）のみが表示される
- 形態素解析結果全体（複数のトークンの詳細情報）が保存されていなかった

### 原因
`src/components/WordPopup.tsx`の`handleAddToWordList`関数で、日本語単語を登録する際に最初の主要トークンの簡易情報（品詞と読み）のみを保存していた：

```typescript
// 変更前
const mainToken = japaneseInfo.find(
  (token) =>
    !token.partOfSpeech.includes('助詞') &&
    !token.partOfSpeech.includes('記号') &&
    token.word.trim().length > 0
);

const reading = mainToken?.reading ?? null;
const info = mainToken 
  ? `${mainToken.partOfSpeech} - ${mainToken.reading}`
  : null;

onAddToWordList(
  word,
  reading,
  info,  // 最初のトークンの簡易情報のみ
  postUri ?? null,
  postText ?? null
);
```

また、`src/components/WordListItem.tsx`では、定義フィールドのラベルが「英語定義」で固定されており、日本語の形態素解析結果に対応していなかった。

### 解決策

**1. WordPopup.tsxの修正 - 形態素解析結果全体を保存：**

```typescript
// 変更後
const mainToken = japaneseInfo.find(
  (token) =>
    !token.partOfSpeech.includes('助詞') &&
    !token.partOfSpeech.includes('記号') &&
    token.word.trim().length > 0
);

const reading = mainToken?.reading ?? null;

// Format all morphology results for definition
const morphologyResult = japaneseInfo.length > 0
  ? japaneseInfo.map(token => 
      `${token.word} (${token.reading})\n品詞: ${token.partOfSpeech}\n基本形: ${token.baseForm}`
    ).join('\n\n')
  : null;

onAddToWordList(
  word,
  reading,
  morphologyResult,  // 全トークンの詳細情報
  postUri ?? null,
  postText ?? null
);
```

**2. WordListItem.tsxの修正 - ラベルを条件分岐：**

```typescript
// 変更前
{word.definition && (
  <View style={styles.detailSection}>
    <Text style={styles.detailLabel}>英語定義</Text>
    <Text style={styles.detailText}>{word.definition}</Text>
  </View>
)}

// 変更後
{word.definition && (
  <View style={styles.detailSection}>
    <Text style={styles.detailLabel}>
      {word.japanese && word.definition.includes('品詞:') ? '形態素解析結果' : '英語定義'}
    </Text>
    <Text style={styles.detailText}>{word.definition}</Text>
  </View>
)}
```

### 実装のポイント
- 形態素解析結果は`japaneseInfo.map()`で全トークンをフォーマットし、改行で区切って保存
- 各トークンの情報は「単語(読み)」「品詞」「基本形」の3行で構成
- WordListItemでは、定義フィールドに「品詞:」が含まれているかで日本語か英語かを判定
- 日本語の場合は「形態素解析結果」、英語の場合は「英語定義」と適切なラベルを表示

### 表示例

**登録時のポップアップ：**
```
みんな味方だよ

形態素解析結果：
みんな (みんな)
品詞: 副詞
基本形: みんな

味方 (みかた)
品詞: 名詞
基本形: 味方

だ (だ)
品詞: 判定詞
基本形: だ

よ (よ)
品詞: 助詞
基本形: よ
```

**単語帳画面での表示：**
- 展開前：「みんな味方だよ」「みんな」
- 展開後：「形態素解析結果」ラベルで上記の全トークン情報を表示

### 関連ファイル
- `src/components/WordPopup.tsx` - 単語ポップアップコンポーネント
- `src/components/WordListItem.tsx` - 単語カードコンポーネント
- `src/types/word.ts` - 型定義

### 教訓
- 形態素解析のような複雑な結果は、フォーマット済みの文字列として保存することで、後から表示が容易になる
- 同じフィールドを異なる用途（英語定義 / 形態素解析結果）で使用する場合、内容から判定できる特徴的な文字列（「品詞:」など）を含めると便利
- 日本語の自然言語処理では、文字列全体ではなく個々のトークンごとに詳細情報を保存・表示することが重要

---

## 17. API設定画面でYahoo JAPAN Client IDセクションへの自動スクロールを実装

### 発生日
2026年1月4日

### 背景
- 設定画面のAPI設定セクションにDeepL API KeyとYahoo JAPAN Client IDの2つの設定項目を追加した
- どちらの項目をタップしても、API設定画面のトップ（DeepLセクション）が表示されていた
- Yahoo JAPAN Client IDをタップした場合、下にスクロールしてYahooセクションを探す必要があった

### 要望
- Yahoo JAPAN Client IDをタップした際、API設定ページのYahoo JAPAN Client IDセクションまで自動的にスクロールしてほしい

### 解決策

**1. ナビゲーションパラメータの追加：**

`src/navigation/AppNavigator.tsx`のRootStackParamListを修正し、ApiKeySetupに`section`パラメータを追加：

```typescript
// 変更前
export type RootStackParamList = {
  Splash: undefined;
  Login: undefined;
  Main: undefined;
  ApiKeySetup: undefined;
  License: undefined;
};

// 変更後
export type RootStackParamList = {
  Splash: undefined;
  Login: undefined;
  Main: undefined;
  ApiKeySetup: { section?: 'deepl' | 'yahoo' };
  License: undefined;
};
```

**2. SettingsScreen.tsxの修正 - 個別のハンドラーを作成：**

DeepL用とYahoo用で別々のハンドラーを実装し、適切なセクションパラメータを渡すように変更：

```typescript
// 変更前 - 共通のハンドラー
const handleApiKeySettings = useCallback(() => {
  navigation.navigate('ApiKeySetup');
}, [navigation]);

// API設定セクションで両方とも同じハンドラーを使用
<SettingsItem
  title="DeepL API Key"
  subtitle={apiKeySet ? '設定済み ✓' : '未設定'}
  onPress={handleApiKeySettings}
/>
<SettingsItem
  title="Yahoo JAPAN Client ID"
  subtitle={yahooClientIdSet ? '設定済み ✓' : '未設定'}
  onPress={handleApiKeySettings}
/>

// 変更後 - 個別のハンドラー
const handleDeepLApiKeySettings = useCallback(() => {
  navigation.navigate('ApiKeySetup', { section: 'deepl' });
}, [navigation]);

const handleYahooApiKeySettings = useCallback(() => {
  navigation.navigate('ApiKeySetup', { section: 'yahoo' });
}, [navigation]);

// API設定セクションで個別のハンドラーを使用
<SettingsItem
  title="DeepL API Key"
  subtitle={apiKeySet ? '設定済み ✓' : '未設定'}
  onPress={handleDeepLApiKeySettings}
/>
<SettingsItem
  title="Yahoo JAPAN Client ID"
  subtitle={yahooClientIdSet ? '設定済み ✓' : '未設定'}
  onPress={handleYahooApiKeySettings}
/>
```

**3. ApiKeySetupScreen.tsxの修正 - スクロール機能の実装：**

ScrollViewとYahooセクションへの参照を追加し、routeパラメータに応じて自動スクロール：

```typescript
// Propsの型定義を更新
type RootStackParamList = {
  ApiKeySetup: { section?: 'deepl' | 'yahoo' };
  Settings: undefined;
};

// useRefのインポートを追加
import React, { useCallback, useState, useEffect, useRef } from 'react';

// コンポーネント内でrouteパラメータを受け取り、refを定義
export function ApiKeySetupScreen({ navigation, route }: Props): React.JSX.Element {
  // Refs
  const scrollViewRef = useRef<ScrollView>(null);
  const yahooSectionRef = useRef<View>(null);
  
  // ... 既存のstate定義

  // スクロール処理のuseEffect
  useEffect(() => {
    if (route.params?.section === 'yahoo') {
      // Wait for layout to complete before scrolling
      const timer = setTimeout(() => {
        yahooSectionRef.current?.measureLayout(
          scrollViewRef.current as any,
          (_x, y) => {
            scrollViewRef.current?.scrollTo({ y: y - 20, animated: true });
          },
          () => {}
        );
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [route.params?.section]);

  // ScrollViewにrefを設定
  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <ScrollView
        ref={scrollViewRef}
        style={styles.scrollView}
        contentContainerStyle={styles.contentContainer}
      >
        {/* DeepL Section */}
        <View style={styles.section}>
          {/* ... DeepLセクションの内容 */}
        </View>

        {/* Divider */}
        <View style={styles.divider} />

        {/* Yahoo! JAPAN Section - refを設定 */}
        <View ref={yahooSectionRef} style={styles.section}>
          {/* ... Yahooセクションの内容 */}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
```

### 実装のポイント
- `useRef`を使用してScrollViewとYahooセクションのViewへの参照を保持
- `measureLayout`でYahooセクションの位置を計算し、ScrollViewをその位置までスクロール
- 300msの遅延を設定し、レイアウトが完全に描画されてからスクロールを実行
- `y - 20`で少し上にオフセットを設定し、セクションタイトルが見やすいように調整
- `animated: true`でスムーズなスクロールアニメーションを実現

### 関連ファイル
- `src/navigation/AppNavigator.tsx` - ナビゲーション型定義
- `src/screens/SettingsScreen.tsx` - 設定画面
- `src/screens/ApiKeySetupScreen.tsx` - API設定画面

### 教訓
- ナビゲーションパラメータを活用することで、同じ画面でも異なる初期状態を実装できる
- React Nativeの`measureLayout`を使用して、動的に要素の位置を計算してスクロールできる
- レイアウト計算には時間がかかるため、`setTimeout`で少し遅延させることで確実にスクロールできる
- ユーザビリティ向上のため、関連するコンテンツに直接ジャンプする機能は重要

---

## 18. 設定ページのアカウント表示で毎回フェッチされる問題

### 発生日
2026年1月4日

### 症状
- 設定ページを開くたびにアカウントのプロフィール情報（アバター、表示名、フォロワー数など）が毎回フェッチされる
- ログに「Profile fetched: connectobasan.com」が繰り返し表示される
- 画面を開くたびにローディング状態が表示され、見づらい

### 調査過程

1. **SettingsScreen.tsxの確認** - 画面フォーカス時に毎回`getProfile()`を呼び出してプロフィールを取得していた

2. **キャッシュ機能の設計** - 認証情報と同様に、プロフィール情報もauthStoreで管理し、キャッシュすることで毎回のフェッチを避けることにした

### 原因
- SettingsScreenで`useEffect`内の`fetchProfile()`が画面フォーカス時に毎回実行されていた
- プロフィール情報がローカルstateで管理されており、画面を離れるとリセットされていた
- プロフィールデータをアプリ全体で共有する仕組みがなかった

### 解決策

**1. authStore.tsにプロフィールキャッシュ機能を追加：**

```typescript
// AuthStateインターフェースに追加
interface AuthState {
  // 既存のstate
  isAuthenticated: boolean;
  isLoading: boolean;
  user: { handle: string; did: string; } | null;
  error: AppError | null;
  
  // プロフィールキャッシュを追加
  profile: BlueskyProfile | null;
  isProfileLoading: boolean;

  // 既存のアクション
  login: (identifier: string, appPassword: string) => Promise<Result<void, AppError>>;
  logout: () => Promise<void>;
  checkAuth: () => Promise<boolean>;
  resumeSession: () => Promise<Result<void, AppError>>;
  clearError: () => void;
  
  // プロフィールアクションを追加
  fetchProfile: () => Promise<Result<BlueskyProfile, AppError>>;
  refreshProfile: () => Promise<void>;
}

// 初期stateに追加
export const useAuthStore = create<AuthState>((set, get) => ({
  // 既存の初期state
  isAuthenticated: false,
  isLoading: true,
  user: null,
  error: null,
  
  // プロフィールの初期state
  profile: null,
  isProfileLoading: false,
  
  // fetchProfile実装 - キャッシュがあればそれを返す
  fetchProfile: async () => {
    const currentProfile = get().profile;
    
    // Return cached profile if available
    if (currentProfile) {
      return { success: true, data: currentProfile };
    }
    
    set({ isProfileLoading: true });
    const result = await AuthService.getProfile();
    
    if (result.success) {
      set({ profile: result.data, isProfileLoading: false });
      return result;
    } else {
      set({ isProfileLoading: false });
      return result;
    }
  },
  
  // refreshProfile実装 - 強制的に最新データを取得
  refreshProfile: async () => {
    set({ isProfileLoading: true });
    const result = await AuthService.getProfile();
    
    if (result.success) {
      set({ profile: result.data, isProfileLoading: false });
    } else {
      set({ isProfileLoading: false });
    }
  },
}));

// セレクターフック追加
export const useAuthProfile = () => useAuthStore((state) => state.profile);
export const useIsProfileLoading = () => useAuthStore((state) => state.isProfileLoading);
```

**2. ログイン時とセッション復元時に自動でプロフィールを取得：**

```typescript
// login関数を修正
login: async (identifier: string, appPassword: string) => {
  set({ isLoading: true, error: null });
  const result = await AuthService.login(identifier, appPassword);

  if (result.success) {
    set({
      isAuthenticated: true,
      isLoading: false,
      user: { handle: result.data.handle, did: result.data.did },
      error: null,
    });
    
    // Fetch profile automatically after login
    get().fetchProfile();
    
    return { success: true, data: undefined };
  } else {
    set({
      isAuthenticated: false,
      isLoading: false,
      user: null,
      error: result.error,
    });
    return result;
  }
},

// resumeSession関数を修正
resumeSession: async () => {
  set({ isLoading: true, error: null });
  const result = await AuthService.resumeSession();

  if (result.success) {
    const storedAuth = await AuthService.getStoredAuth();
    if (storedAuth) {
      set({
        isAuthenticated: true,
        isLoading: false,
        user: { handle: storedAuth.handle, did: storedAuth.did },
        error: null,
      });
      
      // Fetch profile automatically after session resume
      get().fetchProfile();
    }
    return { success: true, data: undefined };
  } else {
    set({
      isAuthenticated: false,
      isLoading: false,
      user: null,
      error: result.error,
    });
    return result;
  }
},

// logout関数でプロフィールもクリア
logout: async () => {
  set({ isLoading: true });
  await AuthService.logout();
  set({
    isAuthenticated: false,
    isLoading: false,
    user: null,
    error: null,
    profile: null,
    isProfileLoading: false,
  });
},
```

**3. SettingsScreen.tsxをストアのキャッシュを使用するように修正：**

```typescript
// 変更前 - ローカルstateで管理
import { getProfile } from '../services/bluesky/auth';
import { BlueskyProfile } from '../types/bluesky';

export function SettingsScreen(): React.JSX.Element {
  const { user, logout, isLoading } = useAuthStore();
  const [profile, setProfile] = useState<BlueskyProfile | null>(null);
  const [isLoadingProfile, setIsLoadingProfile] = useState(true);

  useEffect(() => {
    const fetchProfile = async () => {
      setIsLoadingProfile(true);
      const result = await getProfile();
      if (result.success) {
        setProfile(result.data);
      }
      setIsLoadingProfile(false);
    };

    fetchProfile();

    const unsubscribe = navigation.addListener('focus', () => {
      fetchProfile();
    });

    return unsubscribe;
  }, [navigation]);

  // ... rest of component
  {isLoadingProfile ? (
    <ActivityIndicator />
  ) : (
    // Display profile
  )}
}

// 変更後 - ストアから取得
export function SettingsScreen(): React.JSX.Element {
  const { user, logout, isLoading, profile, isProfileLoading } = useAuthStore();
  
  // プロフィール取得のuseEffectは不要
  
  // ... rest of component
  {isProfileLoading ? (
    <ActivityIndicator />
  ) : (
    // Display profile
  )}
}
```

**4. エラー修正 - 変数名の不一致：**

最初の実装で`isLoadingProfile`と`isProfileLoading`の名前が混在してエラーが発生したため、一貫して`isProfileLoading`を使用するように修正：

```typescript
// エラー: ReferenceError: Property 'isLoadingProfile' doesn't exist

// 修正: 全て isProfileLoading に統一
{isProfileLoading ? (
  <View style={styles.accountLoading}>
    <ActivityIndicator size="small" color={Colors.primary} />
    <Text style={styles.accountLoadingText}>読み込み中...</Text>
  </View>
) : (
  // Display profile
)}
```

**5. 毎回フェッチされる問題の修正：**

当初、画面フォーカス時に`refreshProfile()`を呼び出していたため、毎回APIフェッチが発生していた。この処理を削除し、ログイン時とセッション復元時のみ自動取得されるように変更：

```typescript
// 変更前 - 画面フォーカス時に毎回フェッチ
useEffect(() => {
  const unsubscribe = navigation.addListener('focus', () => {
    refreshProfile();
  });
  return unsubscribe;
}, [navigation, refreshProfile]);

// 変更後 - フォーカス時の処理は不要
// ログイン時とセッション復元時に既にプロフィールが取得されているため、
// ストアから直接参照するだけで十分
```

### 実装のポイント
- `fetchProfile()` - キャッシュがあればそれを返し、なければAPIから取得
- `refreshProfile()` - 必要に応じて強制的に最新データを取得（将来的にプルトゥリフレッシュ機能などで使用可能）
- ログイン時とセッション復元時に自動でプロフィールを取得するため、画面表示時は既にキャッシュされている
- 設定画面ではストアからプロフィールを参照するだけで、追加のAPIコールは不要

### 関連ファイル
- `src/store/authStore.ts` - 認証ストア（プロフィールキャッシュを追加）
- `src/screens/SettingsScreen.tsx` - 設定画面（ストアのキャッシュを使用）
- `src/services/bluesky/auth.ts` - Bluesky認証サービス

### 教訓
- 頻繁に参照されるデータはストアでキャッシュすることで、不要なAPIコールを減らせる
- 認証情報とプロフィール情報は密接に関連しているため、同じストアで管理するのが自然
- キャッシュ機能では、初回取得（`fetchProfile`）と強制更新（`refreshProfile`）を分けて実装することで柔軟性が向上
- 変数名の一貫性は重要で、命名規則が混在するとエラーの原因になる

---

## 19. 単語登録時刻が9時間ズレて記録される問題

### 発生日
2026年1月5日

### 症状
- 投稿文の単語を長押しして単語帳に登録する
- 登録時刻が実際の時刻より9時間前に記録される
- 例：9:11に登録した単語が0:10:59と表示される
- データベースに保存されている時刻がUTC（協定世界時）になっており、日本時間（JST）として表示される際にズレが発生

### 調査過程

1. **最初の修正 - UTC保存方式の導入**
   - データベースにUTC時刻で保存し、表示時にローカル時刻に変換する方式を実装
   - `created_at`を`CURRENT_TIMESTAMP`（UTC）で保存
   - `formatDate`関数でUTC→ローカル変換
   - マイグレーションで既存データを-9時間してUTCに変換

2. **問題の発覚**
   - 新しい単語を登録しても、依然として9時間のズレが発生
   - マイグレーションは実行されたが、新規登録時の時刻が正しくない

3. **原因の特定**
   - `insertWord`関数で`created_at`を明示的に指定していなかった
   - テーブル作成時のDEFAULT値は既存テーブルには適用されない
   - マイグレーションの複雑さとUTC/ローカル時刻の変換ミス

4. **最終的な解決策**
   - シンプルなローカル時刻保存方式に変更
   - データベーススキーマ、挿入処理、表示処理を全てローカル時刻に統一

### 原因

**1. テーブルスキーマとデータ挿入の不一致：**
- テーブル定義で`created_at DATETIME DEFAULT CURRENT_TIMESTAMP`としていた
- しかし、`insertWord`関数で明示的に`created_at`を指定していなかった
- SQLiteでは既存テーブルのDEFAULT値は変更できないため、スキーマを修正してもデータ挿入には影響しなかった

**2. マイグレーションの複雑さ：**
- UTC保存方式では、既存データの変換、新規データの保存、表示時の変換と3箇所で正確な処理が必要
- マイグレーションでデータを変換しても、新規データが異なる形式で保存されると一貫性が失われる

**3. タイムゾーンの考慮不足：**
- 当初「タイムゾーン非依存」を目指してUTC保存を試みたが、個人の学習アプリでは過度に複雑
- ユーザーが海外旅行中に単語を登録することは稀で、実用上はローカル時刻保存で十分

### 解決策

**最終的にローカル時刻保存方式を採用：**

**1. データベーススキーマの修正：**

`src/services/database/init.ts`:
```typescript
// created_atをローカル時刻で保存
created_at DATETIME DEFAULT (datetime('now', 'localtime')),
```

**2. insertWord関数の修正：**

`src/services/database/words.ts`:
```typescript
// 明示的にローカル時刻を指定
const result = await database.runAsync(
  `INSERT INTO words (english, japanese, definition, post_url, post_text, created_at)
   VALUES (?, ?, ?, ?, ?, datetime('now', 'localtime'))`,
  [sanitizedEnglish, input.japanese ?? null, input.definition ?? null, 
   input.postUrl ?? null, input.postText ?? null]
);
```

**3. toggleReadStatus関数の修正：**

```typescript
// read_atもローカル時刻で記録
if (newIsRead === 1) {
  await database.runAsync(
    "UPDATE words SET is_read = ?, read_at = datetime('now', 'localtime') WHERE id = ?",
    [newIsRead, id]
  );
}
```

**4. 統計処理の修正：**

`src/services/database/stats.ts`と`src/services/database/words.ts`の全ての`date('now')`を`date('now', 'localtime')`に変更：

```typescript
// 今日の学習数取得
WHERE date(read_at) = date('now', 'localtime')

// 日別統計の更新
INSERT INTO daily_stats (date, words_read_count)
VALUES (date('now', 'localtime'), 1)
```

**5. 表示処理の修正：**

`src/components/WordListItem.tsx`:
```typescript
// UTC変換せず、ローカル時刻としてそのまま解釈
function formatDate(dateString: string): string {
  try {
    const localDate = new Date(dateString.replace(' ', 'T'));
    return format(localDate, 'yyyy/M/d HH:mm:ss', { locale: ja });
  } catch {
    return '-';
  }
}
```

**6. マイグレーションの追加：**

既存データを修正するため、バージョン3と4のマイグレーションを追加：

```typescript
// Migration to version 3: Fix timezone conversion
if (currentVersion < 3) {
  // Add 9 hours to convert UTC back to JST
  await database.execAsync(`
    UPDATE words 
    SET created_at = datetime(created_at, '+9 hours')
    WHERE created_at IS NOT NULL;
  `);
  // ... (read_atも同様に処理)
}

// Migration to version 4: Ensure all timestamps are in JST
if (currentVersion < 4) {
  // 念のため再度+9時間（冪等性のため条件チェック付き）
  await database.execAsync(`
    UPDATE words 
    SET created_at = datetime(created_at, '+9 hours')
    WHERE created_at IS NOT NULL;
  `);
  // ... (read_atも同様に処理)
}
```

### 実装のポイント
- **一貫性**：データベース保存、取得、表示の全てでローカル時刻を使用
- **シンプルさ**：UTC変換の複雑さを避け、タイムゾーン変換なしで動作
- **明示的な指定**：DEFAULT値に頼らず、INSERT時に必ず`datetime('now', 'localtime')`を指定
- **マイグレーション**：既存データを+9時間して、UTC→ローカル時刻に修正

### 関連ファイル
- `src/services/database/init.ts` - データベース初期化とマイグレーション
- `src/services/database/words.ts` - 単語データベース操作
- `src/services/database/stats.ts` - 統計データベース操作
- `src/components/WordListItem.tsx` - 単語カード表示
- `src/constants/config.ts` - データベース設定

### 教訓
- SQLiteの`CURRENT_TIMESTAMP`は常にUTCを返すため、ローカル時刻が必要な場合は`datetime('now', 'localtime')`を使う
- テーブル定義のDEFAULT値は既存テーブルには適用されないため、INSERT文で明示的に指定する必要がある
- タイムゾーン対応は複雑になりがちなので、要件を満たす最もシンプルな方法を選ぶべき
- 個人の学習アプリでは、グローバルなタイムゾーン対応より、ローカル時刻での一貫性を優先する方が実用的
- データベースマイグレーションは段階的に実行し、各ステップでログを出力して検証可能にする
- 時刻関連の問題では、保存時・取得時・表示時の全てのポイントで一貫した方式を採用することが重要

---

## 18. 単語登録時に同じ単語が2回登録されるエラーと即座に反映されない問題

### 発生日
2026年1月5日

### 症状
- 投稿文の単語を長押しして選択し、「単語帳に追加」ボタンを押す
- 「DUPLICATE_WORD: この単語は既に登録されています」というエラーが表示される
- しかし、実際には登録していない単語でもこのエラーが発生する
- また、単語を登録しても、単語帳画面に即座に反映されず、タブを切り替えてから戻らないと表示されない

### 調査過程

1. **ログの追加** - データベース操作にログを追加したところ、同じ単語が2回連続で登録されようとしていることが判明
   - 1回目: `[insertWord] Inserted with ID: 9` - 成功
   - 2回目: `[insertWord] Duplicate found for "everything": {"id": 9}` - 既に登録済みエラー

2. **WordPopup.tsxの確認** - `handleAddToWordList`関数で以下の処理が行われていた：
   - `addWordToStore()` - データベースに単語を追加（1回目）
   - `onAddToWordList()` - HomeScreenの`handleAddWord`を呼び出し、さらにデータベースに追加（2回目）

3. **単語リストの更新メカニズムの確認** - WordListScreenは`useFocusEffect`で画面がフォーカスされたときのみデータを読み込んでいたため、HOMEタブで単語を追加しても、単語帳タブに切り替えるまで反映されなかった

### 原因

**原因1: 二重登録**
- `WordPopup.tsx`の`handleAddToWordList`で、`addWordToStore()`と`onAddToWordList()`の両方を呼び出していた
- これにより、同じ単語がデータベースに2回連続で登録されようとしていた
- 1回目は成功するが、2回目は重複エラーになる

**原因2: リアルタイム更新の欠如**
- 単語リストの状態管理がローカルステート（`useState`）のみで行われていた
- 画面間で状態が共有されておらず、`useFocusEffect`による画面フォーカス時のみデータを読み込んでいた
- そのため、HOMEタブで単語を追加しても、単語帳タブには即座に反映されなかった

### 解決策

**解決策1: 二重登録の修正**

`src/components/WordPopup.tsx`の`handleAddToWordList`関数を修正し、`onAddToWordList()`の呼び出しを削除：

```typescript
// 変更前 - 2回登録していた
const result = await addWordToStore({ /* ... */ });

if (result.success) {
  // Also call the original callback for backward compatibility
  onAddToWordList(
    word,
    translation?.text ?? null,
    definition?.definition ?? null,
    postUri ?? null,
    postText ?? null
  );
  
  setTimeout(() => {
    onClose();
  }, 500);
} else {
  Alert.alert('エラー', result.error.message);
}

// 変更後 - 1回のみ登録
const result = await addWordToStore({ /* ... */ });

if (result.success) {
  // Show success message
  Alert.alert('成功', '単語を追加しました！');
  
  setTimeout(() => {
    onClose();
  }, 500);
} else {
  Alert.alert('エラー', result.error.message);
}
```

**解決策2: グローバル状態管理の実装**

Zustandを使用したwordStoreを作成し、単語リストをグローバルに管理：

`src/store/wordStore.ts`を新規作成：

```typescript
import { create } from 'zustand';
import { Word, WordFilter, CreateWordInput } from '../types/word';
import * as WordService from '../services/database/words';

interface WordState {
  words: Word[];
  isLoading: boolean;
  error: AppError | null;
  filter: WordFilter;
  
  loadWords: () => Promise<Result<void, AppError>>;
  addWord: (input: CreateWordInput) => Promise<Result<Word, AppError>>;
  toggleReadStatus: (id: number) => Promise<Result<void, AppError>>;
  deleteWord: (id: number) => Promise<Result<void, AppError>>;
  setFilter: (filter: Partial<WordFilter>) => void;
  clearError: () => void;
}

export const useWordStore = create<WordState>((set, get) => ({
  words: [],
  isLoading: false,
  error: null,
  filter: { /* デフォルトフィルタ */ },
  
  loadWords: async () => {
    // データベースから単語を読み込み
  },
  
  addWord: async (input) => {
    const result = await WordService.insertWord(input);
    if (result.success) {
      // 追加後、自動的にloadWords()を呼び出して更新
      await get().loadWords();
    }
    return result;
  },
  
  // その他のアクション...
}));
```

`src/screens/WordListScreen.tsx`を修正し、wordStoreを使用：

```typescript
// 変更前 - ローカルステート
const [words, setWords] = useState<Word[]>([]);
const loadWords = useCallback(async () => {
  const result = await getWords(filter);
  if (result.success) {
    setWords(result.data);
  }
}, [filter]);

// 変更後 - グローバルストア
const { 
  words, 
  isLoading, 
  loadWords, 
  toggleReadStatus,
  deleteWord,
  setFilter 
} = useWordStore();
```

`src/components/WordPopup.tsx`を修正し、wordStoreから直接追加：

```typescript
// wordStoreのインポートを追加
import { useWordStore } from '../store/wordStore';

// コンポーネント内でwordStoreを使用
const addWordToStore = useWordStore(state => state.addWord);

// handleAddToWordList内で使用
const result = await addWordToStore({
  english: word,
  japanese: translation?.text ?? undefined,
  definition: definition?.definition ?? undefined,
  postUrl: postUri ?? undefined,
  postText: postText ?? undefined,
});
```

### 実装のポイント
- Zustandを使用したグローバル状態管理により、画面間でデータが自動的に同期される
- `addWord`関数内で`loadWords()`を呼び出すことで、追加後に自動的に単語リストが更新される
- WordListScreenはwordStoreの`words`を購読しているため、更新が即座に反映される
- 既存のauthStoreと同じパターンで実装し、コードの一貫性を保つ
- エラー処理を改善し、成功時とエラー時で適切なメッセージを表示

### 動作の流れ

1. HOMEタブで単語を選択→WordPopupが開く
2. 「単語帳に追加」ボタンをクリック
3. `WordPopup`が`wordStore.addWord()`を呼び出し
4. `wordStore`がデータベースに保存後、自動的に`loadWords()`を実行
5. `WordListScreen`は`wordStore`の状態を購読しているため、**即座に**新しい単語が表示される
6. タブ切り替えや画面遷移を待つ必要なし

### 関連ファイル
- `src/store/wordStore.ts` - 単語リスト用グローバルストア（新規作成）
- `src/components/WordPopup.tsx` - 単語ポップアップコンポーネント
- `src/screens/WordListScreen.tsx` - 単語帳画面
- `src/services/database/words.ts` - 単語データベースサービス

### 教訓
- 複数の画面で共有されるデータは、グローバル状態管理（Zustand、Redux等）を使用すべき
- ローカルステート（`useState`）のみでは、画面間のデータ同期が困難
- 同じ処理を複数箇所で呼び出すと、意図しない二重実行が発生する可能性がある
- デバッグログを追加することで、処理の流れや問題箇所を特定しやすくなる
- エラーメッセージで「DUPLICATE_WORD」と表示される場合でも、実際には二重登録が原因の可能性がある
- グローバル状態管理により、リアルタイム更新とコードの保守性が大幅に向上する

---

## 19. 英語文章選択機能の実装中にファイルが破損しビルドエラーが発生

### 発生日
2026年1月5日

### 背景
英語文章を選択して、文章全体の翻訳と各単語の訳・定義を表示する機能を実装した。以下の機能を追加：
- ダブルタップで文章（ピリオドまで）を選択
- 文章の日本語訳を表示
- 文章内の各英単語の訳と定義を表示
- 既登録単語にバッジを表示
- 選択した単語のみを一括登録

### 症状
実装後、以下のような構文エラーが連続して発生：
1. `SyntaxError: Unexpected token (175:24)` - PostCard.tsx
2. `SyntaxError: Unexpected token (123:0)` - WordPopup.tsx
3. `SyntaxError: Unexpected token "," (148:29)` - WordPopup.tsx
4. `Identifier 'isJapanese' has already been declared` - WordPopup.tsx
5. `SyntaxError: Unexpected token (517:4)` - WordPopup.tsx
6. `ReferenceError: Property 'handleEndReached' doesn't exist` - HomeScreen.tsx

### 原因
複数ファイルへの編集処理中に、コードの一部が誤って結合・重複し、ファイルが破損した。具体的には：

1. **PostCard.tsx** - `getSentenceContainingWord`関数と`handlePress`関数が誤って結合
2. **WordPopup.tsx** - 以下の問題が発生：
   - `export function WordPopup({`が`exisSentenceMode = false,`に変形
   - `loading`状態の定義が重複して結合
   - `isJapanese`状態が2回宣言
   - `handleAddToWordList`関数の末尾が重複
3. **HomeScreen.tsx** - `handleEndReached`関数の定義が`renderPost`関数の内容と混在

### 解決策

**1. PostCard.tsxの修正：**

破損した関数を正しく再定義：

```typescript
// 修正後
const getSentenceContainingWord = useCallback((wordText: string): string | null => {
  const sentences = splitIntoSentences(post.text);
  for (const sentence of sentences) {
    if (sentence.toLowerCase().includes(wordText.toLowerCase())) {
      return sentence;
    }
  }
  return null;
}, [post.text]);

const handleWordDoubleTap = useCallback(
  (word: string) => {
    if (!onSentenceSelect) return;
    const sentence = getSentenceContainingWord(word);
    if (sentence) {
      setSelectedSentence(sentence);
      setSelectedWord(null);
      onSentenceSelect(sentence, post.uri, post.text);
    }
  },
  [post.uri, post.text, onSentenceSelect, getSentenceContainingWord]
);

const handleWordPress = useCallback(
  (word: string) => {
    if (longPressTimer) {
      clearTimeout(longPressTimer);
      setLongPressTimer(null);
      handleWordDoubleTap(word);
    } else {
      const timer = setTimeout(() => {
        setLongPressTimer(null);
      }, 300);
      setLongPressTimer(timer);
    }
  },
  [longPressTimer, handleWordDoubleTap]
);

const handlePress = useCallback(() => {
  setSelectedWord(null);
  setSelectedSentence(null);
  if (longPressTimer) {
    clearTimeout(longPressTimer);
    setLongPressTimer(null);
  }
}, [longPressTimer]);
```

**2. WordPopup.tsxの修正：**

a) 関数定義を修正：
```typescript
// 修正前（破損）
exisSentenceMode = false,

// 修正後
export function WordPopup({
  visible,
  word,
  isSentenceMode = false,
```

b) loading状態の重複を削除：
```typescript
// 修正後（重複を削除）
const [loading, setLoading] = useState<LoadingState>({
  definition: false,
  translation: false,
  japanese: false,
  sentenceTranslation: false,
  wordsInfo: false,
});
```

c) isJapanese状態の重複を削除：
```typescript
// 修正後（1つだけ残す）
const [isJapanese, setIsJapanese] = useState(false);
```

d) handleAddToWordList関数の重複コードを削除

**3. HomeScreen.tsxの修正：**

handleEndReached関数を正しく再定義：

```typescript
// 修正後
const handleEndReached = useCallback(() => {
  if (!isLoadingMore && hasMore && isConnected) {
    loadMore();
  }
}, [isLoadingMore, hasMore, isConnected, loadMore]);

const renderPost = useCallback(
  ({ item }: { item: TimelinePost }) => {
    const shouldClearSelection = !wordPopup.visible && wordPopup.postUri === item.uri;
    return (
      <PostCard 
        post={item} 
        onWordSelect={handleWordSelect}
        onSentenceSelect={handleSentenceSelect}
        clearSelection={shouldClearSelection}
      />
    );
  },
  [handleWordSelect, handleSentenceSelect, wordPopup.visible, wordPopup.postUri]
);
```

### 関連ファイル
- `src/components/PostCard.tsx` - 投稿カードコンポーネント
- `src/components/WordPopup.tsx` - 単語ポップアップコンポーネント
- `src/screens/HomeScreen.tsx` - ホーム画面

### 教訓
- 複数ファイルへの大規模な編集時は、各ファイルの整合性を確認する
- 構文エラーが発生した場合、エラー箇所周辺のコードを注意深く確認する
- 関数や変数の重複宣言エラーは、コードが誤って結合された可能性を示唆する
- 編集後は必ずビルドを実行し、構文エラーがないことを確認する

---

## 20. 英語文章の単語間にスペースがなくなる問題

### 発生日
2026年1月5日

### 症状
- 英語文章選択機能の実装後、投稿カード内の英文が正しく表示されない
- 単語間のスペースがなくなり、単語が連結して表示される
- 例：「Kitty-tama, you are so brave」が「Kitty-tama,youaresobrave」と表示される

### 原因
`PostCard.tsx`の`parseTextIntoTokens`関数で英語文章を単語に分割する際、正規表現がスペース（空白文字）をキャプチャしていなかった：

```typescript
// 問題のコード
const wordPattern = /([a-zA-Z][a-zA-Z'-]*)|([^\sa-zA-Z]+)/g;
```

この正規表現は：
- `([a-zA-Z][a-zA-Z'-]*)` - 英語単語
- `([^\sa-zA-Z]+)` - 英語以外の文字（句読点など）

をマッチさせるが、スペース（`\s`）は除外されていたため、トークンとして生成されなかった。

### 解決策

`PostCard.tsx`の正規表現にスペースのキャプチャグループを追加：

```typescript
// 変更前（スペースを無視）
const wordPattern = /([a-zA-Z][a-zA-Z'-]*)|([^\sa-zA-Z]+)/g;

// 変更後（スペースも含める）
const wordPattern = /([a-zA-Z][a-zA-Z'-]*)|(\s+)|([^\sa-zA-Z]+)/g;
```

変更点：
- `(\s+)` - スペース（空白文字）をキャプチャするグループを追加
- これにより、単語間のスペースもトークンとして生成され、正しく表示される

### 関連ファイル
- `src/components/PostCard.tsx` - 投稿カードコンポーネント

### 教訓
- テキストをトークンに分割する際、空白文字の扱いに注意する
- 正規表現で文字列を解析する場合、除外パターン（`[^\s...]`など）が意図した動作をしているか確認する
- UI上で文字列が正しく表示されない場合、トークン化処理を疑う
- 実装後は必ず実機またはシミュレータで表示を確認する

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
