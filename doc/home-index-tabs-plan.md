# ホーム画面 インデックスタブUI 実装計画書

## 1. 目的
ホーム画面の上部にファイルインデックス風のタブUIを導入し、フィード切り替えとプロフィールアクセスをより直感的に行えるようにする。紙のインデックスカードのようなビジュアルデザインにより、ユーザーに親しみやすいインターフェースを提供する。

## 2. デザインコンセプト

### ビジュアルイメージ
```
        ┌───────────┐   ┌───┐
        │ Following │   │ ● │  ← アバター画像（丸型）
    ────┴───────────┴───┴───┴─────────────────
    │                                         │
    │           タイムラインコンテンツ           │
    │             (PostCard 一覧)              │
    │                                         │
```

### デザイン特徴
- **インデックス形状**: 上部に突き出したタブ形状（角丸）
- **重なり表現**: 選択タブが前面、非選択タブが背面に見える立体感
- **紙の質感**: 微妙な影とグラデーションでクラフト紙風の印象
- **シームレスな接続**: 選択タブとコンテンツエリアが同一面で繋がる

### タブ構成（Phase 1）
| タブ | 内容 | アイコン |
|------|------|---------|
| Following | フォロー中ユーザーのタイムライン | なし（テキストのみ） |
| プロフィール | ログインユーザーのプロフィール表示 | アバター画像（丸型） |

## 3. 実装方針

### 構成要素
1. **IndexTabs コンポーネント**: タブのビジュアルとタップ操作を管理
2. **HomeScreen の拡張**: タブ切り替えによるコンテンツ切り替え
3. **ProfileView コンポーネント**: プロフィール表示用の新規コンポーネント
4. **カラーパレットの拡張**: インデックス風カラーの追加

## 4. 実装詳細

### 4.1. インデックスタブコンポーネント（新規）
- **ファイル**: `src/components/IndexTabs.tsx`
- **Props**:
    ```typescript
    interface IndexTabsProps {
      activeTab: 'following' | 'profile';
      onTabChange: (tab: 'following' | 'profile') => void;
      avatarUri?: string;
    }
    ```
- **スタイリング**:
    - `borderTopLeftRadius`, `borderTopRightRadius` でタブ形状
    - `position: 'absolute'` + `zIndex` で重なり表現
    - `shadowOffset`, `shadowOpacity` で立体感
    - 選択タブは `borderBottomWidth: 0` でコンテンツと接続

### 4.2. カラーパレットの拡張
- **ファイル**: `src/constants/colors.ts`
- **追加するカラー**:
    ```typescript
    // ライトモード
    indexTab: {
      active: '#F5F0E8',      // クラフト紙風（選択時）
      inactive: '#E8E3DB',    // 少し暗め（非選択時）
      border: '#D4CFC7',      // タブの境界線
      shadow: 'rgba(0,0,0,0.1)',
    }

    // ダークモード
    indexTab: {
      active: '#2A2A2A',
      inactive: '#1F1F1F',
      border: '#3A3A3A',
      shadow: 'rgba(0,0,0,0.3)',
    }
    ```

### 4.3. ホーム画面の変更
- **ファイル**: `src/screens/HomeScreen.tsx`
- **変更内容**:
    - 状態追加: `const [activeTab, setActiveTab] = useState<'following' | 'profile'>('following')`
    - IndexTabs コンポーネントの配置
    - タブに応じたコンテンツ切り替え（条件レンダリング）

### 4.4. プロフィール表示コンポーネント（新規）
- **ファイル**: `src/components/ProfileView.tsx`
- **内容**:
    - ログインユーザーのプロフィール情報表示
    - `authStore` からユーザー情報を取得
    - Bluesky のプロフィール API を利用
- **表示要素**:
    - アバター画像（大）
    - 表示名
    - ハンドル（@username）
    - フォロー/フォロワー数
    - 自己紹介文

### 4.5. 多言語対応
- **ファイル**: `src/locales/ja/home.json`, `src/locales/en/home.json`
- **追加キー**:
    ```json
    {
      "tabs": {
        "following": "Following",
        "profile": "プロフィール"
      }
    }
    ```

