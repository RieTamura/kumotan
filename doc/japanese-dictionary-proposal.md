# 日本語辞書機能の実装提案

## 概要

本ドキュメントは、kumotanアプリに「日本語→日本語」の辞書機能を追加するための技術調査と実装提案をまとめたものです。

**要件:**
- 日本語単語の意味を日本語で表示
- 単語登録時に定義を確認できる
- できればオフライン対応

**調査日:** 2026-01-13

---

## 調査した選択肢

### 1. iOS内蔵辞書（UIReferenceLibraryViewController）

#### 概要
- iOSに組み込まれた辞書機能にアクセス
- モーダルUIで定義を表示

#### メリット
- ✅ 完全無料、APIキー不要
- ✅ Appleが提供する高品質な辞書
- ✅ オフライン動作

#### デメリット
- ❌ **定義テキストを取得できない**（表示のみ）
- ❌ 日本語辞書の利用可否が端末・OSバージョンに依存
- ❌ 現在のWordPopupフローと統合しにくい

#### 実装難易度
★★☆（中）

#### React Nativeライブラリ

- `react-native-reference-library-view`（2023年1月以降更新停止、実質メンテナンス終了）

#### 結論
**補助機能としての実装を推奨**
- 単語詳細画面に「iOS辞書で見る」ボタンを追加
- メイン機能には不適合

---

### 2. 日本語Wiktionary API

#### 概要
- Wikimedia財団が運営する多言語辞書プロジェクト
- MediaWiki APIでアクセス
- 日本語版には名詞84,679項目、動詞17,937項目を収録

#### メリット
- ✅ 完全無料、APIキー不要
- ✅ 日本語→日本語の定義が充実
- ✅ CC BY-SA 3.0ライセンス（商用利用可）
- ✅ オープンソース、継続的に更新

#### デメリット
- ❌ **構造化APIではない**（Wikitext/HTMLのパースが必要）
- ❌ パース処理の実装工数が大きい
- ❌ データ品質にバラつき
- ❌ オンライン接続が必要

#### APIエンドポイント例
```
https://ja.wiktionary.org/w/api.php?action=parse&page=犬&format=json
```

#### 実装アプローチ

**案A: 簡易版（推奨）**
1. MediaWiki APIでHTMLを取得
2. HTMLパーサーで語義セクション（`<ol><li>`）を抽出
3. 最初の定義のみを表示

**案B: 完全版**
1. Wikitextを取得
2. 日本語Wiktionaryのテンプレート構造を解析
3. 品詞、読み、語義、用例を構造化して抽出

#### 実装難易度
★★★☆☆（中〜高）

#### 結論
**オンライン検索機能として実装を推奨**
- 簡易版からスタート
- オフラインDBに見つからない場合のフォールバック

---

### 3. TexTra API（みんなの自動翻訳）

#### 概要
- 国立研究開発法人情報通信研究機構（NICT）が提供
- 機械翻訳サービス

#### メリット
- ✅ 非商用利用は無料
- ✅ 国産サービスで安定性が高い
- ✅ OAuth認証対応

#### デメリット
- ❌ **翻訳APIであり、国語辞典ではない**
- ❌ 日本語→日本語の定義を返す機能はない
- ❌ 商用利用は有料（月額5,000円〜）
- ❌ OAuth認証の実装が必要

#### 辞書引きAPI
- ユーザー登録した用語集（glossary）を使った翻訳支援
- 英日・日英の対訳には有効
- **日本語の語義説明には使えない**

#### 実装難易度
★★☆（中）

#### 結論
**今回の要件には不適合**
- DeepLの代替として検討可能（Phase 2）
- 日本語辞書機能には使用不可

---

### 4. オフライン辞書データベース（SQLite）★推奨★

#### 概要
- Wiktionary/JMdictのダンプデータをSQLiteに変換
- アプリにバンドルして配布
- expo-sqliteで読み込み

