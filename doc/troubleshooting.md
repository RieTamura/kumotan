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
