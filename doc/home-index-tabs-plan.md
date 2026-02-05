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
- [ ] **[Animation]** タブ切り替えアニメーション
- [ ] **[UX]** スワイプによるタブ切り替え
- [ ] **[Cache]** プロフィールデータのキャッシュ機構
