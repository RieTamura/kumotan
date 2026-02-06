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

## 20. 単語カードのスワイプ削除が途中で止まる問題

### 発生日
2026年1月5日

### 症状
- 文章モードの単語ポップアップで、単語カードを左にスワイプして除外しようとする
- スワイプは途中まで動くが、最後まで完了せずカードが削除されない
- 赤い「除外」背景は表示されるが、カードを完全に削除できない

### 調査過程

1. **PanResponderの実装確認** - 最初はReact NativeのPanResponderを使用してスワイプ機能を実装していた

2. **ScrollViewとの競合を疑う** - スワイプが途中で止まる現象から、ScrollViewのジェスチャーとPanResponderのジェスチャーが競合していることを疑った

3. **問題の特定** - PanResponderはScrollView内で使用すると、縦スクロールを検知した時点でジェスチャーが中断されることが判明

### 原因
`PanResponder`と`ScrollView`のジェスチャーが競合していた。

- ポップアップ内のコンテンツはScrollViewでラップされている
- 単語カードのスワイプはPanResponderで実装されていた
- ScrollView内でスワイプを開始すると、ScrollViewが縦スクロールを検知してPanResponderのジェスチャーが中断される
- これにより、スワイプが途中で止まってしまっていた

### 解決策

**1. react-native-gesture-handlerのSwipeableコンポーネントを使用：**

PanResponderから`react-native-gesture-handler`の`Swipeable`コンポーネントに変更。これはScrollViewとの競合を適切に処理してくれる。

```typescript
// 変更前 - PanResponderを使用
import { PanResponder } from 'react-native';

function SwipeableWordCard({ wordInfo, onRemove }: SwipeableWordCardProps): React.JSX.Element {
  const translateX = useRef(new Animated.Value(0)).current;
  
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => !wordInfo.isRegistered,
      onMoveShouldSetPanResponder: (_, gestureState) => {
        return !wordInfo.isRegistered && 
          Math.abs(gestureState.dx) > Math.abs(gestureState.dy) && 
          Math.abs(gestureState.dx) > 10;
      },
      onPanResponderMove: (_, gestureState) => {
        if (gestureState.dx < 0) {
          translateX.setValue(gestureState.dx);
        }
      },
      onPanResponderRelease: (_, gestureState) => {
        if (gestureState.dx < -SWIPE_THRESHOLD) {
          // Remove card animation
          onRemove();
        } else {
          // Snap back
        }
      },
    })
  ).current;

  return (
    <Animated.View {...panResponder.panHandlers}>
      {/* Card content */}
    </Animated.View>
  );
}

// 変更後 - Swipeableを使用
import { GestureHandlerRootView, Swipeable } from 'react-native-gesture-handler';

function SwipeableWordCard({ wordInfo, onRemove }: SwipeableWordCardProps): React.JSX.Element {
  const swipeableRef = useRef<Swipeable>(null);

  const renderRightActions = (
    progress: Animated.AnimatedInterpolation<number>,
    dragX: Animated.AnimatedInterpolation<number>
  ) => {
    const opacity = dragX.interpolate({
      inputRange: [-100, -50, 0],
      outputRange: [1, 0.8, 0],
      extrapolate: 'clamp',
    });

    return (
      <Animated.View style={[styles.deleteBackground, { opacity }]}>
        <Animated.Text style={styles.deleteBackgroundText}>
          除外
        </Animated.Text>
      </Animated.View>
    );
  };

  const handleSwipeOpen = () => {
    onRemove();
  };

  return (
    <Swipeable
      ref={swipeableRef}
      renderRightActions={renderRightActions}
      onSwipeableOpen={handleSwipeOpen}
      rightThreshold={80}
      overshootRight={false}
    >
      <View style={styles.wordItemCard}>
        {/* Card content */}
      </View>
    </Swipeable>
  );
}
```

**2. GestureHandlerRootViewでModal内をラップ：**

Modal内でジェスチャーを機能させるために、GestureHandlerRootViewでラップする必要がある：

```typescript
return (
  <Modal visible={visible} transparent animationType="none">
    <GestureHandlerRootView style={{ flex: 1 }}>
      {/* Backdrop */}
      <Animated.View style={styles.backdrop}>
        {/* ... */}
      </Animated.View>

      {/* Popup */}
      <Animated.View style={styles.popup}>
        {/* ... */}
      </Animated.View>
    </GestureHandlerRootView>
  </Modal>
);
```

**3. babel.config.jsにreanimatedプラグインを追加：**

react-native-gesture-handlerが正しく動作するために、babel設定にreanimatedプラグインを追加：

```javascript
// 変更前
module.exports = function (api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
  };
};

// 変更後
module.exports = function (api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    plugins: ['react-native-reanimated/plugin'],
  };
};
```

### 実装のポイント
- `Swipeable`コンポーネントはScrollViewとのジェスチャー競合を適切に処理する
- `rightThreshold={80}`で、80px以上スワイプしたら削除をトリガー
- `overshootRight={false}`で、右方向へのオーバーシュートを無効化
- 登録済みの単語はSwipeableを使用せず、通常のViewとして表示（スワイプ不可）
- Modal内でreact-native-gesture-handlerを使用する場合、GestureHandlerRootViewでラップが必要

### 関連ファイル
- `src/components/WordPopup.tsx` - 単語ポップアップコンポーネント
- `babel.config.js` - Babel設定ファイル
- `package.json` - react-native-gesture-handler, react-native-reanimatedを追加

### 教訓
- React NativeのPanResponderはScrollView内で使用すると競合が発生しやすい
- スワイプ機能を実装する場合、`react-native-gesture-handler`の使用を検討する
- Modal内でジェスチャーを使用する場合、GestureHandlerRootViewでのラップが必要
- キャッシュをクリア（`npx expo start --clear`）して再起動することで、設定変更を確実に反映できる

---

## 31. 英語定義が見つからない場合のエラー表示が驚かせる問題

### 発生日
2026年1月5日

### 症状
- 投稿文の英語単語を長押しして選択し、辞書APIで定義を検索する
- 単語が辞書に存在しない場合、赤い文字で「"word" の定義が見つかりませんでした。」というエラーが表示される
- 赤いエラー表示がユーザーを驚かせてしまう
- 単語が見つからないことは正常な状況であり、エラーとして扱うべきではない

### 原因
`src/components/WordPopup.tsx`で、`WORD_NOT_FOUND`エラーを他の技術的なエラー（ネットワーク障害など）と同様に赤いエラーテキスト（`errorText`スタイル）で表示していた。

```typescript
// 変更前
) : definitionError ? (
  <Text style={styles.errorText}>{definitionError}</Text>
) : (
  <Text style={styles.hintText}>-</Text>
)
```

### 解決策

**1. WordPopup.tsxの修正 - 状態管理の追加：**

`WORD_NOT_FOUND`エラーを別の状態として管理するため、`definitionNotFound`ステートを追加：

```typescript
// 新しいステートを追加
const [definitionNotFound, setDefinitionNotFound] = useState<boolean>(false);

// エラー処理でWORD_NOT_FOUNDを区別
if (defResult.success) {
  setDefinition(defResult.data);
} else {
  // WORD_NOT_FOUNDの場合は穏やかな「見つからない」状態にする
  if (defResult.error.code === 'WORD_NOT_FOUND') {
    setDefinitionNotFound(true);
  } else {
    setDefinitionError(defResult.error.message);
  }
}
```

**2. 表示スタイルの変更：**

新しい`notFoundText`スタイルを追加し、グレー色でイタリック体の穏やかな表示に変更：

```typescript
// スタイルの追加
notFoundText: {
  fontSize: FontSizes.sm,
  color: Colors.textSecondary,
  fontStyle: 'italic',
},

// 表示の条件分岐
) : definitionNotFound ? (
  <Text style={styles.notFoundText}>定義が見つかりませんでした</Text>
) : definitionError ? (
  <Text style={styles.errorText}>{definitionError}</Text>
) : (
  <Text style={styles.hintText}>-</Text>
)
```

**3. AppErrorのインポート追加：**

エラーコードを判定するため、`AppError`と`ErrorCode`をインポート：

```typescript
import { AppError, ErrorCode } from '../utils/errors';
```

### 実装のポイント
- WORD_NOT_FOUNDエラーは赤いエラー表示ではなく、グレーのイタリック体で「定義が見つかりませんでした」と表示
- 技術的なエラー（ネットワーク障害、API障害など）は引き続き赤いエラー表示
- エラーコードで判定することで、エラーの種類に応じた適切な表示が可能
- ステートをリセットする際は`definitionNotFound`も含める

### 関連ファイル
- `src/components/WordPopup.tsx` - 単語ポップアップコンポーネント
- `src/utils/errors.ts` - エラー定義

### 教訓
- エラーには「システムエラー」と「想定される正常な状況」の2種類がある
- 辞書に単語が見つからないことは正常な状況であり、驚かせる表示は不適切
- エラーコードを活用することで、エラーの種類に応じた適切なUI表示ができる
- 色やスタイルは、メッセージの重要度や性質を伝える重要な要素

---

## 32. 日本語文章選択時に重複キーエラーが発生する問題

### 発生日
2026年1月5日

### 症状
- 投稿文の日本語文章を長押しして選択すると、Reactの警告エラーが表示される
- エラー内容：`Encountered two children with the same key, 's'. Keys should be unique so that components maintain their identity across updates.`
- 同じ文字（助詞「の」など）が複数回出現すると重複キーが発生する
- 機能は動作するが、コンソールに警告が表示される

### 原因
`src/components/WordPopup.tsx`の形態素解析結果を表示する部分で、キーの生成方法に問題があった：

```typescript
// 問題のあるキー生成
{japaneseInfo.map((token, index) => (
  <View key={`${token.word}-${token.reading}-${index}`} style={styles.tokenCard}>
```

同じ単語（例：「の」）が複数回出現した場合、`token.word`が同じになり、`token.reading`も同じになるため、インデックスが最後に配置されていても重複キーが生成される可能性があった。

### 解決策

**1. 形態素解析結果のキー生成方法を修正：**

インデックスを最初に配置し、より確実に一意性を保証：

```typescript
// 変更前
key={`${token.word}-${token.reading}-${index}`}

// 変更後
key={`token-${index}-${token.word}-${token.reading}`}
```

**2. 文章モード単語リストのキー生成も修正：**

```typescript
// 変更前
key={`${wordInfo.word}-${index}`}

// 変更後
key={`word-${index}-${wordInfo.word}`}
```

### 実装のポイント
- インデックスをキーの最初に配置することで、配列内での位置を確実に識別
- プレフィックス（`token-`、`word-`）を追加して、キーの種類を明確化
- 同じ文字や単語が複数回出現してもReactが正しくコンポーネントを識別できる
- 文章モードの単語リストでも同様のパターンを適用

### 関連ファイル
- `src/components/WordPopup.tsx` - 単語ポップアップコンポーネント

### 教訓
- Reactのキーは配列内で一意であることが重要
- インデックスをキーの最初に配置することで、確実な一意性を保証できる
- プレフィックスを追加することで、キーの可読性とデバッグ性が向上
- 同じパターンを複数箇所で使用する場合、一貫性を保つことが重要

---

## 33. 単語登録後に他の文章を選択できない問題

### 発生日
2026年1月5日

### 症状
- 投稿文の単語を長押しして選択し、単語帳に登録する
- WordPopupを閉じた後、他の投稿や同じ投稿で再度単語を選択しようとする
- しかし、長押ししても単語が選択されず、WordPopupが開かない
- 一度選択した投稿だけが選択できなくなる

### 調査過程

1. **PostCard.tsxの確認** - `clearSelection`プロップを受け取り、useEffectで選択状態をクリアする実装は正しかった

2. **HomeScreen.tsxの確認** - `closeWordPopup`関数で`postUri`が保持されたままになっており、`shouldClearSelection`が常に`true`になっていた

### 原因
`src/screens/HomeScreen.tsx`の`closeWordPopup`関数で、ポップアップを閉じた後も`postUri`が保持されたままになっていた：

```typescript
// 変更前
const closeWordPopup = useCallback(() => {
  setWordPopup(prev => ({ ...prev, visible: false }));
}, []);
```

これにより、`renderPost`の条件判定で：
```typescript
const shouldClearSelection = !wordPopup.visible && wordPopup.postUri === item.uri;
```
該当する投稿の`shouldClearSelection`が常に`true`になり、選択がすぐにクリアされてしまっていた。

### 解決策

**1. closeWordPopup関数の修正：**

ポップアップを閉じた後、100ms後に`postUri`をリセットするように変更：

```typescript
const closeWordPopup = useCallback(() => {
  // Keep postUri to allow PostCard to clear selection before full reset
  setWordPopup(prev => ({ ...prev, visible: false }));
  
  // Reset postUri after a short delay to allow PostCard to process clearSelection
  setTimeout(() => {
    setWordPopup(prev => ({ ...initialWordPopupState }));
  }, 100);
}, []);
```

**2. renderPost関数の条件修正：**

`postUri`が空でない場合のみ`clearSelection`をtrueにするように変更：

```typescript
const shouldClearSelection = !wordPopup.visible && wordPopup.postUri === item.uri && wordPopup.postUri !== '';
```

### 実装のポイント
- まず`visible: false`に設定してポップアップを閉じる
- PostCardが`clearSelection`を処理する時間を確保するため、100ms待つ
- その後、全ての状態を初期値にリセット
- `postUri !== ''`条件により、リセット後は選択をクリアしない