#### アーキテクチャ
```
[事前準備]
Wiktionary/JMdict XMLダンプ
    ↓ 変換・構築
SQLiteデータベース (dictionary.db)
    ↓ アプリにバンドル
[アプリ内]
expo-sqlite で読み込み → 高速検索 → UI表示
```

#### データソース

**A. 日本語Wiktionary ダンプ**
- 提供元: Wikimedia Foundation
- URL: https://dumps.wikimedia.org/jawiktionary/
- ライセンス: CC BY-SA 3.0
- 収録数: 約40万項目
- 形式: XML
- 内容: 日本語→日本語の語義、品詞、読み、用例

**B. JMdict**
- 提供元: Electronic Dictionary Research and Development Group
- ライセンス: CC BY-SA 3.0
- 収録数: 214,000項目以上
- 内容: 日英辞書（日本語の読みや語義も含む）
- 制約: 主に翻訳用、日本語→日本語の定義は限定的

**C. Kaikki.org（処理済みWiktionary）**
- URL: https://kaikki.org/dictionary/rawdata.html
- 形式: JSON（機械可読形式）
- メリット: パース処理が不要

#### メリット
- ✅ **完全オフライン動作**
- ✅ **超高速検索**（数ミリ秒）
- ✅ レート制限なし
- ✅ APIキー不要
- ✅ 完全無料・商用利用可
- ✅ プライバシー保護（外部通信なし）

#### デメリット
- ❌ アプリサイズ増加（10〜100 MB）
- ❌ データベース構築の工数が大きい
- ❌ データ更新は手動（アプリリリース時）
- ❌ データ品質のバラつき

#### ファイルサイズ試算

| データソース | 項目数 | 推定サイズ |
|------------|-------|----------|
| 日本語Wiktionary（全項目） | 約40万 | 80〜100 MB |
| 日本語Wiktionary（頻出5万語） | 5万 | 10〜15 MB |
| JMdict（日英辞書） | 21万 | 30〜40 MB |

#### 実装例（Expo SQLite）

```typescript
// assets/dictionary.db を配置

import { SQLiteProvider, useSQLiteContext } from 'expo-sqlite';

export default function App() {
  return (
    <SQLiteProvider
      databaseName="dictionary.db"
      assetSource={{ assetId: require('./assets/dictionary.db') }}
    >
      <YourApp />
    </SQLiteProvider>
  );
}

// 辞書検索（コンポーネント内で使用）
export function useLookupJapaneseWord() {
  const db = useSQLiteContext();
  
  const lookupWord = async (word: string): Promise<DictionaryEntry | null> => {
    const result = await db.getFirstAsync(
      'SELECT * FROM dictionary WHERE word = ? LIMIT 1',
      [word]
    );
    return result ? parseDictionaryEntry(result) : null;
  };
  
  return lookupWord;
}

// 辞書検索（DBインスタンスを渡す）
export async function lookupJapaneseWord(
  db: SQLiteDatabase, 
  word: string
): Promise<DictionaryEntry | null> {
  const result = await db.getFirstAsync(
    'SELECT * FROM dictionary WHERE word = ? LIMIT 1',
    [word]
  );
  return result ? parseDictionaryEntry(result) : null;
}

#### データベーススキーマ例

```sql
CREATE TABLE dictionary (
   id INTEGER PRIMARY KEY,
   word TEXT NOT NULL,
   reading TEXT,
   part_of_speech TEXT,
   definition TEXT,
   examples TEXT,
 );
 
 CREATE INDEX idx_word ON dictionary(word);
 CREATE INDEX idx_reading ON dictionary(reading);
