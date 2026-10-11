#!/usr/bin/env node
// 原稿の本文の裸テキスト文字数を機械的にカウントする。
//
// 除去するもの（本文でない要素）:
//   - <!-- … -->                       HTML コメント
//   - <div class="rule">…</div>        AI 向けの執筆規約（内部メモ）
//   - <div class="comment">…</div>     著者メモ（内部メモ）
//   - <div class="page-image">…</div>  1ページ大の図版（テキストなし）
//   - 見出し（<h1..6>…</h1..6> と Markdown の #… 行）
//   - ルビの読み 《…》（振り仮名は注記なので数えない。親字は残す）
//   - 残りの HTML タグ、HTML エンティティ、空白・改行
//
// 使い方:
//   node .claude/skills/count-manuscript/count.mjs            # 原稿/*.md を集計
//   node .claude/skills/count-manuscript/count.mjs 原稿/*.md  # ファイル指定
//   node .claude/skills/count-manuscript/count.mjs --json     # JSON 出力

import { readFileSync, readdirSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve, join, relative, basename } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
// スキルは .claude/skills/count-manuscript/ にあるのでリポジトリ root は 3 階層上
const REPO_ROOT = resolve(__dirname, "..", "..", "..");
const MANUSCRIPT_DIR = join(REPO_ROOT, "原稿");

function stripToBareText(md) {
  let s = md;
  // HTML コメント（前付けファイル冒頭の説明など）
  s = s.replace(/<!--[\s\S]*?-->/g, "");
  // 規約・著者メモ（内部メモ）。中に ## 見出しを含むが、入れ子の div は置かない前提
  s = s.replace(/<div\s+class="(?:rule|comment)">[\s\S]*?<\/div>/g, "");
  // 図版ブロック
  s = s.replace(/<div\s+class="page-image">[\s\S]*?<\/div>/g, "");
  // HTML 見出しタグ（中のテキストごと）
  s = s.replace(/<h[1-6]\b[^>]*>[\s\S]*?<\/h[1-6]>/g, "");
  // Markdown 見出し行（# … 〜 ###### …）
  s = s.replace(/^\s{0,3}#{1,6}\s.*$/gm, "");
  // ルビの読み（親字は残す）
  s = s.replace(/《[^》]*》/g, "");
  s = s.replace(/｜/g, ""); // 親文字開始マーカー
  // 残りの HTML タグ
  s = s.replace(/<[^>]+>/g, "");
  // よく出る HTML エンティティ
  s = s
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"');
  return s;
}

// 空白（半角・全角スペース、改行、タブ）を除いた文字数（コードポイント単位）
function countChars(text) {
  const noSpace = text.replace(/[\s　]/g, "");
  return [...noSpace].length;
}

function collectTargets(argPaths) {
  if (argPaths.length > 0) {
    return argPaths.map((p) => resolve(p));
  }
  return readdirSync(MANUSCRIPT_DIR)
    .filter((f) => f.endsWith(".md"))
    .sort()
    .map((f) => join(MANUSCRIPT_DIR, f));
}

const args = process.argv.slice(2);
const jsonOut = args.includes("--json");
const paths = args.filter((a) => !a.startsWith("--"));

const files = collectTargets(paths);
const rows = [];
for (const file of files) {
  if (!statSync(file).isFile()) continue;
  const raw = readFileSync(file, "utf8");
  const bare = stripToBareText(raw);
  rows.push({ file, name: basename(file), count: countChars(bare) });
}

const total = rows.reduce((a, r) => a + r.count, 0);

if (jsonOut) {
  console.log(
    JSON.stringify(
      {
        total,
        files: rows.map((r) => ({
          path: relative(REPO_ROOT, r.file),
          count: r.count,
        })),
      },
      null,
      2,
    ),
  );
} else {
  const width = Math.max(...rows.map((r) => r.name.length), 4);
  for (const r of rows) {
    console.log(`${r.name.padEnd(width)}  ${String(r.count).padStart(7)} 字`);
  }
  console.log(`${"-".repeat(width + 11)}`);
  console.log(`${"合計".padEnd(width)}  ${String(total).padStart(7)} 字`);
}