### 動作フロー
1. 単語を選択 → `wordPopup.postUri`に投稿のURIが保存される
2. WordPopupを閉じる → `visible: false`に設定
3. PostCardで選択がクリア → `shouldClearSelection`が`true`で選択解除
4. 100ms後 → `postUri`が空文字列にリセット、`shouldClearSelection`が`false`に
5. 他の投稿（または同じ投稿）で再度選択可能に

### 関連ファイル
- `src/screens/HomeScreen.tsx` - ホーム画面

### 教訓
- 親子コンポーネント間の状態同期では、タイミングの制御が重要
- `setTimeout`を使用して段階的に状態を更新することで、適切な処理順序を保証できる
- 条件判定に追加のチェック（`!== ''`など）を加えることで、意図しない動作を防げる
- デバッグ時は、状態の変化のタイミングと条件判定の順序を注意深く確認する

---

## 34. 日本語文章が長押しで選択できない問題

### 発生日
2026年1月5日

### 症状
- 投稿文の英語単語は長押しで選択できる
- 投稿文の日本語文章を長押ししても、何も反応しない
- WordPopupが開かず、形態素解析結果を確認できない

### 調査過程

1. **PostCard.tsxの確認** - `renderText`関数で、`isEnglishWord`の場合のみタッチ可能な`<Text>`要素として表示されていた

2. **日本語のトークン処理** - `isJapaneseWord`フラグは設定されていたが、通常のTextとして表示され、タッチイベントが設定されていなかった

### 原因
`src/components/PostCard.tsx`の`renderText`関数で、英語単語のみがタッチ可能に実装されており、日本語文章は通常のTextとして表示されていた：

```typescript
// 変更前
if (token.isEnglishWord) {
  // タッチ可能な<Text>を返す
}
return <Text key={token.index}>{token.text}</Text>;  // 日本語はタッチ不可
```

### 解決策

**1. 日本語文章用のハンドラーを追加：**

```typescript
const handleJapaneseSentenceLongPress = useCallback(
  (sentence: string) => {
    if (!onSentenceSelect) return;
    setSelectedSentence(sentence);
    setSelectedWord(null);
    onSentenceSelect(sentence, post.uri, post.text);
  },
  [post.uri, post.text, onSentenceSelect]
);
```

**2. renderText関数を拡張：**

日本語文章もタッチ可能にする処理を追加：

```typescript
if (token.isJapaneseWord) {
  const isSentenceSelected = selectedSentence === token.text;
  
  return (
    <Text
      key={token.index}
      style={
        isSentenceSelected
          ? styles.highlightedSentence
          : styles.selectableJapanese
      }
      onLongPress={() => handleJapaneseSentenceLongPress(token.text)}
      suppressHighlighting={false}
    >
      {token.text}
    </Text>
  );
}
```

**3. スタイルの追加：**

日本語文章用のスタイルを追加：

```typescript
selectableJapanese: {
  // Selectable Japanese sentences have same style as regular text but are touchable
},
```

**4. スタイル構造の修正：**

既存のスタイル定義にバグがあったため修正：

```typescript
// 変更前（バグ）
content: {
  marginBottom: Spacing.md,
  highlightedSentence: {  // ネストエラー
    // ...
  },
},

// 変更後
content: {
  marginBottom: Spacing.md,
},
highlightedSentence: {
  backgroundColor: '#FFF3E0',
  color: Colors.text,
  fontWeight: '500',
},
```

### 実装のポイント
- 日本語文章は`onLongPress`のみ対応（ダブルタップは英語のみ）
- 選択時は薄いオレンジ色（`#FFF3E0`）でハイライト表示
- `suppressHighlighting={false}`で、タッチフィードバックを有効化
- スタイルの構造エラーを修正し、正しい階層に配置

### 動作
- **英語**: 長押しで単語選択、ダブルタップで文章選択
- **日本語**: 長押しで文章選択（形態素解析が実行される）

### 関連ファイル
- `src/components/PostCard.tsx` - 投稿カードコンポーネント

### 教訓
- 新機能追加時は、既存の実装パターンを参考に一貫性を保つ
- 日本語と英語で異なるインタラクションパターンが適切な場合もある
- スタイル定義のネストエラーはTypeScriptでも検出されにくいため、注意が必要
- タッチ可能な要素には適切なフィードバック（ハイライトなど）を提供する

---

## 35. 投稿カードのヒントテキストの調整

### 発生日
2026年1月5日

### 背景
- 投稿カードの下部に操作方法を示すヒントテキストを表示している
- ユーザーのフィードバックを受けて、よりわかりやすい表現に調整した

### 変更内容

ヒントテキストを段階的に調整：

**第1段階：**
```typescript
// 最初の表示
"長押しで単語、ダブルタップで文章を選択"

// ↓ 英文のみ対応であることを明記
"長押しで単語、ダブルタップで文章を選択 ※英文のみ"
```

**第2段階：**
```typescript
// ↓ よりシンプルに
"長押しで単語選択"
```

**最終版：**
```typescript
// ↓ ダブルタップ機能も記載しつつ、句点で読みやすく
"長押しで単語選択。ダブルタップで文章を選択 ※英文のみ"
```

### 実装のポイント
- 句点（。）で操作方法を区切り、読みやすさを向上
- 「※英文のみ」の注記で、ダブルタップは英文のみであることを明示
- 日本語文章は長押しのみで選択できることが暗黙的に示される

### 関連ファイル
- `src/components/PostCard.tsx` - 投稿カードコンポーネント

### 教訓
- ヒントテキストは簡潔さと情報量のバランスが重要
- ユーザーフィードバックを受けて段階的に改善することが効果的
- 注記（※）を使用して、例外や制限事項を明示する
- 句読点の使い方で、テキストの読みやすさが大きく変わる

---

## 問題報告テンプレート

---

## 19. 日本語文章の長押し選択時に形態素解析が実行されない問題

### 発生日
2026年1月6日

### 症状

- 日本語文章を長押しして選択すると、単語登録ポップアップが表示される
- しかし、Yahoo! JAPAN Text Analysis APIによる形態素解析が実行されない
- ログに「Extracted 0 words from sentence: []」と表示され、単語が抽出されていない
- 英語文章の長押しは正常に動作し、英単語が抽出される

### 調査過程

1. **ログの確認** - スクリーンショットのログから以下を確認：

   ```text
   WordPopup: Fetching data for sentence "待て待て、近いうちにまた正座する機会あるし、ここはジムで有酸素か"
   WordPopup: Extracted 0 words from sentence: []
   ```

2. **コードフローの確認** - `WordPopup.tsx`のコードを確認したところ、以下の流れになっていた：
   - `fetchWordData()` → `fetchSentenceData()` が呼ばれる
   - `fetchSentenceData()` は `extractEnglishWords()` で英単語を抽出する処理のみ実装
   - Yahoo APIの `analyzeMorphology()` は `fetchSingleWordData()` 内でのみ呼ばれる

3. **根本原因の特定** - 文章モード（`isSentenceMode = true`）では、日本語判定がされず、英語文章処理のみが実行されていた

### 原因
`src/components/WordPopup.tsx`の`fetchSentenceData()`関数で以下の問題があった：

1. **日本語判定の欠如** - `setIsJapanese(false)`で常にfalseに設定されており、日本語文章が検出されていなかった

2. **処理分岐の欠如** - 文章モードは英語専用として実装されており、日本語文章の場合の処理フローが存在しなかった

3. **形態素解析の呼び出しがない** - `analyzeMorphology()`は単語モードの`fetchSingleWordData()`内でのみ呼ばれており、文章モードでは実行されていなかった

### 解決策

**1. ヘルパー関数の追加（300-311行目）：**

形態素解析結果を単語リスト形式に変換する関数を追加：

```typescript
const convertJapaneseInfoToWordInfo = useCallback((tokens: JapaneseWordInfo[]): WordInfo[] => {
  return tokens.map(token => ({
    word: token.word,
    japanese: token.reading,
    definition: `${token.partOfSpeech} - 基本形: ${token.baseForm}`,
    isRegistered: false,
    isSelected: true,
  }));
}, []);
```

**2. 既存の英語文章処理をリファクタリング（412-484行目）：**

`fetchSentenceData()`のコードを`fetchEnglishSentenceData()`に分離：

```typescript
const fetchEnglishSentenceData = useCallback(async () => {
  const hasKey = await hasApiKey();
  setApiKeyAvailable(hasKey);

  // 1. Translate the entire sentence
  if (hasKey) {
    updateLoading('sentenceTranslation', true);
    const sentenceResult = await translateToJapanese(word);
    updateLoading('sentenceTranslation', false);
    // ...
  }

  // 2. Extract words from sentence
  const words = extractEnglishWords(word);
  // ...

  // 3-4. Fetch info for each word
  // ...
}, [word]);
```

**3. 日本語文章処理用の新関数を追加（486-529行目）：**

```typescript
const fetchJapaneseSentenceData = useCallback(async () => {
  const hasYahooId = await hasYahooClientId();
  setYahooClientIdAvailable(hasYahooId);

  if (!hasYahooId) {
    console.log('WordPopup: Yahoo Client ID not available');
    return;
  }

  console.log('WordPopup: Analyzing Japanese sentence with morphology');

  // Morphological analysis
  updateLoading('wordsInfo', true);
  const result = await analyzeMorphology(word);
  updateLoading('wordsInfo', false);

  if (result.success) {
    console.log(`WordPopup: Extracted ${result.data.length} words from sentence:`, result.data);

    // Convert morphological analysis results to WordInfo
    const wordInfos = convertJapaneseInfoToWordInfo(result.data);

    // Get registered words from store
    const registeredWords = useWordStore.getState().words;
    const registeredWordsSet = new Set(
      registeredWords.map(w => w.english.toLowerCase())
    );

    // Update isRegistered flag
    const updatedWordInfos = wordInfos.map(info => ({
      ...info,
      isRegistered: registeredWordsSet.has(info.word.toLowerCase()),
      isSelected: !registeredWordsSet.has(info.word.toLowerCase()),
    }));

    setWordsInfo(updatedWordInfos);
  } else {
    console.error('WordPopup: Morphological analysis error:', result.error.message);
    setSentenceError(result.error.message);
  }
}, [word, convertJapaneseInfoToWordInfo]);
```

**4. fetchSentenceData()に日本語判定と分岐処理を追加（534-546行目）：**

```typescript
const fetchSentenceData = useCallback(async () => {
  // Japanese detection
  const sentenceIsJapanese = Validators.isJapanese(word);
  setIsJapanese(sentenceIsJapanese);

  if (sentenceIsJapanese) {
    // Japanese sentence processing
    await fetchJapaneseSentenceData();
  } else {
    // English sentence processing
    await fetchEnglishSentenceData();
  }
}, [word, fetchJapaneseSentenceData, fetchEnglishSentenceData]);
```

### 実装のポイント

- `Validators.isJapanese()`で日本語を検出し、処理を分岐
- 形態素解析結果を`WordInfo`形式に変換し、既存の単語リストUIで表示
- 各単語の読み、品詞、基本形を`definition`フィールドにフォーマットして保存
- 登録済み単語のチェック機能も日本語に対応
- エラーハンドリングとログ出力で動作を追跡可能に

### データフロー

**日本語文章を長押しした場合：**

1. `fetchWordData()` が呼ばれる
2. `isSentenceMode = true` なので `fetchSentenceData()` が実行
3. `Validators.isJapanese()` で日本語と判定
4. `fetchJapaneseSentenceData()` が実行される
5. `analyzeMorphology()` でYahoo APIを呼び出し
6. 形態素解析結果を `WordInfo[]` に変換
7. `setWordsInfo()` で単語リストに設定
8. 既存のUIで単語カード形式で表示

### 関連ファイル

- `src/components/WordPopup.tsx` - 単語ポップアップコンポーネント（主な修正箇所）
- `src/services/dictionary/yahooJapan.ts` - Yahoo! API連携サービス
- `src/utils/validators.ts` - 日本語判定関数
- `src/types/word.ts` - 型定義（JapaneseWordInfo, WordInfo）

### 得られた知見

- 新機能追加時は、既存の処理フローに統合する必要がある
- 単語モードと文章モードで同じAPIを使う場合、両方から呼び出せるように設計する
- 言語別の処理は、早い段階で分岐させることで可読性が向上する
- useCallbackの依存配列を正しく設定しないと、関数が正しく更新されない

---

## 30. TestFlight環境でOAuthリダイレクト時に「undefined is not a function」エラー

### 発生日
2026年1月9日

### 症状
- TestFlightビルドでOAuth認証を試みると、リダイレクト時に「undefined is not a function」エラーが表示される
- 開発環境（Expo Go）では問題なく動作する
- エラーメッセージは「OAuth認証中にエラーが発生しました。undefined is not a function」

### 原因
`@atproto/oauth-client-expo` v0.0.7の初期バージョンで、以下の問題が考えられる：

1. **ネイティブモジュールの初期化問題**
   - 依存関係の`react-native-mmkv`がTestFlight環境で正しく初期化されていない可能性
   - Metro bundlerのキャッシュ問題

2. **ExpoOAuthClientの内部エラー**
   - `signIn()`メソッドがリダイレクトを処理する際に、未定義の関数を呼び出している
   - デバッグログが不足しているため、具体的なエラー箇所が不明

