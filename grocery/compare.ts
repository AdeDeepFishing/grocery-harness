// Reads every out/models/*/results.json and writes one page comparing models:
//   npx tsx grocery/compare.ts
import { readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import type { CaseResult } from "./run.js";

const dir = path.resolve("out/models");
const rows: string[] = [];

for (const name of (await readdir(dir)).sort()) {
  let data: { model: string; results: CaseResult[] };
  try {
    data = JSON.parse(await readFile(path.join(dir, name, "results.json"), "utf8"));
  } catch {
    continue;
  }
  const n = data.results.length;
  const sure = data.results.filter((r) => r.bare.confident).length;
  const bare = data.results.filter((r) => r.bare.correct).length;
  const harness = data.results.filter((r) => r.harness.correct).length;
  const bar = (count: number, cls: string) =>
    `<div class="bar"><i class="${cls}" style="width:${(count / n) * 100}%"></i><b>${count}/${n}</b></div>`;
  rows.push(
    `<tr><td><a href="models/${name}/report.html">${data.model}</a></td><td>${bar(sure, "says")}</td><td>${bar(bare, "before")}</td><td>${bar(harness, "after")}</td></tr>`,
  );
}

const html = `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Grocery harness by model</title>
<style>
  :root { --bg:#fbfaf7; --ink:#1d1d1f; --mute:#6b6b70; --line:#e6e3dc; --pass:#1f8a5b; --fail:#c2413a; --warn:#c9952b; --track:#efece5; }
  body { margin:0; background:var(--bg); color:var(--ink); font:18px/1.5 -apple-system,"Helvetica Neue",sans-serif; }
  main { max-width:1080px; margin:0 auto; padding:40px 20px 80px; } h1 { font-size:28px; margin:0; } p { color:var(--mute); margin:6px 0 28px; }
  .wrap { overflow-x:auto; } table { width:100%; min-width:680px; border-collapse:collapse; }
  th { text-align:left; font-size:15px; color:var(--mute); font-weight:500; padding:8px 12px; }
  td { padding:14px 12px; border-top:1px solid var(--line); } td:first-child { font:15px ui-monospace,Menlo,monospace; } a { color:inherit; }
  .bar { position:relative; height:34px; background:var(--track); border-radius:8px; overflow:hidden; min-width:150px; }
  .bar i { position:absolute; inset:0 auto 0 0; border-radius:8px; } .bar b { position:relative; line-height:34px; padding-left:10px; font-variant-numeric:tabular-nums; }
  .says { background:var(--warn); opacity:.55 } .before { background:var(--fail); opacity:.5 } .after { background:var(--pass); opacity:.55 }
</style>
<main>
  <h1>Same harness, five models</h1>
  <p>Ten meal plans each. Nothing changes between the last two columns except the harness around the model.</p>
  <div class="wrap"><table>
    <tr><th>Model</th><th>Says “it's correct”</th><th>Actually correct</th><th>Correct with the harness</th></tr>
    ${rows.join("\n    ")}
  </table></div>
</main></html>`;

await writeFile(path.resolve("out/models.html"), html);
console.log(`Wrote ${path.resolve("out/models.html")}`);
