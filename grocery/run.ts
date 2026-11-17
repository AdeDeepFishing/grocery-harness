import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { cases, type Case } from "./cases.js";
import { MODEL, bareList, feedback, startLedger, writeLedger, type Ledger } from "./agents.js";
import { listFromLedger, score, verifyLedger, type Row } from "./verify.js";
import { renderReport } from "./report.js";

const MAX_ROUNDS = Number(process.env.MAX_ROUNDS ?? 3);
const OUT = path.resolve(process.env.OUT_DIR ?? "out");

export type CaseResult = {
  id: string;
  title: string;
  mealPlan: string;
  pantry: string;
  bare: { correct: boolean; rows: Row[]; confident: boolean; note: string };
  harness: { correct: boolean; rows: Row[]; rounds: { round: number; problems: string[] }[] };
};

async function runCase(c: Case): Promise<CaseResult> {
  // A. Bare model: one call, then ask it whether it is sure.
  const bare = await bareList(c);
  const bareScore = score(c.expected, bare.list);

  // B. Same model inside the harness: ledger → verify → feed problems back → repeat.
  const messages = startLedger(c);
  const rounds: { round: number; problems: string[] }[] = [];
  let ledger: Ledger | null = null;
  for (let round = 1; round <= MAX_ROUNDS; round++) {
    ledger = await writeLedger(messages);
    const problems = verifyLedger(ledger, c);
    rounds.push({ round, problems });
    if (problems.length === 0) break;
    messages.push(feedback(problems));
  }
  const harnessScore = score(c.expected, listFromLedger(ledger));

  const mark = (ok: boolean) => (ok ? "✓" : "✗");
  console.log(
    `${c.id.padEnd(20)} bare ${mark(bareScore.correct)} (says it is ${bare.confident ? "sure" : "unsure"})   ` +
      `harness ${mark(harnessScore.correct)} (problems per round: ${rounds.map((r) => r.problems.length).join(" → ")})`,
  );
  return {
    id: c.id,
    title: c.title,
    mealPlan: c.mealPlan,
    pantry: c.pantry,
    bare: { ...bareScore, confident: bare.confident, note: bare.note },
    harness: { ...harnessScore, rounds },
  };
}

const only = process.argv[2];
const selected = only ? cases.filter((c) => c.id === only) : cases;
console.log(`Model: ${MODEL} · ${selected.length} case(s) · up to ${MAX_ROUNDS} rounds\n`);

const results = await Promise.all(selected.map(runCase));
const n = results.length;
console.log(`\nModel says it is sure:  ${results.filter((r) => r.bare.confident).length}/${n}`);
console.log(`Bare model correct:     ${results.filter((r) => r.bare.correct).length}/${n}`);
console.log(`With harness correct:   ${results.filter((r) => r.harness.correct).length}/${n}`);

await mkdir(OUT, { recursive: true });
await writeFile(path.join(OUT, "results.json"), JSON.stringify({ model: MODEL, results }, null, 2));
await writeFile(path.join(OUT, "report.html"), renderReport(MODEL, results));
console.log(`\nReport: ${path.join(OUT, "report.html")}`);