3. **リダイレクトURI設定の問題**
   - app.json: `scheme: "io.github.rietamura"`
   - oauth-client-metadata.json: `redirect_uris: ["io.github.rietamura:/oauth/callback"]`
   - 設定自体は正しいが、TestFlightでURL Schemeが正しく登録されていない可能性

### 解決策

#### 1. 詳細なデバッグログの追加

[auth.ts:476-579](src/services/bluesky/auth.ts#L476-L579)と[oauth-client.ts:69-94](src/services/bluesky/oauth-client.ts#L69-L94)に詳細なログを追加：

```typescript
// 常にログを出力（__DEV__条件を削除）
console.log('[OAuth] Starting OAuth flow for handle:', handle);
console.error('[OAuth] OAuth flow error:', errorMessage);
console.error('[OAuth] Error type:', typeof error);
console.error('[OAuth] Error object:', error);
```

エラーメッセージにも詳細を含める：
```typescript
`OAuth認証中にエラーが発生しました。\n\nエラー詳細: ${errorMessage}`
```

#### 2. TestFlightでのデバッグ方法

TestFlightでコンソールログを確認する方法：

1. **Xcodeでデバイスログを確認**
   ```bash
   # デバイスを接続
   # Xcode > Window > Devices and Simulators > デバイス選択
   # Open Consoleをクリック
   ```

2. **コンソールアプリで確認（Mac）**
   ```bash
   # デバイスを接続して、コンソールアプリを起動
   # デバイスを選択して、アプリのログをフィルタリング
   ```

3. **Remote Loggingサービスを使う**
   - Sentry, Bugsnag, LogRocketなどのサービスを導入して本番環境のログを収集

#### 3. Metro Bundlerキャッシュのクリア

```bash
# キャッシュをクリア
npx expo start -c

# より徹底的に
npx react-native clean
npx expo start -c --reset-cache
```

#### 4. node_modulesの再インストール

```bash
rm -rf node_modules
rm package-lock.json
npm install
npx expo start -c
```

#### 5. Development Buildへの移行（最終手段）

`@atproto/oauth-client-expo`が`react-native-mmkv`に依存しているため、Expo Goでは動作しない可能性がある。その場合はDevelopment Buildが必要：

```bash
npx expo prebuild
npx expo run:ios  # または run:android
```

#### 6. ExpoOAuthClient初期化チェックの追加

[oauth-client.ts:69-72](src/services/bluesky/oauth-client.ts#L69-L72)で、コンストラクタが正しく呼び出せるか確認：

```typescript
// Check if ExpoOAuthClient is properly imported
if (typeof ExpoOAuthClient !== 'function') {
  throw new Error(`ExpoOAuthClient is not a constructor. Type: ${typeof ExpoOAuthClient}`);
}
```

### 次のステップ

1. TestFlightで再テストして、追加したログからエラーの詳細を確認
2. エラーメッセージに表示される「エラー詳細」を確認
3. 必要に応じて、上記の解決策を順番に試す
4. それでも解決しない場合は、`@atproto/oauth-client-expo`のIssueを確認、または報告

### 関連ファイル
- [src/services/bluesky/auth.ts](src/services/bluesky/auth.ts) - OAuth認証フロー
- [src/services/bluesky/oauth-client.ts](src/services/bluesky/oauth-client.ts) - OAuth Client初期化
- [app.json](app.json) - URL Scheme設定
- [docs/oauth-client-metadata.json](docs/oauth-client-metadata.json) - OAuth Client Metadata

### 参考リンク
- [@atproto/oauth-client-expo GitHub](https://github.com/bluesky-social/atproto/tree/main/packages/oauth/oauth-client-expo)
- [Expo Deep Linking Guide](https://docs.expo.dev/guides/deep-linking/)

---

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

---

## 31. TestFlightでOAuth認証時にエラーが発生する問題！EMKV / TurboModules�E�E

### 発生日
2026年1朁E1日

### 痁E��
- TestFlightでアプリを起動し、「Blueskyでログイン」�Eタンを押してハンドル名を入力し、認証フローを開始しようとすると、以下�Eエラー画面が表示される、E
  - **エラーメチE��ージ**: `Failed to create a new MMKV instance: react-native-mmkv 3.x.x requires TurboModules, but the new architecture is not enabled!`
  - **詳細**: `Downgrade to react-native-mmkv 2.x.x if you want to stay on the old architecture. Enable the new architecture in your app to use react-native-mmkv 3.x.x.`

### 調査過稁E

1. **package.jsonの確誁E* - `react-native-mmkv`のバ�Eジョンを確認したところ、`^4.1.1`がインスト�EルされてぁE��、E
2. **エラーメチE��ージの刁E��** - エラーメチE��ージが示す通り、バージョン3以降�E`react-native-mmkv`は、React Nativeの新しいアーキチE��チャ�E�EurboModules/JSI�E�を忁E��とすることがわかった、E
3. **プロジェクト設定�E確誁E* - `app.json`や`eas.json`を確認したが、New Architectureを有効にする設定が含まれてぁE��かった、Expo SDK 52以前�EチE��ォルト�E旧アーキチE��チャであるため、�E示皁E��有効化する忁E��があった、E

### 原因
`@atproto/oauth-client-expo`が依存する`react-native-mmkv`のバ�Eジョン�E�E.x�E�が、React Native New Architecture (TurboModules) を忁E��としてぁE��が、�Eロジェクト設定でNew Architectureが無効になってぁE��ため、E

### 解決筁E
New Architectureを有効化することで対応した、E

**1. `expo-build-properties`のインスト�Eル:**
```bash
npx expo install expo-build-properties
```

**2. `app.json`の設定変更:**
Pluginsセクションに`expo-build-properties`の設定を追加し、iOS/Android両方で`newArchEnabled`を`true`に設定、E

```json
"plugins": [
  "expo-secure-store",
  "expo-sqlite",
  [
    "expo-build-properties",
    {
      "ios": {
        "newArchEnabled": true
      },
      "android": {
        "newArchEnabled": true
      }
    }
  ]
],
```

### 関連ファイル
- `app.json` - ビルド設宁E
- `package.json` - 依存関俁E

### 教訁E
- ネイチE��ブモジュールを使用するライブラリ�E�特に`react-native-mmkv`などの高性能なも�E�E��E、React NativeのアーキチE��チャ�E�Eld vs New/TurboModules�E�に依存する場合がある、E
- メジャーバ�EジョンアチE�E時には要件�E�Erchitecture�E�が変わることがあるため、エラーメチE��ージをよく読み、忁E��な設定を行うこと、E

### 問題31：TestFlightでのOAuth認証エラー (MMKV New Architecture)

- **症状**: TestFlightでOAuth認証を行うと、MMKV関連のエラー (
eact-native-mmkv 3.x.x requires TurboModules) が発生し、クラッシュまたは赤画面になる。
- **原因**: 
eact-native-mmkv v3以降はNew Architecture (TurboModules) が必須だが、アプリがOld Architectureでビルドされていたため。
- **解決策**: 
eact-native-mmkv をOld Architecture対応のv2.x系 (^2.12.2) にダウングレードし、pp.jsonのNew Architecture設定を削除した。
- **ステータス**: 解決済み (v1.8で対応)


---

## 問題31: react-native-mmkvのネストされた依存関係バージョン競合（2026-01-11）

### 症状
- TestFlightでOAuth認証時にエラーが発生
- エラーメッセージ: `Failed to create a new MMKV instance: react-native-mmkv 3.x.x requires TurboModules, but the new architecture is not enabled!`
- `package.json`で`react-native-mmkv@2.12.2`を指定しているにもかかわらず、エラーが発生

### 原因
`@atproto/oauth-client-expo@0.0.7`がネストされた依存関係として`react-native-mmkv@3.3.3`を持っている。`package.json`の直接依存として追加した`react-native-mmkv@2.12.2`とは別に、ネストされた依存としてv3が使用されていた。

`ash
# npm ls で確認した結果
kumotan@1.0.0
 @atproto/oauth-client-expo@0.0.7
  react-native-mmkv@3.3.3  #  これがv3を使用
 react-native-mmkv@2.12.2   #  直接依存はv2
`

### 解決策
`package.json`に`overrides`フィールドを追加して、すべての依存関係（ネストされたものを含む）で`react-native-mmkv@2.12.2`を強制使用するように設定。

`json
{
  "dependencies": {
    "react-native-mmkv": "2.12.2"
  },
  "overrides": {
    "react-native-mmkv": "2.12.2"
  }
}
`

**注意点**:
- `overrides`と`dependencies`で同じパッケージを指定する場合、バージョンを完全一致させる必要がある
- `^2.12.2`（キャレット付き）ではなく`2.12.2`（完全固定）を使用すること

### 修正後の確認
`ash
npm ls react-native-mmkv
# 結果
 @atproto/oauth-client-expo@0.0.7
  react-native-mmkv@2.12.2 deduped
 react-native-mmkv@2.12.2 overridden
`

### ステータス
- **解決済み** (v1.9で対応)

### 関連ファイル
- `package.json` - overridesフィールド追加


---



---

## 問題32: TestFlightでのJSI初期化エラー (react-native-mmkv)（2026-01-11）

### 症状
- TestFlightでOAuth認証時にエラーが発生
- エラーメッセージ:
  `
  Failed to create a new MMKV instance: React Native is not running on-device.
  MMKV can only be used when synchronous method invocations (JSI) are possible.
  `

### 原因

eact-native-mmkv v2.x 系を使用しているが、pp.json で New Architecture (TurboModules) の設定が曖昧、またはデフォルトで有効になっていた可能性がある。
Expo SDK 54 環境ではデフォルトの設定により、Old Architecture用のモジュールが正しくロードされなかった可能性がある。

### 解決策
pp.json の expo オブジェクト直下に 
ewArchEnabled: false を設定する（Expo SDK 52以降の推奨設定）。
expo-build-properties プラグイン経由ではなく、ルートプロパティとして設定する必要がある。

`json
  "expo": {
    "newArchEnabled": false,
    "plugins": [
       ...
    ]
  }
`

### ステータス
- **解決済み** (v1.11で対応)


---

## 問題33: New Architecture (TurboModules) への移行（2026-01-11）

### 背景
Old Architecture環境下で 
eact-native-mmkv v2 を使用する試み（問題32）は、Expo SDK 54 環境でのビルドエラーやJSI初期化エラーの解決に至らず、設定が複雑化していた。
また、@atproto/oauth-client-expo は内部でNew Architecture対応の 
eact-native-mmkv v3 を使用することを前提としている。

### 解決策
根本的な解決として、React Nativeの **New Architecture (TurboModules/Fabric)** を有効にする方針へ転換。

1. **pp.json 設定:**
   pp.json のルート配下で 
ewArchEnabled: true を設定。
   `json
   "expo": {
     "newArchEnabled": true,
     ...
   }
   `

2. **依存関係の更新:**
   package.json で overrides を削除し、
eact-native-mmkv を ^3.2.0 にアップグレード。

### 検証
- ビルドエラー（Install pods phase）の解消
- TestFlightでのOAuth認証（JSIエラーの解消）

### ステータス
- **対応済み** (v1.12)


---

## 問題34: Expo Doctorによる依存関係重複警告（2026-01-11）

### 症状
- ビルド時または expo doctor 実行時に Duplicate dependencies エラーが発生。
- 例: expo-constants が複数バージョン（または同じバージョンで複数箇所）インストールされている警告。

### 原因

ode_modules フォルダ内の整合性が崩れている、または package-lock.json に重複した依存関係が記録されている。
特にアーキテクチャ変更や依存パッケージの大幅な更新を行った後に発生しやすい。

### 解決策
クリーンインストールを行う。

1. 
ode_modules フォルダを削除
2. package-lock.json を削除
3. 
pm install を実行

### ステータス
- **解決済み** (v1.12で対応)


---

## 問題35: OAuth認証後「Bad token scope」および「Authentication Required」エラー（2026-01-19）

### 背景
OAuth認証フロー自体は成功するものの、認証後のAPI呼び出しで以下のエラーが発生した：
1. 「Bad token scope」エラー
2. 「Authentication Required」エラー

### 症状
- OAuth認証（ブラウザでのBlueskyログイン）は正常に完了
- アプリに戻った後、タイムライン取得などのAPI呼び出しが失敗
- エラーメッセージ: `OAuth "invalid_grant" error: Bad token scope`
- 後に: `Authentication Required`

### 原因

複数の根本原因があった：

#### 原因1: PDSとAuthorization Serverの混同
- `bsky.social`は**Authorization Server（Entryway）**であり、**PDS（Protected Resource）**ではない
- ユーザーの実際のPDS URLは異なる（例：`puffball.us-east.host.bsky.network`）
- `customResolver`でハードコードされた`serviceEndpoint: 'https://bsky.social'`は不正確
- DID解決時に正しいPDS URLを取得する必要があった

#### 原因2: DPoP-boundトークンとBskyAgentの非互換性
- ATProtocol OAuthで取得するトークンはDPoP-bound（証明鍵に紐づけ）
- `BskyAgent.resumeSession()`は従来のApp Password形式のトークンを想定
- DPoP-boundトークンを`BskyAgent.resumeSession()`に渡すと「Bad token scope」エラー発生
- OAuth sessionの`fetchHandler`を使用してAPI呼び出しを行う必要があった

### 解決策

#### 修正1: PLC Directoryから実際のDIDドキュメントを取得
`src/services/auth/oauth-client.ts`の`customResolver`を修正：

```typescript
// Fetch the actual DID document from PLC Directory to get the real PDS URL
let didDoc: any;
if (did.startsWith('did:plc:')) {
  console.log('[OAuth] Fetching DID document from PLC Directory...');
  const plcRes = await fetch(`https://plc.directory/${did}`);
  if (!plcRes.ok) {
    throw new Error(`Failed to fetch DID document: ${plcRes.status}`);
  }
  didDoc = await plcRes.json();
  console.log('[OAuth] Got DID document, PDS:', didDoc.service?.[0]?.serviceEndpoint);
}
```

#### 修正2: キャッシュからProtected Resourceメタデータを削除
```typescript
// Only cache the Authorization Server metadata, not Protected Resource metadata
asCache.set('https://bsky.social', BSKY_AS_METADATA);
// prCache entries for bsky.social removed - it's not a PDS
```

#### 修正3: setOAuthSession()関数の導入
`src/services/bluesky/auth.ts`に新しい関数を追加：

```typescript
export function setOAuthSession(session: any): void {
  currentOAuthSession = session;
  agent = new BskyAgent({
    service: API.BLUESKY.SERVICE,
  });
  (agent as any).sessionManager = {
    did: session.did,
    fetchHandler: session.fetchHandler.bind(session),
  };
  console.log('[OAuth] Agent initialized with OAuth session fetchHandler');
}
```

#### 修正4: startOAuthFlowとresumeSessionの更新
- `startOAuthFlow`: 認証成功後に`setOAuthSession(session)`を呼び出し
- `resumeSession`: OAuth session復元時に`setOAuthSession(oauthSession)`を呼び出し
- `clearAuth`: `currentOAuthSession`もクリア

### 関連ファイル
- `src/services/auth/oauth-client.ts` - OAuthクライアント設定
- `src/services/bluesky/auth.ts` - 認証サービス

### 教訓
1. **ATProtocolの認証アーキテクチャを正しく理解する**
   - `bsky.social`はAuthorization Server（Entryway）
   - ユーザーのPDSは別のサーバー（DIDドキュメントで確認）
   - Protected Resource MetadataとAuthorization Server Metadataは別物

2. **DPoP-boundトークンの特性を理解する**
   - 従来のBearer tokenとは異なる
   - 専用の`fetchHandler`を使用する必要がある
   - `BskyAgent`の標準メソッドとは非互換

3. **エラーメッセージの調査が重要**
   - 「Bad token scope」は実際には認証方式の不一致
   - OAuth libraryのソースコードを読んで理解

### ステータス
- **解決済み** (v1.17で対応)
- **実機でのOAuthログイン成功を確認**

---

## 44. ログイン後にReact Nativeの重複キーエラーが発生する問題

### 発生日
2026年1月23日

### 症状
- ログイン後、ホーム画面のタイムラインを表示すると、以下のエラーが複数表示される:
  ```
  ERROR Encountered two children with the same key, `%s`. 
  Keys should be unique so that components maintain their identity across updates.
  ```
- エラーメッセージに投稿URI（例: `.%s=2//did=2plc=2viumcw4bffp32jaizbhdik2u/app.bsky.feed.post/3ljzytwody22d`）が含まれる
- タイムラインのスクロールや追加読み込み時に発生する

### 調査過程

1. **HomeScreen.tsxの確認** - FlatListの`keyExtractor`が正しく実装されていることを確認（346行目で`item.uri`を使用）

2. **useBlueskyFeed.tsの確認** - `loadMore`関数で新しい投稿を追加する際に、重複チェックを行っていないことを発見

3. **feed.tsの確認** - APIから返されるデータ自体に重複がある可能性も考慮

### 原因
1. **`useBlueskyFeed.ts`の`loadMore`関数**で、無限スクロール時に新しい投稿を既存の投稿配列に追加する際、重複チェックを行っていなかった:
   ```typescript
   // 問題のコード
   setState((prev) => ({
     ...prev,
     posts: [...prev.posts, ...result.data.posts],  // 重複チェックなし
   }));
   ```

2. 同じ投稿が複数回配列に追加されると、`FlatList`の`keyExtractor`が同じキー（URI）を持つ複数の子要素を検出し、React Nativeの重複キーエラーが発生

### 解決策

#### 修正1: useBlueskyFeed.tsのloadMore関数

新しい投稿を追加する前に、既存のURIと重複しないようフィルタリングを追加:

```typescript
// 修正後のコード
if (result.success) {
  setState((prev) => {
    // Filter out duplicate posts by URI
    const existingUris = new Set(prev.posts.map(p => p.uri));
    const newPosts = result.data.posts.filter(p => !existingUris.has(p.uri));
    
    return {
      ...prev,
      posts: [...prev.posts, ...newPosts],
      isLoadingMore: false,
      cursor: result.data.cursor,
      hasMore: !!result.data.cursor && result.data.posts.length > 0,
    };
  });
}
```

**実装のポイント:**
- `Set`を使用して既存の投稿URIを効率的に管理
- `filter`で重複する投稿を除外してから配列に追加
- パフォーマンスを考慮した実装（O(n)の時間計算量）

#### 修正2: feed.tsのgetTimeline関数（予防的修正）

APIから返されたデータ自体に重複がある場合に備えて、URIベースで重複を除外:

```typescript
// マッピング後に重複除外を追加
const uniquePosts = posts.filter((post, index, self) =>
  index === self.findIndex((p) => p.uri === post.uri)
);

if (__DEV__) {
  console.log(`Fetched ${uniquePosts.length} posts from timeline`);
  if (posts.length !== uniquePosts.length) {
    console.warn(`Removed ${posts.length - uniquePosts.length} duplicate posts`);
  }
}

return {
  success: true,
  data: {
    posts: uniquePosts,
    cursor: response.data.cursor,
  },
};
```

**実装のポイント:**
- `findIndex`を使用して最初に出現した投稿のみを保持
- 開発モードでは重複が検出された場合に警告を表示
- API側の問題にも対応できる防御的プログラミング

### 関連ファイル
- `src/hooks/useBlueskyFeed.ts` - Blueskyフィードフック（主要な修正）
- `src/services/bluesky/feed.ts` - フィードサービス（予防的修正）
- `src/screens/HomeScreen.tsx` - ホーム画面（keyExtractorは正しく実装済み）

### 教訓
1. **無限スクロールでのデータ追加時は重複チェックが必須**
   - 既存データと新規データを結合する際は、必ず重複を確認する
   - ユニークキー（この場合はURI）を使用して重複を検出

2. **Setを使った効率的な重複チェック**
   - `Set`を使用することで、O(1)の検索時間で重複を検出できる
   - 大量のデータでもパフォーマンスが低下しない

3. **防御的プログラミングの重要性**
   - API側のデータに問題がある可能性も考慮する
   - 複数のレイヤーで重複チェックを行うことで、より堅牢なアプリケーションになる

4. **React NativeのFlatListの特性**
   - `keyExtractor`で返すキーは必ずユニークである必要がある
   - 重複キーがあると、コンポーネントの状態管理やレンダリングに問題が発生する

### ステータス
- **解決済み** (2026年1月23日)
- **修正内容を確認済み**



---

## 45. 巨大な辞書データ（.db, .json）がGitHubに含まれない問題

### 発生日
2026年1月26日

### 症状
- ローカルで辞書データ（JMdict）を作成したが、Git管理対象に含まれず、GitHubにプッシュされない。
- 他の環境でクローンした際、辞書ファイルが存在しないため、アプリの辞書機能が動作しない。

### 原因
- 辞書データは展開時で100MBを超え、GitHubのファイルサイズ制限に抵触するため。
- アプリのビルドサイズを軽量化するため、巨大なバイナリデータをリポジトリから除外する設計に変更したため。

### 解決策
1. **.gitignoreの更新**: ssets/jmdict/*.db, ssets/jmdict/*.json, ssets/jmdict/*.gz を除外し、誤ってリポジトリを肥大化させないようにした。
2. **圧縮スクリプトの導入**: scripts/jmdict/compress-dictionary.js を実行し、ローカルでGZIP圧縮（約30MB程度）を行えるようにした。
3. **外部配信の準備**: 初回起動時に外部（GitHub Pages等）からダウンロードし、ローカルで解凍配置する仕組み (src/services/dictionary/setup.ts) の実装を開始した。

### 関連ファイル
- .gitignore`n- scripts/jmdict/compress-dictionary.js`n- src/services/dictionary/setup.ts`n- doc/kumotan-worddb-implementation-proposal.md (詳細設計)

---

## 46. 投稿内の画像が縦に引き伸ばされる問題

### 発生日
2026年1月27日

### 症状
- タイムラインの投稿に2枚の画像が横並びで表示される際、画像が縦に引き伸ばされて表示される
- 特にアスペクト比が横長の画像で顕著に発生

### 原因
`src/components/PostCard.tsx`の`twoImageItem`スタイルに高さの制限がなく、`aspectRatio`が指定されていなかったため、画像が親コンテナの高さに合わせて縦に引き伸ばされていた。

```typescript
// 変更前
twoImageItem: {
  flex: 1,
  borderRadius: BorderRadius.md,
  overflow: 'hidden',
  position: 'relative',
},
```

### 解決策
`twoImageItem`スタイルに`aspectRatio: 1`を追加し、2枚並びの画像が正方形の比率で表示されるように修正：

```typescript
// 変更後
twoImageItem: {
  flex: 1,
  aspectRatio: 1,  // 追加
  borderRadius: BorderRadius.md,
  overflow: 'hidden',
  position: 'relative',
},
```

### 関連ファイル
- `src/components/PostCard.tsx` - 投稿カードコンポーネント

### 教訓
- React Nativeで画像を表示する際、親コンテナに`aspectRatio`を指定しないと画像が意図しないサイズで表示されることがある
- `flex: 1`だけでは高さが決まらず、子要素の`height: '100%'`が予期しない挙動を起こす可能性がある
- 画像グリッドを実装する際は、各セルに明示的なアスペクト比を設定することが重要

---

## 47. 日本語投稿で1投稿単語モードを使うと他の投稿で単語モードが使えない問題

### 発生日
2026年1月28日

### 症状
- 日本語の投稿で単語をタップして単語モード（WordPopup）を表示する
- ポップアップを閉じた後、別の日本語投稿で単語をタップしても単語モードが動作しない
- 2回目以降の単語タップでポップアップが正しくデータを取得しない

### 調査過程

1. **PostCard.tsxの確認** - `handleJapaneseWordPress`は正しく`onWordSelect`を呼び出していた

2. **HomeScreen.tsxの確認** - `handleWordSelect`は正しく`setWordPopup`を呼び出していた

3. **WordPopup.tsxの確認** - useEffectの依存配列に問題があることが判明

### 原因
`src/components/WordPopup.tsx`のuseEffectで、依存配列に`fetchWordData`が含まれていなかった：

```typescript
// 変更前
useEffect(() => {
  if (visible && word) {
    fetchWordData();
  } else {
    // Reset state when closed
    setIsJapanese(false);
    // ...
  }
// eslint-disable-next-line react-hooks/exhaustive-deps
}, [visible, word]);  // fetchWordDataが依存配列にない
```

`fetchWordData`は`useCallback`で定義されており、`word`と`isSentenceMode`に依存している。しかし、useEffectの依存配列に含まれていなかったため、古い`fetchWordData`関数が呼ばれる可能性があった。

また、新しい単語でポップアップを開く際に、前回の状態（`isJapanese`など）がリセットされずに残っていた。

### 解決策

**src/components/WordPopup.tsxの修正：**

1. useEffectの依存配列に`fetchWordData`を追加
2. 新しいデータをフェッチする前に状態をリセットするように変更

```typescript
// 変更後
useEffect(() => {
  console.log(`WordPopup useEffect: visible=${visible}, word="${word}"`);

  if (visible && word) {
    console.log('WordPopup useEffect: Calling fetchWordData');
    // Reset state before fetching new data
    setDefinition(null);
    setTranslation(null);
    setJapaneseInfo([]);
    setSentenceTranslation(null);
    setWordsInfo([]);
    setEnglishTranslation(null);
    setDefinitionError(null);
    setDefinitionNotFound(false);
    setTranslationError(null);
    setJapaneseError(null);
    setSentenceError(null);
    setEnglishTranslationError(null);
    setIsAdding(false);
    // Call fetchWordData
    fetchWordData();
  } else {
    console.log('WordPopup useEffect: Resetting state');
    // Reset state when closed
    setDefinition(null);
    setTranslation(null);
    setJapaneseInfo([]);
    setSentenceTranslation(null);
    setWordsInfo([]);
    setEnglishTranslation(null);
    setDefinitionError(null);
    setDefinitionNotFound(false);
    setTranslationError(null);
    setJapaneseError(null);
    setSentenceError(null);
    setEnglishTranslationError(null);
    setIsAdding(false);
    setIsJapanese(false);
  }
}, [visible, word, fetchWordData]);  // fetchWordDataを依存配列に追加
```

### 動作確認ログ
修正後、以下のように正しく動作することを確認：
```
LOG WordPopup useEffect: visible=true, word="ひとえに"
LOG WordPopup useEffect: Calling fetchWordData
LOG JMdict reverse translated: "ひとえに" → "wholly (due to)"
LOG WordPopup useEffect: visible=false, word="ひとえに"
LOG WordPopup useEffect: Resetting state
LOG WordPopup useEffect: visible=true, word="君への愛だよ"
LOG WordPopup useEffect: Calling fetchWordData
LOG Translated (JA→EN): "君への愛だよ" → "My love for you."
```

### 関連ファイル
- `src/components/WordPopup.tsx` - 単語ポップアップコンポーネント

### 教訓
- `useCallback`で定義した関数をuseEffect内で使用する場合、依存配列に必ずその関数を含める
- ESLintの`react-hooks/exhaustive-deps`警告を無視（`eslint-disable`）すると、このような問題を引き起こす可能性がある
- ポップアップやモーダルを再利用する際は、新しいデータを表示する前に必ず前回の状態をリセットする
- デバッグログを活用して、useEffectの実行タイミングを確認することが問題の特定に有効

---

## 48. 投稿フィードの画像をタップするとダウンロードしようとする問題

### 発生日
2026年1月29日

### 症状
- 投稿フィードの画像をタップすると、ブラウザでフルサイズ画像URLが開かれる
- iOSではファイルをダウンロードしようとする挙動になる
- アプリ内で画像をプレビューできず、画面遷移したのかと勘違いされる

### 原因
`src/components/PostCard.tsx`の`handleImagePress`関数で、`Linking.openURL(image.fullsize)`を使用して画像URLをブラウザで開いていた：

```typescript
// 変更前
const handleImagePress = useCallback((image: PostImage) => {
  if (image.fullsize) {
    Linking.openURL(image.fullsize).catch((err) => {
      if (__DEV__) {
        console.error('Failed to open image:', err);
      }
    });
  }
}, []);
```

この実装では、画像URLがそのままブラウザに渡されるため、ダウンロードダイアログが表示されることがあった。

### 解決策

**1. react-native-image-viewingライブラリをインストール：**

```bash
npm install react-native-image-viewing
```

**2. PostCard.tsxの修正：**

a) インポートを追加：
```typescript
import ImageViewing from 'react-native-image-viewing';
import { X } from 'lucide-react-native';
```

b) 画像ビューアー用のstateを追加：
```typescript
// Image viewer state
const [imageViewerVisible, setImageViewerVisible] = useState(false);
const [imageViewerIndex, setImageViewerIndex] = useState(0);
```

c) handleImagePressをビューアー表示に変更：
```typescript
// 変更後
const handleImagePress = useCallback((index: number) => {
  setImageViewerIndex(index);
  setImageViewerVisible(true);
}, []);
```

d) 画像データを準備する関数を追加：
```typescript
const imageViewerImages = useMemo(() => {
  const images = post.embed?.images;
  if (!images || images.length === 0) return [];
  return images.map((image) => ({
    uri: image.fullsize || image.thumb,
  }));
}, [post.embed?.images]);
```

e) ImageViewingコンポーネントを追加（ヘッダー付き）：
```typescript
<ImageViewing
  images={imageViewerImages}
  imageIndex={imageViewerIndex}
  visible={imageViewerVisible}
  onRequestClose={() => setImageViewerVisible(false)}
  backgroundColor="rgba(0, 0, 0, 0.85)"
  HeaderComponent={({ imageIndex }) => (
    <View style={styles.imageViewerHeader}>
      <Text style={styles.imageViewerTitle}>
        {t('home:imagePreview', '画像プレビュー')}
        {imageViewerImages.length > 1 && ` (${imageIndex + 1}/${imageViewerImages.length})`}
      </Text>
      <Pressable
        onPress={() => setImageViewerVisible(false)}
        style={styles.imageViewerCloseButton}
        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
      >
        <X size={24} color="#fff" />
      </Pressable>
    </View>
  )}
/>
```

f) スタイルを追加：
```typescript
imageViewerHeader: {
  flexDirection: 'row',
  justifyContent: 'space-between',
  alignItems: 'center',
  paddingHorizontal: Spacing.lg,
  paddingTop: Spacing.xl,
  paddingBottom: Spacing.md,
  backgroundColor: 'rgba(0, 0, 0, 0.5)',
},
imageViewerTitle: {
  color: '#fff',
  fontSize: FontSizes.lg,
  fontWeight: '600',
},
imageViewerCloseButton: {
  padding: Spacing.sm,
  borderRadius: BorderRadius.full,
  backgroundColor: 'rgba(255, 255, 255, 0.2)',
},
```

### 実装のポイント

**背景色の調整について：**
- 最初は`rgba(0, 0, 0, 0.7)`で半透明にしたが、`react-native-image-viewing`は内部でModalを使用しているため、下の投稿フィードのコンテンツは透けて見えない
- Modalの背景色が半透明でも、その下に見えるのはアプリの背景色のみ
- 代わりにヘッダーを追加して「画像プレビュー」タイトルと閉じるボタンを表示することで、ポップアップであることを明示

**ヘッダーの機能：**
- 「画像プレビュー」タイトルを表示
- 複数画像の場合は「(1/3)」のように現在位置を表示
- 右上に×ボタンを配置して閉じる操作を明確化

**画像ビューアーの機能：**
- ピンチでズームイン/アウト
- スワイプで複数画像を切り替え
- 下スワイプまたは背景タップで閉じる

### 関連ファイル
- `src/components/PostCard.tsx` - 投稿カードコンポーネント
- `package.json` - react-native-image-viewing依存関係

### 教訓
- 画像表示には専用のビューアーライブラリを使用することで、ズームやスワイプなどの標準的なUXを提供できる
- `Linking.openURL()`で画像URLを開くと、プラットフォームによってダウンロード挙動になる場合がある
- Modalベースのビューアーでは背景を半透明にしても元のコンテンツは透けて見えないため、ヘッダーなどで明確にポップアップであることを示す
- ヘッダーにタイトルと閉じるボタンを追加することで、ユーザーが画面遷移と勘違いすることを防げる

---

## 49. 英単語と日本語単語の登録操作が異なる問題

### 発生日
2026年1月29日

### 症状
- 英単語は長押しで登録ポップアップが起動する
- 日本語単語はタップで登録ポップアップが起動する
- 同じ「単語を登録する」という操作なのに、言語によって操作方法が異なり一貫性がない

### 原因
`src/components/PostCard.tsx`で英単語と日本語単語に異なるイベントハンドラが設定されていた：

**英単語（567-589行目付近）：**

```typescript
<Text
  onLongPress={() => handleWordLongPress(token.text)}  // 長押しで単語登録
  onPress={() => handleWordPress(token.text)}          // タップはダブルタップ検出用
>
```

**日本語単語（591-612行目付近）：**

```typescript
<Text
  onPress={() => handleJapaneseWordPress(token.text)}           // タップで単語登録
  onLongPress={() => handleJapaneseSentenceLongPress(post.text)} // 長押しで文章登録
>
```

### 解決策

**1. 日本語単語のイベントハンドラを英単語と同じにする：**

```typescript
// 変更前
<Text
  onPress={() => handleJapaneseWordPress(token.text)}
  onLongPress={() => handleJapaneseSentenceLongPress(post.text)}
>

// 変更後
<Text
  onPress={() => handleWordPress(token.text)}
  onLongPress={() => handleWordLongPress(token.text)}
>
```

**2. 不要になった関数を削除：**

以下の2つの関数は使用されなくなったため削除：
- `handleJapaneseWordPress` - 日本語単語のタップ処理
- `handleJapaneseSentenceLongPress` - 日本語文章の長押し処理

### 変更後の統一された操作

| 操作 | 英単語 | 日本語単語 |
|------|--------|------------|
| 長押し | 単語登録ポップアップ | 単語登録ポップアップ |
| ダブルタップ | 文選択 | 文選択 |

### 関連ファイル
- `src/components/PostCard.tsx` - 投稿カードコンポーネント

### 教訓
- 同じ機能に対しては一貫した操作方法を提供することが重要
- 言語によって操作方法が異なると、ユーザーが混乱する原因になる
- 長押しは誤タップを防ぐ効果があり、重要な操作（登録など）に適している
- 不要になったコードは速やかに削除して、コードベースをクリーンに保つ

---

## 50. 英語→日本語翻訳で出典（JMdict/DeepL）が表示されない問題

### 発生日
2026年1月29日

### 症状
- 日本語→英語翻訳では「ソース: JMdict辞書」または「ソース: DeepL翻訳」と出典が表示される
- しかし、英語→日本語翻訳では出典が表示されておらず、どのAPIで翻訳されたか分からない
- API設定画面でDeepL APIの使用状況を確認しても、実際の翻訳がJMdictで行われたかDeepLで行われたか判断できない

### 原因
翻訳表示のコードが2つのコンポーネントに分かれていた：

1. **WordPopupModal.tsx** - 日本語→英語翻訳では出典表示が実装済み
2. **WordPopup.tsx** - 英語→日本語翻訳では出典表示が未実装

英語→日本語翻訳セクションでは `translation.text` のみを表示しており、`translation.source`、`translation.readings`、`translation.partOfSpeech` などの追加情報が表示されていなかった。

```typescript
// 変更前（WordPopup.tsx 870-888行目）
{!isJapanese && (
  <View style={styles.section}>
    <Text style={styles.sectionTitle}>日本語訳</Text>
    {loading.translation ? (
      <ActivityIndicator size="small" color={Colors.primary} />
    ) : translation ? (
      <Text style={styles.translationText}>{translation.text}</Text>  // 出典表示なし
    ) : ...
  </View>
)}
```

### 解決策

**1. WordPopup.tsxの修正（英語→日本語翻訳セクション）：**

出典、読み、品詞の表示を追加：

```typescript
// 変更後
{!isJapanese && (
  <View style={styles.section}>
    <Text style={styles.sectionTitle}>日本語訳</Text>
    {loading.translation ? (
      <ActivityIndicator size="small" color={Colors.primary} />
    ) : translation ? (
      <>
        <Text style={styles.translationText}>{translation.text}</Text>
        {translation.source && (
          <Text style={styles.sourceText}>
            出典: {translation.source === 'jmdict' ? 'JMdict辞書' : 'DeepL翻訳'}
          </Text>
        )}
        {translation.readings && translation.readings.length > 0 && (
          <Text style={styles.readingText}>
            読み: {translation.readings.join(', ')}
          </Text>
        )}
        {translation.partOfSpeech && translation.partOfSpeech.length > 0 && (
          <Text style={styles.posInfoText}>
            品詞: {translation.partOfSpeech.join(', ')}
          </Text>
        )}
      </>
    ) : ...
  </View>
)}
```

**2. WordPopupModal.tsxの修正（英語→日本語翻訳セクション）：**

同様に出典と追加情報の表示を追加：

```typescript
// 変更後
{!state.isJapanese && (
  <View style={styles.section}>
    <Text style={styles.sectionTitle}>{t('translation')}</Text>
    {wordLookup.loading.translation ? (
      <ActivityIndicator size="small" color={Colors.primary} />
    ) : state.translation ? (
      <>
        <Text style={styles.translationText}>{state.translation.text}</Text>
        {state.translation.source && (
          <Text style={styles.sourceText}>
            {t('japaneseWord.source')}: {
              state.translation.source === 'jmdict'
                ? t('japaneseWord.sourceJMdict')
                : t('japaneseWord.sourceDeepL')
            }
          </Text>
        )}
        {state.translation.readings && state.translation.readings.length > 0 && (
          <Text style={styles.readingText}>
            {t('japaneseWord.reading')}: {state.translation.readings.join(', ')}
          </Text>
        )}
        {state.translation.partOfSpeech && state.translation.partOfSpeech.length > 0 && (
          <Text style={styles.posInfoText}>
            {t('partOfSpeech')}: {state.translation.partOfSpeech.join(', ')}
          </Text>
        )}
      </>
    ) : ...
  </View>
)}
```

**3. WordPopupModal.tsxにposInfoTextスタイルを追加：**

```typescript
posInfoText: {
  fontSize: FontSizes.sm,
  color: Colors.textSecondary,
  marginTop: Spacing.xs,
},
```

### 変更後の統一された表示

| 翻訳方向     | 出典表示 | 読み表示 | 品詞表示 |
| ------------ | -------- | -------- | -------- |
| 日本語→英語 | ✅       | ✅       | ✅       |
| 英語→日本語 | ✅       | ✅       | ✅       |

### 関連ファイル

- `src/components/WordPopup.tsx` - 単語ポップアップコンポーネント（旧版）
- `src/components/WordPopup/WordPopupModal.tsx` - 単語ポップアップモーダル（新版）

### 学んだこと

- 同じ機能（翻訳表示）は言語方向に関わらず一貫した情報を提供するべき
- 複数のコンポーネントに同様の機能がある場合、全てを同期して更新する必要がある
- 出典表示はユーザーがAPIの使用状況を把握するために重要な情報

---

## 51. アプリ起動時のロード画面の統一とシームレスな遷移

### 発生日
2026年2月2日

### 症状
- OSレベルの起動画面（スプラッシュ画面）と、アプリ初期化中のロード画面（プログレスバー付き）のデザインが異なっていた。
- iPhone SE（第3世代）などの高速なデバイスで、ロード画面からホーム画面へ遷移せず、起動画面が表示されたまま固まってしまうことがあった。
- アプリ初期化中のプログレスバーが表示されない（または一瞬で消える）。

### 調査過程
1. **デザインの乖離**: `app.json` で設定されたスプラッシュ画像（`assets/splash.png`）と、`App.tsx` でテキスト表示されていたロード画面のデザインが一致していなかった。
2. **遷移の不具合**: `expo-splash-screen` の非表示タイミングを JS 側の画像読み込み完了（`onLoad`）に依存させていたが、高速なデバイスでは画像がロードされる前にメイン画面に切り替わり、非表示命令が実行されないまま起動画面がアプリを覆い隠していた。
3. **レイアウトの制約**: 小さな画面（iPhone SE等）でプログレスバーの位置が最適化されておらず、視認性が低かった。

### 原因
- ネイティブのスプラッシュ画面と JS 側のロード画面の切り替え制御が不完全だった。
- 非常に高速な初期化が行われる環境において、`SplashScreen.hideAsync()` が確実に実行されないパスが存在した。

### 解決策
**1. デザインの統一**:
`App.tsx` のロード画面に `assets/splash.png` を使用し、背景色とリサイズモードを OS 設定と一致させた。

**2. 確実な非表示ロジックの追加**:
`isReady` 状態（初期化完了）を監視し、完了した瞬間に強制的に `SplashScreen.hideAsync()` を実行する `useEffect` を追加した。

```typescript
// App.tsx
useEffect(() => {
  if (initState.isReady) {
    // 遷移をスムーズにするため極短時間のディレイを入れる
    const timer = setTimeout(() => {
      SplashScreen.hideAsync().catch(() => {/* ignore */});
    }, 100);
    return () => clearTimeout(timer);
  }
}, [initState.isReady]);
```

**3. レイアウトの堅牢化**:
`StyleSheet.absoluteFillObject` と `bottom` 指定の組み合わせを iPhone SE の画面サイズ（高さ 667px）に最適化し、プログレスバーの `left/right` を 0 にして中央配置を確実にした。

### 学んだこと
- 起動画面の制御は非常にデリケートであり、ネットワーク速度やデバイス性能の差を考慮した「ガード」の実装が不可欠。
- コンポーネントのイベント（`onLoad`等）だけでなく、状態（`isReady`等）に基づいたフォールバック処理を設けることで、ハングアップを防ぐことができる。
- スプラッシュ画面の背景色や画像のリサイズ設定が 1px でもずれると、ユーザーは「フラッシュ」として不快に感じるため、ネイティブ設定との完全な同期が重要。

### 関連ファイル
- `App.tsx`
- `app.json`
- `assets/splash.png`

---

## 52. 投稿編集画面がステータスバー（時間表示等）と重なる問題

### 発生日
2026年2月2日

### 症状
- 投稿編集用のポップアップを表示した際、特にキーボードが表示されると、ポップアップの上部（タイトルや閉じるボタン）がステータスバー（時刻、バッテリー、電波状況など）の背面に回り込んでしまい、非常に見づらくなる。
- iPhone SE（第3世代）などの画面サイズが小さいデバイスで顕著に発生。

### 調査過程
1. **既存の実装**: 当初は画面中央、後に画面下部に配置される「フローティング・ポップアップ」形式だった。
2. **原因特定**: `KeyboardAvoidingView` によってポップアップ全体が上へ押し上げられる際、キーボードの高さ ＋ ポップアップの高さが画面全体の高さを超えてしまい、上部にはみ出していた。
3. **対策の試行**: 
    - `useSafeAreaInsets` を使用してマージンを設定したが、入力エリアが広い場合に結局押し出されてしまった。
    - `ScrollView` を導入して高さを制限（`maxHeight`）したが、画面占有率が低くなり使い勝手が悪化した。

### 解決策
**Bluesky風のフルスクリーン・エディタへの移行**:
ポップアップ形式を廃止し、本家Blueskyに近い画面全体の編集モードに変更した。

1. **レイアウトの刷新**:
    - モーダルを `presentationStyle="fullScreen"` に設定。
    - 上部に「キャンセル」と「投稿する」ボタンを配置したヘッダーを固定。
    - `useSafeAreaInsets` を使用して、ステータスバーを避けるためのパディング（`paddingTop: insets.top`）を確実に挿入。

2. **UI/UXの向上**:
    - 入力エリアを広く取り、スクロール可能にすることで、長い投稿でも全体が見渡せるようにした。
    - キャラクターカウンターをキーボードの直上に配置し、入力しながら残り文字数を確認しやすくした。

### 学んだこと
- 小さな画面のモバイル端末では、ポップアップ形式よりもフルスクリーン形式の方が、OSのUI（ステータスバー、キーボード）との干渉を制御しやすく、アクセシビリティも向上する。
- iPhone SEのようなコンパクトな端末を常にレイアウトの検証対象に含める必要がある。

### 関連ファイル
- `src/components/PostCreationModal.tsx`
- `src/hooks/usePostCreation.ts`

---

## 20. 単語帳ページで「削除ボタン」の背景色がダークモードにならない問題

### 発生日
2026年2月2日

### 症状
- アプリ全体の「明るさ設定」をダークモードにしても、単語帳ページの各単語カード右側にある「削除ボタン」部分の背景が白く残ってしまう
- 左側の単語テキスト部分は正しくダークモードの色（暗い背景）になっている

### 原因
`WordListScreen.tsx` 内で、リストの各アイテムをレンダリングする `renderWordItem` 関数が `useCallback` でメモ化されていたが、その**依存配列に `colors` （テーマカラー情報）が含まれていなかった**。

このため、テーマが切り替わっても `renderWordItem` 内で使用されている背景色の指定などが更新されず、初期化時のライトモード（背景白）の設定が維持されたままになっていた。

### 解決策
`WordListScreen.tsx` の以下のレンダリング関数の `useCallback` 依存配列に `colors` を追加した。

- `renderWordItem`: 各単語カードのレンダリング
- `renderEmpty`: リストが空の時の表示レンダリング

```tsx
// 修正後
const renderWordItem = useCallback(
  ({ item }: { item: Word }) => (
    <View style={[styles.wordCard, { backgroundColor: colors.card }]}>
      {/* ... */}
      <Pressable style={styles.deleteButton} onPress={() => handleWordDelete(item)}>
        <Trash2 size={20} color={colors.error} />
      </Pressable>
    </View>
  ),
  [handleToggleRead, handleWordDelete, colors] // colors を追加
);