```

#### 実装難易度
★★★★☆（高）

#### 構築ステップ

1. **データダウンロード**
   ```bash
   pip install wiktextract
   wiktwords --language ja \
     --out data.json \
     jawiktionary-latest-pages-articles.xml.bz2
   ```

2. **JSONからSQLiteへの変換**
   - カスタムPythonスクリプトでdata.jsonを読み込み
   - SQLiteデータベースに変換・挿入

3. **SQLite変換**
   - カスタムスクリプトでJSON → SQLite変換
   - 頻出5万語を抽出

4. **Expoアプリへの組み込み**
   - `assets/dictionary.db`に配置
   - SQLiteProviderで読み込み

#### 結論
**最も推奨されるアプローチ**
- ユーザー体験が最高（オフライン・高速）
- 初期工数は大きいが、長期的にメリット大

---

### 5. ATProtocol/PDS（検討したが非推奨）

#### 概要
- 各ユーザーがPersonal Data Server（PDS）を持つ
- カスタムLexiconで辞書スキーマを定義
- ユーザーのリポジトリに辞書データを保存？

#### 重大な制約

**1. データの所在問題**
- ATProtocolのPDSは個人データ用に設計
- 各ユーザーに40万項目の辞書をコピー？
- ストレージを大量消費

**2. オフライン動作不可**
- PDSへのアクセスはネットワーク必須
- `@atproto/api`はHTTPリクエスト
- オフライン辞書のメリットが失われる

**3. 検索パフォーマンス**
- `listRecords`は全レコード取得 → クライアント側フィルタ
- インデックス検索なし
- 40万項目を毎回取得？

**4. 設計思想との不一致**
- ATProtocol: ユーザーが作成したコンテンツ用
- 辞書データ: 静的・読み取り専用・全ユーザー共通

#### 結論
**辞書データベースとしては不適合**

#### ATProtocolの正しい活用例

以下のような機能には最適：
- 学習記録の共有（`io.kumotan.learning.session`）
- 単語リストの公開（`io.kumotan.wordlist.collection`）
- 学習チャレンジ（`io.kumotan.challenge.participation`）

```typescript
// 学習セッション記録をPDSに保存
await agent.api.com.atproto.repo.createRecord({
  repo: agent.session?.did,
  collection: 'io.kumotan.learning.session',
  record: {
    date: '2026-01-13',
    wordsLearned: 25,
    timeSpent: 1800,
    achievement: '10日連続達成！',
    visibility: 'public',
    createdAt: new Date().toISOString(),
    $type: 'io.kumotan.learning.session',
  },
});
```

---

## 総合比較

| 項目 | iOS辞書 | Wiktionary API | TexTra | **SQLite DB** | ATProtocol |
|------|---------|----------------|--------|--------------|-----------|
| **日本語→日本語** | △ | ✅ | ❌ | ✅ | ✅ |
| **料金** | 無料 | 無料 | 無料/有料 | 無料 | 無料 |
| **オフライン** | ✅ | ❌ | ❌ | **✅** | ❌ |
| **検索速度** | 高速 | 中速 | 中速 | **超高速** | 低速 |
| **実装難易度** | ★★ | ★★★ | ★★ | ★★★★ | ★★★★★ |
| **データ取得** | 不可 | 可能 | 不可 | 可能 | 可能 |
| **アプリサイズ** | 0 MB | 0 MB | 0 MB | **10-15 MB** | 0 MB |
| **適合性** | △ | ⭐⭐⭐⭐ | ❌ | **⭐⭐⭐⭐⭐** | ❌ |

---

## 最終推奨：ハイブリッドアプローチ

### アーキテクチャ

**Tier 1: オフライン辞書DB（コア機能）**
- 頻出5万語をSQLiteにバンドル（10〜15 MB）
- 高速・オフラインで動作
- 90%以上のユースケースをカバー

**Tier 2: Wiktionary APIフォールバック**
- オフラインDBに見つからない場合
- ネットワークがある時のみオンライン検索
- キャッシュに保存（オプション）

**Tier 3: iOS辞書（補助機能）**
- 単語詳細画面に「辞書で調べる」ボタン
- より詳しい情報を見たい場合に利用

### 実装フロー

```typescript
async function lookupJapaneseWord(word: string) {
  // 1. ローカルDBを検索（高速・オフライン）
  const localResult = await offlineDB.lookup(word);
  if (localResult) return localResult;

  // 2. ネットワークがあればWiktionary API
  if (isOnline) {
    const onlineResult = await wiktionaryAPI.lookup(word);
    if (onlineResult) {
      // オプション: キャッシュに保存
      await offlineDB.cache(word, onlineResult);
      return onlineResult;
    }
  }

  // 3. 見つからない
  return null;
}
```

---

## 実装ロードマップ

### Phase 1: オフライン辞書DB（MVP）
**優先度: 高**

1. **データベース構築ツール作成**
   - Wiktionaryダンプのダウンロード
   - 頻出5万語の抽出ロジック
   - SQLite変換スクリプト
   - 工数: 2〜3週間

2. **Expoアプリへの統合**
   - `expo-sqlite`で辞書DBをバンドル
   - 検索機能の実装（`src/services/dictionary/offline.ts`）
   - 工数: 3〜5日

3. **UI統合**
   - WordPopupコンポーネントに統合
   - 日本語単語検出時に辞書検索
   - 工数: 2〜3日

### Phase 2: Wiktionary APIフォールバック
**優先度: 中**

1. **簡易パーサー実装**
   - MediaWiki API呼び出し
   - HTMLから語義抽出
   - 工数: 1週間

2. **フォールバック機能**
   - オフラインDB → オンラインAPI
   - キャッシュ機構（オプション）
   - 工数: 3日

### Phase 3: iOS辞書統合（オプション）
**優先度: 低**

1. **UIReferenceLibraryViewController統合**
   - React Nativeブリッジ作成
   - 単語詳細画面にボタン追加
   - 工数: 2〜3日

### Phase 4: ソーシャル機能（ATProtocol活用）
**優先度: 低**

1. **学習記録の共有**
   - カスタムLexicon定義
   - 学習セッション記録機能
   - 工数: 1〜2週間

2. **単語リスト共有**
   - 公開単語リスト機能
   - インポート機能
   - 工数: 1〜2週間

---

## 技術的考慮事項

### データベース構築時の注意点

1. **頻出語の選定基準**
   - BCCWJ（現代日本語書き言葉均衡コーパス）の頻度データ
   - JLPT出題単語リスト
   - アプリユーザーの検索履歴（将来的に）

2. **データクリーニング**
   - 重複エントリの削除
   - 定義文の正規化
   - 不適切な内容のフィルタリング

3. **インデックス最適化**
   - `word`カラムにINDEX
   - `reading`カラムにもINDEX（平仮名検索用）
   - UNIQUE制約で重複防止

4. **文字コード**
   - UTF-8で統一
   - 異体字の正規化（「竈」→「釜」など）

### パフォーマンス最適化

1. **全文検索**
   - SQLite FTS5（Full-Text Search）の活用
   - 前方一致・部分一致検索

   **注意:** FTS5拡張はネイティブSQLiteに組み込まれた機能であり、カスタムビルド（`expo prebuild`、EAS Build、またはベアワークフロー）が必須です。Expo Goのプリビルト環境では動作しません。Expo Goをサポートする必要がある場合、JavaScriptベースのフィルタリングを代替案として検討してください。

2. **遅延ロード**
   - 用例は初回表示時に取得
   - 画像・音声は別テーブル

3. **圧縮**
   - データベースファイルの圧縮
   - gzipで配布 → 起動時に解凍（オプション）

### ライセンス遵守

**CC BY-SA 3.0の要件:**
- アプリ内に帰属表記（About画面など）
- データソースのクレジット表記
- 同じライセンスで派生物を配布

**表記例:**
```
本アプリの日本語辞書データは、Wikimedia Foundationの
日本語版Wiktionaryを利用しています。

