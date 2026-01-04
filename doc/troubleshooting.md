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