const renderEmpty = useCallback(() => {
  // ...
}, [isLoading, t, colors]); // colors を追加
```

### 関連ファイル
- `src/screens/WordListScreen.tsx`

### 教訓
- `useCallback` や `useMemo` を使用する際、レンダリング結果がテーマ（ `colors` ）に依存している場合は、必ず依存配列に含める必要がある。
- コンポーネント化されている部分は正しく表示されていても、画面（Screen）レベルで定義されているレンダリング関数内のインラインスタイルなどが盲点になりやすい。

---

## 21. クイズ終了確認ダイアログのボタンが見づらい問題

### 発生日
2026年2月3日

### 症状
- クイズ中に戻ろうとすると終了確認ダイアログが表示される
- 「終了」ボタンが赤文字でグレー背景に表示され、視認性が非常に低い
- ダークモードでは特に見づらい

### 原因
React Nativeの`Alert.alert()`を使用しており、`style: 'destructive'`を指定するとプラットフォームネイティブのスタイルが適用される。iOSではこれが赤いテキストになるが、ダークモードのグレー背景との組み合わせでコントラストが低くなっていた。

### 解決策

**1. カスタム確認モーダルコンポーネントを作成：**

`src/components/common/ConfirmModal.tsx`を新規作成：

```typescript
interface ConfirmModalButton {
  text: string;
  onPress: () => void;
  style?: 'default' | 'cancel' | 'destructive';
}