データソース: https://ja.wiktionary.org/
ライセンス: CC BY-SA 3.0
```

---

## まとめ

**日本語辞書機能の実装には、オフライン辞書データベース（SQLite）を推奨します。**

### 採用理由
1. ✅ 完全オフライン動作（最高のUX）
2. ✅ 超高速検索（APIの100倍以上）
3. ✅ レート制限・APIキーなし
4. ✅ プライバシー保護
5. ✅ 長期的なコスト削減

### トレードオフ
- ⚠️ アプリサイズ +10〜15 MB
- ⚠️ 初期実装工数 2〜3週間
- ⚠️ データ更新は手動

### ハイブリッドアプローチの利点
- コア機能はオフライン（5万語）
- 拡張機能はオンライン（Wiktionary API）
- 補助機能でiOS辞書
- 将来的にATProtocolでソーシャル機能

**この組み合わせにより、オフライン・高速・包括的な日本語辞書機能が実現できます。**

---

## 参考資料

### 技術ドキュメント
- [Expo SQLite Documentation](https://docs.expo.dev/versions/latest/sdk/sqlite/)
- [MediaWiki API: Parsing wikitext](https://www.mediawiki.org/wiki/API:Parsing_wikitext)
- [JMdict Project](https://www.edrdg.org/jmdict/j_jmdict.html)
- [ATProtocol Lexicon Specification](https://atproto.com/specs/lexicon)

### データソース
- [日本語Wiktionary ダンプ](https://dumps.wikimedia.org/jawiktionary/)
- [Kaikki.org - 処理済みWiktionaryデータ](https://kaikki.org/dictionary/rawdata.html)
- [JMdict ダウンロード](https://www.edrdg.org/jmdict/edict_doc.html)

### ツール・ライブラリ
- [wiktextract - Wiktionaryパーサー](https://github.com/tatuylonen/wiktextract)
- [react-native-sqlite-storage](https://github.com/andpor/react-native-sqlite-storage)
- [@atproto/api](https://www.npmjs.com/package/@atproto/api)

### コミュニティ
- [ATProtocol Community](https://discourse.atprotocol.community/)
- [Expo Forums](https://forums.expo.dev/)

---

**作成日:** 2026-01-13
**最終更新日:** 2026-01-14
**作成者:** Claude (Anthropic)
**バージョン:** 1.1

---

## 実装決定（2026-01-14）

### ユーザー決定事項

**採用アプローチ**: ✅ **ハイブリッド方式（Tier 1-2）**

1. ✅ **アプリサイズ増加**: 10-15 MB増加を許容（オフライン辞書DB採用）
2. ✅ **実装時期**: v1.0.0リリース後すぐに実装開始
3. ✅ **実装範囲**: Phase 1-2（オフラインDB + Wiktionary APIフォールバック）

### 確定スケジュール

```
Week 1-2: v1.0.0リリース準備
  → TypeScript型エラー修正
  → M3 Phase 2完成（エラーハンドリング、トースト、SettingsScreen）
  → TestFlight配信

Week 3-6: v1.1.0日本語辞書実装（Phase 1）
  → DB構築ツール作成（2-3週間）
  → Expoアプリ統合（3-5日）
  → UI統合（2-3日）
  → v1.1.0 TestFlight配信

Week 7-8: v1.1.1 Wiktionary APIフォールバック（Phase 2）
  → 簡易パーサー実装（1週間）
  → フォールバック機能（3日）
  → v1.1.1リリース
```

### 期待される成果

- **Week 2終了時**: v1.0.0 App Password専用版リリース
- **Week 6終了時**: v1.1.0 日本語辞書MVP版リリース（オフライン）
- **Week 8終了時**: v1.1.1 日本語辞書完全版リリース（オフライン+オンライン）

### ユーザー体験の向上

- **英語単語**: Free Dictionary API + DeepL翻訳（既存機能）
- **日本語単語**: オフライン辞書DB（90%カバー）→ Wiktionary API（残り10%）
- **特長**: 完全オフライン対応、超高速検索（数ミリ秒）、プライバシー保護

### 次のステップ

1. v1.0.0リリース準備のテスト修正から実装開始
2. リリース後、DB構築ツールの作成に着手
3. 段階的リリース（v1.1.0 MVP → v1.1.1 完全版）

---