## 5. ステップ・バイ・ステップの作業予定

1. **[Colors]** `colors.ts` にインデックスタブ用カラーを追加
2. **[Component]** `IndexTabs.tsx` を作成（タブUIのみ、タップ動作付き）
3. **[HomeScreen]** `HomeScreen.tsx` にタブ状態と `IndexTabs` を統合
4. **[Profile]** `ProfileView.tsx` を作成（プロフィール表示）
5. **[Integration]** タブ切り替えによるコンテンツ切り替えを実装
6. **[i18n]** 多言語対応の追加
7. **[Test]** ライト/ダークモード両方での動作確認

## 6. 考慮事項

### アニメーション
- タブ切り替え時のフェードまたはスライドアニメーション（`react-native-reanimated` を活用）
- タブタップ時の微妙なスケールエフェクト

### アクセシビリティ
- タブに `accessibilityRole="tab"` を設定
- 選択状態を `accessibilityState={{ selected: true }}` で明示

### パフォーマンス
- プロフィールデータのキャッシュ（頻繁な API 呼び出しを避ける）
- タブ切り替え時のコンテンツ再レンダリング最適化

### 将来の拡張性
- 追加タブ（For You, Discover 等）への対応を考慮した設計
- タブのスクロール対応（タブ数増加時）

## 7. 進捗状況

### Phase 1: 基本実装
- [x] **[Colors]** インデックスタブ用カラーの追加
- [x] **[Component]** `IndexTabs.tsx` の作成
- [x] **[HomeScreen]** タブ状態管理の追加
- [x] **[Profile]** `ProfileView.tsx` の作成
- [x] **[Integration]** タブ切り替え動作の実装
- [x] **[i18n]** 多言語対応

### Phase 2: 改善（オプション）
- [x] **[Cache]** プロフィールデータのキャッシュ機構
- [x] **[Animation]** タブ切り替えアニメーション
- [x] **[UX]** スワイプによるタブ切り替え

---

## 8. 現在の実装状況（コード調査結果）

### 8.1. ホーム画面の実際の構成（`HomeScreen.tsx`）

計画からの主な変更・拡張点：

#### タブ構成の拡張

計画では `following` | `profile` の2タブだったが、現在は3種類のタブキーをサポート：

| タブキー | 内容 |
| --- | --- |
| `following` | フォロー中ユーザーのタイムライン（`FollowingFeedTab`） |
| `customFeed` | カスタムフィード（`CustomFeedTab`、フィード選択時のみ表示） |
| `profile` | ログインユーザーのプロフィール（`ProfileView`） |

タブの順序は `useTabOrderStore` で管理されており、ユーザーがカスタマイズ可能。

#### コンテンツ切り替えの実装

条件レンダリングではなく **`react-native-pager-view`（PagerView）** によるスワイプ式ページング：

```text
SafeAreaView
├── OfflineBanner（ネットワーク切断時バナー）
├── ヘッダー行（IndexTabs + 通知ベルアイコン）
├── PagerView（水平スワイプ）
│   ├── FollowingFeedTab（単語選択機能付き）
│   ├── CustomFeedTab（カスタムフィード選択時のみ）
│   └── ProfileView（自分のプロフィール）
├── スクロールトップFAB（Animated、スクロール量に応じて表示）
├── 投稿作成FAB（Plusアイコン）
├── PostCreationModal
├── WordPopup（英単語選択ポップアップ）
├── ConfirmModal（ブロック・投稿削除確認）
├── ProfilePreviewModal
└── TutorialTooltip
```

#### 主な状態管理

- **`activeTab`**: 現在のタブ（`HomeTabKey` 型）
- **`tabs`**: `useMemo` で生成された `TabConfig[]`（tabOrderに従って並び替え）
- **タブごとのスクロールオフセット**: FAB表示制御に使用
- **FABアニメーション**: `Animated.Value` で透明度・位置をアニメーション
- **Zustand ストア**: `customFeedStore`, `authStore`, `socialStore`, `notificationStore`

---

### 8.2. IndexTabs コンポーネント（`IndexTabs.tsx`）

計画からの主な変更点：

#### TabConfig インターフェース（計画より拡張）