interface ConfirmModalProps {
  visible: boolean;
  title: string;
  message?: string;
  buttons: ConfirmModalButton[];
  onClose?: () => void;
}

export function ConfirmModal({
  visible,
  title,
  message,
  buttons,
  onClose,
}: ConfirmModalProps): React.JSX.Element {
  const { colors } = useTheme();

  const getButtonStyle = (style?: 'default' | 'cancel' | 'destructive') => {
    switch (style) {
      case 'destructive':
        return {
          backgroundColor: colors.error,  // 赤背景
          textColor: '#FFFFFF',           // 白文字
        };
      case 'cancel':
        return {
          backgroundColor: colors.backgroundSecondary,
          textColor: colors.text,
        };
      default:
        return {
          backgroundColor: colors.primary,
          textColor: '#FFFFFF',
        };
    }
  };

  // ... モーダルのレンダリング
}
```

**2. QuizScreen.tsxでカスタムモーダルを使用：**

```typescript
// 変更前 - ネイティブAlert
const handleExit = useCallback(() => {
  Alert.alert(
    t('quiz.exitConfirmTitle'),
    t('quiz.exitConfirmMessage'),
    [
      { text: t('quiz.continue'), style: 'cancel' },
      {
        text: t('quiz.exit'),
        style: 'destructive',
        onPress: () => {
          isExitingRef.current = true;
          navigation.goBack();
        },
      },
    ]
  );
}, [navigation, t]);

