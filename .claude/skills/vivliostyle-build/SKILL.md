---
name: vivliostyle-build
description: 本書の PDF / EPUB ビルド基盤（vivliostyle.config.js・css/print.css・css/epub.css とその仕組み）を扱うときに参照する。前付け（表紙・扉・はじめに・目次）の構成、章エントリの追加、目次の自動生成、ルビ変換、段落内改行の処理、縦組み改ページ、EPUB 固有の上書き、ビルド手順を扱う。config やビルド、PDF、EPUB、目次、前書き、CSS に触れる作業の前に読む。
---

# vivliostyle ビルド基盤

原稿は縦書きプレビューで執筆し、**@vivliostyle/cli v11** で A5（148mm×210mm）縦組みの PDF と EPUB にビルドする。原稿の**中身**の書き方は [CLAUDE.md](../../../CLAUDE.md) を見る。このスキルは**ビルド基盤（config と CSS と生成の仕組み）**だけを扱う。

## ビルド手順

```bash
npm run build       # prebuild で .vivliostyle を掃除 → output/book.pdf を生成
npm run preview     # ブラウザで縦組みプレビュー
npm run build-epub  # output/book.epub を生成
```

中間生成物は `.vivliostyle/`（`workspaceDir`）。原稿 `.md` → VFM で HTML 化 → `.vivliostyle/原稿/*.html` → PDF。config や CSS を変えたら、**必ずビルドして生成 HTML を実際に確認する**（`.vivliostyle/原稿/*.html` と `.vivliostyle/publication.json` の `readingOrder`）。

## config の骨格（vivliostyle.config.js）

- `entry: [...]` — **配列の順序がそのまま本の読み順（reading order）**。各章エントリには `title` を明示する（未指定だと本文先頭の見出し＝規約ブロックの「## 軸」が目次に拾われる）。
- `toc: { title:'目次', sectionDepth:0 }` — 目次設定。`sectionDepth:0` は各エントリ1行のみ。1 以上で見出しも展開。**`htmlPath` は指定しない**（目次ソースは前付けファイルが兼ねる。下記）。
- `theme: 'css/print.css'` — 縦組みスタイル。改ページはここが握る（`h1{page-break-before/after:always}` `h2{page-break-before:always}` など）。
- `size: '148mm 210mm'`、`output: output/book.pdf`。
- **版面は上下左右の余白で明示して決める（`@page` の `block-size` と `auto` に頼らない）。** @vivliostyle/cli 11.3 系（core 2.45）では `@page` の `block-size` が縦組みでも「高さ」として扱われ、左右アキが 0 に潰れて版面が紙端まで広がり、地のアキが広がってノンブルが本文に食い込む（11.1.0 では正常）。そのため `@page` で天地のアキ（`margin-top` / `margin-bottom`）を、`@page :left` / `:right` で左右のアキを「判型の幅 − 版面の幅 − 小口/ノドアキ」の calc で明示している。判型・文字サイズ・行数を変えたら、この calc も合わせて直す。
- `copyAsset.excludes` — 原稿が参照しない画像フォルダ（既定は `images/_src`）を workspace へコピーしない（EPUB 肥大化対策。後述）。
- `vfm.replace` — 縦書きエディタのルビ記法を `<ruby>` に変換。`漢字《よみ》`（直前の漢字列を自動親文字化）と `｜親文字《ルビ》`（全角縦棒で親文字開始を明示）。
- `vfm.editPlugins` の hast プラグイン 2つ:
  - `markNoIndent` — 開き括弧で始まる `<p>` に `no-indent` を付け天付きにする。
  - `joinSoftBreaks` — 段落内のソフト改行（VFM が残す `\n`）を詰める。CJK 同士は空白なし連結、英数字境界だけ半角空白を残す。`blockquote`/`pre`/`code`/`.codes` は対象外。
- config が `require` している `unist-util-visit` / `unist-util-visit-parents` / `hast-util-to-string` は package.json に明示している（@vivliostyle/cli の依存と同じメジャーに揃える）。

## 前付け（表紙→扉→はじめに→目次）の仕組み ★重要

**罠**: vivliostyle が自動生成する目次 `toc.html` は `<h1>{config.title}</h1>` ＋ 空 `<nav>` という構造で、**扉（書名ページ）と目次が同一ファイルに同居**する。このため両者の「間」に別ページを差し込めない。

**解決**: 目次のソースを**自作ファイルに差し替える**。`entry` に自分で `path` を指定した `rel:'contents'` エントリを置くと、vivliostyle は**デフォルトの h1 を注入せず**、そのファイルの中身をそのまま使い、中の**空の `<nav role="doc-toc">` にだけ目次を流し込む**（`nav && !nav.hasChildNodes()` のときだけ `<h2>{toc.title}</h2>` ＋リンク一覧を append）。

