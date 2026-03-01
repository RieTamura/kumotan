# Yahoo! 校正支援API 実装計画書

## 概要

Bluesky 投稿作成モーダルに Yahoo! テキスト解析 Web API（校正支援）を統合し、
日本語投稿の誤字・表記ゆれ・助詞誤りをチェックできる機能を追加する。

---

## 対象 API

| 項目 | 内容 |
|------|------|
| API名 | Yahoo! テキスト解析 Web API - 校正支援 V2 |
| エンドポイント | `https://jlp.yahooapis.jp/KouseiService/V2/kousei` |
| 認証 | Yahoo! **Client ID**（URLパラメータ `?appid=`） |
| プロトコル | JSON-RPC 2.0 (POST) |
| 既存インフラ | `yahooJapan.ts` に Client ID 管理・同パターン API 呼び出し済み |

---

## ユーザーフロー

```
[PostCreationModal 開く]
       │
[テキスト入力]
       │
[ツールバーの SpellCheck ボタンをタップ]
       │
       ├─ Yahoo Client ID 未設定 → Alert「APIキー設定を確認してください」
       ├─ 日本語なし → Alert「日本語テキストが必要です」
       │
       └─ API 呼び出し（ローディングスピナー表示）
              │
              ├─ エラーなし → Alert「問題は見つかりませんでした」
              │
              └─ エラーあり → 校正レビューモードへ
                     │
                     [ProofreadingView 表示]
                     ・エラー箇所: 赤背景ハイライト＋下線（inline Text）
                     ・バナー: 「N件の問題（タップで修正候補を確認）| 編集に戻る」
                     │
                     [エラー箇所をタップ]
                     └─ 修正候補パネルを表示（テキスト直下）
                            │
                            ├─ 候補あり → 候補をタップ → text 更新 → パネル閉じる
                            │             → 残り0件で校正モード自動終了
                            ├─ 候補なし → 「修正候補がありません」表示
                            └─ ✕ボタン  → パネルを閉じる（テキスト変更なし）
```

---

## UI 設計

### 通常モード（TextInput）

```
┌────────────────────────────────────────┐
│ TextInput（通常編集）                   │
└────────────────────────────────────────┘
[🌐 誰でも] [🖼] [🏷] ............ [🔍] [15/300]
                               ↑ SpellCheck2 ボタン
```

### 校正レビューモード（ProofreadingView）

```
┌────────────────────────────────────────┐
│ ⚠ 2件の問題が見つかりました    編集に戻る │  ← バナー
├────────────────────────────────────────┤
│ これは こんにちわ です。               │  ← inline Text（レイアウト崩れなし）
│          ─────────                     │    エラー語: 赤色＋下線
└────────────────────────────────────────┘
┌────────────────────────────────────────┐
│ 修正候補                            ✕ │  ← 修正候補パネル（エラー語タップで出現）
├────────────────────────────────────────┤
│ こんにちは                             │  ← 候補ボタン（タップで適用）
└────────────────────────────────────────┘
[🌐 誰でも] [🖼] [🏷] ............ [🔍*] [15/300]
                               ↑ アクティブ色
```

---

## 実装ファイル一覧

| ファイル | 変更種別 | 内容 |
|---------|---------|------|
| `src/services/dictionary/yahooJapan.ts` | 修正 | `KOUSEI` エンドポイント追加、`ProofreadingSuggestion` 型定義、`checkProofreading()` 関数追加 |
| `src/components/ProofreadingView.tsx` | 新規作成 | テキストセグメントレンダラー（ハイライト＋修正候補） |
| `src/locales/ja/home.json` | 修正 | 校正関連の日本語文言追加 |
| `src/locales/en/home.json` | 修正 | 校正関連の英語文言追加 |
| `src/components/PostCreationModal.tsx` | 修正 | 校正ステート・ハンドラ・UI 統合 |

---

## ProofreadingView 技術仕様

### レンダリング方式

外側の `<Text>` にすべてのセグメントをネストした `<Text>` として配置する。
React Nativeのテキストエンジンがinline flowを処理するため、
`View`をflex-wrap行に混在させたときのレイアウト崩れが発生しない。

```
<Text fontSize=18 lineHeight=28>
  <Text>正常テキスト</Text>               ← 通常セグメント
  <Text                                   ← エラーセグメント
    color="error"
    backgroundColor="errorLight"
    textDecorationLine="underline"
    onPress={() => onSegmentTap(offset, length, suggestions)}
  >
    エラー語
  </Text>
  <Text>正常テキスト続き</Text>
</Text>
```

改行（`\n`）は nested Text内でそのまま機能するため、特別な処理は不要。

### 修正候補パネル

`ProofreadingView` はタップを親（`PostCreationModal`）に通知するのみ。
パネルの表示・適用処理は `PostCreationModal` 側で管理する。

- 候補あり：候補ごとにPressableボタンを表示
- 候補なし：「修正候補がありません」テキストを表示（タップは無効）
- ✕ボタン：パネルを閉じてテキスト変更なし

---

## 状態管理

`PostCreationModal` 内にローカル state として管理する（store への追加不要）。

```typescript
const [isProofreadingMode, setIsProofreadingMode] = useState(false);
const [proofreadingSuggestions, setProofreadingSuggestions] = useState<ProofreadingSuggestion[]>([]);
const [isProofreadingChecking, setIsProofreadingChecking] = useState(false);
```

---

## 修正適用ロジック

1. `text.slice(0, offset) + suggestion + text.slice(offset + length)` でテキスト置換
2. 適用済みサジェスチョンを除去
3. 後続サジェスチョンの `offset` を `diff = suggestion.length - length` で補正
4. 残りサジェスチョンが 0 になったら自動的に校正モードを終了

---

## 工数見積もり

| 作業 | 見積もり |
|------|---------|
| `yahooJapan.ts` への API 追加 | 30分 |
| `ProofreadingView.tsx` 新規作成 | 2時間 |
| i18n 文言追加 | 15分 |
| `PostCreationModal.tsx` 統合 | 2時間 |
| 動作確認・調整 | 1時間 |
| **合計** | **約5〜6時間** |