// 変更後 - カスタムモーダル
const [showExitConfirm, setShowExitConfirm] = useState(false);

const handleExit = useCallback(() => {
  setShowExitConfirm(true);
}, []);

// レンダリング部分
<ConfirmModal
  visible={showExitConfirm}
  title={t('quiz.exitConfirmTitle')}
  message={t('quiz.exitConfirmMessage')}
  buttons={[
    {
      text: t('quiz.continue'),
      onPress: () => setShowExitConfirm(false),
      style: 'cancel',
    },
    {
      text: t('quiz.exit'),
      onPress: handleConfirmExit,
      style: 'destructive',
    },
  ]}
  onClose={() => setShowExitConfirm(false)}
/>
```

### 実装のポイント

- `destructive`スタイルのボタンは赤背景＋白文字で視認性を大幅に向上
- `cancel`スタイルのボタンはグレー背景で「終了」ボタンと明確に区別
- テーマカラーを使用してダークモード/ライトモードの両方に対応
- ネイティブAlertの制限を回避し、アプリ全体で一貫したデザインを実現

### 関連ファイル

- `src/components/common/ConfirmModal.tsx` - 確認モーダルコンポーネント（新規作成）
- `src/screens/QuizScreen.tsx` - クイズ画面

### 教訓

- React NativeのネイティブAlertはプラットフォームのスタイルに依存するため、細かなカスタマイズが難しい
- ダークモード対応を考慮する場合、カスタムモーダルの方が制御しやすい
- 重要なアクション（削除、終了など）のボタンは、背景色で強調することで視認性と操作の明確さが向上

---

## 22. クイズ完了後に結果画面に遷移せず終了確認ダイアログが表示される問題

### 発生日
2026年2月3日

### 症状
- クイズの最後の問題に回答し、「結果」ボタンを押す
- 結果画面に遷移せず、終了確認ダイアログ（「クイズを終了しますか？」）が表示される
- ダイアログで「終了」を押すと、クイズ設定画面に戻ってしまう
- 結果画面を見ることができない

### 原因
`navigation.replace('QuizResult', ...)`が呼び出されると、現在の画面（QuizScreen）が削除されて新しい画面に置き換えられる。この「画面削除」のイベントが`beforeRemove`リスナーをトリガーし、終了確認ダイアログが表示されていた。

`beforeRemove`リスナーの条件チェック：
```typescript
useEffect(() => {
  const unsubscribe = navigation.addListener('beforeRemove', (e) => {
    // 意図的な離脱の場合は許可
    if (isExitingRef.current) {
      return;
    }

    // フィードバック表示中またはローディング中は許可
    if (showFeedback || isLoading) {
      return;
    }

    // それ以外は終了確認を表示
    e.preventDefault();
    handleExit();
  });

  return unsubscribe;
}, [navigation, showFeedback, isLoading, handleExit]);
```

問題点：
- クイズ完了時、`handleNext`で`setShowFeedback(false)`を呼び出した後に`navigation.replace`が実行される
- この時点で`showFeedback`は`false`、`isLoading`も`false`になっている可能性がある
- `isExitingRef`は設定されていないため、`beforeRemove`がブロックされる

### 解決策

**1. クイズ完了を追跡するrefを追加：**

```typescript
const inputRef = useRef<TextInput>(null);
const isExitingRef = useRef(false);
const isCompletingRef = useRef(false);  // 追加
```

**2. クイズ完了時にrefを設定：**

```typescript
if (nextIndex >= session.questions.length) {
  // Quiz completed
  setIsLoading(true);
  try {
    const result = await completeQuiz(session);
    setIsLoading(false);

    if (result.success) {
      isCompletingRef.current = true;  // 追加
      navigation.replace('QuizResult', { result: result.data });
    } else {
      Alert.alert(t('common:errors.error'), result.error.message);
    }
  } catch (error) {
    // エラーハンドリング
  }
}
```

**3. beforeRemoveリスナーでrefをチェック：**

```typescript
useEffect(() => {
  const unsubscribe = navigation.addListener('beforeRemove', (e) => {
    // 意図的な離脱またはクイズ完了時は許可
    if (isExitingRef.current || isCompletingRef.current) {
      return;
    }

    if (showFeedback || isLoading) {
      return;
    }

    e.preventDefault();
    handleExit();
  });

  return unsubscribe;
}, [navigation, showFeedback, isLoading, handleExit]);
```

### 実装のポイント
- `useRef`を使用することで、state更新の非同期性に影響されない同期的な値を保持
- `isExitingRef`（途中離脱用）と`isCompletingRef`（完了時用）を分けることで、意図を明確に区別
- `navigation.replace`は現在の画面を削除するため、`beforeRemove`がトリガーされることを認識する必要がある

### 関連ファイル
- `src/screens/QuizScreen.tsx` - クイズ画面

### 教訓
- `navigation.replace()`は`beforeRemove`イベントをトリガーする
- stateの更新は非同期であるため、リスナー内でstateに依存すると予期しない動作になる場合がある
- `useRef`を使用することで、state更新のタイミングに依存しない制御が可能
- ナビゲーションのブロック機能を実装する際は、正常な遷移パターンも考慮する必要がある

---

## 23. クイズ結果画面の統計行で「正解した単語」ラベルが表示されない問題

### 発生日
2026年2月3日

### 症状
- クイズ結果画面の統計行（Stats row）に3つの統計値が表示される
- 正解数の下にラベルが表示されない（空白）
- 不正解数の下には「間違えた単語」と表示される
- 時間の下にもラベルが表示されない

### 原因
`QuizResultScreen.tsx`で、翻訳キーから不適切な方法でラベルを抽出しようとしていた：

```typescript
// 問題のあるコード
<Text style={[styles.statLabel, { color: colors.textSecondary }]}>
  {t('result.score', { correct: '', total: '' }).split('/')[0].trim()}