[原稿/_前書き.md](../../../原稿/_前書き.md) 1ファイルに前付けを順番どおり置いている:

```html
<div class="cover"><img src="../images/cover.jpg" alt="" /></div>  <!-- 任意。表紙 -->
<h1>…書名…</h1>            <!-- 扉。page-break-after:always で1ページ独立 -->
<h2>はじめに</h2>            <!-- page-break-before:always で次ページ -->
（本文）
<nav id="toc" role="doc-toc"></nav>   <!-- 空。ビルド時に目次が注入される -->
```

### 前付けを触るときの注意
- `<nav id="toc" role="doc-toc"></nav>` は**中を空に保つ**（空白・改行も不可。子ノードが1つでもあると目次が注入されない）。消さない。
- 書名 `<h1>` は `config.title` と**手動で一致**させている。config を変えたら前書きファイルの h1 も直す。
- 表紙は `div.cover` → `@page cover`（margin 0・ノンブル無し・版面制限なし）で紙面全体を覆う。

## EPUB ビルド（npm run build-epub）

同じ config・同じ `entry` 順で EPUB を出す。PDF と違う点は script 側のオプションだけ:

```
vivliostyle build -o "output/book.epub" -f epub --reading-progression rtl \
  -T css/print.css css/epub.css
```

- `--reading-progression rtl` … opf に `page-progression-direction="rtl"`。縦組み和書のページ送り（右→左）。
- `-T css/print.css css/epub.css` … テーマを2枚重ねる。**EPUB 専用の上書きは [css/epub.css](../../../css/epub.css) に書く**（print.css は PDF の版面設計なので EPUB のために触らない）。
- **EPUB は workspace にコピーされた資産を全部同梱する**。原稿が参照しない元画像・旧版は `copyAsset.excludes` で除外する（PDF は使用画像しか埋め込まないので影響なし）。

### EPUB では何が効かないか
EPUB はリフロー型なので、print.css のうち **`@page` 一式（版面 `block-size`・マージン・ノンブル・改ページ）は全て無効**。`css/epub.css` は次の2点を肩代わりする:

1. **縦組みを確実に効かせる** — 多くのリーダは古い WebKit ベースで、`-epub-writing-mode` / `-webkit-writing-mode` のプレフィックスが無いと `writing-mode` を無視する（html にも指定する）。`text-orientation` は**指定しない**（欧文が1字ずつ正立して縦積みになる）。
2. **絶対長を相対値へ** — print.css は字送りを `Q`（1/4mm）、行長を「42字」で固定している。EPUB では `16Q → 1rem` と読み替えて比率を維持し、行長（縦組みでは `inline-size`／`height`）は `auto` にして画面高に流す。

### 縦組みでの %（つまずきどころ）
縦組みでは **inline 方向＝縦、block 方向＝横**。`width` / `max-width` はブロック方向＝ページ送りの軸にあたり、長さが不定になるため **% が解決されず効かない**。「画像をページいっぱいに」は **`height:100%`** で指定し、横幅は縦横比に任せる。`<img width="…">` 属性は `width:auto` で無効化する。

### 天地の余白（@page が無くても制御できる）
**ページの天地の余白は body の物理 `padding-top` / `padding-bottom` で制御できる**（縦組みではインライン方向なので、どのページのどの行にも効く）。`padding-left` / `padding-right` はブロック方向＝ページ送りの軸なので、流れの最初と最後に一度きりしか効かない。ルビが密な blockquote は天地 padding を print.css の `1em` から `1.5em` に広げている。

### リーダ実装の差
- `transform` 未対応のリーダがある。print.css は問いかけ枠（`div.question::before`）の飾り「Q」を `rotate(-90deg)` で正立させているが、epub.css では transform を外し **`text-orientation: upright`（`-epub-` 付き）で正立**させる。
- transform を外すと `translate` の位置補正も消えるので物理オフセットに置き換える: `translate(-50%)` → `margin-left: -0.5em`、Y → `top`。
- 新しい CSS を足すときは、まずプレフィックス付きの旧 WebKit 系プロパティが無いか確認する。

確認は、生成物を展開して xhtml をブラウザで開けばよい（`unzip` → `EPUB/原稿/*.xhtml`）。最終確認は実機のリーダで行う。

## 章を増やすとき
- 原稿ファイルに中身が入ったら、`entry` 配列に `{ path:'原稿/NN 章名.md', title:'第N章　章名' }` を読み順の位置に追加する。**中身の無いファイルは entry に入れない**（空ページになる）。
- `title` は必ず付ける（前述の見出し誤爆回避）。
- 追加後はビルドして、`publication.json` の `readingOrder` と生成 HTML を確認する。