```typescript
interface TabConfig {
  key: string;
  label?: string;
  renderContent?: (isActive: boolean) => React.ReactNode;  // カスタム描画（アバター等）
  onRemove?: () => void;           // 「×」ボタンによるタブ削除
  rowBreak?: boolean;              // ここで行を折り返す
  clipAtEdge?: boolean;            // コンテナ端でクリップ（アバタータブ用）
}
```

#### 2行レイアウト

`rowBreak: true` のタブを境界に **Row 1 / Row 2** の2段構成が可能（現在は1段のみ使用）。

#### AnimatedTab のアニメーション仕様

- **プレスアニメーション**: `scale` 0.95 → 1（spring: damping 15, stiffness 150, mass 0.5）
- **アクティブ高さ**: 非選択36px → 選択44px（interpolate）
- `withSpring` を使用したスムーズなトランジション

#### AvatarTabIcon

プロフィールタブ専用の丸型アバター表示コンポーネント：

- 非選択時：24px、選択時：30px（アニメーションで変化）
- 画像未設定時はプレースホルダー円を表示
- `AVATAR_TAB_CLIP = 17px` でコンテナ右端をクリップ

---

### 8.3. ProfileView コンポーネント（`ProfileView.tsx`）

計画からの主な変更点：

#### Props インターフェース（計画より拡張）

```typescript
interface ProfileViewProps {
  flatListRef?: React.RefObject<FlatList<TimelinePost> | null>;
  onScroll?: (event) => void;
  onReplyPress?: (post) => void;
  onRepostPress?: (post, shouldRepost) => Promise<void>;
  onQuotePress?: (post) => void;
}
```

#### 表示構成（FlatList ベース）

```text
FlatList
├── ListHeaderComponent（プロフィールヘッダー）
│   ├── バナー画像（BANNER_HEIGHT: 120px）
│   ├── アバター画像（AVATAR_SIZE: 80px、バナー上にオーバーラップ）
│   ├── 表示名 + ハンドル（@username）
│   ├── 自己紹介文（URL/ハッシュタグ/メンションのリッチテキスト解析）
│   ├── フォロー中・フォロワー・投稿数（K/Mフォーマット）
│   └── 「My Posts」セクションヘッダー
├── 投稿一覧（PostCard、単語選択機能付き）
├── 空状態メッセージ
└── ページングローダー
```

#### 追加機能

- `useAuthorFeed` による無限スクロール付き投稿フィード
- プルトゥリフレッシュ（プロフィール＋フィード同時更新）
- `tokenizeRichText` による説明文のURL/ハッシュタグ/メンション解析
- 投稿の楽観的削除（`deletedUris` セット管理）
- 単語選択ポップアップ（`WordPopup`）

---

### 8.4. カラーパレット（`colors.ts`）

計画のクラフト紙風カラーからTwitter/Bluesky風のニュートラルカラーに変更：

| カラーキー | ライトモード | ダークモード |
| --- | --- | --- |
| `indexTabActive` | `#FFFFFF`（白） | `#15202B` |
| `indexTabInactive` | `#F7F9FA`（薄グレー） | `#1E2732` |
| `indexTabBorder` | `#E1E8ED` | `#38444D` |
| `indexTabShadow` | `rgba(0,0,0,0.1)` | `rgba(0,0,0,0.3)` |
| `indexTabText` | `#657786`（グレー） | `#8899A6` |
| `indexTabTextActive` | `#14171A`（ほぼ黒） | `#FFFFFF` |

---

### 8.5. 多言語対応（`home.json`）

計画のタブラベル以外にも大幅に拡張済み（ja/en両対応）：

- タブラベル（Following / プロフィール）
- 投稿作成・操作（いいね、リポスト、返信、引用、削除、ブロック）
- 校正機能（`proofreadingButton`, `proofreadingIssuesFound`）
- 英単語選択機能（`wordSelection.*`）
- 通知（`notifications.*`：いいね/リポスト/フォロー/メンション/返信/引用）
- チュートリアル（`tutorial.*`）
- 投稿設定（返信制限、コンテンツ警告）
- エラー・ローディング状態
