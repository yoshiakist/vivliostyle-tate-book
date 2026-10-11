# vivliostyle で電子書籍を作るには

Markdown（VFM）で書いた原稿から、[Vivliostyle](https://vivliostyle.org/) で**縦組みの PDF と EPUB** をつくるための書籍テンプレートです。

このリポジトリの原稿そのものが、『vivliostyle で電子書籍を作るには』という短い解説書になっています。本に書いてある仕組みで、その本自身が組まれています。

## 特徴

- **縦組み・A5 判**の版面を、文字サイズ（Q）× 字数 × 行数から積み上げて設計した印刷用 CSS
- **前付け（表紙・扉・はじめに・目次）**を1ファイルで自由に組める構成（自動目次の「扉と目次が同居する」問題を回避）
- 縦書きエディタで一般的な**ルビ記法 `漢字《よみ》`** をビルド時に `<ruby>` へ変換
- 縦組みで隙間の原因になる**段落内のソフト改行**をビルド時に詰める処理、開き括弧で始まる段落の**自動天付き**
- **EPUB 用の上書き CSS**（古い WebKit 系リーダ向けのプレフィックス、絶対長→相対値、縦組みの % の罠への対処、`transform` 非対応リーダ対策）
- **AI エージェント向けの執筆規約**を原稿の中に置き、CSS で非表示にする仕組み（`<div class="rule">`）と、AI 向けの指示書（`CLAUDE.md`・`.claude/skills/`）

## 使い方

```bash
npm install
npm run build        # output/book.pdf
npm run build-epub   # output/book.epub
npm run preview      # ブラウザでプレビュー
npm run count        # 章ごとの本文文字数
```

Node.js が必要です（`@vivliostyle/cli` v11）。本文書体は Google Fonts から読み込むため、ビルドにはネットワーク接続が必要です。

## ディレクトリ構成

```
vivliostyle-tate-book/
├─ 原稿/                       ← 原稿（VFM）。entry の並びが読み順
│   ├─ _前書き.md              ← 前付け（表紙・扉・はじめに・目次）。目次ソースを兼ねる
│   ├─ 01 本をコードで組む.md
│   ├─ … 06 AI と書く.md
│   └─ _おわりに.md
├─ css/
│   ├─ print.css               ← 印刷用（縦組み・A5・版面・ノンブル・部品の見た目）
│   └─ epub.css                ← EPUB 用の上書き（build-epub のときだけ重ねる）
├─ images/                     ← 原稿から参照する画像（元画像は images/_src/ に置けば EPUB に同梱されない）
├─ vivliostyle.config.js       ← 書名・章の並び・目次・ルビ変換・ビルド時の下ごしらえ
├─ CLAUDE.md                   ← AI エージェント向け: 原稿の形式・規約ブロック・文体
└─ .claude/skills/
    ├─ vivliostyle-build/      ← AI エージェント向け: ビルド基盤の仕組みと罠
    └─ count-manuscript/       ← 本文文字数のカウント
```

## 自分の本に使うには

1. `vivliostyle.config.js` の `title` / `author` と、`原稿/_前書き.md` の扉 `<h1>` を書き換える（書名は2か所で手動一致）。
2. `原稿/` の章ファイルを自分の原稿に差し替え、`entry` 配列を読み順に並べる。各エントリに `title` を明示する。
3. 判型や字数を変えたいときは `css/print.css` の `@page` と `p` の数値を変える。
4. 表紙画像を使うなら、`原稿/_前書き.md` の `<h1>` の前に `<div class="cover"><img src="../images/cover.jpg" alt="" /></div>` を置く。

原稿の書き方（使える部品・空行の作法・規約ブロック）は [CLAUDE.md](CLAUDE.md)、ビルドの仕組みと罠は [.claude/skills/vivliostyle-build/SKILL.md](.claude/skills/vivliostyle-build/SKILL.md) にまとめています。どちらも AI エージェント向けに書いていますが、人間が読んでも手引きになります。

## ライセンス

ISC
