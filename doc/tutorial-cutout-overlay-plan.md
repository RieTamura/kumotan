# チュートリアル カットアウトオーバーレイ実装計画

## 背景

現在のチュートリアルオーバーレイは全画面を `rgba(0,0,0,0.7)` で覆い、ハイライト領域には青枠のみ表示している。枠の中も暗いままのため、対象のアイコンや単語が見えにくい。

## 目的

ハイライト領域を「切り抜き（カットアウト）」して、対象要素が元の明るさで見えるようにする。

## 方式

**4分割オーバーレイ方式** — ハイライト領域の上・下・左・右に4つの暗いViewを配置し、中央を空ける。

```
┌──────────────────────────┐
│       上エリア（暗）       │
├────┬────────────┬────────┤
│左  │  カットアウト │  右    │
│(暗)│  (透明)      │  (暗)  │
├────┴────────────┴────────┤
│       下エリア（暗）       │
└──────────────────────────┘
```

### 選定理由

- 追加ライブラリ不要（純粋なView配置）
- TutorialTooltip.tsx のみの変更で完結
- 既存の `highlightArea` 座標をそのまま活用可能

## 変更対象

- `src/components/Tutorial/TutorialTooltip.tsx` — 1ファイルのみ

## 実装詳細

### 変更内容

1. 現在の単一オーバーレイ View (`styles.overlay`) を、4つの暗いViewに分割
2. ハイライト領域の中央に青枠Viewはそのまま残す（カットアウト+青枠の併用）
3. `hasValidHighlight` が false の場合は従来通り全画面オーバーレイ

### カットアウト座標の計算

```
highlightArea の padded 座標:
  top    = highlightArea.y - 4
  left   = highlightArea.x - 4
  width  = highlightArea.width + 8
  height = highlightArea.height + 8
  bottom = top + height
  right  = left + width

4つのエリア:
  上: { top: 0, left: 0, right: 0, height: top }
  下: { top: bottom, left: 0, right: 0, bottom: 0 }
  左: { top: top, left: 0, width: left, height: height }
  右: { top: top, left: right, right: 0, height: height }
```

## リスク

- なし（TutorialTooltip内部の変更のみ、外部インターフェース変更なし）
