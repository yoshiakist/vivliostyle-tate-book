// @ts-check
const { visit } = require('unist-util-visit');
const { visitParents } = require('unist-util-visit-parents');
const { toString } = require('hast-util-to-string');

// 行頭が開き括弧の <p> に no-indent クラスを付ける rehype プラグイン。
// 縦組みでは開き括弧が字形自体に行頭アキを持つため、通常の 1 字下げ
// （css の p{text-indent:1em}）を打ち消して天付き（text-indent:0）にする。
// 判定は toString（段落のテキスト内容）で行うので、《ルビ》を含む段落でも
// 先頭文字を正しく見る。
const OPEN_BRACKET = /^[「『（〈《【〔｛“"]/;
const markNoIndent = () => (tree) => {
  visit(tree, 'element', (node) => {
    if (node.tagName !== 'p') return;
    if (!OPEN_BRACKET.test(toString(node).replace(/^\s+/, ''))) return;
    node.properties = node.properties || {};
    const c = node.properties.className || [];
    node.properties.className = [...(Array.isArray(c) ? c : [c]), 'no-indent'];
  });
};

// 段落内のソフト改行を詰める hast プラグイン。
// VFM は空行で <p> を分けるが、段落の中の単なる改行（ソフト改行）は消さず
// テキストに \n を残す。これがレンダリング時に半角スペース1個へ折りたたまれ、
// 縦組みの行内に不要なアキが出る（改行の隣がルビ・約物・英数字だと CSS の
// segment-break 変換規則で詰まらず残るため）。ここでビルド時に除去する。
//   ・CJK 同士の改行  … 空白なしで連結（正しい日本語組版）
//   ・要素境界（ルビ等）に接する改行 … 詰める
//   ・英数字境界の改行 … 半角空白を1つだけ残す（英単語が繋がらないように）
// 引用 <blockquote>（詩・経文など改行に意味がある引用を想定）・コード
// （pre/code・div.codes）は対象外。全角スペース
// （U+3000）や、改行を含まない既存の空白列はそのまま残す。
const CJK = /[\u2E80-\u30FF\u3400-\u9FFF\uF900-\uFAFF\uFF00-\uFFEF]/;
const SKIP_TAGS = new Set(['blockquote', 'pre', 'code']);
const collapseSoftBreaks = (value) => {
  let out = '';
  for (let i = 0; i < value.length; i++) {
    const ch = value[i];
    if (ch !== '\n' && ch !== ' ' && ch !== '\t') {
      out += ch;
      continue;
    }
    // 半角の空白・改行が連続する範囲をまとめて見る（全角スペースは対象外）。
    let j = i;
    let hasNL = false;
    while (j < value.length && (value[j] === '\n' || value[j] === ' ' || value[j] === '\t')) {
      if (value[j] === '\n') hasNL = true;
      j++;
    }
    if (!hasNL) {
      out += value.slice(i, j); // 改行を含まない空白列は触らない
    } else {
      const prev = out[out.length - 1];
      const next = value[j];
      if (prev === undefined || next === undefined) {
        // ノード端（ルビ等の要素境界）に接する改行は詰める
      } else if (CJK.test(prev) && CJK.test(next)) {
        // CJK 同士は空白なしで連結
      } else {
        out += ' '; // 英数字境界だけ半角空白を残す
      }
    }
    i = j - 1;
  }
  return out;
};
const joinSoftBreaks = () => (tree) => {
  visitParents(tree, 'text', (node, ancestors) => {
    if (node.value.indexOf('\n') === -1) return;
    for (const a of ancestors) {
      if (a.tagName && SKIP_TAGS.has(a.tagName)) return;
      const cls = a.properties && a.properties.className;
      if (cls && (Array.isArray(cls) ? cls.includes('codes') : cls === 'codes')) return;
    }
    node.value = collapseSoftBreaks(node.value);
  });
};

/** @type {import('@vivliostyle/cli').VivliostyleConfigSchema} */
const vivliostyleConfig = {
  // 書名。原稿/_前書き.md の扉 <h1> と手動で一致させること。
  title: 'vivliostyle で電子書籍を作るには',
  author: 'Yoshiaki Sato',
  language: 'ja',
  // 縦組み用スタイル（css/print.css を全エントリに適用）
  theme: 'css/print.css',
  // 出力する原稿。配列の順序がそのまま本の読み順になる。
  // 各章には title を明示して目次の見出しに使う（未指定だと本文先頭の見出しが
  // 拾われる。冒頭に AI 向けの規約ブロック <div class="rule"> を置く章では、
  // その中の「## 軸」などが目次に出てしまう）。
  // 中身のない（書きかけの空）ファイルは入れない。空ページになる。
  entry: [
    // 前付け（扉＋はじめに＋目次）。この1ファイルが目次ソースを兼ねる。
    // 末尾の空 <nav role="doc-toc"> に、下の toc 設定に従って目次が注入される。
    // （rel:'contents' なのでこのエントリ名は自動的に「目次」になる。）
    { rel: 'contents', path: '原稿/_前書き.md' },
    { path: '原稿/01 本をコードで組む.md', title: '第一章　本をコードで組む' },
    { path: '原稿/02 原稿の書き方.md', title: '第二章　原稿の書き方' },
    { path: '原稿/03 縦組みの版面.md', title: '第三章　縦組みの版面' },
    { path: '原稿/04 前付けと目次.md', title: '第四章　前付けと目次' },
    { path: '原稿/05 EPUB を出す.md', title: '第五章　EPUB を出す' },
    { path: '原稿/06 AI と書く.md', title: '第六章　AI と書く' },
    { path: '原稿/_おわりに.md', title: 'おわりに' },
  ],
  // 目次の設定。ソースは上の { rel: 'contents' } エントリ（原稿/_前書き.md）が
  // 兼ねるので htmlPath（自動生成先）は指定しない。
  //   title       … nav 内に注入される見出し（<h2>目次</h2>）
  //   sectionDepth… 0 なら各エントリ（章）1 行のみ。1 以上で見出しも展開。
  toc: {
    title: '目次',
    sectionDepth: 0,
  },
  output: [
    {
      path: 'output/book.pdf',
      format: 'pdf',
    },
  ],
  // 中間生成ファイルの置き場所
  workspaceDir: '.vivliostyle',
  // 原稿から参照していない画像（旧版・未圧縮の元画像など）を workspace へ
  // コピーしない。PDF は使用画像だけを埋め込むので影響はないが、EPUB は
  // コピーされた資産をすべて同梱してしまうため、ここで絞る。
  // 例: 元画像を images/_src/ に置き、圧縮した版だけを原稿から参照する運用。
  copyAsset: {
    excludes: ['images/_src'],
  },
  // 版面計算は CSS 側（@page）で行うため、既定の A4 は使わない（A5 判）
  size: '148mm 210mm',
  // VFM は novel-writer のルビ記法 `漢字《よみ》` を解釈しないため、
  // ビルド時に <ruby> へ変換する。
  //   ・｜親文字《ルビ》 … ｜（全角縦棒）で親文字の開始を明示
  //   ・漢字《ルビ》     … 直前の漢字列を親文字として自動検出
  vfm: {
    replace: [
      {
        test: /｜([^《｜]+)《([^》]+)》|([々〆㐀-䶿一-鿿豈-﫿々〆ヶ]+)《([^》]+)》/g,
        match: (result, h) => {
          const base = result[1] ?? result[3];
          const ruby = result[2] ?? result[4];
          return h('ruby', [base, h('rt', ruby)]);
        },
      },
    ],
    // 行頭が開き括弧の段落を天付きにする（上の markNoIndent 参照）。
    editPlugins: (p) => ({ ...p, hastPlugins: [...p.hastPlugins, markNoIndent, joinSoftBreaks] }),
  },
};

module.exports = vivliostyleConfig;
