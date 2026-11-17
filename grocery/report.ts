import type { CaseResult } from "./run.js";
import type { Row } from "./verify.js";

const esc = (s: string) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

function listTable(rows: Row[]): string {
  const body = [...rows]
    .sort((a, b) => Number(a.ok) - Number(b.ok))
    .map((r) => {
      const got = r.got === 0 ? "missing" : `${r.got} ${r.unit}`;
      const why = r.ok ? "" : r.expected === 0 ? "not needed" : `should be ${r.expected} ${r.unit}`;
      return `<tr class="${r.ok ? "" : "bad"}"><td>${esc(r.item)}</td><td class="num">${got}</td><td class="why">${why}</td></tr>`;
    })
    .join("");
  return `<table>${body}</table>`;
}

// One static page for the projector: three numbers, then one card per case.
export function renderReport(model: string, results: CaseResult[]): string {
  const n = results.length;
  const sure = results.filter((r) => r.bare.confident).length;
  const bare = results.filter((r) => r.bare.correct).length;
  const harness = results.filter((r) => r.harness.correct).length;

  const cards = results
    .map((r) => {
      const wrongBare = r.bare.rows.filter((row) => !row.ok).length;
      const wrongHarness = r.harness.rows.filter((row) => !row.ok).length;
      const rounds = r.harness.rounds
        .map((round) => `<span class="pill ${round.problems.length ? "fail" : "pass"}">round ${round.round}: ${round.problems.length} caught</span>`)
        .join(" → ");
      const caught = r.harness.rounds[0]?.problems ?? [];
      return `<section>
  <h2>${esc(r.title)}</h2>
  <details class="src"><summary>Meal plan and pantry notes</summary><div class="cols"><pre>${esc(r.mealPlan)}</pre><pre>${esc(r.pantry)}</pre></div></details>
  <div class="cols">
    <div class="col">
      <h3>Bare model <span class="tag ${r.bare.correct ? "pass" : "fail"}">${r.bare.correct ? "correct" : `${wrongBare} wrong`}</span></h3>
      <p class="quote">${r.bare.confident ? "“Yes, it is correct.”" : "“Not sure.”"} <span>${esc(r.bare.note)}</span></p>
      ${listTable(r.bare.rows)}
    </div>
    <div class="col">
      <h3>With harness <span class="tag ${r.harness.correct ? "pass" : "fail"}">${r.harness.correct ? "correct" : `${wrongHarness} wrong`}</span></h3>
      <p class="quote">${rounds}</p>
      ${listTable(r.harness.rows)}
      ${caught.length ? `<details><summary>What the harness caught in round 1</summary><ul>${caught.map((p) => `<li>${esc(p)}</li>`).join("")}</ul></details>` : ""}
    </div>
  </div>
</section>`;
    })
    .join("");

  return `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Grocery harness report</title>
<style>
  :root { --bg:#fbfaf7; --card:#fff; --ink:#1d1d1f; --mute:#6b6b70; --line:#e6e3dc; --pass:#1f8a5b; --passbg:#e3f4ea; --fail:#c2413a; --failbg:#fbe6e3; --warn:#9a6a00; }
  * { box-sizing:border-box } body { margin:0; background:var(--bg); color:var(--ink); font:17px/1.5 -apple-system,"Helvetica Neue",sans-serif; }
  main { max-width:1080px; margin:0 auto; padding:36px 20px 80px; }
  h1 { font-size:26px; margin:0; } .model { color:var(--mute); margin:4px 0 28px; }
  .hero { display:grid; grid-template-columns:repeat(3,1fr); gap:16px; margin-bottom:36px; }
  .score { padding:20px 22px; border-radius:16px; border:1px solid var(--line); background:var(--card); }
  .score small { display:block; color:var(--mute); font-size:15px; } .score b { font-size:68px; line-height:1.1; font-variant-numeric:tabular-nums; }
  .score.says b { color:var(--warn) } .score.before b { color:var(--fail) } .score.after b { color:var(--pass) }
  section { border-top:1px solid var(--line); padding:24px 0; } h2 { font-size:20px; margin:0 0 10px; }
  h3 { font-size:16px; margin:0 0 6px; display:flex; align-items:center; gap:8px; }
  .cols { display:grid; grid-template-columns:1fr 1fr; gap:20px; } .col { min-width:0; background:var(--card); border:1px solid var(--line); border-radius:14px; padding:16px; }
  .tag, .pill { font-size:13px; font-weight:600; padding:2px 10px; border-radius:999px; } .pass { background:var(--passbg); color:var(--pass); } .fail { background:var(--failbg); color:var(--fail); }
  .quote { margin:0 0 10px; font-size:15px; } .quote span { color:var(--mute); }
  table { width:100%; border-collapse:collapse; font-size:15px; } td { padding:4px 6px; border-top:1px solid var(--line); }
  .num { text-align:right; font-variant-numeric:tabular-nums; white-space:nowrap; } .why { color:var(--fail); font-size:13px; white-space:nowrap; }
  tr.bad td { background:var(--failbg); } tr.bad td:first-child { font-weight:600; }
  details { margin-top:10px; color:var(--mute); font-size:14px; } details.src { margin:0 0 12px; } li { margin:3px 0; }
  pre { margin:8px 0 0; white-space:pre-wrap; font:13px/1.5 ui-monospace,Menlo,monospace; color:var(--ink); background:var(--card); border:1px solid var(--line); border-radius:10px; padding:12px; }
  @media (max-width:720px) { .hero, .cols { grid-template-columns:1fr; } .score b { font-size:52px; } }
</style>
<main>
  <h1>Don't let the agent mark its own homework</h1>
  <p class="model">Grocery list from a meal plan and pantry notes · ${esc(model)} · same model, same prompt rules, ${n} cases</p>
  <div class="hero">
    <div class="score says"><small>Model says “it's correct”</small><b>${sure}/${n}</b></div>
    <div class="score before"><small>Actually correct</small><b>${bare}/${n}</b></div>
    <div class="score after"><small>Correct with the harness</small><b>${harness}/${n}</b></div>
  </div>
  ${cards}
</main></html>`;
}