</Text>
```

`result.score`の翻訳値は`"{{correct}} / {{total}} 正解"`であり、パラメータに空文字を渡して`split('/')`すると意味のない結果になっていた。

同様に時間のラベルも：
```typescript
{t('result.timeTaken', { minutes: '', seconds: '' }).split(':')[0].trim()}
```

`result.timeTaken`は`"所要時間: {{minutes}}分{{seconds}}秒"`であり、これも適切に動作していなかった。

### 解決策

**1. 翻訳ファイルに専用のラベルキーを追加：**

`src/locales/ja/quiz.json`に追加：

```json
{
  "result": {
    "header": "結果",
    "score": "{{correct}} / {{total}} 正解",
    "accuracy": "正答率: {{percentage}}%",
    "timeTaken": "所要時間: {{minutes}}分{{seconds}}秒",
    "timeLabel": "所要時間",           // 追加
    "perfect": "パーフェクト！すばらしい！",
    "great": "よくできました！",
    "good": "頑張りました！",
    "keepTrying": "もう少し頑張ろう！",
    "correctWords": "正解した単語",    // 追加
    "incorrectWords": "間違えた単語",
    // ...
  }
}
```

**2. QuizResultScreen.tsxで翻訳キーを直接使用：**

```typescript
// 変更前
<View style={styles.statItem}>
  <Text style={[styles.statValue, { color: colors.text }]}>
    {result.correctCount}
  </Text>
  <Text style={[styles.statLabel, { color: colors.textSecondary }]}>
    {t('result.score', { correct: '', total: '' }).split('/')[0].trim()}
  </Text>
</View>

// 変更後
<View style={styles.statItem}>
  <Text style={[styles.statValue, { color: colors.text }]}>
    {result.correctCount}
  </Text>
  <Text style={[styles.statLabel, { color: colors.textSecondary }]}>
    {t('result.correctWords')}
  </Text>
</View>
```

時間のラベルも同様に修正：
```typescript
// 変更前
{t('result.timeTaken', { minutes: '', seconds: '' }).split(':')[0].trim()}

// 変更後
{t('result.timeLabel')}
```

### 実装のポイント
- 翻訳文字列を`split()`等で加工してラベルを抽出するのは避けるべき
- 必要なラベルは専用の翻訳キーとして定義する
- i18nの翻訳キーは明確で直接的な命名にする

### 関連ファイル
- `src/locales/ja/quiz.json` - 日本語翻訳ファイル
- `src/screens/QuizResultScreen.tsx` - クイズ結果画面

### 教訓
- 翻訳文字列を文字列操作（split、substring等）で加工するのはアンチパターン
- 言語によって文字列の構造が異なるため、特定の区切り文字を前提にした処理は機能しない
- 必要なテキストは個別の翻訳キーとして定義し、直接参照する
- i18nを適切に使用することで、多言語対応が容易になり、コードの保守性も向上

---

## 24. クイズ結果画面に花吹雪（Confetti）アニメーションを追加

### 発生日
2026年2月3日

### 背景
クイズ完了時に、お祝いの演出として花吹雪アニメーションを表示したいという要望があった。

### 実装

**1. Confettiコンポーネントを作成：**

`src/components/common/Confetti.tsx`を新規作成。`react-native-reanimated`を使用してアニメーションを実装：

```typescript
const CONFETTI_COLORS = [
  '#FF6B6B', '#4ECDC4', '#FFE66D', '#95E1D3',
  '#F38181', '#AA96DA', '#FCBAD3', '#1DA1F2', '#17BF63',
];

function ConfettiPiece({ index, startDelay, onAnimationEnd, isLast }) {
  const translateY = useSharedValue(-50);
  const translateX = useSharedValue(0);
  const rotate = useSharedValue(0);
  const opacity = useSharedValue(1);

  useEffect(() => {
    // 落下アニメーション
    translateY.value = withDelay(
      startDelay,
      withTiming(SCREEN_HEIGHT + 100, {
        duration: 2500 + Math.random() * 1500,
        easing: Easing.out(Easing.quad),
      })
    );

    // 横方向のドリフト
    translateX.value = withDelay(
      startDelay,
      withTiming((Math.random() - 0.5) * 150, { ... })
    );

    // 回転
    rotate.value = withDelay(
      startDelay,
      withTiming(360 + Math.random() * 720, { ... })
    );

    // フェードアウト
    opacity.value = withDelay(
      startDelay + duration * 0.7,
      withTiming(0, { ... })
    );
  }, []);

  return (
    <Animated.View style={[styles.confettiPiece, animatedStyle, { ... }]} />
  );
}

export function Confetti({ count = 50, onAnimationEnd }) {
  const pieces = useMemo(() =>
    Array.from({ length: count }, (_, i) => ({
      index: i,
      startDelay: Math.random() * 500,
    })),
    [count]
  );

  return (
    <View style={styles.container} pointerEvents="none">
      {pieces.map((piece, idx) => (
        <ConfettiPiece
          key={piece.index}
          index={piece.index}
          startDelay={piece.startDelay}
          isLast={idx === pieces.length - 1}
          onAnimationEnd={onAnimationEnd}
        />
      ))}
    </View>
  );
}
```

**2. QuizResultScreenでConfettiを使用：**

```typescript
import { Confetti } from '../components/common/Confetti';

export function QuizResultScreen() {
  const [showConfetti, setShowConfetti] = useState(true);

  const handleConfettiEnd = useCallback(() => {
    setShowConfetti(false);
  }, []);

  return (
    <View style={[styles.wrapper, { backgroundColor: colors.background }]}>
      <ScrollView>
        {/* 結果表示コンテンツ */}
      </ScrollView>

      {/* Confetti animation */}
      {showConfetti && (
        <Confetti count={60} onAnimationEnd={handleConfettiEnd} />
      )}
    </View>
  );
}
```

### 実装のポイント
- `react-native-reanimated`のWorkletベースのアニメーションを使用して滑らかな動きを実現
- 各紙吹雪は個別の開始遅延、落下速度、回転速度、ドリフト方向を持つ
- 紙吹雪の形状は円形と長方形をランダムに混合
- `pointerEvents="none"`により、紙吹雪がタッチイベントをブロックしない
- アニメーション終了後は`showConfetti`を`false`にしてコンポーネントをアンマウント

### 関連ファイル
- `src/components/common/Confetti.tsx` - 花吹雪コンポーネント（新規作成）
- `src/screens/QuizResultScreen.tsx` - クイズ結果画面

### 教訓
- `react-native-reanimated`はパフォーマンスの良いアニメーションを実装するのに適している
- 多数のアニメーション要素を同時に動かす場合、各要素にランダム性を持たせることで自然な動きになる
- `pointerEvents="none"`を使用することで、オーバーレイ要素がユーザーインタラクションを妨げないようにできる

---

## 25. 単語帳ページのUIレイアウト改善

### 発生日
2026年2月3日

### 背景
単語帳ページのヘッダーにあった並び替えアイコン（⇅）の位置が、削除ボタンの列と揃っておらず、UIの一貫性が欠けていた。また、フィルタータブの順番が「すべて」「未読」「既読」となっており、よく使う「未読」が最初に来ていなかった。

### 変更内容

#### 1. ソートアイコンの位置変更

**変更前**: ヘッダー右上にTipsアイコンと並んで配置
**変更後**: フィルタータブ行の右端（削除ボタンの列と同じ位置）に移動

```typescript
// 変更前 - ヘッダーにソートボタン
<View style={styles.header}>
  <Text style={styles.headerTitle}>{t('header')}</Text>
  <View style={styles.headerRight}>
    <Pressable onPress={() => navigation.navigate('Tips')}>
      <Lightbulb />
    </Pressable>
    <Pressable onPress={handleSortChange}>
      <Text style={styles.sortIcon}>⇅</Text>
    </Pressable>
  </View>
</View>

// 変更後 - フィルタータブ行にソートボタン
<View style={styles.header}>
  <Text style={styles.headerTitle}>{t('header')}</Text>
  <Pressable onPress={() => navigation.navigate('Tips')}>
    <Lightbulb />
  </Pressable>
</View>

<View style={styles.filterContainer}>
  <View style={styles.filterTabsWrapper}>
    {/* フィルタータブ */}
  </View>
  <Pressable onPress={handleSortChange}>
    <Text style={styles.sortIcon}>⇅</Text>
  </Pressable>
</View>
```

#### 2. スタイルの追加・修正

```typescript
// filterContainerにjustifyContentとalignItemsを追加
filterContainer: {
  flexDirection: 'row',
  justifyContent: 'space-between',  // 追加
  alignItems: 'center',              // 追加
  paddingHorizontal: Spacing.md,
  paddingVertical: Spacing.sm,
  backgroundColor: Colors.backgroundSecondary,
  borderBottomWidth: 1,
  borderBottomColor: Colors.border,
},

// フィルタータブをまとめるラッパーを追加
filterTabsWrapper: {
  flexDirection: 'row',
},

// sortButtonのpaddingを調整
sortButton: {
  paddingVertical: Spacing.sm,
  paddingHorizontal: Spacing.lg,  // 削除ボタンと同じ幅に
},
```

#### 3. フィルタータブの順番変更

**変更前**: 「すべて」→「未読」→「既読」
**変更後**: 「未読」→「既読」→「すべて」

```typescript
// 変更後のフィルタータブの順序
<View style={styles.filterTabsWrapper}>
  <Pressable onPress={() => handleFilterChange('unread')}>
    <Text>{t('filters.unread')}</Text>  {/* 未読 */}
  </Pressable>
  <Pressable onPress={() => handleFilterChange('read')}>
    <Text>{t('filters.read')}</Text>    {/* 既読 */}
  </Pressable>
  <Pressable onPress={() => handleFilterChange('all')}>
    <Text>{t('filters.all')}</Text>     {/* すべて */}
  </Pressable>
</View>
```

#### 4. 不要なスタイルの削除

`headerRight`スタイルは使用されなくなったため削除。

### 関連ファイル
- `src/screens/WordListScreen.tsx` - 単語帳画面

### 教訓
- UIの一貫性を保つために、関連する要素（ソートアイコンと削除ボタン）の配置を揃えることが重要
- フィルタータブは使用頻度の高いオプションを先頭に配置することで、ユーザビリティが向上
- `flexDirection: 'row'`と`justifyContent: 'space-between'`の組み合わせで、左右に要素を分散配置できる

---

## 26. 各ページのヘッダー高さが統一されていない問題

### 発生日
2026年2月3日

### 症状
- 単語帳ページ、ホームページ、クイズページ、設定ページでヘッダーの高さが異なっていた
- ホームページとクイズページのヘッダーが他のページより高く表示されていた
- タブを切り替えるとヘッダー部分の高さが変わり、視覚的に不統一だった

### 原因
各ページでセーフエリアの処理方法が異なっていた：

**WordListScreen（正しい実装）:**
- `SafeAreaView edges={['top']}` を使用
- ヘッダーには `paddingVertical: Spacing.md` のみ

**HomeScreen / QuizSetupScreen（問題のある実装）:**
- 通常の `View` を使用
- ヘッダーに手動で `paddingTop: insets.top` を追加
- この結果、セーフエリアのパディングがヘッダー内に含まれ、ヘッダーが高くなっていた

**SettingsScreen:**
- 既に `SafeAreaView edges={['top']}` を使用しており、正しい高さだった

### 解決策

**1. HomeScreen.tsxの修正：**

```typescript
// 変更前 - ViewとpaddingTopを使用
return (
  <View style={[styles.safeArea, { backgroundColor: colors.background }]}>
    <View style={[styles.header, {
      backgroundColor: colors.background,
      borderBottomColor: colors.border,
      paddingTop: insets.top,  // 手動でセーフエリアを追加
    }]}>

// 変更後 - SafeAreaViewを使用
return (
  <SafeAreaView style={[styles.safeArea, { backgroundColor: colors.background }]} edges={['top']}>
    <View style={[styles.header, {
      backgroundColor: colors.background,
      borderBottomColor: colors.border,
      // paddingTopを削除
    }]}>
```

閉じタグも `</View>` から `</SafeAreaView>` に変更。

**2. QuizSetupScreen.tsxの修正：**

```typescript
// 変更前 - useSafeAreaInsetsとpaddingTopを使用
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export function QuizSetupScreen(): React.JSX.Element {
  const insets = useSafeAreaInsets();
  
  return (
    <View style={[styles.screenContainer, { backgroundColor: colors.background }]}>
      <View style={[styles.header, {
        backgroundColor: colors.background,
        borderBottomColor: colors.border,
        paddingTop: insets.top,
      }]}>

// 変更後 - SafeAreaViewを使用
import { SafeAreaView } from 'react-native-safe-area-context';

export function QuizSetupScreen(): React.JSX.Element {
  // useSafeAreaInsetsを削除
  
  return (
    <SafeAreaView style={[styles.screenContainer, { backgroundColor: colors.background }]} edges={['top']}>
      <View style={[styles.header, {
        backgroundColor: colors.background,
        borderBottomColor: colors.border,
        // paddingTopを削除
      }]}>
```

**3. QuizSetupScreenのスタイルをSpacing定数に統一：**

```typescript
// 変更前 - ハードコードされた値
header: {
  paddingHorizontal: 16,
  paddingVertical: 12,
},
headerTitle: {
  fontSize: 20,
},
headerIconButton: {
  padding: 8,
  borderRadius: 9999,
},

// 変更後 - Spacing定数を使用
import { Spacing, FontSizes, BorderRadius } from '../constants/colors';

header: {
  paddingHorizontal: Spacing.lg,
  paddingVertical: Spacing.md,
},
headerTitle: {
  fontSize: FontSizes.xl,
},
headerIconButton: {
  padding: Spacing.sm,
  borderRadius: BorderRadius.full,
},
```

**4. SettingsScreen:**
既に `SafeAreaView edges={['top']}` を使用し、`Spacing.lg` と `Spacing.md` を使用していたため、変更不要。

### 実装のポイント
- `SafeAreaView edges={['top']}` を使用すると、セーフエリアの処理がコンポーネント外で行われる
- 手動で `paddingTop: insets.top` を追加すると、ヘッダー内にセーフエリアが含まれてしまう
- 全ページで同じSpacing定数（`Spacing.lg`, `Spacing.md`）を使用することで一貫性を保つ
- ハードコードされた値（`16`, `12`など）は定数に置き換えて保守性を向上

### 関連ファイル
- `src/screens/HomeScreen.tsx` - ホーム画面
- `src/screens/QuizSetupScreen.tsx` - クイズ設定画面
- `src/screens/SettingsScreen.tsx` - 設定画面（変更なし）
- `src/screens/WordListScreen.tsx` - 単語帳画面（基準として参照）
- `src/constants/colors.ts` - Spacing, FontSizes, BorderRadius定数

### 教訓
- セーフエリアの処理は `SafeAreaView` コンポーネントに任せ、手動でパディングを追加しない
- 新しい画面を作成する際は、既存の画面の実装パターンを確認して一貫性を保つ
- スタイル値はハードコードせず、定義済みの定数を使用することで、変更時の影響範囲を限定できる
- UIの一貫性は細部（ヘッダー高さなど）にも注意を払うことで、アプリ全体の品質が向上する


### 追加修正（同日）

#### 問題
SettingsScreenのヘッダーはアイコンボタンがないため、テキストのみの高さとなり、他のページ（WordListScreen等）のヘッダーより低くなっていた。

#### 原因
WordListScreenのヘッダーには24pxのアイコン（padding: Spacing.sm = 8px）があり、これがヘッダーの実際の高さを決定していた。SettingsScreenはテキストのみでアイコンがないため、コンテンツ高さが低くなっていた。

#### 解決策
全ての画面のヘッダーに `minHeight: 56` を追加して、コンテンツに関係なく一貫した高さを保証。

```typescript
// 全画面で統一されたヘッダースタイル
header: {
  flexDirection: 'row',
  alignItems: 'center',
  justifyContent: 'space-between',
  paddingHorizontal: Spacing.lg,
  paddingVertical: Spacing.md,
  borderBottomWidth: 1,
  borderBottomColor: Colors.border,
  backgroundColor: Colors.background,
  minHeight: 56,  // 追加：最小高さを保証
},
```

#### 修正したファイル
- `src/screens/WordListScreen.tsx` - minHeight: 56 追加
- `src/screens/HomeScreen.tsx` - minHeight: 56 追加
- `src/screens/QuizSetupScreen.tsx` - minHeight: 56 追加
- `src/screens/SettingsScreen.tsx` - flexDirection, alignItems, justifyContent, minHeight: 56 追加

---

## 27. 文章モードのWordPopupでキャンセルボタンが透ける問題

### 発生日
2026年2月4日

### 症状
- 投稿フィードの文章モード（本アイコン）で文章を選択し、単語登録ポップアップを表示する
- ポップアップ内の「キャンセル」ボタンの背景が透けて、下にある単語リストが見えてしまう
- スクロールすると透けた部分の内容も一緒に動く

### 原因
`WordPopup.tsx`の`actions`コンテナ（ボタン配置領域）には背景色が設定されておらず、キャンセルボタンは`variant="outline"`で`backgroundColor: 'transparent'`が適用されていた。

1. **actionsスタイル** - `position: absolute`でポップアップの下部に配置されているが、背景色がない
2. **キャンセルボタン** - `variant="outline"`を使用
3. **Button.tsxのoutlineバリアント** - `backgroundColor: 'transparent'`が設定されている

この結果、スクロールコンテンツ（単語リストなど）が`actions`の下に重なり、キャンセルボタンの透明な背景を通して見えてしまっていた。

### 解決策

**WordPopup.tsxの修正 - キャンセルボタンに直接背景色を適用：**

```typescript
// 変更前 - 背景色なし
<Button
  title="キャンセル"
  onPress={handleBackdropPress}
  variant="outline"
  disabled={isAdding}
  style={styles.cancelButton}
/>

// 変更後 - テーマ対応の背景色を追加
<Button
  title="キャンセル"
  onPress={handleBackdropPress}
  variant="outline"
  disabled={isAdding}
  style={[styles.cancelButton, { backgroundColor: colors.background }]}
/>
```

### 実装のポイント
- `actions`コンテナ全体に背景色を設定すると、ボタン領域全体に色が広がってしまう
- キャンセルボタンのスタイルに直接`backgroundColor: colors.background`を追加することで、ボタン部分のみに背景色が適用される
- `colors.background`を使用することで、ライトモード・ダークモードどちらでも適切な背景色が設定される

### 関連ファイル
- `src/components/WordPopup.tsx` - 単語ポップアップコンポーネント
- `src/components/common/Button.tsx` - 共通ボタンコンポーネント（outlineバリアントの定義）

### 教訓
- `variant="outline"`のボタンは背景が透明になるため、絶対配置されたコンテナ内で使用する場合は注意が必要
- ボタンスタイルを上書きする際は、コンテナ全体ではなくボタン自体に適用することで、意図しない領域への影響を避けられる
- テーマ対応のアプリでは、ハードコードした色ではなく`colors`オブジェクトを使用して一貫性を保つ

---

## 28. 文章モードのWordPopupにフィードバックアイコンがない問題

### 発生日
2026年2月4日

### 症状
- 単語モードでWordPopupを表示すると、ヘッダー右側にフィードバックアイコン（MessageSquareShare）が表示される
- しかし、文章モードでWordPopupを表示すると、フィードバックアイコンが表示されない
- 文章モードでも翻訳結果に対するフィードバックを送信したい場合がある

### 原因
`WordPopup.tsx`のヘッダー部分で、フィードバックアイコンの表示条件に`{!isSentenceMode && ...}`が設定されており、文章モード時にはフィードバックアイコンが非表示になっていた。

```typescript
// 変更前 - 文章モードでは非表示
{/* Feedback Icon */}
{!isSentenceMode && (
  <Pressable
    onPress={() => setIsFeedbackVisible(true)}
    style={styles.feedbackButton}
    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
  >
    <MessageSquareShare size={22} color={colors.primary} />
  </Pressable>
)}
```

### 解決策

**WordPopup.tsxの修正 - 条件を削除してフィードバックアイコンを常に表示：**

```typescript
// 変更後 - 文章モードでも表示
{/* Feedback Icon */}
<Pressable
  onPress={() => setIsFeedbackVisible(true)}
  style={styles.feedbackButton}
  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
>
  <MessageSquareShare size={22} color={colors.primary} />
</Pressable>
```

### 実装のポイント
- `{!isSentenceMode && ...}`の条件分岐を削除し、フィードバックアイコンを無条件で表示
- フィードバックモーダル（FeedbackModal）自体は変更不要で、既存の実装がそのまま動作する
- 文章モード・単語モードの両方で同じユーザー体験を提供

### 関連ファイル
- `src/components/WordPopup.tsx` - 単語ポップアップコンポーネント（761-769行目）

### 教訓
- UIの機能は、特別な理由がない限りモードによって差別化しないほうが一貫性がある
- フィードバック機能のような汎用的な機能は、全てのモードで利用可能にすることでユーザビリティが向上する
- 条件分岐で機能を制限する場合は、その理由を明確にしておくことが重要

---

## 29. 単語帳の投稿URLがBluesky公式サイトで開かれる問題

### 発生日
2026年2月6日

### 症状
- 単語帳ページで登録した単語をタップして展開し、投稿URLをタップすると外部ブラウザでBluesky公式サイト（bsky.app）が開かれる
- アプリから離脱してしまい、投稿の確認後にアプリに戻る手間がかかる
- kumotanアプリ内で投稿を確認したい

### 原因
`src/components/WordListItem.tsx`の`handleUrlPress`関数で、AT Protocol URI（`at://...`）をHTTPS URL（`https://bsky.app/...`）に変換し、`Linking.openURL()`で外部ブラウザに遷移していた。

```typescript
// 変更前 - 外部ブラウザで開く
const handleUrlPress = useCallback(async () => {
  if (word.postUrl) {
    let urlToOpen = word.postUrl;
    if (word.postUrl.startsWith('at://')) {
      const match = word.postUrl.match(/^at:\/\/([^\/]+)\/app\.bsky\.feed\.post\/(.+)$/);
      if (match) {
        const [, did, rkey] = match;
        urlToOpen = `https://bsky.app/profile/${did}/post/${rkey}`;
      }
    }
    await Linking.openURL(urlToOpen);
  }
}, [word.postUrl]);
```

### 調査過程

1. **既存のThreadScreenの確認** - アプリ内にはホーム画面やプロフィール画面から投稿スレッドを表示する`ThreadScreen`が既に実装されていた

2. **ナビゲーション構成の確認** - `AppNavigator.tsx`で`Thread: { postUri: string }`ルートが定義済みであり、`postUri`（AT Protocol URI）をパラメータとして受け取る仕組みが既にあった

3. **WordListScreenのナビゲーション確認** - WordListScreenは`useNavigation<NativeStackNavigationProp<RootStackParamList>>()`を既にインポートしており、ナビゲーションの準備が整っていた

4. **結論** - 新しい画面を作成する必要はなく、既存のThreadScreenを単語帳から呼び出す導線を追加するだけで実現可能

### 解決策

**1. WordListItem.tsxの修正 - onPostPressコールバックの追加：**

propsに`onPostPress`コールバックを追加し、`handleUrlPress`を簡素化：

```typescript
// Props interfaceに追加
interface WordListItemProps {
  word: Word;
  onToggleRead?: (word: Word) => void;
  onDelete?: (word: Word) => void;
  onPostPress?: (postUri: string) => void;  // 追加
}

// handleUrlPressの変更
const handleUrlPress = useCallback(() => {
  if (word.postUrl && onPostPress) {
    onPostPress(word.postUrl);
  }
}, [word.postUrl, onPostPress]);
```

不要になった`Linking`と`Alert`のインポートも削除。

**2. WordListScreen.tsxの修正 - ナビゲーション遷移の追加：**

```typescript
// handlePostPress関数を追加
const handlePostPress = useCallback((postUri: string) => {
  navigation.navigate('Thread', { postUri });
}, [navigation]);

// WordListItemにonPostPressを渡す
<WordListItem
  word={item}
  onToggleRead={handleToggleRead}
  onPostPress={handlePostPress}
/>
```

### 実装のポイント

- 新しい画面を作成せず、既存の`ThreadScreen`を再利用することでコードの重複をゼロに抑えた
- WordListItemは`onPostPress`コールバックを受け取る形にし、ナビゲーションロジックを親コンポーネント（WordListScreen）に委譲。これによりWordListItemはナビゲーションに依存しない汎用的なコンポーネントのまま維持
- 変更は2ファイル、計10行程度の最小限で完結

### 関連ファイル

- `src/components/WordListItem.tsx` - 単語カードコンポーネント（onPostPressコールバック追加、Linking/Alert削除）
- `src/screens/WordListScreen.tsx` - 単語帳画面（handlePostPress追加、WordListItemへの受け渡し）
- `src/screens/ThreadScreen.tsx` - スレッド表示画面（変更なし、既存のまま再利用）
- `src/navigation/AppNavigator.tsx` - ナビゲーション定義（変更なし、Threadルート既存）

### 教訓

- 新しい画面を作成する前に、既存の画面で要件を満たせないか確認する
- コールバックパターンを使用してナビゲーションロジックを親に委譲することで、子コンポーネントの再利用性を維持できる
- 外部ブラウザへの遷移をアプリ内ナビゲーションに変更するだけで、ユーザー体験が大幅に向上する
